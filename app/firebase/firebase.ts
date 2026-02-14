import { Platform } from "react-native";
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

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

// ---- App Check (WEB ONLY) ----
const ENABLE_APPCHECK = process.env.EXPO_PUBLIC_ENABLE_APPCHECK === "true";
const APPCHECK_SITE_KEY = process.env.EXPO_PUBLIC_APPCHECK_RECAPTCHA_SITE_KEY;

const isWeb = typeof window !== "undefined";

if (ENABLE_APPCHECK && isWeb) {
  const USE_EMULATORS = process.env.EXPO_PUBLIC_USE_EMULATORS === "true";
  if (USE_EMULATORS) {
    (globalThis as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  if (!APPCHECK_SITE_KEY) {
    console.warn(
      "App Check enabled but missing EXPO_PUBLIC_APPCHECK_RECAPTCHA_SITE_KEY",
    );
  } else {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(APPCHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, FUNCTIONS_REGION);
export const storage = getStorage(app);

// Use emulators only when explicitly enabled
const USE_EMULATORS = process.env.EXPO_PUBLIC_USE_EMULATORS === "true";

if (USE_EMULATORS) {
  const g = globalThis as any;

  if (!g.__FIREBASE_EMULATORS_CONNECTED__) {
    const defaultHost = Platform.OS === "android" ? "10.0.2.2" : "localhost";
    const EMULATOR_HOST = process.env.EXPO_PUBLIC_EMULATOR_HOST || defaultHost;

    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
    connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);
    connectStorageEmulator(storage, EMULATOR_HOST, 9199);

    g.__FIREBASE_EMULATORS_CONNECTED__ = true;
  }
}
