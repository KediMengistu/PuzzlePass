import type { ExpoConfig } from "expo/config";

const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME ?? "app";
const APP_SLUG = process.env.EXPO_PUBLIC_APP_SLUG ?? "app";
const APP_SCHEME = process.env.EXPO_PUBLIC_APP_SCHEME ?? "puzzlepass";
const IOS_BUNDLE_IDENTIFIER = process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER;
const ANDROID_PACKAGE = process.env.EXPO_PUBLIC_ANDROID_PACKAGE;

const config: ExpoConfig = {
  name: APP_NAME,
  slug: APP_SLUG,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: APP_SCHEME,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    ...(IOS_BUNDLE_IDENTIFIER
      ? { bundleIdentifier: IOS_BUNDLE_IDENTIFIER }
      : {}),
  },
  android: {
    ...(ANDROID_PACKAGE ? { package: ANDROID_PACKAGE } : {}),
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
