import { configureStore } from '@reduxjs/toolkit';

import authReducer from '@/src/features/auth/authSlice';
import entitlementsReducer from '@/src/features/entitlements/entitlementsSlice';
import episodesReducer from '@/src/features/episodes/episodesSlice';
import locationReducer from '@/src/features/location/locationSlice';
import progressReducer from '@/src/features/progress/progressSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    episodes: episodesReducer,
    entitlements: entitlementsReducer,
    progress: progressReducer,
    location: locationReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
