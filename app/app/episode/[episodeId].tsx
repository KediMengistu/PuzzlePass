import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/firebase/firebase";
import {
  useRestartEpisodeMutation,
  useStartEpisodeMutation,
  useSubmitActionMutation,
} from "@/store/api/puzzle-api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectAuthUser,
  selectEpisodeById,
  selectEpisodeProgress,
  selectEpisodeRunnerEntry,
  selectEpisodesState,
} from "@/store/selectors";
import {
  episodeRunnerErrorSet,
  episodeRunnerReset,
  episodeRunnerSceneCleared,
  episodeRunnerSceneFailed,
  episodeRunnerSceneLoading,
  episodeRunnerSceneReceived,
} from "@/store/slices/episode-runner-slice";
import type { Scene } from "@/store/types";

function firstParam(value: string | string[] | undefined) {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

function friendlyError(error: unknown) {
  const e = error as {
    code?: string;
    message?: string;
    data?: { message?: string };
  };

  const code = String(e?.code ?? "");
  const rawMessage =
    (typeof e?.data?.message === "string" && e.data.message) ||
    (typeof e?.message === "string" && e.message) ||
    "Unknown error";

  if (code.includes("permission-denied")) {
    return rawMessage.replace(/^PERMISSION_DENIED:\s*/i, "");
  }
  if (code.includes("unauthenticated")) {
    return "You must be signed in.";
  }

  return rawMessage;
}

export default function EpisodeRunner() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const params = useLocalSearchParams<{ episodeId?: string | string[] }>();
  const episodeId = firstParam(params.episodeId);

  const user = useAppSelector(selectAuthUser);
  const episodesState = useAppSelector(selectEpisodesState);
  const episode = useAppSelector((state) =>
    episodeId ? selectEpisodeById(state, episodeId) : null,
  );
  const progress = useAppSelector((state) =>
    episodeId ? selectEpisodeProgress(state, episodeId) : null,
  );
  const runnerEntry = useAppSelector((state) =>
    episodeId ? selectEpisodeRunnerEntry(state, episodeId) : null,
  );

  const [startEpisode, startEpisodeState] = useStartEpisodeMutation();
  const [submitAction, submitActionState] = useSubmitActionMutation();
  const [restartEpisode, restartEpisodeState] = useRestartEpisodeMutation();

  const [code, setCode] = useState("");
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);

  const startedKeyRef = useRef<string | null>(null);

  const currentSceneId =
    progress?.currentSceneId ?? startEpisodeState.data?.currentSceneId ?? null;

  useEffect(() => {
    if (!episodeId) return;
    return () => {
      dispatch(episodeRunnerReset({ episodeId }));
    };
  }, [dispatch, episodeId]);

  useEffect(() => {
    if (!user?.uid || !episodeId) return;

    const key = `${user.uid}:${episodeId}`;
    if (startedKeyRef.current === key) return;

    startedKeyRef.current = key;
    dispatch(episodeRunnerErrorSet({ episodeId, error: null }));
    startEpisode({ episodeId }).catch(() => null);
  }, [dispatch, episodeId, startEpisode, user?.uid]);

  useEffect(() => {
    if (!episodeId || !currentSceneId) {
      if (episodeId) {
        dispatch(episodeRunnerSceneCleared({ episodeId, sceneId: null }));
      }
      return;
    }

    dispatch(episodeRunnerSceneLoading({ episodeId, sceneId: currentSceneId }));

    const sceneRef = doc(db, "episodes", episodeId, "scenes", currentSceneId);
    return onSnapshot(
      sceneRef,
      (snap) => {
        if (!snap.exists()) {
          dispatch(
            episodeRunnerSceneFailed({
              episodeId,
              sceneId: currentSceneId,
              error: "Scene not found.",
            }),
          );
          return;
        }

        dispatch(
          episodeRunnerSceneReceived({
            episodeId,
            sceneId: currentSceneId,
            scene: snap.data() as Scene,
          }),
        );
      },
      (error) => {
        dispatch(
          episodeRunnerSceneFailed({
            episodeId,
            sceneId: currentSceneId,
            error: friendlyError(error),
          }),
        );
      },
    );
  }, [currentSceneId, dispatch, episodeId]);

  useEffect(() => {
    setCode("");
    setSelectedChoiceId(null);
  }, [currentSceneId]);

  const scene = runnerEntry?.scene ?? null;

  const actionError =
    runnerEntry?.error ??
    (startEpisodeState.error ? friendlyError(startEpisodeState.error) : null) ??
    (restartEpisodeState.error ? friendlyError(restartEpisodeState.error) : null) ??
    (submitActionState.error ? friendlyError(submitActionState.error) : null);

  const restartEpisodeFlow = async () => {
    if (!episodeId) return;

    dispatch(episodeRunnerErrorSet({ episodeId, error: null }));
    try {
      await restartEpisode({ episodeId }).unwrap();
    } catch (error) {
      dispatch(
        episodeRunnerErrorSet({ episodeId, error: friendlyError(error) }),
      );
    }
  };

  const submitContinue = async () => {
    if (!episodeId || !currentSceneId) return;

    dispatch(episodeRunnerErrorSet({ episodeId, error: null }));
    try {
      await submitAction({
        episodeId,
        sceneId: currentSceneId,
        action: { type: "continue" },
      }).unwrap();
    } catch (error) {
      dispatch(
        episodeRunnerErrorSet({
          episodeId,
          error: friendlyError(error) || "Continue failed.",
        }),
      );
    }
  };

  const submitCode = async () => {
    if (!episodeId || !currentSceneId) return;

    dispatch(episodeRunnerErrorSet({ episodeId, error: null }));
    try {
      await submitAction({
        episodeId,
        sceneId: currentSceneId,
        action: { type: "code", code },
      }).unwrap();
    } catch (error) {
      dispatch(
        episodeRunnerErrorSet({
          episodeId,
          error: friendlyError(error) || "Wrong code. Try again.",
        }),
      );
    }
  };

  const submitChoice = async () => {
    if (!episodeId || !currentSceneId) return;
    if (!selectedChoiceId) {
      dispatch(episodeRunnerErrorSet({ episodeId, error: "Pick an option first." }));
      return;
    }

    dispatch(episodeRunnerErrorSet({ episodeId, error: null }));
    try {
      await submitAction({
        episodeId,
        sceneId: currentSceneId,
        action: { type: "choice", optionId: selectedChoiceId },
      }).unwrap();
    } catch (error) {
      dispatch(
        episodeRunnerErrorSet({
          episodeId,
          error: friendlyError(error) || "Wrong choice. Try again.",
        }),
      );
    }
  };

  const header = (
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
        <Text style={{ color: "white" }}>&lt;- Back</Text>
      </Pressable>

      <View style={{ gap: 4 }}>
        <Text style={{ color: "white", fontSize: 20, fontWeight: "700" }}>
          {episode?.title ?? "Episode"}
        </Text>
        <Text style={{ color: "#999" }}>Episode ID: {episodeId ?? "-"}</Text>
        <Text style={{ color: "#999" }}>
          Current scene: {currentSceneId ?? "-"}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={restartEpisodeFlow}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: "#222",
            opacity: restartEpisodeState.isLoading ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>
            {restartEpisodeState.isLoading ? "Restarting..." : "Restart"}
          </Text>
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

      {actionError ? <Text style={{ color: "#ff6b6b" }}>{actionError}</Text> : null}
    </View>
  );

  if (!episodeId) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "black",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "white" }}>Missing episode id.</Text>
      </View>
    );
  }

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
        <Text style={{ color: "white" }}>
          {episodesState.status === "loading"
            ? "Loading episode..."
            : "Episode not found."}
        </Text>
      </View>
    );
  }

  if (!currentSceneId) {
    return (
      <View style={{ flex: 1, backgroundColor: "black" }}>
        {header}
        <View style={{ padding: 16, gap: 10 }}>
          <Text style={{ color: "white" }}>
            {startEpisodeState.isLoading
              ? "Starting episode..."
              : "Cannot start this episode."}
          </Text>
          <Text style={{ color: "#999" }}>{actionError ?? "Unknown error"}</Text>
        </View>
      </View>
    );
  }

  if (runnerEntry?.sceneStatus === "loading" || !scene) {
    return (
      <View style={{ flex: 1, backgroundColor: "black" }}>
        {header}
        <View style={{ padding: 16, gap: 10 }}>
          <Text style={{ color: "white" }}>Loading scene...</Text>
          <Text style={{ color: "#999" }}>currentSceneId: {currentSceneId}</Text>
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
            Episode complete
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
                opacity: submitActionState.isLoading ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "white", textAlign: "center" }}>
                {submitActionState.isLoading ? "Submitting..." : "Continue"}
              </Text>
            </Pressable>
          </>
        ) : null}

        {scene.type === "code_entry" ? (
          <>
            <Text style={{ color: "#ddd", lineHeight: 22 }}>{scene.prompt}</Text>

            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Enter code..."
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
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: "#222",
                opacity: submitActionState.isLoading ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "white", textAlign: "center" }}>
                {submitActionState.isLoading ? "Submitting..." : "Submit"}
              </Text>
            </Pressable>
          </>
        ) : null}

        {scene.type === "choice" ? (
          <>
            <Text style={{ color: "#ddd", lineHeight: 22 }}>{scene.prompt}</Text>

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
                opacity: submitActionState.isLoading ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "white", textAlign: "center" }}>
                {submitActionState.isLoading ? "Submitting..." : "Submit"}
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}
