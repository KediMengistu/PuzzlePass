import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface ProgressState {
  status: RequestStatus;
  completedEpisodeIds: string[];
}

const initialState: ProgressState = {
  status: 'idle',
  completedEpisodeIds: [],
};

const progressSlice = createSlice({
  name: 'progress',
  initialState,
  reducers: {
    resetProgressState: () => initialState,
    setProgressStatus: (state, action: PayloadAction<RequestStatus>) => {
      state.status = action.payload;
    },
    setCompletedEpisodeIds: (state, action: PayloadAction<string[]>) => {
      state.completedEpisodeIds = action.payload;
    },
  },
});

export const { resetProgressState, setProgressStatus, setCompletedEpisodeIds } = progressSlice.actions;
export default progressSlice.reducer;
