import { PayloadAction, createSlice } from "@reduxjs/toolkit";

import type { AsyncStatus, EpisodeProgress } from "@/store/types";

type ProgressState = {
  byEpisodeId: Record<string, EpisodeProgress>;
  status: AsyncStatus;
  error: string | null;
};

const initialState: ProgressState = {
  byEpisodeId: {},
  status: "idle",
  error: null,
};

const progressSlice = createSlice({
  name: "progress",
  initialState,
  reducers: {
    progressLoading(state) {
      state.status = "loading";
      state.error = null;
    },
    progressEpisodeUpserted(state, action: PayloadAction<EpisodeProgress>) {
      const episodeId = action.payload.episodeId;
      if (!episodeId) return;

      state.byEpisodeId[episodeId] = action.payload;
      state.status = "ready";
      state.error = null;
    },
    progressEpisodeRemoved(state, action: PayloadAction<string>) {
      delete state.byEpisodeId[action.payload];
      state.status = "ready";
      state.error = null;
    },
    progressFailed(state, action: PayloadAction<string>) {
      state.status = "error";
      state.error = action.payload;
    },
    progressCleared(state) {
      state.byEpisodeId = {};
      state.status = "idle";
      state.error = null;
    },
  },
});

export const {
  progressLoading,
  progressEpisodeUpserted,
  progressEpisodeRemoved,
  progressFailed,
  progressCleared,
} = progressSlice.actions;
export const progressReducer = progressSlice.reducer;
