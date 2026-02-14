import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { User } from "firebase/auth";

export type AuthStatus = "idle" | "authenticated" | "unauthenticated";

type AuthState = {
  user: User | null;
  status: AuthStatus;
};

const initialState: AuthState = {
  user: null,
  status: "idle",
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    authStateChanged(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
      state.status = action.payload ? "authenticated" : "unauthenticated";
    },
  },
});

export const { authStateChanged } = authSlice.actions;
export const authReducer = authSlice.reducer;
