import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";

import colors from "@/constants/colors";

const { navy } = colors.light;
const nativeDriver = Platform.OS !== "web";

interface AnimatedSplashProps {
  onAnimationEnd: () => void;
}

export function AnimatedSplash({ onAnimationEnd }: AnimatedSplashProps) {
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const logoOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 480,
          useNativeDriver: nativeDriver,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 380,
          useNativeDriver: nativeDriver,
        }),
      ]),
      Animated.delay(180),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 420,
        useNativeDriver: nativeDriver,
      }),
    ]).start(() => onAnimationEnd());
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: overlayOpacity }]} pointerEvents="none">
      <View style={styles.logoWrap}>
        <Animated.Image
          source={require("../assets/images/dt-tours-logo-transparent.png")}
          style={[
            styles.logo,
            {
              transform: [{ scale: logoScale }],
              opacity: logoOpacity,
            },
          ]}
          resizeMode="contain"
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: navy,
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 60,
  },
  logo: {
    width: "70%",
    aspectRatio: 2.2,
  },
});
