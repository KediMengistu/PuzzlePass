import { PayloadAction, createSlice } from "@reduxjs/toolkit";

import type { AsyncStatus, Episode } from "@/store/types";

type EpisodesState = {
  items: Episode[];
  status: AsyncStatus;
  error: string | null;
};

const initialState: EpisodesState = {
  items: [],
  status: "idle",
  error: null,
};

const episodesSlice = createSlice({
  name: "episodes",
  initialState,
  reducers: {
    episodesLoading(state) {
      state.status = "loading";
      state.error = null;
    },
    episodesReceived(state, action: PayloadAction<Episode[]>) {
      state.items = action.payload;
      state.status = "ready";
      state.error = null;
    },
    episodesFailed(state, action: PayloadAction<string>) {
      state.status = "error";
      state.error = action.payload;
    },
    episodesCleared(state) {
      state.items = [];
      state.status = "idle";
      state.error = null;
    },
  },
});

export const {
  episodesLoading,
  episodesReceived,
  episodesFailed,
  episodesCleared,
} = episodesSlice.actions;
export const episodesReducer = episodesSlice.reducer;
