import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { User } from "firebase/auth";

export type AuthStatus = "idle" | "authenticated" | "unauthenticated";

type AuthState = {
  user: User | null;
  status: AuthStatus;
  provider: string | null;
  isAnonymous: boolean;
};

const initialState: AuthState = {
  user: null,
  status: "idle",
  provider: null,
  isAnonymous: false,
};

function resolveProvider(user: User | null): string | null {
  if (!user) return null;
  if (user.isAnonymous) return "anonymous";
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
      state.isAnonymous = action.payload?.isAnonymous ?? false;
    },
  },
});

export const { authStateChanged } = authSlice.actions;
export const authReducer = authSlice.reducer;
