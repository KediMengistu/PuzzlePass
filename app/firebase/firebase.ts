import { Platform } from "react-native";
import { FirebaseOptions, initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

type FirebasePlatform = "WEB" | "IOS" | "ANDROID";

const FIREBASE_PLATFORM: FirebasePlatform =
  Platform.OS === "ios" ? "IOS" : Platform.OS === "android" ? "ANDROID" : "WEB";

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readBooleanEnv(name: string, defaultValue: boolean): boolean {
  const value = readEnv(name);
  if (!value) return defaultValue;
  return value.toLowerCase() === "true";
}

function readFirebaseEnv(
  suffix: string,
  options?: { required?: boolean; sharedSuffix?: string },
) {
  const platformName = `EXPO_PUBLIC_FIREBASE_${FIREBASE_PLATFORM}_${suffix}`;
  const sharedName = `EXPO_PUBLIC_FIREBASE_${options?.sharedSuffix ?? suffix}`;

  const value = readEnv(platformName) ?? readEnv(sharedName);

  if (options?.required && !value) {
    throw new Error(
      `Missing Firebase env for ${suffix}. Set ${platformName} or ${sharedName}.`,
    );
  }

  return value;
}

function buildFirebaseConfig(): FirebaseOptions {
  const config: FirebaseOptions = {
    apiKey: readFirebaseEnv("API_KEY", { required: true }),
    projectId: readFirebaseEnv("PROJECT_ID", { required: true }),
    storageBucket: readFirebaseEnv("STORAGE_BUCKET", { required: true }),
    messagingSenderId: readFirebaseEnv("MESSAGING_SENDER_ID", {
      required: true,
    }),
    appId: readFirebaseEnv("APP_ID", { required: true }),
  };

  const authDomain = readFirebaseEnv("AUTH_DOMAIN", {
    required: FIREBASE_PLATFORM === "WEB",
  });
  if (authDomain) {
    config.authDomain = authDomain;
  }

  if (FIREBASE_PLATFORM === "WEB") {
    const measurementId = readFirebaseEnv("MEASUREMENT_ID");
    if (measurementId) {
      config.measurementId = measurementId;
    }
  }

  return config;
}

const firebaseConfig = buildFirebaseConfig();

const FUNCTIONS_REGION =
  process.env.EXPO_PUBLIC_FIREBASE_CLOUD_FUNCTIONS_REGION ??
  "northamerica-northeast2";

const app = initializeApp(firebaseConfig);

// ---- App Check (WEB ONLY) ----
const ENABLE_APPCHECK = readBooleanEnv("EXPO_PUBLIC_ENABLE_APPCHECK", false);
const APPCHECK_SITE_KEY = readEnv("EXPO_PUBLIC_APPCHECK_RECAPTCHA_SITE_KEY");

const isWeb = typeof window !== "undefined";

if (ENABLE_APPCHECK && isWeb) {
  const USE_EMULATORS = readBooleanEnv("EXPO_PUBLIC_USE_EMULATORS", false);
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
const USE_EMULATORS = readBooleanEnv("EXPO_PUBLIC_USE_EMULATORS", false);

if (USE_EMULATORS) {
  const g = globalThis as any;

  if (!g.__FIREBASE_EMULATORS_CONNECTED__) {
    const defaultHost = Platform.OS === "android" ? "10.0.2.2" : "localhost";
    const EMULATOR_HOST = readEnv("EXPO_PUBLIC_EMULATOR_HOST") || defaultHost;

    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
    connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);
    connectStorageEmulator(storage, EMULATOR_HOST, 9199);

    g.__FIREBASE_EMULATORS_CONNECTED__ = true;
  }
}
