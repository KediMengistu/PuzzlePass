import { configureStore } from "@reduxjs/toolkit";

import { puzzleApi } from "./api/puzzle-api";
import { authReducer } from "./slices/auth-slice";
import { uiReducer } from "./slices/ui-slice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    [puzzleApi.reducerPath]: puzzleApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(puzzleApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
