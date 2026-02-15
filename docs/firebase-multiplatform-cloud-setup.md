# Firebase Multi-Platform Cloud Setup (Web + iOS + Android)

This document describes the configuration work completed to support:

- Firebase config for web, iOS, and Android
- Env-driven app identity settings (bundle/package/scheme)
- Cloud-only runtime defaults (emulators disabled by default)

## What Changed

1. `app/firebase/firebase.ts`
- Refactored Firebase initialization to support platform-specific env overrides with shared fallbacks.
- Added cloud-first env parsing (`EXPO_PUBLIC_USE_EMULATORS` now defaults to `false` when unset).
- Kept emulator wiring available but opt-in only.

2. `app/app.config.ts` (new)
- Added dynamic Expo config driven by env variables.
- Supports env-based:
  - app name/slug/scheme
  - iOS bundle identifier
  - Android package name

3. `app/.env`
- Refactored with sections and new variables for:
  - shared Firebase config
  - optional web/iOS/android Firebase overrides
  - Google sign-in client IDs
  - cloud runtime controls
- Set `EXPO_PUBLIC_USE_EMULATORS=false`.

4. `app/firebase/auth-helpers.ts`
- Added fallback support for `EXPO_PUBLIC_GOOGLE_CLIENT_ID` so platform-specific client IDs can inherit a common value if desired.

## Env Key Strategy

The app reads Firebase values like this:

1. Platform-specific key (if present), then
2. Shared key fallback

Examples:
- iOS API key: `EXPO_PUBLIC_FIREBASE_IOS_API_KEY` -> fallback `EXPO_PUBLIC_FIREBASE_API_KEY`
- Android app id: `EXPO_PUBLIC_FIREBASE_ANDROID_APP_ID` -> fallback `EXPO_PUBLIC_FIREBASE_APP_ID`
- Web auth domain: `EXPO_PUBLIC_FIREBASE_WEB_AUTH_DOMAIN` -> fallback `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`

## What You Need To Plug In

Use Firebase Console -> **Project settings** -> **Your apps**.

### Shared Firebase keys (minimum baseline)
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` (web domain, e.g. `your-project.firebaseapp.com`)
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID` (web app id or shared app id)

### Platform-specific Firebase overrides (recommended now that iOS/Android apps exist)
- iOS:
  - `EXPO_PUBLIC_FIREBASE_IOS_API_KEY`
  - `EXPO_PUBLIC_FIREBASE_IOS_PROJECT_ID`
  - `EXPO_PUBLIC_FIREBASE_IOS_STORAGE_BUCKET`
  - `EXPO_PUBLIC_FIREBASE_IOS_MESSAGING_SENDER_ID`
  - `EXPO_PUBLIC_FIREBASE_IOS_APP_ID`
- Android:
  - `EXPO_PUBLIC_FIREBASE_ANDROID_API_KEY`
  - `EXPO_PUBLIC_FIREBASE_ANDROID_PROJECT_ID`
  - `EXPO_PUBLIC_FIREBASE_ANDROID_STORAGE_BUCKET`
  - `EXPO_PUBLIC_FIREBASE_ANDROID_MESSAGING_SENDER_ID`
  - `EXPO_PUBLIC_FIREBASE_ANDROID_APP_ID`
- Web (optional overrides):
  - `EXPO_PUBLIC_FIREBASE_WEB_API_KEY`
  - `EXPO_PUBLIC_FIREBASE_WEB_AUTH_DOMAIN`
  - `EXPO_PUBLIC_FIREBASE_WEB_PROJECT_ID`
  - `EXPO_PUBLIC_FIREBASE_WEB_STORAGE_BUCKET`
  - `EXPO_PUBLIC_FIREBASE_WEB_MESSAGING_SENDER_ID`
  - `EXPO_PUBLIC_FIREBASE_WEB_APP_ID`
  - `EXPO_PUBLIC_FIREBASE_WEB_MEASUREMENT_ID`

### Google sign-in client IDs
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

Optional fallback:
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (used when platform-specific keys are omitted)

### Expo app identity
- `EXPO_PUBLIC_APP_SCHEME` (currently `puzzlepass`)
- `EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER`
- `EXPO_PUBLIC_ANDROID_PACKAGE`
- Optional:
  - `EXPO_PUBLIC_APP_NAME`
  - `EXPO_PUBLIC_APP_SLUG`

## Cloud-Only Runtime Settings

For Firebase cloud usage (no local emulators):

- `EXPO_PUBLIC_USE_EMULATORS=false`
- `EXPO_PUBLIC_FIREBASE_CLOUD_FUNCTIONS_REGION=<your functions region>`

If App Check is enabled:
- `EXPO_PUBLIC_ENABLE_APPCHECK=true`
- `EXPO_PUBLIC_APPCHECK_RECAPTCHA_SITE_KEY=<site key>` (web only)

## Recommended Setup Flow

1. Update `app/.env` directly with your real Firebase and OAuth values.

2. Fill all shared Firebase keys.

3. Fill iOS/Android override keys from the iOS and Android app configs in Firebase Console.

4. Fill Google OAuth client IDs for web/iOS/android.

5. Set:
- `EXPO_PUBLIC_USE_EMULATORS=false`
- your region in `EXPO_PUBLIC_FIREBASE_CLOUD_FUNCTIONS_REGION`

6. Set `EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER` and `EXPO_PUBLIC_ANDROID_PACKAGE` to match the app IDs you registered in Firebase.

7. Restart Expo dev server after env changes:
```bash
npx expo start -c
```

## Verification Checklist

- Web sign-in works with Google.
- iOS sign-in works with iOS OAuth client id.
- Android sign-in works with Android OAuth client id.
- Checkout calls hit cloud Functions (not localhost).
- Firestore/Storage calls use project cloud resources.
