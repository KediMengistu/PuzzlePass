import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";

type Episode = {
  title: string;
  startSceneId: string;
};

type SceneBase = {
  title: string;
  nextSceneId?: string;
};

type StoryScene = SceneBase & {
  type: "story";
  body: string;
};

type CodeEntryScene = SceneBase & {
  type: "code_entry";
  prompt: string;
  answer: string; // Phase 2 will remove from client-visible docs (server validation)
};

type ChoiceScene = SceneBase & {
  type: "choice";
  prompt: string;
  options: { id: string; label: string }[];
  correctOptionId: string; // Phase 2 will remove from client-visible docs (server validation)
};

type Scene = StoryScene | CodeEntryScene | ChoiceScene;

type EpisodeProgress = {
  episodeId: string;
  currentSceneId: string;
  completedSceneIds: string[];
  isCompleted: boolean;
  completedAt: any | null;
};

export default function EpisodeRunner() {
  const router = useRouter();
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();

  const [user, setUser] = useState<User | null>(null);
  const [episode, setEpisode] = useState<Episode | null>(null);

  const [progress, setProgress] = useState<EpisodeProgress | null>(null);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);

  const [code, setCode] = useState("");
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Subscribe to episode doc
  useEffect(() => {
    if (!episodeId) return;
    const ref = doc(db, "episodes", episodeId);
    return onSnapshot(ref, (snap) => {
      setEpisode(snap.exists() ? (snap.data() as Episode) : null);
    });
  }, [episodeId]);

  const progressRef = useMemo(() => {
    if (!user?.uid || !episodeId) return null;
    return doc(db, "progress", user.uid, "episodes", episodeId);
  }, [user?.uid, episodeId]);

  // Ensure progress exists, then subscribe to progress
  useEffect(() => {
    if (!progressRef || !episode?.startSceneId) return;

    (async () => {
      const existing = await getDoc(progressRef);
      if (!existing.exists()) {
        await setDoc(progressRef, {
          episodeId,
          currentSceneId: episode.startSceneId,
          startedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          completedSceneIds: [],
          isCompleted: false,
          completedAt: null,
        });
      }
    })();

    return onSnapshot(progressRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;

      const p: EpisodeProgress = {
        episodeId: data.episodeId,
        currentSceneId: data.currentSceneId,
        completedSceneIds: data.completedSceneIds ?? [],
        isCompleted: data.isCompleted ?? false,
        completedAt: data.completedAt ?? null,
      };

      setProgress(p);
      setCurrentSceneId(p.currentSceneId ?? null);
    });
  }, [progressRef, episode?.startSceneId, episodeId]);

  // Subscribe to the current scene doc
  useEffect(() => {
    if (!episodeId || !currentSceneId) return;

    const sceneRef = doc(db, "episodes", episodeId, "scenes", currentSceneId);
    return onSnapshot(sceneRef, (snap) => {
      setScene(snap.exists() ? (snap.data() as Scene) : null);
      setError(null);
      setCode("");
      setSelectedChoiceId(null);
    });
  }, [episodeId, currentSceneId]);

  const restartEpisode = async () => {
    if (!progressRef || !episode?.startSceneId) return;

    await setDoc(
      progressRef,
      {
        episodeId,
        currentSceneId: episode.startSceneId,
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        completedSceneIds: [],
        isCompleted: false,
        completedAt: null,
      },
      { merge: true },
    );
  };

  const markComplete = async () => {
    if (!progressRef || !currentSceneId) return;

    await updateDoc(progressRef, {
      updatedAt: serverTimestamp(),
      completedSceneIds: arrayUnion(currentSceneId),
      isCompleted: true,
      completedAt: serverTimestamp(),
    });
  };

  const advanceToNext = async (nextSceneId?: string) => {
    if (!progressRef || !currentSceneId) return;

    try {
      if (!nextSceneId) {
        await markComplete();
        return;
      }

      await updateDoc(progressRef, {
        currentSceneId: nextSceneId,
        updatedAt: serverTimestamp(),
        completedSceneIds: arrayUnion(currentSceneId),
      });
    } catch (e: any) {
      console.error("advanceToNext failed:", e);
      setError(e?.message ?? "Failed to advance scene");
    }
  };

  const header = useMemo(() => {
    return (
      <View
        style={{
          padding: 16,
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: "#222",
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ padding: 8, alignSelf: "flex-start" }}
        >
          <Text style={{ color: "white" }}>← Back</Text>
        </Pressable>

        <View style={{ gap: 4 }}>
          <Text style={{ color: "white", fontSize: 20, fontWeight: "700" }}>
            {episode?.title ?? "Episode"}
          </Text>
          <Text style={{ color: "#999" }}>Episode ID: {episodeId}</Text>
          <Text style={{ color: "#999" }}>
            Current scene: {currentSceneId ?? "—"}
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={restartEpisode}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: "#222",
            }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Restart</Text>
          </Pressable>

          {progress?.isCompleted ? (
            <View
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: "#173d22",
                borderWidth: 1,
                borderColor: "#2f7a44",
                alignSelf: "center",
              }}
            >
              <Text style={{ color: "#7CFC90", fontWeight: "800" }}>
                Completed
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }, [
    episode?.title,
    episodeId,
    currentSceneId,
    progress?.isCompleted,
    router,
  ]);

  if (!user) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "black",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "white" }}>Please sign in first.</Text>
      </View>
    );
  }

  if (!episode) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "black",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "white" }}>Loading episode…</Text>
      </View>
    );
  }

  if (!scene) {
    return (
      <View style={{ flex: 1, backgroundColor: "black" }}>
        {header}
        <View style={{ padding: 16, gap: 10 }}>
          <Text style={{ color: "white" }}>Scene not found.</Text>
          <Text style={{ color: "#999" }}>
            currentSceneId: {currentSceneId ?? "—"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "black" }}>
      {header}

      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>
          {scene.title}
        </Text>

        {/* STORY */}
        {scene.type === "story" ? (
          <>
            <Text style={{ color: "#ddd", lineHeight: 22 }}>{scene.body}</Text>

            {scene.nextSceneId ? (
              <Pressable
                onPress={() => advanceToNext(scene.nextSceneId)}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: "#222",
                  marginTop: 8,
                }}
              >
                <Text style={{ color: "white", textAlign: "center" }}>
                  Continue
                </Text>
              </Pressable>
            ) : (
              <Text style={{ color: "#7CFC90", marginTop: 12 }}>
                ✅ Episode complete
              </Text>
            )}
          </>
        ) : null}

        {/* CODE ENTRY */}
        {scene.type === "code_entry" ? (
          <>
            <Text style={{ color: "#ddd", lineHeight: 22 }}>
              {scene.prompt}
            </Text>

            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Enter code…"
              placeholderTextColor="#666"
              style={{
                borderWidth: 1,
                borderColor: "#333",
                borderRadius: 12,
                padding: 12,
                color: "white",
                backgroundColor: "#111",
              }}
            />

            {error ? <Text style={{ color: "#ff6b6b" }}>{error}</Text> : null}

            <Pressable
              onPress={async () => {
                if ((code ?? "").trim() === (scene.answer ?? "").trim()) {
                  await advanceToNext(scene.nextSceneId);
                } else {
                  setError("Wrong code. Try again.");
                }
              }}
              style={{ padding: 12, borderRadius: 12, backgroundColor: "#222" }}
            >
              <Text style={{ color: "white", textAlign: "center" }}>
                Submit
              </Text>
            </Pressable>
          </>
        ) : null}

        {/* CHOICE */}
        {scene.type === "choice" ? (
          <>
            <Text style={{ color: "#ddd", lineHeight: 22 }}>
              {scene.prompt}
            </Text>

            <View style={{ gap: 10 }}>
              {scene.options.map((opt) => {
                const selected = selectedChoiceId === opt.id;

                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setSelectedChoiceId(opt.id)}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: selected ? "#2a2a2a" : "#111",
                      borderWidth: 1,
                      borderColor: selected ? "#666" : "#222",
                    }}
                  >
                    <Text style={{ color: "white", fontWeight: "700" }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? <Text style={{ color: "#ff6b6b" }}>{error}</Text> : null}

            <Pressable
              onPress={async () => {
                if (!selectedChoiceId) {
                  setError("Pick an option first.");
                  return;
                }

                if (selectedChoiceId === scene.correctOptionId) {
                  await advanceToNext(scene.nextSceneId);
                } else {
                  setError("Not quite. Try another option.");
                }
              }}
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: "#222",
                marginTop: 4,
              }}
            >
              <Text style={{ color: "white", textAlign: "center" }}>
                Submit
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}
