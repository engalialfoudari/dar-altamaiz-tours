import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

const STORAGE_KEY = "has_shown_notification_rescue_popup";
const NAVY = "#1B3A72";

export function NotificationRescueModal() {
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    checkAndShow();
  }, []);

  async function checkAndShow() {
    if (Platform.OS === "web") return;

    let N: any = null;
    try {
      N = require("expo-notifications");
    } catch { return; }
    if (!N) return;

    try {
      const alreadyShown = await AsyncStorage.getItem(STORAGE_KEY);
      if (alreadyShown === "true") return;

      const { status } = await N.getPermissionsAsync();
      // Only show rescue modal when the user has actively DENIED notifications.
      // "undetermined" means never asked yet — that's handled by the normal permission flow.
      if (status !== "denied") return;

      await AsyncStorage.setItem(STORAGE_KEY, "true");

      setTimeout(() => {
        setVisible(true);
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        ]).start();
      }, 2500);
    } catch { }
  }

  function dismiss() {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.94, duration: 200, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  }

  function openSettings() {
    Linking.openSettings().catch(() => { });
    dismiss();
  }

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>🔔</Text>
          </View>

          <Text style={styles.titleAr}>تنبيه مهم</Text>
          <Text style={styles.titleEn}>Important Notice</Text>

          <Text style={styles.bodyAr}>
            {"نلاحظ أنك قمت بإيقاف الإشعارات، وبالتالي لن تتمكن من استلام آخر عروضنا الحصرية والتنبيهات الذكية والجديدة التي تهمك أثناء السفر."}
          </Text>
          <Text style={styles.bodyEn}>
            {"You've disabled notifications, so you'll miss our exclusive deals and smart travel alerts."}
          </Text>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            onPress={openSettings}
          >
            <Text style={styles.primaryBtnAr}>تفعيل الإشعارات الآن</Text>
            <Text style={styles.primaryBtnEn}>Enable Notifications</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.6 }]}
            onPress={dismiss}
          >
            <Text style={styles.secondaryBtnTxt}>لاحقاً  /  Later</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: "#0D0D0D",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D4AF37",
    padding: 24,
    width: "100%",
    alignItems: "center",
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1A1500",
    borderWidth: 1.5,
    borderColor: "#D4AF37",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  icon: {
    fontSize: 24,
  },
  titleAr: {
    color: "#D4AF37",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 2,
  },
  titleEn: {
    color: "rgba(212,175,55,0.6)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  bodyAr: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    lineHeight: 22,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    marginBottom: 6,
  },
  bodyEn: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    marginBottom: 18,
  },
  divider: {
    height: 1,
    backgroundColor: "#1E1E1E",
    width: "100%",
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: NAVY,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 26,
    alignItems: "center",
    marginBottom: 10,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  primaryBtnAr: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  primaryBtnEn: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    paddingVertical: 8,
    alignItems: "center",
  },
  secondaryBtnTxt: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
