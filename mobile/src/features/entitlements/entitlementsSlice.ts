import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface EntitlementsState {
  status: RequestStatus;
  entitledEpisodeIds: string[];
}

const initialState: EntitlementsState = {
  status: 'idle',
  entitledEpisodeIds: [],
};

const entitlementsSlice = createSlice({
  name: 'entitlements',
  initialState,
  reducers: {
    resetEntitlementsState: () => initialState,
    setEntitlementsStatus: (state, action: PayloadAction<RequestStatus>) => {
      state.status = action.payload;
    },
    setEntitledEpisodeIds: (state, action: PayloadAction<string[]>) => {
      state.entitledEpisodeIds = action.payload;
    },
  },
});

export const { resetEntitlementsState, setEntitlementsStatus, setEntitledEpisodeIds } =
  entitlementsSlice.actions;
export default entitlementsSlice.reducer;
