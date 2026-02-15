import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface EpisodesState {
  status: RequestStatus;
  episodeIds: string[];
}

const initialState: EpisodesState = {
  status: 'idle',
  episodeIds: [],
};

const episodesSlice = createSlice({
  name: 'episodes',
  initialState,
  reducers: {
    resetEpisodesState: () => initialState,
    setEpisodesStatus: (state, action: PayloadAction<RequestStatus>) => {
      state.status = action.payload;
    },
    setEpisodeIds: (state, action: PayloadAction<string[]>) => {
      state.episodeIds = action.payload;
    },
  },
});

export const { resetEpisodesState, setEpisodesStatus, setEpisodeIds } = episodesSlice.actions;
export default episodesSlice.reducer;
