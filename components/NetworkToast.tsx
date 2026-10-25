/**
 * NetworkToast
 *
 * Listens for connectivity changes and shows a brief green banner
 * at the top of the screen when the connection is restored after
 * being offline. The toast auto-dismisses after 3 seconds.
 *
 * Usage: render <NetworkToast /> once inside the root layout.
 */
import NetInfo from "@react-native-community/netinfo";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function NetworkToast() {
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOffline = useRef(false);

  function show() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVisible(true);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();

    hideTimer.current = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(({ finished }) => { if (finished) setVisible(false); });
    }, 3000);
  }

  useEffect(() => {
    if (Platform.OS === "web") return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (!online) {
        wasOffline.current = true;
      } else if (wasOffline.current) {
        wasOffline.current = false;
        show();
      }
    });

    return () => {
      unsubscribe();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      opacity.stopAnimation();
    };
  }, []);

  if (!visible) return null;

  return (
    <Animated.View
      testID="network-toast"
      style={[styles.toast, {
        paddingTop: insets.top + 10,
        paddingLeft: insets.left + 16,
        paddingRight: insets.right + 16,
        opacity,
      }]}
      pointerEvents="none"
    >
      <Text style={styles.icon}>✓</Text>
      <Text style={styles.text}>تم استعادة الاتصال</Text>
      <Text style={styles.textEn}>Back online</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    backgroundColor: "#1a7a4a",
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 8,
  },
  icon: {
    color: "#7fffb8",
    fontSize: 16,
    fontWeight: "700",
  },
  text: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  textEn: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
});
