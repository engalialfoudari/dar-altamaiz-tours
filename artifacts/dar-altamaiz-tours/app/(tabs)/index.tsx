import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const WEBSITE_URL = "https://dt-tours.com";
const SPLASH_DURATION = 3000;

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C96A";
const NAVY = "#0A1628";
const NAVY_MID = "#132040";

function LoadingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 200);
    const a3 = animate(dot3, 400);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.dotsContainer}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { opacity: dot }]}
        />
      ))}
    </View>
  );
}

function SplashScreenView({ onDone }: { onDone: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const dividerAnim = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(dividerAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(titleAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleAnim, {
          toValue: 1,
          duration: 600,
          delay: 100,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => onDone());
    }, SPLASH_DURATION);

    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim, titleAnim, subtitleAnim, dividerAnim, splashOpacity, onDone]);

  return (
    <Animated.View style={[styles.splashContainer, { opacity: splashOpacity }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={NAVY}
        translucent={false}
      />

      <View style={styles.bgOverlay} />

      <View style={styles.splashContent}>
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.iconRing}>
            <View style={styles.iconInner}>
              <View style={styles.crescentOuter}>
                <View style={styles.crescentInner} />
              </View>
              <View style={styles.starRow}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.starDot} />
                ))}
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.divider,
            {
              opacity: dividerAnim,
              transform: [
                {
                  scaleX: dividerAnim,
                },
              ],
            },
          ]}
        />

        <Animated.Text
          style={[
            styles.companyName,
            {
              opacity: titleAnim,
              transform: [
                {
                  translateY: titleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          Dar AlTamaiz Tours
        </Animated.Text>

        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: subtitleAnim,
              transform: [
                {
                  translateY: subtitleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          Your Journey, Our Excellence
        </Animated.Text>
      </View>

      <View style={styles.bottomSection}>
        <LoadingDots />
      </View>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const [showSplash, setShowSplash] = useState(true);
  const [webviewVisible, setWebviewVisible] = useState(false);
  const webviewRef = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!showSplash) {
      setWebviewVisible(true);
    }
  }, [showSplash]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const onBackPress = () => {
      if (canGoBack.current && webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, []);

  const handleNavStateChange = (navState: WebViewNavigation) => {
    canGoBack.current = navState.canGoBack;
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={NAVY}
        translucent={false}
      />

      {webviewVisible && (
        <WebView
          ref={webviewRef}
          source={{ uri: WEBSITE_URL }}
          style={StyleSheet.absoluteFill}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState={false}
          scalesPageToFit
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          onNavigationStateChange={handleNavStateChange}
          contentInsetAdjustmentBehavior="never"
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />
      )}

      {showSplash && (
        <SplashScreenView onDone={() => setShowSplash(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
  },
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: NAVY,
  },
  splashContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  logoContainer: {
    marginBottom: 32,
  },
  iconRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: NAVY_MID,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  iconInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  crescentOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 5,
    borderColor: GOLD,
    overflow: "hidden",
    position: "relative",
  },
  crescentInner: {
    position: "absolute",
    top: -4,
    right: -10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: NAVY_MID,
  },
  starRow: {
    flexDirection: "row",
    gap: 6,
  },
  starDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: GOLD_LIGHT,
  },
  divider: {
    width: 80,
    height: 1.5,
    backgroundColor: GOLD,
    marginBottom: 24,
    opacity: 0.7,
  },
  companyName: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: GOLD_LIGHT,
    textAlign: "center",
    letterSpacing: 1.5,
    marginBottom: 10,
    textShadowColor: GOLD,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#8A9BB5",
    textAlign: "center",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  bottomSection: {
    paddingBottom: 60,
    alignItems: "center",
  },
  dotsContainer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: GOLD,
  },
});
