import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";

import { HotelPortalIcon } from "@/components/HotelPortalIcon";

export function LoadingCountdown({
  message,
  durationSeconds = 20,
  color = "#003580",
  mutedColor = "#64748B",
  rtl = false,
}: {
  message: string;
  durationSeconds?: number;
  color?: string;
  mutedColor?: string;
  rtl?: boolean;
}) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const watchMotion = useRef(new Animated.Value(0)).current;
  const nativeDriver = Platform.OS !== "web";

  useEffect(() => {
    setSecondsLeft(durationSeconds);
    const countdown = setInterval(() => {
      setSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1_000);
    return () => clearInterval(countdown);
  }, [durationSeconds]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(watchMotion, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: nativeDriver,
        }),
        Animated.timing(watchMotion, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: nativeDriver,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [nativeDriver, watchMotion]);

  return (
    <View style={styles.wrap} accessibilityLabel={`${message} ${secondsLeft}s`}>
      <Animated.View
        style={{
          transform: [
            {
              rotate: watchMotion.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: ["-10deg", "10deg", "-10deg"],
              }),
            },
          ],
        }}
      >
        <HotelPortalIcon name="time" size={38} color={color} />
      </Animated.View>
      <Text style={[styles.counter, { color }]}>{secondsLeft > 0 ? `${secondsLeft}s` : "…"}</Text>
      <Text style={[styles.message, { color: mutedColor }, rtl && styles.rtlText]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 9,
  },
  counter: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  message: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  rtlText: {
    writingDirection: "rtl",
  },
});