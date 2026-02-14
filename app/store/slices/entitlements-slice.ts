import { PayloadAction, createSlice } from "@reduxjs/toolkit";

import type { AsyncStatus, Entitlement } from "@/store/types";

type EntitlementsState = {
  value: Entitlement | null;
  status: AsyncStatus;
  error: string | null;
};

const initialState: EntitlementsState = {
  value: null,
  status: "idle",
  error: null,
};

const entitlementsSlice = createSlice({
  name: "entitlements",
  initialState,
  reducers: {
    entitlementsLoading(state) {
      state.status = "loading";
      state.error = null;
    },
    entitlementsReceived(state, action: PayloadAction<Entitlement | null>) {
      state.value = action.payload;
      state.status = "ready";
      state.error = null;
    },
    entitlementsFailed(state, action: PayloadAction<string>) {
      state.status = "error";
      state.error = action.payload;
    },
    entitlementsCleared(state) {
      state.value = null;
      state.status = "idle";
      state.error = null;
    },
  },
});

export const {
  entitlementsLoading,
  entitlementsReceived,
  entitlementsFailed,
  entitlementsCleared,
} = entitlementsSlice.actions;
export const entitlementsReducer = entitlementsSlice.reducer;
