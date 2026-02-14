import { configureStore } from "@reduxjs/toolkit";

import { puzzleApi } from "./api/puzzle-api";
import { authReducer } from "./slices/auth-slice";
import { checkoutReducer } from "./slices/checkout-slice";
import { entitlementsReducer } from "./slices/entitlements-slice";
import { episodesReducer } from "./slices/episodes-slice";
import { progressReducer } from "./slices/progress-slice";
import { uiReducer } from "./slices/ui-slice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    checkout: checkoutReducer,
    entitlements: entitlementsReducer,
    episodes: episodesReducer,
    progress: progressReducer,
    ui: uiReducer,
    [puzzleApi.reducerPath]: puzzleApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(puzzleApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
