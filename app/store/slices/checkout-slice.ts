import { AnyAction, createSlice } from "@reduxjs/toolkit";

import { puzzleApi } from "@/store/api/puzzle-api";
import type { VerifyCheckoutSessionOutput } from "@/store/api/puzzle-api";
import type { AsyncStatus } from "@/store/types";

type RedirectStatus = "idle" | "pending" | "cancelled" | "success";

type CheckoutState = {
  createSession: {
    status: AsyncStatus;
    episodeId: string | null;
    url: string | null;
    reused: boolean | null;
    error: string | null;
  };
  verifySession: {
    status: AsyncStatus;
    sessionId: string | null;
    result: VerifyCheckoutSessionOutput | null;
    error: string | null;
  };
  redirectStatus: RedirectStatus;
};

function createInitialCreateSessionState(): CheckoutState["createSession"] {
  return {
    status: "idle",
    episodeId: null,
    url: null,
    reused: null,
    error: null,
  };
}

function createInitialVerifySessionState(): CheckoutState["verifySession"] {
  return {
    status: "idle",
    sessionId: null,
    result: null,
    error: null,
  };
}

const initialState: CheckoutState = {
  createSession: createInitialCreateSessionState(),
  verifySession: createInitialVerifySessionState(),
  redirectStatus: "idle",
};

function getActionErrorMessage(action: AnyAction): string {
  const payloadMessage = action.payload?.message;
  if (typeof payloadMessage === "string" && payloadMessage.trim().length > 0) {
    return payloadMessage;
  }

  const errorMessage = action.error?.message;
  if (typeof errorMessage === "string" && errorMessage.trim().length > 0) {
    return errorMessage;
  }

  return "Request failed.";
}

const checkoutSlice = createSlice({
  name: "checkout",
  initialState,
  reducers: {
    checkoutFlowReset(state) {
      state.createSession = createInitialCreateSessionState();
      state.verifySession = createInitialVerifySessionState();
      state.redirectStatus = "idle";
    },
    checkoutRedirectStarted(state) {
      state.redirectStatus = "pending";
    },
    checkoutRedirectCancelled(state) {
      state.redirectStatus = "cancelled";
    },
    checkoutRedirectCompleted(state) {
      state.redirectStatus = "success";
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(
      puzzleApi.endpoints.createCheckoutSession.matchPending,
      (state, action) => {
        const episodeId = action.meta?.arg?.originalArgs?.episodeId ?? null;
        state.createSession = {
          status: "loading",
          episodeId,
          url: null,
          reused: null,
          error: null,
        };
      },
    );

    builder.addMatcher(
      puzzleApi.endpoints.createCheckoutSession.matchFulfilled,
      (state, action) => {
        state.createSession = {
          status: "ready",
          episodeId: state.createSession.episodeId,
          url: action.payload.url,
          reused: action.payload.reused,
          error: null,
        };
      },
    );

    builder.addMatcher(
      puzzleApi.endpoints.createCheckoutSession.matchRejected,
      (state, action) => {
        state.createSession = {
          status: "error",
          episodeId: state.createSession.episodeId,
          url: null,
          reused: null,
          error: getActionErrorMessage(action),
        };
      },
    );

    builder.addMatcher(
      puzzleApi.endpoints.verifyCheckoutSession.matchPending,
      (state, action) => {
        const sessionId = action.meta?.arg?.originalArgs?.sessionId ?? null;
        state.verifySession = {
          status: "loading",
          sessionId,
          result: null,
          error: null,
        };
      },
    );

    builder.addMatcher(
      puzzleApi.endpoints.verifyCheckoutSession.matchFulfilled,
      (state, action) => {
        state.verifySession = {
          status: "ready",
          sessionId: state.verifySession.sessionId,
          result: action.payload,
          error: null,
        };
      },
    );

    builder.addMatcher(
      puzzleApi.endpoints.verifyCheckoutSession.matchRejected,
      (state, action) => {
        state.verifySession = {
          status: "error",
          sessionId: state.verifySession.sessionId,
          result: null,
          error: getActionErrorMessage(action),
        };
      },
    );
  },
});

export const {
  checkoutFlowReset,
  checkoutRedirectStarted,
  checkoutRedirectCancelled,
  checkoutRedirectCompleted,
} = checkoutSlice.actions;
export const checkoutReducer = checkoutSlice.reducer;
