import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";

import { auth } from "./firebase";

type GoogleSignInResult = "signed_in" | "redirecting";

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

WebBrowser.maybeCompleteAuthSession();

function createNonce() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function getGoogleClientIdForPlatform() {
  if (Platform.OS === "ios") return GOOGLE_IOS_CLIENT_ID;
  if (Platform.OS === "android") return GOOGLE_ANDROID_CLIENT_ID;
  return GOOGLE_WEB_CLIENT_ID;
}

function parseAuthResultUrl(url: string) {
  const hash = url.includes("#") ? url.split("#")[1] ?? "" : "";
  const query = url.includes("?") ? url.split("?")[1]?.split("#")[0] ?? "" : "";

  const hashParams = new URLSearchParams(hash);
  const queryParams = new URLSearchParams(query);

  return {
    idToken: hashParams.get("id_token") ?? queryParams.get("id_token"),
    accessToken:
      hashParams.get("access_token") ?? queryParams.get("access_token"),
  };
}

async function signInWithGoogleWeb(): Promise<GoogleSignInResult> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    await signInWithPopup(auth, provider);
    return "signed_in";
  } catch (error: any) {
    const code = String(error?.code ?? "");

    const shouldFallbackToRedirect =
      code.includes("popup") || code.includes("operation-not-supported");

    if (!shouldFallbackToRedirect) {
      throw error;
    }

    await signInWithRedirect(auth, provider);
    return "redirecting";
  }
}

async function signInWithGoogleNative(): Promise<GoogleSignInResult> {
  const clientId = getGoogleClientIdForPlatform();
  if (!clientId) {
    throw new Error(
      "Missing Google OAuth client id for this platform. Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID or EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID.",
    );
  }

  const redirectUri = Linking.createURL("auth/google");
  const nonce = createNonce();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "id_token token",
    scope: "openid profile email",
    nonce,
    prompt: "select_account",
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type !== "success" || !result.url) {
    throw new Error("Google sign-in cancelled.");
  }

  const { idToken, accessToken } = parseAuthResultUrl(result.url);

  if (!idToken && !accessToken) {
    throw new Error("Google sign-in did not return an auth token.");
  }

  const credential = GoogleAuthProvider.credential(idToken, accessToken ?? undefined);
  await signInWithCredential(auth, credential);
  return "signed_in";
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (Platform.OS === "web") {
    return signInWithGoogleWeb();
  }
  return signInWithGoogleNative();
}

export async function signOutCurrentUser() {
  return signOut(auth);
}
