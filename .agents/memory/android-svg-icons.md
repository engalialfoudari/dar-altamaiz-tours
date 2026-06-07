---
name: Android SVG Icons
description: Why @expo/vector-icons fails on Android and the correct replacement approach.
---

# Android Icon Rendering

## The rule
Never use @expo/vector-icons (Ionicons, Feather, etc.) in this app. Use react-native-svg inline SVG paths.

**Why:** On Android, font-based vector icons fail with rectangles/squares due to two compounding issues:
1. Font family name case sensitivity (Android is case-sensitive; Expo Go registers "Ionicons" capital-I, @expo/vector-icons@15.x uses "ionicons" lowercase)
2. New Architecture (Fabric) on Android handles font registration differently from iOS

**How to apply:** All tab bar icons, header icons, and any UI icons must use `<Svg>` + `<Path>/<Circle>/<Rect>` from `react-native-svg`. Use Feather-style 24x24 viewBox stroke paths. Active state = gold color + strokeWidth 2.2; inactive = muted color + strokeWidth 1.6.

**react-native-svg** is already installed at v15.12.1.

**File locations:**
- Tab icons: `components/BottomTabBar.tsx` — IconHome, IconGlobe, IconBriefcase, IconPhone
- Header back: `components/AppHeader.tsx` — ChevronLeft
- Error UI: `components/ErrorFallback.tsx` — IconAlertCircle, IconX
