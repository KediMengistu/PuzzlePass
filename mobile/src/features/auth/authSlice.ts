import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface AuthState {
  status: RequestStatus;
  userId: string | null;
}

const initialState: AuthState = {
  status: 'idle',
  userId: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    resetAuthState: () => initialState,
    setAuthStatus: (state, action: PayloadAction<RequestStatus>) => {
      state.status = action.payload;
    },
    setUserId: (state, action: PayloadAction<string | null>) => {
      state.userId = action.payload;
    },
  },
});

export const { resetAuthState, setAuthStatus, setUserId } = authSlice.actions;
export default authSlice.reducer;
