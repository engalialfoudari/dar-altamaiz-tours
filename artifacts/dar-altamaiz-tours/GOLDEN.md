# Golden Release — V18-6-2026

**Date:** 18 June 2026  
**Expo SDK:** 54.0.35  
**React Native:** 0.81.5  
**React:** 19.1.0

## Features locked in this release

### ✈️ Flights
- AI chatbot extracts origin, destination, dates, passengers from natural language (AR + EN)
- Puppeteer scrapes dt-tours.com live flight results (inline cards: carrier, times, stops, price)
- Fallback: server returns the exact dt-tours.com results page URL once searchId XHR fires (~25-30 s); in-app browser opens that URL automatically — no empty search form shown
- "Waiting" UI after 20 s with elapsed counter and manual tap option

### 🏨 Hotels
- Star filter (1–5★) with sidebar checkbox click on dt-tours.com before scraping
- Server-side strict star matching; `starsMismatch` warning banner when exact unavailable
- Star detection: Unicode ★ → data-star → fa-icon (scoped to category container only, avoids review stars)
- Per-hotel booking URL extracted from each card's anchor (not the shared city page)
- 10 results sorted cheapest → most expensive

### 🌴 Packages / Offers
- Opens dt-tours.com packages page in in-app WebView

## Dependency compatibility (all pins match Expo SDK 54 bundledNativeModules.json)

| Package | Version |
|---------|---------|
| react-native-reanimated | 4.1.7 |
| react-native-worklets | 0.5.1 |
| react-native-webview | 13.15.0 |
| react-native-gesture-handler | 2.28.0 |
| react-native-screens | 4.16.0 |
| react-native-safe-area-context | 5.6.2 |
| react-native-svg | 15.12.1 |
| expo-notifications | 0.32.17 |
| expo-haptics | 15.0.8 |
| expo-updates | 29.0.18 |

## Build profiles (eas.json)

- **preview** → APK (internal distribution)
- **production** → AAB (Google Play)

## Known build fix

`plugins/withAndroidPackaging.js` excludes `META-INF/versions/9/OSGI-INF/MANIFEST.MF` from the Gradle merge step, resolving a Java resource conflict between `jspecify` and `okhttp3`.
