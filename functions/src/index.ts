import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

const REGION = process.env.FUNCTIONS_REGION || "northamerica-northeast2";
setGlobalOptions({ region: REGION });

type PublicScene =
  | { type: "story"; title: string; body: string; nextSceneId?: string }
  | { type: "code_entry"; title: string; prompt: string; nextSceneId?: string }
  | {
      type: "choice";
      title: string;
      prompt: string;
      options: { id: string; label: string }[];
      nextSceneId?: string;
    };

function requireAuth(request: any) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  return request.auth.uid as string;
}

export const startEpisode = onCall(async (request) => {
  const uid = requireAuth(request);
  const { episodeId } = request.data ?? {};
  if (!episodeId)
    throw new HttpsError("invalid-argument", "Missing episodeId.");

  const episodeRef = db.doc(`episodes/${episodeId}`);
  const episodeSnap = await episodeRef.get();
  if (!episodeSnap.exists)
    throw new HttpsError("not-found", "Episode not found.");

  const episode = episodeSnap.data() as any;
  if (!episode.isPublished) {
    throw new HttpsError("permission-denied", "Episode is not published.");
  }

  const startSceneId = episode.startSceneId as string;
  if (!startSceneId) {
    throw new HttpsError(
      "failed-precondition",
      "Episode missing startSceneId.",
    );
  }

  const progressRef = db.doc(`progress/${uid}/episodes/${episodeId}`);
  const progressSnap = await progressRef.get();

  if (!progressSnap.exists) {
    await progressRef.set({
      episodeId,
      currentSceneId: startSceneId,
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      completedSceneIds: [],
      isCompleted: false,
      completedAt: null,
    });
    return { currentSceneId: startSceneId, isCompleted: false };
  }

  const progress = progressSnap.data() as any;
  return {
    currentSceneId: progress.currentSceneId ?? startSceneId,
    isCompleted: !!progress.isCompleted,
  };
});

export const submitAction = onCall(async (request) => {
  const uid = requireAuth(request);
  const { episodeId, sceneId, action } = request.data ?? {};

  if (!episodeId || !sceneId || !action) {
    throw new HttpsError(
      "invalid-argument",
      "Missing episodeId/sceneId/action.",
    );
  }

  const progressRef = db.doc(`progress/${uid}/episodes/${episodeId}`);
  const progressSnap = await progressRef.get();
  if (!progressSnap.exists) {
    throw new HttpsError(
      "failed-precondition",
      "Progress not started. Call startEpisode first.",
    );
  }

  const progress = progressSnap.data() as any;
  if (progress.isCompleted) return { isCompleted: true, nextSceneId: null };

  if (progress.currentSceneId !== sceneId) {
    throw new HttpsError(
      "failed-precondition",
      `Not on this scene. Current is ${progress.currentSceneId}.`,
    );
  }

  const sceneRef = db.doc(`episodes/${episodeId}/scenes/${sceneId}`);
  const sceneSnap = await sceneRef.get();
  if (!sceneSnap.exists) throw new HttpsError("not-found", "Scene not found.");

  const scene = sceneSnap.data() as PublicScene;

  // Validation rules per scene type
  if (scene.type === "story") {
    if (action.type !== "continue") {
      throw new HttpsError(
        "invalid-argument",
        "Story requires action.type=continue.",
      );
    }
  }

  if (scene.type === "code_entry") {
    if (action.type !== "code") {
      throw new HttpsError(
        "invalid-argument",
        "Code scene requires action.type=code.",
      );
    }

    const solRef = db.doc(`episodes/${episodeId}/solutions/${sceneId}`);
    const solSnap = await solRef.get();
    if (!solSnap.exists)
      throw new HttpsError("failed-precondition", "Missing solution doc.");

    const expected = ((solSnap.data() as any).answer ?? "").trim();
    const actual = (action.code ?? "").trim();

    if (!expected || actual !== expected) {
      throw new HttpsError("permission-denied", "Wrong code.");
    }
  }

  if (scene.type === "choice") {
    if (action.type !== "choice") {
      throw new HttpsError(
        "invalid-argument",
        "Choice scene requires action.type=choice.",
      );
    }

    const solRef = db.doc(`episodes/${episodeId}/solutions/${sceneId}`);
    const solSnap = await solRef.get();
    if (!solSnap.exists)
      throw new HttpsError("failed-precondition", "Missing solution doc.");

    const expected = ((solSnap.data() as any).correctOptionId ?? "").trim();
    const actual = (action.optionId ?? "").trim();

    if (!expected || actual !== expected) {
      throw new HttpsError("permission-denied", "Wrong choice.");
    }
  }

  const nextSceneId = (scene as any).nextSceneId ?? null;

  // Advance progress
  if (!nextSceneId) {
    await progressRef.update({
      updatedAt: FieldValue.serverTimestamp(),
      completedSceneIds: FieldValue.arrayUnion(sceneId),
      isCompleted: true,
      completedAt: FieldValue.serverTimestamp(),
    });
    return { isCompleted: true, nextSceneId: null };
  }

  await progressRef.update({
    currentSceneId: nextSceneId,
    updatedAt: FieldValue.serverTimestamp(),
    completedSceneIds: FieldValue.arrayUnion(sceneId),
  });

  return { isCompleted: false, nextSceneId };
});

export const restartEpisode = onCall(async (request) => {
  const uid = requireAuth(request);
  const { episodeId } = request.data ?? {};
  if (!episodeId)
    throw new HttpsError("invalid-argument", "Missing episodeId.");

  const episodeRef = db.doc(`episodes/${episodeId}`);
  const episodeSnap = await episodeRef.get();
  if (!episodeSnap.exists)
    throw new HttpsError("not-found", "Episode not found.");

  const startSceneId = (episodeSnap.data() as any).startSceneId as string;
  if (!startSceneId) {
    throw new HttpsError(
      "failed-precondition",
      "Episode missing startSceneId.",
    );
  }

  const progressRef = db.doc(`progress/${uid}/episodes/${episodeId}`);
  await progressRef.set(
    {
      episodeId,
      currentSceneId: startSceneId,
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      completedSceneIds: [],
      isCompleted: false,
      completedAt: null,
    },
    { merge: true },
  );

  return { currentSceneId: startSceneId, isCompleted: false };
});
