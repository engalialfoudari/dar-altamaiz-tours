import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Platform, StyleSheet, Text, View } from "react-native";

const nativeDriver = Platform.OS !== "web";
const SCREEN_WIDTH = Dimensions.get("window").width;

// Total splash duration (ms): logo-in 480 + hold 180 + fade-out 420 = 1080
// Progress bar fills over the same 1080ms window.
const PROGRESS_DURATION = 1080;

interface AnimatedSplashProps {
  onAnimationEnd: () => void;
}

export function AnimatedSplash({ onAnimationEnd }: AnimatedSplashProps) {
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const logoOpacity = useRef(new Animated.Value(0.6)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === "web") {
      onAnimationEnd();
      return;
    }

    // Progress bar + tagline run in parallel with the logo sequence
    Animated.parallel([
      Animated.timing(progressWidth, {
        toValue: SCREEN_WIDTH,
        duration: PROGRESS_DURATION,
        useNativeDriver: false, // width can't use native driver
      }),
      Animated.sequence([
        Animated.delay(220),
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: nativeDriver,
        }),
      ]),
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
      ]),
    ]).start(() => onAnimationEnd());
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: overlayOpacity }]} pointerEvents="none">
      <View style={styles.logoWrap}>
        <Animated.Image
          source={require("../assets/images/dt-tours-logo-email.png")}
          style={[
            styles.logo,
            {
              transform: [{ scale: logoScale }],
              opacity: logoOpacity,
            },
          ]}
          resizeMode="contain"
        />
        <Animated.View style={[styles.taglineWrap, { opacity: taglineOpacity }]}>
          <Text style={styles.taglineAr}>شريك سفرك الموثوق منذ 2008</Text>
          <Text style={styles.taglineEn}>Your Trusted Travel Partner Since 2008</Text>
        </Animated.View>
      </View>

      {/* Progress bar at the bottom */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ffffff",
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
  taglineWrap: {
    alignItems: "center",
    marginTop: 14,
    gap: 2,
  },
  taglineAr: {
    fontSize: 13,
    color: "#0A1628",
    fontWeight: "600",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  taglineEn: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "400",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  progressTrack: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#e5e7eb",
  },
  progressFill: {
    height: 3,
    backgroundColor: "#D4AF37",
  },
});
