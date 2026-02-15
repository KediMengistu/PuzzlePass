# PuzzlePass App

This app is configured for Expo + Firebase across web, iOS, and Android.

## Setup Guides

- Firebase multi-platform cloud setup:
  - `../docs/firebase-multiplatform-cloud-setup.md`

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Configure env:
- Update `app/.env` directly with Firebase and Google OAuth keys
- Keep `EXPO_PUBLIC_USE_EMULATORS=false` for cloud usage

3. Start app:
```bash
npx expo start -c
```

## Platform Launch Commands

```bash
npm run web
npm run ios
npm run android
```
