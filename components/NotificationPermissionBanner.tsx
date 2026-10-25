/**
 * NotificationPermissionBanner
 *
 * A safe-area-aware reminder shown when the user has
 * blocked notifications. Tapping the button deep-links to OS settings.
 *
 * - Checks permission on mount and every time the app comes to foreground.
 * - Auto-hides as soon as the user enables notifications and returns to the app.
 * - Dismissal is saved locally; hidden reminders render no off-screen content.
 */

import React, { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AppState,
  type AppStateStatus,
  DeviceEventEmitter,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DISMISSED_KEY = "notification_permission_banner_dismissed";

export function NotificationPermissionBanner() {
  const [denied, setDenied] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [language, setLanguage] = useState<"en" | "ar" | "tr">("en");
  const insets = useSafeAreaInsets();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    let mounted = true;
    const syncLanguage = () => {
      AsyncStorage.getItem("home_lang")
        .then((value) => {
          if (mounted && (value === "en" || value === "ar" || value === "tr")) setLanguage(value);
        })
        .catch(() => {});
    };
    async function checkPermission() {
      if (Platform.OS === "web") return;
      try {
        // expo-notifications may be unavailable in Expo Go.
        const N = require("expo-notifications");
        const { status } = await N.getPermissionsAsync() as { status: string };
        if (mounted) setDenied(status === "denied");
      } catch {
        if (mounted) setDenied(false);
      }
    }
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((value) => { if (mounted) setDismissed(value === "true"); })
      .catch(() => { if (mounted) setDismissed(false); });
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
      (next: "en" | "ar" | "tr") => setLanguage(next),
    );

    return () => {
      mounted = false;
      sub.remove();
      languageSub.remove();
    };
  }, []);

  function openSettings() {
    Linking.openSettings().catch(() => {});
  }

  function dismiss() {
    setDismissed(true);
    AsyncStorage.setItem(DISMISSED_KEY, "true").catch(() => {});
  }

  // A fixed negative translation cannot hide an inset/font-size-dependent bar.
  if (Platform.OS === "web" || !denied || dismissed) return null;

  const copy = {
    en: { message: "Don’t miss exclusive offers — enable notifications", enable: "Enable →", enableLabel: "Enable notifications", dismiss: "Dismiss notification reminder" },
    ar: { message: "تفوّتك العروض الحصرية — فعّل الإشعارات", enable: "تفعيل ←", enableLabel: "تفعيل الإشعارات", dismiss: "إخفاء تذكير الإشعارات" },
    tr: { message: "Özel fırsatları kaçırmayın — bildirimleri etkinleştirin", enable: "Etkinleştir →", enableLabel: "Bildirimleri etkinleştir", dismiss: "Bildirim hatırlatıcısını kapat" },
  }[language];

  return (
    <View
      testID="notification-permission-banner"
      style={[
        styles.banner,
        { paddingTop: insets.top + 6, paddingLeft: insets.left + 14, paddingRight: insets.right + 14 },
      ]}
    >
      <Text style={styles.bell}>🔔</Text>
      <Text style={[styles.message, language === "ar" && styles.rtlText]}>
        {copy.message}
      </Text>
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={openSettings}
        accessibilityRole="button"
        accessibilityLabel={copy.enableLabel}
      >
        <Text style={styles.btnText}>{copy.enable}</Text>
      </Pressable>
      <Pressable
        testID="notification-permission-dismiss"
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel={copy.dismiss}
        style={styles.dismissBtn}
      >
        <Text style={styles.dismissText}>×</Text>
      </Pressable>
    </View>
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
    minWidth: 0,
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
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  dismissBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissText: { color: "#fff", fontSize: 24 },
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
