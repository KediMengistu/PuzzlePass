import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { User } from "firebase/auth";

export type AuthStatus = "idle" | "authenticated" | "unauthenticated";

type AuthState = {
  user: User | null;
  status: AuthStatus;
  provider: string | null;
};

const initialState: AuthState = {
  user: null,
  status: "idle",
  provider: null,
};

function resolveProvider(user: User | null): string | null {
  if (!user) return null;
  return user.providerData[0]?.providerId ?? null;
}

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    authStateChanged(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
      state.status = action.payload ? "authenticated" : "unauthenticated";
      state.provider = resolveProvider(action.payload);
    },
  },
});

export const { authStateChanged } = authSlice.actions;
export const authReducer = authSlice.reducer;
