import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface LocationState {
  status: RequestStatus;
  currentRegion: string | null;
}

const initialState: LocationState = {
  status: 'idle',
  currentRegion: null,
};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    resetLocationState: () => initialState,
    setLocationStatus: (state, action: PayloadAction<RequestStatus>) => {
      state.status = action.payload;
    },
    setCurrentRegion: (state, action: PayloadAction<string | null>) => {
      state.currentRegion = action.payload;
    },
  },
});

export const { resetLocationState, setLocationStatus, setCurrentRegion } = locationSlice.actions;
export default locationSlice.reducer;
