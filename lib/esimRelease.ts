import { Platform } from "react-native";

// The published web export hides eSIM until the owner approves its release.
// Expo development and native builds retain the existing screen.
export const isEsimReleased = Platform.OS !== "web" || process.env.EXPO_PUBLIC_ESIM_RELEASED !== "false";