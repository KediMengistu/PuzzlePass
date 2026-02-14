import { PayloadAction, createSlice } from "@reduxjs/toolkit";

import type { AsyncStatus, Scene } from "@/store/types";

type EpisodeRunnerEntry = {
  activeSceneId: string | null;
  sceneStatus: AsyncStatus;
  scene: Scene | null;
  error: string | null;
};

type EpisodeRunnerState = {
  byEpisodeId: Record<string, EpisodeRunnerEntry>;
};

const initialEntry = (): EpisodeRunnerEntry => ({
  activeSceneId: null,
  sceneStatus: "idle",
  scene: null,
  error: null,
});

const initialState: EpisodeRunnerState = {
  byEpisodeId: {},
};

function ensureEpisodeEntry(state: EpisodeRunnerState, episodeId: string) {
  if (!state.byEpisodeId[episodeId]) {
    state.byEpisodeId[episodeId] = initialEntry();
  }
  return state.byEpisodeId[episodeId];
}

const episodeRunnerSlice = createSlice({
  name: "episodeRunner",
  initialState,
  reducers: {
    episodeRunnerReset(state, action: PayloadAction<{ episodeId: string }>) {
      delete state.byEpisodeId[action.payload.episodeId];
    },
    episodeRunnerErrorSet(
      state,
      action: PayloadAction<{ episodeId: string; error: string | null }>,
    ) {
      const entry = ensureEpisodeEntry(state, action.payload.episodeId);
      entry.error = action.payload.error;
    },
    episodeRunnerSceneLoading(
      state,
      action: PayloadAction<{ episodeId: string; sceneId: string }>,
    ) {
      const entry = ensureEpisodeEntry(state, action.payload.episodeId);
      entry.activeSceneId = action.payload.sceneId;
      entry.sceneStatus = "loading";
      entry.error = null;
    },
    episodeRunnerSceneReceived(
      state,
      action: PayloadAction<{ episodeId: string; sceneId: string; scene: Scene }>,
    ) {
      const entry = ensureEpisodeEntry(state, action.payload.episodeId);
      entry.activeSceneId = action.payload.sceneId;
      entry.scene = action.payload.scene;
      entry.sceneStatus = "ready";
      entry.error = null;
    },
    episodeRunnerSceneFailed(
      state,
      action: PayloadAction<{
        episodeId: string;
        sceneId: string;
        error: string;
      }>,
    ) {
      const entry = ensureEpisodeEntry(state, action.payload.episodeId);
      entry.activeSceneId = action.payload.sceneId;
      entry.sceneStatus = "error";
      entry.error = action.payload.error;
      entry.scene = null;
    },
    episodeRunnerSceneCleared(
      state,
      action: PayloadAction<{ episodeId: string; sceneId: string | null }>,
    ) {
      const entry = ensureEpisodeEntry(state, action.payload.episodeId);
      entry.activeSceneId = action.payload.sceneId;
      entry.sceneStatus = "idle";
      entry.scene = null;
    },
  },
});

export const {
  episodeRunnerReset,
  episodeRunnerErrorSet,
  episodeRunnerSceneLoading,
  episodeRunnerSceneReceived,
  episodeRunnerSceneFailed,
  episodeRunnerSceneCleared,
} = episodeRunnerSlice.actions;
export const episodeRunnerReducer = episodeRunnerSlice.reducer;
