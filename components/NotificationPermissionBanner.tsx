/**
 * NotificationPermissionBanner
 *
 * A slim persistent bar that slides down from the top when the user has
 * blocked notifications. Tapping the button deep-links to OS settings.
 *
 * - Checks permission on mount and every time the app comes to foreground.
 * - Auto-hides as soon as the user enables notifications and returns to the app.
 * - No permanent dismiss: if the user doesn't act, it stays visible as a reminder.
 */

import React, { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Animated,
  AppState,
  type AppStateStatus,
  DeviceEventEmitter,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function NotificationPermissionBanner() {
  const [denied, setDenied] = useState(false);
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const slideY = useRef(new Animated.Value(-90)).current;
  const insets = useSafeAreaInsets();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const syncLanguage = () => {
      AsyncStorage.getItem("home_lang")
        .then((value) => {
          if (value === "en" || value === "ar") setLanguage(value);
        })
        .catch(() => {});
    };
    syncLanguage();
    checkPermission();

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        next === "active"
      ) {
        // Re-check every time app returns to foreground so the banner hides
        // automatically once the user enables notifications in settings.
        checkPermission();
        syncLanguage();
      }
      appState.current = next;
    });
    const languageSub = DeviceEventEmitter.addListener(
      "homeLanguageChanged",
      (next: "en" | "ar") => setLanguage(next),
    );

    return () => {
      sub.remove();
      languageSub.remove();
    };
  }, []);

  async function checkPermission() {
    if (Platform.OS === "web") return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const N = require("expo-notifications");
      const { status } = await N.getPermissionsAsync() as { status: string };
      const isDenied = status === "denied";
      setDenied(isDenied);
      Animated.spring(slideY, {
        toValue: isDenied ? 0 : -90,
        useNativeDriver: true,
        tension: 70,
        friction: 12,
      }).start();
    } catch {
      // expo-notifications unavailable (e.g. web / Expo Go) — stay hidden
    }
  }

  function openSettings() {
    Linking.openSettings().catch(() => {});
  }

  // Keep the node in tree always so the animation can run,
  // but make it non-interactive when hidden.
  return (
    <Animated.View
      style={[
        styles.banner,
        { paddingTop: insets.top + 6, transform: [{ translateY: slideY }] },
      ]}
      pointerEvents={denied ? "auto" : "none"}
    >
      <Text style={styles.bell}>🔔</Text>
      <Text style={[styles.message, language === "ar" && styles.rtlText]} numberOfLines={2}>
        {language === "ar"
          ? "تفوّتك العروض الحصرية — فعّل الإشعارات"
          : "Don’t miss exclusive offers — enable notifications"}
      </Text>
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={openSettings}
        accessibilityRole="button"
        accessibilityLabel={language === "ar" ? "تفعيل الإشعارات" : "Enable notifications"}
      >
        <Text style={styles.btnText}>{language === "ar" ? "تفعيل ←" : "Enable →"}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: "#1A1500",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,175,55,0.35)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 8,
    // Shadow so it floats above content
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 12,
  },
  bell: {
    fontSize: 16,
  },
  message: {
    flex: 1,
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "left",
    lineHeight: 18,
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  btn: {
    backgroundColor: "#D4AF37",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  btnPressed: {
    opacity: 0.75,
  },
  btnText: {
    color: "#000",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
});
