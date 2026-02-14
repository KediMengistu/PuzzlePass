import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";

/**
 * -------------------------
 * Configure IDs for your emulator data
 * -------------------------
 * Update these to match docs that actually exist in your Firestore emulator.
 */
const FREE_EPISODE_ID = "episode_001"; // published + isFreePreview=true
const FREE_SCENE_ID = "scene_001"; // must exist at episodes/{FREE_EPISODE_ID}/scenes/{FREE_SCENE_ID}

const PAID_EPISODE_ID = "episode_002"; // published + isFreePreview=false
const PAID_SCENE_ID = "scene_001"; // must exist at episodes/{PAID_EPISODE_ID}/scenes/{PAID_SCENE_ID}

// Solutions doc to test (must exist) — should always be denied
const SOLUTION_SCENE_ID = "scene_003";

function formatErr(e: any) {
  const code = e?.code ?? "";
  const msg = e?.message ?? String(e);
  return `${code} ${msg}`.trim();
}

export default function Debug() {
  const [out, setOut] = useState<string>("");

  const banner = () => {
    const uid = auth.currentUser?.uid;
    return `Signed in: ${uid ?? "NO"}\n`;
  };

  /**
   * -------------------------
   * READ TESTS
   * -------------------------
   */

  const tryReadEpisodeMeta = async (episodeId: string) => {
    setOut(banner() + `Reading episode meta: ${episodeId} …`);
    try {
      const ref = doc(db, "episodes", episodeId);
      const snap = await getDoc(ref);
      setOut(
        banner() +
          `READ OK\npath=episodes/${episodeId}\nexists=${snap.exists()}\n` +
          JSON.stringify(snap.data(), null, 2),
      );
    } catch (e: any) {
      setOut(
        banner() + `READ FAILED\npath=episodes/${episodeId}\n${formatErr(e)}`,
      );
    }
  };

  const tryReadScene = async (episodeId: string, sceneId: string) => {
    setOut(banner() + `Reading scene: ${episodeId}/${sceneId} …`);
    try {
      const ref = doc(db, "episodes", episodeId, "scenes", sceneId);
      const snap = await getDoc(ref);
      setOut(
        banner() +
          `READ OK\npath=episodes/${episodeId}/scenes/${sceneId}\nexists=${snap.exists()}\n` +
          JSON.stringify(snap.data(), null, 2),
      );
    } catch (e: any) {
      setOut(
        banner() +
          `READ FAILED\npath=episodes/${episodeId}/scenes/${sceneId}\n${formatErr(e)}`,
      );
    }
  };

  const tryReadSolution = async () => {
    setOut(banner() + "Reading solution doc…");
    try {
      const ref = doc(
        db,
        "episodes",
        FREE_EPISODE_ID,
        "solutions",
        SOLUTION_SCENE_ID,
      );
      const snap = await getDoc(ref);
      setOut(
        banner() +
          `READ OK (❌ should be denied)\npath=episodes/${FREE_EPISODE_ID}/solutions/${SOLUTION_SCENE_ID}\nexists=${snap.exists()}\n` +
          JSON.stringify(snap.data(), null, 2),
      );
    } catch (e: any) {
      setOut(
        banner() +
          `READ FAILED (✅ expected)\npath=episodes/${FREE_EPISODE_ID}/solutions/${SOLUTION_SCENE_ID}\n${formatErr(e)}`,
      );
    }
  };

  /**
   * -------------------------
   * WRITE TESTS (should be denied)
   * -------------------------
   */

  const tryWriteProgress = async () => {
    setOut(banner() + "Writing progress doc…");
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setOut(banner() + "Not signed in.");
        return;
      }
      const ref = doc(db, "progress", uid, "episodes", FREE_EPISODE_ID);
      await setDoc(
        ref,
        { hacked: true, updatedAt: serverTimestamp() },
        { merge: true },
      );
      setOut(banner() + "WRITE OK (❌ should be denied)");
    } catch (e: any) {
      setOut(banner() + `WRITE FAILED (✅ expected)\n${formatErr(e)}`);
    }
  };

  const tryWriteEntitlement = async () => {
    setOut(banner() + "Writing entitlements doc…");
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setOut(banner() + "Not signed in.");
        return;
      }
      const ref = doc(db, "entitlements", uid);
      await setDoc(
        ref,
        { hacked: true, updatedAt: serverTimestamp() },
        { merge: true },
      );
      setOut(banner() + "WRITE OK (❌ should be denied)");
    } catch (e: any) {
      setOut(banner() + `WRITE FAILED (✅ expected)\n${formatErr(e)}`);
    }
  };

  /**
   * -------------------------
   * Entitlement Toggle (FOR TESTING ONLY)
   * -------------------------
   *
   * This tries to update entitlements from the client.
   * With your hardened rules, it SHOULD FAIL.
   *
   * The reason it’s useful: it confirms you cannot “self-unlock” a paid episode
   * by writing to entitlements directly.
   */
  const trySelfUnlockPaid = async () => {
    setOut(banner() + "Attempting client-side self-unlock of paid episode…");
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setOut(banner() + "Not signed in.");
        return;
      }
      const ref = doc(db, "entitlements", uid);
      await updateDoc(ref, { unlockedEpisodeIds: arrayUnion(PAID_EPISODE_ID) });
      setOut(banner() + "UPDATE OK (❌ should be denied)");
    } catch (e: any) {
      setOut(banner() + `UPDATE FAILED (✅ expected)\n${formatErr(e)}`);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "black" }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>
        Debug (Rules Test Harness)
      </Text>

      <Text style={{ color: "#aaa" }}>
        Configured IDs:
        {"\n"}FREE {FREE_EPISODE_ID}/{FREE_SCENE_ID}
        {"\n"}PAID {PAID_EPISODE_ID}/{PAID_SCENE_ID}
      </Text>

      {/* Episode meta reads */}
      <Pressable
        onPress={() => tryReadEpisodeMeta(FREE_EPISODE_ID)}
        style={{ padding: 12, borderRadius: 12, backgroundColor: "#222" }}
      >
        <Text style={{ color: "white" }}>Read FREE episode meta</Text>
      </Pressable>

      <Pressable
        onPress={() => tryReadEpisodeMeta(PAID_EPISODE_ID)}
        style={{ padding: 12, borderRadius: 12, backgroundColor: "#222" }}
      >
        <Text style={{ color: "white" }}>Read PAID episode meta</Text>
      </Pressable>

      {/* Scene reads */}
      <Pressable
        onPress={() => tryReadScene(FREE_EPISODE_ID, FREE_SCENE_ID)}
        style={{ padding: 12, borderRadius: 12, backgroundColor: "#222" }}
      >
        <Text style={{ color: "white" }}>
          Read FREE scene (should be allowed when signed in)
        </Text>
      </Pressable>

      <Pressable
        onPress={() => tryReadScene(PAID_EPISODE_ID, PAID_SCENE_ID)}
        style={{ padding: 12, borderRadius: 12, backgroundColor: "#222" }}
      >
        <Text style={{ color: "white" }}>
          Read PAID scene (should be denied unless entitled)
        </Text>
      </Pressable>

      {/* Solutions read */}
      <Pressable
        onPress={tryReadSolution}
        style={{ padding: 12, borderRadius: 12, backgroundColor: "#222" }}
      >
        <Text style={{ color: "white" }}>
          Try read solutions/{SOLUTION_SCENE_ID} (should be denied)
        </Text>
      </Pressable>

      {/* Write attempts */}
      <Pressable
        onPress={tryWriteProgress}
        style={{ padding: 12, borderRadius: 12, backgroundColor: "#222" }}
      >
        <Text style={{ color: "white" }}>
          Try write progress (merge hacked) (should be denied)
        </Text>
      </Pressable>

      <Pressable
        onPress={tryWriteEntitlement}
        style={{ padding: 12, borderRadius: 12, backgroundColor: "#222" }}
      >
        <Text style={{ color: "white" }}>
          Try write entitlements (should be denied)
        </Text>
      </Pressable>

      <Pressable
        onPress={trySelfUnlockPaid}
        style={{ padding: 12, borderRadius: 12, backgroundColor: "#222" }}
      >
        <Text style={{ color: "white" }}>
          Try self-unlock PAID episode (should be denied)
        </Text>
      </Pressable>

      <Text style={{ color: "#bbb", marginTop: 10 }} allowFontScaling={false}>
        {out}
      </Text>
    </ScrollView>
  );
}
