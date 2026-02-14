# step 1 - redux toolkit integration local commands

Run these commands **after pulling the merged PR** to ensure the Step 1 Redux Toolkit foundation is installed and working locally.

## 1) Pull latest code

```bash
git pull
```

## 2) Install app dependencies (includes Redux Toolkit + React Redux)

```bash
cd app
npm install
```

## 3) Verify required packages are installed

```bash
npm ls @reduxjs/toolkit react-redux
```

## 4) Run lint to catch integration issues

```bash
npm run lint
```

## 5) Run TypeScript check

```bash
npx tsc --noEmit
```

## 6) Start the Expo app

```bash
npm run web
```

> You can also run mobile targets if needed:

```bash
npm run ios
npm run android
```

## Optional clean install (if you hit dependency issues)

```bash
rm -rf node_modules package-lock.json
npm install
```

## Optional Expo cache reset (if Metro acts stale)

```bash
npx expo start -c
```
