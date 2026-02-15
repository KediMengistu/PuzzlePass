import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const env = process.env as Record<string, string | undefined>;

const getRequiredEnvVar = (name: string): string => {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const firebaseConfig = {
  apiKey: getRequiredEnvVar("EXPO_PUBLIC_FIREBASE_API_KEY"),
  authDomain: getRequiredEnvVar("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: getRequiredEnvVar("EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: getRequiredEnvVar("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getRequiredEnvVar(
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  ),
  appId: getRequiredEnvVar("EXPO_PUBLIC_FIREBASE_APP_ID"),
  measurementId: getRequiredEnvVar("EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID"),
};

const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export { firebaseApp };

const shouldUseEmulators = __DEV__ && false;
const firebaseGlobals = globalThis as typeof globalThis & {
  __firebaseEmulatorsConnected?: boolean;
};

if (shouldUseEmulators && !firebaseGlobals.__firebaseEmulatorsConnected) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  firebaseGlobals.__firebaseEmulatorsConnected = true;
}
