import Stripe from "stripe";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "crypto";

initializeApp();
const db = getFirestore();

const REGION = process.env.FUNCTIONS_REGION || "northamerica-northeast2";
setGlobalOptions({ region: REGION });

/**
 * -------------------------
 * Types / Helpers (Game)
 * -------------------------
 */

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

async function getEntitlement(uid: string) {
  const entSnap = await db.doc(`entitlements/${uid}`).get();
  const ent = entSnap.exists ? (entSnap.data() as any) : {};
  const isSubscriber = ent?.isSubscriber === true;
  const unlockedEpisodeIds: string[] = Array.isArray(ent?.unlockedEpisodeIds)
    ? ent.unlockedEpisodeIds
    : [];
  return { isSubscriber, unlockedEpisodeIds };
}

function userCanAccessEpisode(
  uidEnt: { isSubscriber: boolean; unlockedEpisodeIds: string[] },
  episodeId: string,
  episode: any,
) {
  if (episode?.isFreePreview === true) return true;
  if (uidEnt.isSubscriber) return true;
  return uidEnt.unlockedEpisodeIds.includes(episodeId);
}

async function requireEpisodeAccess(
  uid: string,
  episodeId: string,
  episode: any,
) {
  const ent = await getEntitlement(uid);
  if (userCanAccessEpisode(ent, episodeId, episode)) return;

  throw new HttpsError(
    "permission-denied",
    "Episode is locked. Purchase required.",
  );
}

/**
 * -------------------------
 * Stripe Setup
 * -------------------------
 */

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.warn(
    "Missing STRIPE_SECRET_KEY env var (Stripe functions will fail).",
  );
}

const stripe = new Stripe(STRIPE_SECRET_KEY || "sk_test_missing");
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:8081";

// Allowed mobile schemes for redirect urls (dev builds + Expo Go)
const ALLOWED_MOBILE_SCHEMES = (
  process.env.ALLOWED_MOBILE_SCHEMES ?? "puzzlepass,exp,exps"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function validateRedirectUrl(urlStr: string, kind: "successUrl" | "cancelUrl") {
  // allow Stripe placeholder in validation
  const probe = urlStr.replace("{CHECKOUT_SESSION_ID}", "cs_test_probe");
  let u: URL;

  try {
    u = new URL(probe);
  } catch {
    throw new HttpsError("invalid-argument", `Invalid ${kind}.`);
  }

  const scheme = u.protocol.replace(":", "");

  if (scheme === "http" || scheme === "https") {
    // Restrict web redirects to your configured app origin
    let appOrigin: string | null = null;
    try {
      appOrigin = new URL(APP_BASE_URL).origin;
    } catch {
      appOrigin = null;
    }

    if (appOrigin && u.origin !== appOrigin) {
      throw new HttpsError(
        "invalid-argument",
        `${kind} origin not allowed. Expected ${appOrigin}`,
      );
    }

    return urlStr;
  }

  // Custom schemes for mobile (puzzlepass://, exp://, etc.)
  if (!ALLOWED_MOBILE_SCHEMES.includes(scheme)) {
    throw new HttpsError(
      "invalid-argument",
      `${kind} scheme not allowed: ${scheme}`,
    );
  }

  return urlStr;
}

/**
 * -------------------------
 * Callable Abuse Hardening
 * -------------------------
 */

const ENFORCE_APPCHECK = process.env.ENFORCE_APPCHECK === "true";
const REQUIRE_NON_ANON_FOR_CHECKOUT =
  process.env.REQUIRE_NON_ANON_FOR_CHECKOUT === "true";

const CHECKOUT_LIMIT = Number(process.env.CHECKOUT_LIMIT ?? "5");
const CHECKOUT_WINDOW_SECONDS = Number(
  process.env.CHECKOUT_WINDOW_SECONDS ?? "600",
);

// how long we allow reusing an OPEN session (user double-clicks, refreshes, etc)
const CHECKOUT_REUSE_SECONDS = Number(
  process.env.CHECKOUT_REUSE_SECONDS ?? "1800",
);

// how long we consider a "creating" attempt valid before generating a fresh attempt
const CHECKOUT_CREATING_GRACE_SECONDS = Number(
  process.env.CHECKOUT_CREATING_GRACE_SECONDS ?? "30",
);

// TTL settings (Firestore TTL uses Timestamp fields)
const RATE_LIMIT_TTL_SECONDS = Number(
  process.env.RATE_LIMIT_TTL_SECONDS ?? String(CHECKOUT_WINDOW_SECONDS * 2),
);
const CHECKOUT_DOC_TTL_SECONDS = Number(
  process.env.CHECKOUT_DOC_TTL_SECONDS ?? "86400", // 1 day
);
const STRIPE_EVENT_TTL_SECONDS = Number(
  process.env.STRIPE_EVENT_TTL_SECONDS ?? "604800", // 7 days
);

function isAnonymousAuth(request: any) {
  return request.auth?.token?.firebase?.sign_in_provider === "anonymous";
}

function safeDocId(s: string) {
  return String(s).replace(/[^a-zA-Z0-9_:-]/g, "_");
}

/**
 * rate_limits/{uid__checkout__episodeId}
 */
function rateDocId(uid: string, episodeId: string) {
  return safeDocId(`${uid}__checkout__${episodeId}`);
}

async function enforceRateLimit(uid: string, episodeId: string) {
  const now = Date.now();
  const windowMs = CHECKOUT_WINDOW_SECONDS * 1000;
  const ref = db.doc(`rate_limits/${rateDocId(uid, episodeId)}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    let count = 0;
    let windowStartMs = now;

    if (snap.exists) {
      const data = snap.data() as any;
      const prevStart = Number(data.windowStartMs ?? now);
      const prevCount = Number(data.count ?? 0);

      if (now - prevStart < windowMs) {
        windowStartMs = prevStart;
        count = prevCount;
      }
    }

    count += 1;

    if (count > CHECKOUT_LIMIT) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many checkout attempts. Try again in a few minutes.",
      );
    }

    const expiresAt = Timestamp.fromMillis(now + RATE_LIMIT_TTL_SECONDS * 1000);

    tx.set(
      ref,
      {
        uid,
        episodeId,
        count,
        windowStartMs,
        expiresAt,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

/**
 * checkout_sessions/{uid__episodeId}
 * Stores the latest attempt/session so we can:
 * - reuse OPEN sessions
 * - avoid Stripe idempotency returning an old COMPLETED/EXPIRED session
 * - have an attemptId that is stable during retries
 */
function checkoutSessionDocId(uid: string, episodeId: string) {
  return safeDocId(`${uid}__${episodeId}`);
}

type CheckoutAttemptRecord = {
  uid: string;
  episodeId: string;
  attemptId: string;
  stripeSessionId?: string | null;
  stripeSessionUrl?: string | null;
  status?: "creating" | "open" | "complete" | "expired" | "unknown";
  createdAtMs: number;
  expiresAt?: FirebaseFirestore.Timestamp;
  updatedAt?: any;
};

async function getOrCreateAttempt(uid: string, episodeId: string) {
  const ref = db.doc(
    `checkout_sessions/${checkoutSessionDocId(uid, episodeId)}`,
  );
  const now = Date.now();
  const reuseMs = CHECKOUT_REUSE_SECONDS * 1000;
  const creatingGraceMs = CHECKOUT_CREATING_GRACE_SECONDS * 1000;

  const attempt = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (snap.exists) {
      const data = snap.data() as any;

      const createdAtMs = Number(data.createdAtMs ?? 0);
      const status = (data.status as string | undefined) ?? "unknown";
      const attemptId = String(data.attemptId ?? "");
      const stripeSessionId =
        (data.stripeSessionId as string | undefined) ?? null;
      const stripeSessionUrl =
        (data.stripeSessionUrl as string | undefined) ?? null;

      const ageMs = createdAtMs ? now - createdAtMs : Number.MAX_SAFE_INTEGER;

      // If it's a recent OPEN session, we *can* try reuse (caller will verify via Stripe retrieve)
      if (
        status === "open" &&
        attemptId &&
        stripeSessionId &&
        ageMs < reuseMs
      ) {
        return {
          mode: "reuse" as const,
          refPath: ref.path,
          attemptId,
          stripeSessionId,
          stripeSessionUrl,
          createdAtMs,
        };
      }

      // If we are in a "creating" attempt and it is very recent, keep same attemptId
      // so retries call Stripe with the same idempotency key.
      if (status === "creating" && attemptId && ageMs < creatingGraceMs) {
        return {
          mode: "continue-creating" as const,
          refPath: ref.path,
          attemptId,
          stripeSessionId,
          stripeSessionUrl,
          createdAtMs,
        };
      }
    }

    // Otherwise generate a NEW attemptId (this is the key change vs your old constant idempotency key)
    const attemptId = randomUUID();
    const expiresAt = Timestamp.fromMillis(
      now + CHECKOUT_DOC_TTL_SECONDS * 1000,
    );

    tx.set(
      ref,
      {
        uid,
        episodeId,
        attemptId,
        status: "creating",
        createdAtMs: now,
        expiresAt,
        updatedAt: FieldValue.serverTimestamp(),
      } satisfies CheckoutAttemptRecord,
      { merge: true },
    );

    return {
      mode: "new" as const,
      refPath: ref.path,
      attemptId,
      stripeSessionId: null,
      stripeSessionUrl: null,
      createdAtMs: now,
    };
  });

  return { attempt, ref };
}

async function tryReuseOpenCheckoutSession(params: {
  uid: string;
  episodeId: string;
  stripeSessionId: string;
  stripeSessionUrl?: string | null;
  ref: FirebaseFirestore.DocumentReference;
}) {
  const { stripeSessionId, stripeSessionUrl, ref } = params;

  // Retrieve session to confirm it's still OPEN.
  const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

  if (session.status === "open" && (session.url || stripeSessionUrl)) {
    await ref.set(
      {
        status: "open",
        stripeSessionUrl: session.url ?? stripeSessionUrl ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { url: session.url ?? stripeSessionUrl!, reused: true };
  }

  const nextStatus =
    session.status === "complete"
      ? "complete"
      : session.status === "expired"
        ? "expired"
        : "unknown";

  await ref.set(
    { status: nextStatus, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  return null;
}

/**
 * -------------------------
 * Stripe purchase mapping helpers
 * -------------------------
 * stripe_purchases/{paymentIntentId} -> {uid, episodeId, status}
 * episode_purchases/{uid__episodeId} -> {currentPaymentIntentId, status}
 */

function episodePurchaseDocId(uid: string, episodeId: string) {
  return safeDocId(`${uid}__${episodeId}`);
}

async function recordPaidPurchase(params: {
  uid: string;
  episodeId: string;
  sessionId: string;
  paymentIntentId: string;
  customerId: string | null;
}) {
  const { uid, episodeId, sessionId, paymentIntentId, customerId } = params;

  await db.doc(`stripe_purchases/${safeDocId(paymentIntentId)}`).set(
    {
      uid,
      episodeId,
      sessionId,
      paymentIntentId,
      customerId,
      status: "paid",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await db.doc(`episode_purchases/${episodePurchaseDocId(uid, episodeId)}`).set(
    {
      uid,
      episodeId,
      currentPaymentIntentId: paymentIntentId,
      status: "paid",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function revokeIfCurrentPurchaseRefunded(params: {
  paymentIntentId: string;
}) {
  const { paymentIntentId } = params;

  const purchaseRef = db.doc(`stripe_purchases/${safeDocId(paymentIntentId)}`);
  const purchaseSnap = await purchaseRef.get();
  if (!purchaseSnap.exists) return;

  const purchase = purchaseSnap.data() as any;
  const uid = purchase.uid as string | undefined;
  const episodeId = purchase.episodeId as string | undefined;

  if (!uid || !episodeId) return;

  await purchaseRef.set(
    { status: "refunded", refundedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  const epPurchaseRef = db.doc(
    `episode_purchases/${episodePurchaseDocId(uid, episodeId)}`,
  );
  const epPurchaseSnap = await epPurchaseRef.get();

  const currentPaymentIntentId = epPurchaseSnap.exists
    ? (epPurchaseSnap.data() as any).currentPaymentIntentId
    : null;

  if (currentPaymentIntentId !== paymentIntentId) {
    return;
  }

  const ent = await getEntitlement(uid);
  if (ent.isSubscriber) return;

  await db.doc(`entitlements/${uid}`).set(
    {
      unlockedEpisodeIds: FieldValue.arrayRemove(episodeId),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await epPurchaseRef.set(
    { status: "refunded", updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

/**
 * -------------------------
 * Stripe webhook idempotency
 * -------------------------
 */

async function withStripeEventLock(eventId: string, fn: () => Promise<void>) {
  const ref = db.doc(`stripe_events/${safeDocId(eventId)}`);

  const created = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return false;

    const expiresAt = Timestamp.fromMillis(
      Date.now() + STRIPE_EVENT_TTL_SECONDS * 1000,
    );

    tx.create(ref, {
      status: "processing",
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
    });

    return true;
  });

  if (!created) {
    return;
  }

  try {
    await fn();
    await ref.set(
      { status: "processed", processedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  } catch (e) {
    await ref.delete().catch(() => null);
    throw e;
  }
}

/**
 * -------------------------
 * Existing Game Functions
 * -------------------------
 */

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

  await requireEpisodeAccess(uid, episodeId, episode);

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

  const epSnap = await db.doc(`episodes/${episodeId}`).get();
  if (!epSnap.exists) throw new HttpsError("not-found", "Episode not found.");
  const ep = epSnap.data() as any;
  if (!ep.isPublished)
    throw new HttpsError("permission-denied", "Episode is not published.");

  await requireEpisodeAccess(uid, episodeId, ep);

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

  const episode = episodeSnap.data() as any;
  if (!episode.isPublished) {
    throw new HttpsError("permission-denied", "Episode is not published.");
  }

  await requireEpisodeAccess(uid, episodeId, episode);

  const startSceneId = episode.startSceneId as string;
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

/**
 * -------------------------
 * Stripe Checkout (Hardened)
 * -------------------------
 */

export const createCheckoutSession = onCall(
  { enforceAppCheck: ENFORCE_APPCHECK },
  async (request) => {
    const uid = requireAuth(request);

    if (!STRIPE_SECRET_KEY) {
      throw new HttpsError("failed-precondition", "Missing STRIPE_SECRET_KEY.");
    }

    if (REQUIRE_NON_ANON_FOR_CHECKOUT && isAnonymousAuth(request)) {
      throw new HttpsError(
        "failed-precondition",
        "Please create a full account before purchasing.",
      );
    }

    const { episodeId, successUrl, cancelUrl } = request.data ?? {};
    if (!episodeId)
      throw new HttpsError("invalid-argument", "Missing episodeId.");

    const epSnap = await db.doc(`episodes/${episodeId}`).get();
    if (!epSnap.exists) throw new HttpsError("not-found", "Episode not found.");

    const ep = epSnap.data() as any;

    if (!ep.isPublished) {
      throw new HttpsError("permission-denied", "Episode is not published.");
    }

    if (ep.isFreePreview === true) {
      throw new HttpsError(
        "failed-precondition",
        "Episode is free. No purchase needed.",
      );
    }

    const ent = await getEntitlement(uid);
    if (userCanAccessEpisode(ent, episodeId, ep)) {
      throw new HttpsError(
        "failed-precondition",
        "You already own access to this episode.",
      );
    }

    const priceId = ep.stripePriceId;
    if (!priceId)
      throw new HttpsError("failed-precondition", "Missing stripePriceId.");

    await enforceRateLimit(uid, episodeId);

    const { attempt, ref } = await getOrCreateAttempt(uid, episodeId);

    if (
      attempt.mode === "reuse" &&
      attempt.stripeSessionId &&
      attempt.createdAtMs &&
      (attempt.stripeSessionUrl || true)
    ) {
      const reused = await tryReuseOpenCheckoutSession({
        uid,
        episodeId,
        stripeSessionId: attempt.stripeSessionId,
        stripeSessionUrl: attempt.stripeSessionUrl,
        ref,
      });

      if (reused) return reused;
    }

    const attemptId = attempt.attemptId;

    const finalSuccessUrl = successUrl
      ? validateRedirectUrl(String(successUrl), "successUrl")
      : `${APP_BASE_URL}/purchase?purchase=success&session_id={CHECKOUT_SESSION_ID}`;

    const finalCancelUrl = cancelUrl
      ? validateRedirectUrl(String(cancelUrl), "cancelUrl")
      : `${APP_BASE_URL}/purchase?purchase=cancel`;

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: finalSuccessUrl,
        cancel_url: finalCancelUrl,
        metadata: { uid, episodeId, type: "episode_unlock" },
        client_reference_id: uid,
      },
      { idempotencyKey: `pps_attempt_${attemptId}` },
    );

    if (!session.url)
      throw new HttpsError("internal", "Stripe session missing url.");

    await ref.set(
      {
        uid,
        episodeId,
        attemptId,
        stripeSessionId: session.id,
        stripeSessionUrl: session.url,
        status: "open",
        createdAtMs: attempt.createdAtMs ?? Date.now(),
        updatedAt: FieldValue.serverTimestamp(),
      } satisfies CheckoutAttemptRecord,
      { merge: true },
    );

    return { url: session.url, reused: false };
  },
);

/**
 * -------------------------
 * Verify after redirect (self-healing)
 * -------------------------
 */

export const verifyCheckoutSession = onCall(
  { enforceAppCheck: ENFORCE_APPCHECK },
  async (request) => {
    const uid = requireAuth(request);

    if (!STRIPE_SECRET_KEY) {
      throw new HttpsError("failed-precondition", "Missing STRIPE_SECRET_KEY.");
    }

    const { sessionId } = request.data ?? {};
    if (!sessionId || typeof sessionId !== "string") {
      throw new HttpsError("invalid-argument", "Missing sessionId.");
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const metaUid = session.metadata?.uid ?? null;
    const episodeId = session.metadata?.episodeId ?? null;
    const type = session.metadata?.type ?? null;

    if (type !== "episode_unlock" || !episodeId || !metaUid) {
      throw new HttpsError(
        "failed-precondition",
        "Not a valid PuzzlePass purchase session.",
      );
    }

    if (metaUid !== uid) {
      throw new HttpsError(
        "permission-denied",
        "This checkout session does not belong to you.",
      );
    }

    const epSnap = await db.doc(`episodes/${episodeId}`).get();
    if (!epSnap.exists) throw new HttpsError("not-found", "Episode not found.");
    const ep = epSnap.data() as any;

    const ent = await getEntitlement(uid);
    if (userCanAccessEpisode(ent, episodeId, ep)) {
      return { status: "already_entitled" as const, episodeId };
    }

    if (session.payment_status !== "paid") {
      return {
        status: "not_paid" as const,
        episodeId,
        payment_status: session.payment_status,
      };
    }

    await db.doc(`entitlements/${uid}`).set(
      {
        unlockedEpisodeIds: FieldValue.arrayUnion(episodeId),
        updatedAt: FieldValue.serverTimestamp(),
        stripeCustomerId: session.customer ?? null,
      },
      { merge: true },
    );

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : null;

    if (paymentIntentId) {
      await recordPaidPurchase({
        uid,
        episodeId,
        sessionId: session.id,
        paymentIntentId,
        customerId: (session.customer as string) ?? null,
      });
    }

    await db
      .doc(`checkout_sessions/${checkoutSessionDocId(uid, episodeId)}`)
      .set(
        { status: "complete", updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );

    return { status: "paid_unlocked" as const, episodeId };
  },
);

/**
 * -------------------------
 * Stripe Webhook (idempotent)
 * -------------------------
 */

export const stripeWebhook = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (!sig) {
    res.status(400).send("Missing stripe-signature header.");
    return;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    res.status(500).send("Missing STRIPE_WEBHOOK_SECRET env var.");
    return;
  }

  let event: Stripe.Event;

  try {
    const rawBody = (req as any).rawBody as Buffer;
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig as string,
      webhookSecret,
    );
  } catch (err: any) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    await withStripeEventLock(event.id, async () => {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;

        const uid = session.metadata?.uid;
        const episodeId = session.metadata?.episodeId;
        const type = session.metadata?.type;

        if (
          type === "episode_unlock" &&
          session.payment_status === "paid" &&
          uid &&
          episodeId
        ) {
          const paymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null;

          await db.doc(`entitlements/${uid}`).set(
            {
              unlockedEpisodeIds: FieldValue.arrayUnion(episodeId),
              updatedAt: FieldValue.serverTimestamp(),
              stripeCustomerId: session.customer ?? null,
            },
            { merge: true },
          );

          await db
            .doc(`checkout_sessions/${checkoutSessionDocId(uid, episodeId)}`)
            .set(
              { status: "complete", updatedAt: FieldValue.serverTimestamp() },
              { merge: true },
            );

          if (paymentIntentId) {
            await recordPaidPurchase({
              uid,
              episodeId,
              sessionId: session.id,
              paymentIntentId,
              customerId: (session.customer as string) ?? null,
            });
          }
        }
      }

      if (event.type === "charge.refunded") {
        const charge = event.data.object as Stripe.Charge;

        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : null;

        if (paymentIntentId && charge.refunded === true) {
          await revokeIfCurrentPurchaseRefunded({ paymentIntentId });
        }
      }
    });

    res.json({ received: true });
  } catch (e: any) {
    res.status(500).send(`Webhook handler failed: ${e?.message ?? String(e)}`);
  }
});
