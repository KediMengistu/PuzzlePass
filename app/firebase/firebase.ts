import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Fail fast for required keys only
const requiredKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
] as const;

for (const k of requiredKeys) {
  if (!firebaseConfig[k]) {
    throw new Error(`Missing Firebase config env var: ${k}`);
  }
}

const FUNCTIONS_REGION =
  process.env.EXPO_PUBLIC_FIREBASE_CLOUD_FUNCTIONS_REGION ??
  "northamerica-northeast2";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, FUNCTIONS_REGION);
export const storage = getStorage(app);

// Use emulators only when explicitly enabled
const USE_EMULATORS = process.env.EXPO_PUBLIC_USE_EMULATORS === "true";

if (USE_EMULATORS) {
  // Guard against reconnecting during Fast Refresh / hot reload
  const g = globalThis as any;

  if (!g.__FIREBASE_EMULATORS_CONNECTED__) {
    connectAuthEmulator(auth, "http://localhost:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, "localhost", 8080);
    connectFunctionsEmulator(functions, "localhost", 5001);
    connectStorageEmulator(storage, "localhost", 9199);

    g.__FIREBASE_EMULATORS_CONNECTED__ = true;
  }
}
