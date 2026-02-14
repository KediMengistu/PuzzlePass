import { PayloadAction, createSlice } from "@reduxjs/toolkit";

type UiState = {
  globalError: string | null;
};

const initialState: UiState = {
  globalError: null,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setGlobalError(state, action: PayloadAction<string | null>) {
      state.globalError = action.payload;
    },
    clearGlobalError(state) {
      state.globalError = null;
    },
  },
});

export const { setGlobalError, clearGlobalError } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
