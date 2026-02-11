import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

// IMPORTANT:
// This file is at: app/app/(tabs)/episode/[episodeId].tsx
// Your firebase.ts is at: app/firebase/firebase.ts
// So you need THREE .. to reach project root:
import { auth, db, functions } from "../../firebase/firebase";

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
  // NOTE: no answer here (it lives in solutions/* and is validated by server)
};

type ChoiceScene = SceneBase & {
  type: "choice";
  prompt: string;
  options: { id: string; label: string }[];
  // NOTE: no correctOptionId here (it lives in solutions/* and is validated by server)
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

  // callable functions
  const startEpisodeFn = useMemo(
    () => httpsCallable(functions, "startEpisode"),
    [],
  );
  const submitActionFn = useMemo(
    () => httpsCallable(functions, "submitAction"),
    [],
  );
  const restartEpisodeFn = useMemo(
    () => httpsCallable(functions, "restartEpisode"),
    [],
  );

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Subscribe to episode doc (for title + sanity)
  useEffect(() => {
    if (!episodeId) return;
    const ref = doc(db, "episodes", episodeId);
    return onSnapshot(ref, (snap) => {
      setEpisode(snap.exists() ? (snap.data() as Episode) : null);
    });
  }, [episodeId]);

  // Start/resume progress via server (creates progress doc if missing)
  useEffect(() => {
    if (!user?.uid || !episodeId) return;

    (async () => {
      try {
        setError(null);
        const res: any = await startEpisodeFn({ episodeId });
        const data = res.data as any;
        setCurrentSceneId(data.currentSceneId ?? null);
      } catch (e: any) {
        setError(e?.message ?? "Failed to start episode.");
      }
    })();
  }, [user?.uid, episodeId, startEpisodeFn]);

  // Subscribe to progress doc (READ ONLY, written by functions)
  useEffect(() => {
    if (!user?.uid || !episodeId) return;

    const progressRef = doc(db, "progress", user.uid, "episodes", episodeId);
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
  }, [user?.uid, episodeId]);

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
    if (!episodeId) return;
    try {
      setError(null);
      await restartEpisodeFn({ episodeId });
      // progress listener will update currentSceneId automatically
    } catch (e: any) {
      setError(e?.message ?? "Failed to restart.");
    }
  };

  const submitContinue = async () => {
    if (!episodeId || !currentSceneId) return;
    try {
      setError(null);
      await submitActionFn({
        episodeId,
        sceneId: currentSceneId,
        action: { type: "continue" },
      });
    } catch (e: any) {
      setError(e?.message ?? "Continue failed.");
    }
  };

  const submitCode = async () => {
    if (!episodeId || !currentSceneId) return;
    try {
      setError(null);
      await submitActionFn({
        episodeId,
        sceneId: currentSceneId,
        action: { type: "code", code },
      });
    } catch (e: any) {
      setError(e?.message ?? "Wrong code. Try again.");
    }
  };

  const submitChoice = async () => {
    if (!episodeId || !currentSceneId) return;

    if (!selectedChoiceId) {
      setError("Pick an option first.");
      return;
    }

    try {
      setError(null);
      await submitActionFn({
        episodeId,
        sceneId: currentSceneId,
        action: { type: "choice", optionId: selectedChoiceId },
      });
    } catch (e: any) {
      setError(e?.message ?? "Wrong choice. Try again.");
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

        {error ? <Text style={{ color: "#ff6b6b" }}>{error}</Text> : null}
      </View>
    );
  }, [
    episode?.title,
    episodeId,
    currentSceneId,
    progress?.isCompleted,
    router,
    error,
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

  if (progress?.isCompleted) {
    return (
      <View style={{ flex: 1, backgroundColor: "black" }}>
        {header}
        <View style={{ padding: 16 }}>
          <Text style={{ color: "#7CFC90", marginTop: 12 }}>
            ✅ Episode complete
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

            <Pressable
              onPress={submitContinue}
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

            <Pressable
              onPress={submitCode}
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

            <Pressable
              onPress={submitChoice}
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
