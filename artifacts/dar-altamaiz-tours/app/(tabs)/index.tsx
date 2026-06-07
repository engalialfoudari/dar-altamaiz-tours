import NetInfo from "@react-native-community/netinfo";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { BottomTabBar, Tab, TabKey, TABS } from "@/components/BottomTabBar";
import colors from "@/constants/colors";

const { gold, navy } = colors.light;

const INJECTED_JS = `
(function() {
  var style = document.createElement('style');
  style.id = '__dt_native_style';
  var existing = document.getElementById('__dt_native_style');
  if (existing) existing.remove();
  style.textContent = 'body{overflow-x:hidden!important}html{overflow-x:hidden!important}';
  document.head.appendChild(style);
  true;
})();
`;

function LoadingOverlay() {
  const nd = Platform.OS !== "web";
  const textOpacity = useRef(new Animated.Value(0.4)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(textOpacity, { toValue: 1, duration: 900, useNativeDriver: nd }),
        Animated.timing(textOpacity, { toValue: 0.4, duration: 900, useNativeDriver: nd }),
      ])
    );
    const dots = Animated.loop(
      Animated.stagger(220, [
        Animated.sequence([
          Animated.timing(dot1, { toValue: 1, duration: 380, useNativeDriver: nd }),
          Animated.timing(dot1, { toValue: 0.3, duration: 380, useNativeDriver: nd }),
        ]),
        Animated.sequence([
          Animated.timing(dot2, { toValue: 1, duration: 380, useNativeDriver: nd }),
          Animated.timing(dot2, { toValue: 0.3, duration: 380, useNativeDriver: nd }),
        ]),
        Animated.sequence([
          Animated.timing(dot3, { toValue: 1, duration: 380, useNativeDriver: nd }),
          Animated.timing(dot3, { toValue: 0.3, duration: 380, useNativeDriver: nd }),
        ]),
      ])
    );
    pulse.start();
    dots.start();
    return () => {
      pulse.stop();
      dots.stop();
    };
  }, []);

  return (
    <View style={styles.loadingOverlay} pointerEvents="none">
      <Image
        source={require("../../assets/images/dt-tours-logo-transparent.png")}
        style={styles.loadingLogo}
        resizeMode="contain"
        tintColor={gold}
      />
      <Animated.Text style={[styles.loadingText, { opacity: textOpacity }]}>
        Loading your holiday experiences...
      </Animated.Text>
      <View style={styles.loadingDots}>
        <Animated.View style={[styles.loadingDot, { opacity: dot1 }]} />
        <Animated.View style={[styles.loadingDot, { opacity: dot2 }]} />
        <Animated.View style={[styles.loadingDot, { opacity: dot3 }]} />
      </View>
    </View>
  );
}

function WelcomeScreen({ onExplore, onLogin }: { onExplore: () => void; onLogin: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const nd = Platform.OS !== "web";

  const logoFade = useRef(new Animated.Value(0)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(48)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const titleShimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoFade, { toValue: 1, duration: 800, delay: 100, useNativeDriver: nd }),
      Animated.timing(cardFade, { toValue: 1, duration: 800, delay: 300, useNativeDriver: nd }),
      Animated.timing(cardSlide, { toValue: 0, duration: 750, delay: 300, useNativeDriver: nd }),
    ]).start();

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(3200),
        Animated.timing(titleShimmer, { toValue: 1, duration: 380, useNativeDriver: false }),
        Animated.timing(titleShimmer, { toValue: 0, duration: 380, useNativeDriver: false }),
      ])
    );
    shimmerLoop.start();
    return () => shimmerLoop.stop();
  }, []);

  const handlePressIn = () =>
    Animated.spring(btnScale, { toValue: 0.95, useNativeDriver: nd }).start();
  const handlePressOut = () =>
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: nd }).start();

  return (
    <View style={styles.welcomeRoot}>
      <ImageBackground
        source={require("../../assets/images/welcome-bg.png")}
        style={styles.bgImage}
        resizeMode="cover"
      >
        <View style={styles.topOverlay} />
        <View style={styles.bottomOverlay} />

        <Animated.View
          style={[
            styles.logoArea,
            {
              paddingTop: insets.top + (isTablet ? 56 : 44),
              opacity: logoFade,
            },
          ]}
        >
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/images/dt-tours-logo-transparent.png")}
              style={styles.logoImage}
              resizeMode="contain"
              tintColor="#FFFFFF"
            />
          </View>
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Animated.View
          style={[
            styles.brandCard,
            {
              marginBottom: insets.bottom + (isTablet ? 64 : 44),
              marginHorizontal: isTablet ? width * 0.12 : 20,
              opacity: cardFade,
              transform: [{ translateY: cardSlide }],
            },
          ]}
        >
          <Animated.Text
            style={[
              styles.brandTitle,
              isTablet && { fontSize: 30 },
              {
                color: titleShimmer.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: ["#C9A84C", "#FFF3A0", "#C9A84C"],
                }),
                textShadowColor: titleShimmer.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [
                    "rgba(201,168,76,0)",
                    "rgba(255,240,110,0.85)",
                    "rgba(201,168,76,0)",
                  ],
                }),
                textShadowRadius: 14,
                textShadowOffset: { width: 0, height: 0 },
              },
            ]}
          >
            Dar AlTamaiz Tours
          </Animated.Text>
          <Text style={[styles.brandCashback, isTablet && { fontSize: 17 }]}>
            Book more &amp; get cashback on every successful booking!
          </Text>
          <Text style={[styles.brandTagline, isTablet && { fontSize: 14 }]}>
            Your Trusted Travel Partner Since 2008
          </Text>

          <Animated.View style={{ transform: [{ scale: btnScale }], width: "100%" }}>
            <Pressable
              style={styles.ctaBtn}
              onPress={onLogin}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <Text style={[styles.ctaBtnText, isTablet && { fontSize: 18 }]}>Log In</Text>
            </Pressable>
          </Animated.View>

          <Pressable
            style={({ pressed }) => [styles.guestBtn, pressed && { opacity: 0.7 }]}
            onPress={onExplore}
          >
            <Text style={[styles.guestBtnText, isTablet && { fontSize: 15 }]}>
              Continue as Guest
            </Text>
          </Pressable>
        </Animated.View>
      </ImageBackground>
    </View>
  );
}

function WebShell({ initialUrl = TABS[0].url }: { initialUrl?: string }) {
  const WebView = require("react-native-webview").WebView;
  const webviewRef = useRef<any>(null);
  const canGoBack = useRef(false);

  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [webUrl, setWebUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const wasOffline = useRef(false);
  const toastSlide = useRef(new Animated.Value(-90)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const dismissToast = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(toastSlide, { toValue: -90, duration: 300, useNativeDriver: true }),
    ]).start(() => setShowToast(false));
  };

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);

      if (offline && !wasOffline.current) {
        setShowToast(true);
        toastSlide.setValue(-90);
        toastOpacity.setValue(0);
        Animated.parallel([
          Animated.timing(toastSlide, { toValue: 0, duration: 350, useNativeDriver: true }),
          Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start(() => {
          toastTimer.current = setTimeout(dismissToast, 4000);
        });
      }

      if (wasOffline.current && !offline) {
        dismissToast();
        setHasError(false);
        setLoading(true);
        webviewRef.current?.reload?.();
      }
      wasOffline.current = offline;
    });
    return () => {
      unsubscribe();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack.current && webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, []);

  const handleTabPress = (tab: Tab) => {
    setActiveTab(tab.key);
    setHasError(false);
    setLoading(true);
    setWebUrl(tab.url);
  };

  const handleRetry = () => {
    setHasError(false);
    setLoading(true);
    webviewRef.current?.reload?.();
  };

  return (
    <View style={styles.shellRoot}>
      <AppHeader />

      <View style={styles.webArea}>
        <WebView
          ref={webviewRef}
          source={{ uri: webUrl }}
          style={StyleSheet.absoluteFill}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          setSupportMultipleWindows={false}
          injectedJavaScript={INJECTED_JS}
          injectedJavaScriptBeforeContentLoaded={INJECTED_JS}
          onNavigationStateChange={(navState: any) => {
            canGoBack.current = navState.canGoBack;
          }}
          onLoadStart={() => {
            setLoading(true);
            setHasError(false);
          }}
          onLoad={() => setLoading(false)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setHasError(true);
          }}
          onHttpError={(e: any) => {
            if (e.nativeEvent.statusCode >= 500) {
              setLoading(false);
              setHasError(true);
            }
          }}
          onShouldStartLoadWithRequest={(request: any) => {
            const url: string = request.url;
            return (
              url.startsWith("https://dt-tours.com") ||
              url.startsWith("http://dt-tours.com") ||
              url.startsWith("about:") ||
              url.startsWith("javascript:")
            );
          }}
          contentInsetAdjustmentBehavior="never"
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />

        {loading && !hasError && <LoadingOverlay />}

        {hasError && !isOffline && (
          <View style={styles.errorScreen}>
            <Text style={[styles.errorIcon, isTablet && { fontSize: 64 }]}>✈️</Text>
            <Text style={[styles.errorTitle, isTablet && { fontSize: 24 }]}>
              Connection Failed
            </Text>
            <Text style={[styles.errorSub, isTablet && { fontSize: 16 }]}>
              Check your internet connection and try again
            </Text>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.8 }]}
              onPress={handleRetry}
            >
              <Text style={[styles.retryBtnText, isTablet && { fontSize: 16 }]}>Retry</Text>
            </Pressable>
          </View>
        )}

        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={[styles.offlineIcon, isTablet && { fontSize: 64 }]}>📡</Text>
            <Text style={[styles.offlineTitle, isTablet && { fontSize: 26 }]}>
              No Internet Connection
            </Text>
            <Text style={[styles.offlineSub, isTablet && { fontSize: 16 }]}>
              Check your connection — we'll reload automatically when back online
            </Text>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.8 }]}
              onPress={handleRetry}
            >
              <Text style={[styles.retryBtnText, isTablet && { fontSize: 16 }]}>Retry</Text>
            </Pressable>
          </View>
        )}
      </View>

      <BottomTabBar activeTab={activeTab} onTabPress={handleTabPress} />

      {showToast && (
        <Animated.View
          style={[
            styles.offlineToast,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastSlide }],
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.offlineToastInner}>
            <Text style={styles.offlineToastIcon}>⚠️</Text>
            <View style={styles.offlineToastTextBlock}>
              <Text style={styles.offlineToastTitle}>Connection Lost</Text>
              <Text style={styles.offlineToastSub}>
                You may lose unsaved progress
              </Text>
            </View>
            <Pressable
              onPress={dismissToast}
              hitSlop={10}
              style={({ pressed }) => [
                styles.offlineToastClose,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.offlineToastCloseText}>✕</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function WebIframeShell({ initialUrl = TABS[0].url }: { initialUrl?: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [webUrl, setWebUrl] = useState(initialUrl);

  const handleTabPress = (tab: Tab) => {
    setActiveTab(tab.key);
    setWebUrl(tab.url);
  };

  return (
    <View style={styles.shellRoot}>
      <AppHeader />
      <View style={styles.webArea}>
        <iframe
          src={webUrl}
          style={{ flex: 1, width: "100%", height: "100%", border: "none" } as any}
          title="Dar AlTamaiz Tours"
        />
      </View>
      <BottomTabBar activeTab={activeTab} onTabPress={handleTabPress} />
    </View>
  );
}

export default function HomeScreen() {
  const [phase, setPhase] = useState<"welcome" | "transitioning" | "shell">("welcome");
  const [initialShellUrl, setInitialShellUrl] = useState(TABS[0].url);
  const welcomeOpacity = useRef(new Animated.Value(1)).current;
  const shellOpacity = useRef(new Animated.Value(0)).current;
  const nd = Platform.OS !== "web";

  const transitionToShell = (url: string) => {
    setInitialShellUrl(url);
    setPhase("transitioning");
    Animated.parallel([
      Animated.timing(welcomeOpacity, { toValue: 0, duration: 500, useNativeDriver: nd }),
      Animated.timing(shellOpacity, { toValue: 1, duration: 500, useNativeDriver: nd }),
    ]).start(() => setPhase("shell"));
  };

  const handleExplore = () => transitionToShell(TABS[0].url);
  const handleLogin = () => transitionToShell("https://dt-tours.com/index.php/auth/login");

  const ShellComponent = Platform.OS === "web" ? WebIframeShell : WebShell;

  return (
    <View style={styles.root}>
      {(phase === "transitioning" || phase === "shell") && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: shellOpacity }]}>
          <ShellComponent initialUrl={initialShellUrl} />
        </Animated.View>
      )}

      {phase !== "shell" && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: welcomeOpacity }]}>
          <WelcomeScreen onExplore={handleExplore} onLogin={handleLogin} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: navy,
  },

  welcomeRoot: {
    flex: 1,
    backgroundColor: navy,
  },
  bgImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 360,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 360,
    backgroundColor: "rgba(6,16,32,0.85)",
  },
  logoArea: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 0,
    zIndex: 10,
  },
  logoContainer: {
    width: "94%",
    height: 180,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: "100%",
    height: 240,
    transform: [{ scale: 1.1 }],
  },
  brandCard: {
    backgroundColor: "rgba(10,22,40,0.75)",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.35)",
    zIndex: 10,
  },
  brandTitle: {
    color: gold,
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  brandCashback: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  brandTagline: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  ctaBtn: {
    backgroundColor: "#1B263B",
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    marginBottom: 12,
  },
  ctaBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  guestBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
  },
  guestBtnText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
  },

  shellRoot: {
    flex: 1,
    backgroundColor: navy,
  },
  webArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,22,40,0.93)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  loadingLogo: {
    width: 120,
    height: 44,
    marginBottom: 22,
    opacity: 0.75,
  },
  loadingText: {
    color: gold,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    marginBottom: 18,
    letterSpacing: 0.3,
  },
  loadingDots: {
    flexDirection: "row",
    gap: 8,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: gold,
  },
  errorScreen: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    backgroundColor: navy,
    zIndex: 10,
  },
  errorIcon: {
    fontSize: 52,
    marginBottom: 18,
  },
  errorTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
    textAlign: "center",
  },
  errorSub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  retryBtn: {
    backgroundColor: gold,
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 50,
  },
  retryBtnText: {
    color: navy,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },

  offlineToast: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  offlineToastInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F1E36",
    borderWidth: 1,
    borderColor: gold,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  offlineToastIcon: {
    fontSize: 20,
  },
  offlineToastTextBlock: {
    flex: 1,
    gap: 2,
  },
  offlineToastTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  offlineToastSub: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  offlineToastClose: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  offlineToastCloseText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },

  offlineBanner: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    zIndex: 20,
  },
  offlineIcon: {
    fontSize: 52,
    marginBottom: 18,
  },
  offlineTitle: {
    color: gold,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 10,
  },
  offlineSub: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
});
