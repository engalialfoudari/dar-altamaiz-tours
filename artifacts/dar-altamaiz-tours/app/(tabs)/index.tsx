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
            useNativeDriver: false,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: false,
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
        <Animated.View key={i} style={[styles.dot, { opacity: dot }]} />
      ))}
    </View>
  );
}

function SplashScreenView({ onDone }: { onDone: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: false,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: false,
      }).start(() => onDone());
    }, SPLASH_DURATION);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.splashContainer, { opacity: splashOpacity }]}>
      {Platform.OS !== "web" && (
        <StatusBar
          barStyle="light-content"
          backgroundColor={NAVY}
          translucent={false}
        />
      )}

      <View style={styles.splashContent}>
        <Animated.View
          style={[
            styles.logoContainer,
            { transform: [{ scale: scaleAnim }] },
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

        <View style={styles.divider} />

        <Text style={styles.companyName}>Dar AlTamaiz Tours</Text>

        <Text style={styles.tagline}>Your Journey, Our Excellence</Text>
      </View>

      <View style={styles.bottomSection}>
        <LoadingDots />
      </View>
    </Animated.View>
  );
}

function NativeWebViewScreen() {
  const WebView = require("react-native-webview").WebView;
  const webviewRef = useRef<any>(null);
  const canGoBack = useRef(false);

  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack.current && webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );
    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={NAVY}
        translucent={false}
      />
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
        onNavigationStateChange={(navState: any) => {
          canGoBack.current = navState.canGoBack;
        }}
        contentInsetAdjustmentBehavior="never"
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function WebIframeScreen() {
  return (
    <View style={styles.container}>
      <iframe
        src={WEBSITE_URL}
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          border: "none",
        }}
        title="Dar AlTamaiz Tours"
      />
    </View>
  );
}

export default function HomeScreen() {
  const [showSplash, setShowSplash] = useState(true);
  const [webviewVisible, setWebviewVisible] = useState(false);

  useEffect(() => {
    if (!showSplash) {
      setWebviewVisible(true);
    }
  }, [showSplash]);

  return (
    <View style={styles.container}>
      {webviewVisible &&
        (Platform.OS === "web" ? (
          <WebIframeScreen />
        ) : (
          <NativeWebViewScreen />
        ))}

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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
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
