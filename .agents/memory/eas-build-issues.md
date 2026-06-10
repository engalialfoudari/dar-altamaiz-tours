---
name: EAS Build Issues - Dar AlTamaiz Tours
description: Diagnosis and fix history for Android Gradle/Metro failures in this Expo WebView wrapper app
---

## Root cause of all Gradle failures (confirmed from actual log)

The real error was NOT in worklets C++ compilation. The actual Gradle failure was:

```
Execution failed for task ':app:mergeReleaseJavaResource'.
> 2 files found with path 'META-INF/versions/9/OSGI-INF/MANIFEST.MF' from inputs:
   - org.jspecify:jspecify:1.0.0/jspecify-1.0.0.jar
   - com.squareup.okhttp3:logging-interceptor:5.3.2/logging-interceptor-5.3.2.jar
```

**Fix applied:** `expo-build-properties` plugin in app.json with:
```json
{ "android": { "packagingOptions": { "excludes": ["META-INF/versions/9/OSGI-INF/MANIFEST.MF"] } } }
```

## How to fetch EAS build logs (for future debugging)

1. GraphQL query: `{ builds { byId(buildId: "...") { logFiles } } }`
2. Response contains a signed GCS URL (expires in 15 min) with Brotli encoding
3. Fetch with: `curl -s "$LOG_URL" | python3 -c "import sys,brotli; ..."`
4. Content is JSON Lines format: each line has `"msg"` field with the actual log text

## Build timeline facts

- C++ compilation (worklets + reanimated) takes ~18-20 minutes
- mergeReleaseJavaResource runs AFTER C++ compilation (explains 22-min failures)
- EAS logs can only be obtained via the `logFiles` GraphQL field on the Build type

## Other build-related findings

### Metro failure without worklets
- `react-native-reanimated@4.1.7` imports from `react-native-worklets` at JS level
- `WorkletsModule` throws at runtime if native proxy absent — cannot exclude from autolinking
- worklets MUST be installed as a native module

### Worklets version
- worklets@0.8.3 is installed (reanimated 4.1.x supports 0.5.x–0.8.x per compatibility.json)
- worklets@0.5.1 is the Expo SDK 54 pin but caused same Gradle failure (Java resource conflict)

### newArchEnabled
- Added `plugins/withNewArch.js` config plugin that writes `newArchEnabled=true` to gradle.properties
- Also set `ORG_GRADLE_PROJECT_newArchEnabled=true` in eas.json env (belt-and-suspenders)
- The app.json `"newArchEnabled": true` at top level does NOT write to Android gradle.properties by itself

### Removed packages (confirmed unused, removed to reduce build complexity)
- react-native-keyboard-controller, expo-glass-effect, expo-haptics, expo-image-picker
- expo-location, expo-blur, expo-linear-gradient

**Why:** autoInstallPeers: false in pnpm-workspace.yaml; these were noise that bloated the native build.
