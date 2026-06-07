import NetInfo from "@react-native-community/netinfo";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { ProfileDrawer } from "@/components/ProfileDrawer";
import colors from "@/constants/colors";

const { gold, navy } = colors.light;

const buildInjectedJS = (lang?: "EN" | "AR") => `
(function() {
  var style = document.createElement('style');
  style.id = '__dt_native_style';
  var existing = document.getElementById('__dt_native_style');
  if (existing) existing.remove();
  style.textContent = [
    'header { display: none !important; }',
    'footer { display: none !important; }',
    '.site-header { display: none !important; }',
    '.site-footer { display: none !important; }',
    '#masthead { display: none !important; }',
    '#colophon { display: none !important; }',
    '.main-navigation { display: none !important; }',
    '.navbar { display: none !important; }',
    '.header-area { display: none !important; }',
    '.footer-area { display: none !important; }',
    'body { overflow-x: hidden !important; }',
    'html { overflow-x: hidden !important; }',
  ].join('\\n');
  document.head.appendChild(style);
  true;
})();
`;

const makeChangeLangJS = (lang: "EN" | "AR") => `
(function() {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', 'https://dt-tours.com/index.php/utilities/changeLanguage', true);
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  xhr.withCredentials = true;
  xhr.onload = function() { location.reload(); };
  xhr.onerror = function() { location.reload(); };
  xhr.send('lang=${lang}&page=home');
})();
true;
`;

function WelcomeScreen({ onExplore }: { onExplore: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;

  const logoFade = useRef(new Animated.Value(0)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(48)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoFade, {
        toValue: 1,
        duration: 800,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.timing(cardFade, {
        toValue: 1,
        duration: 800,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.timing(cardSlide, {
        toValue: 0,
        duration: 750,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () =>
    Animated.spring(btnScale, { toValue: 0.95, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }).start();

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
          <Text style={[styles.brandTitle, isTablet && { fontSize: 30 }]}>
            Dar AlTamaiz Tours
          </Text>
          <Text style={[styles.brandCashback, isTablet && { fontSize: 17 }]}>
            Book more &amp; get cashback on every successful booking!
          </Text>
          <Text style={[styles.brandTagline, isTablet && { fontSize: 14 }]}>
            Your Trusted Travel Partner Since 2008
          </Text>

          <Animated.View style={{ transform: [{ scale: btnScale }], width: "100%" }}>
            <Pressable
              style={styles.ctaBtn}
              onPress={onExplore}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <Text style={[styles.ctaBtnText, isTablet && { fontSize: 20 }]}>
                Start
              </Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </ImageBackground>
    </View>
  );
}

function WebShell() {
  const WebView = require("react-native-webview").WebView;
  const webviewRef = useRef<any>(null);
  const canGoBack = useRef(false);

  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [webUrl, setWebUrl] = useState(TABS[0].url);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentLang, setCurrentLang] = useState<"EN" | "AR">("EN");
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
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      if (canGoBack.current && webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [drawerOpen]);

  const handleTabPress = (tab: Tab) => {
    setActiveTab(tab.key);
    setHasError(false);
    setLoading(true);
    setWebUrl(tab.url);
  };

  const handleNavigate = (url: string) => {
    setHasError(false);
    setLoading(true);
    setWebUrl(url);
    setActiveTab("home");
  };

  const handleLanguageChange = (lang: "EN" | "AR") => {
    if (lang === currentLang) return;
    setCurrentLang(lang);
    webviewRef.current?.injectJavaScript?.(makeChangeLangJS(lang));
  };

  const handleRetry = () => {
    setHasError(false);
    setLoading(true);
    webviewRef.current?.reload?.();
  };

  return (
    <View style={styles.shellRoot}>
      <AppHeader
        onAvatarPress={() => setDrawerOpen(true)}
      />

      <View style={styles.webArea}>
        {!hasError && (
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
            injectedJavaScript={buildInjectedJS()}
            injectedJavaScriptBeforeContentLoaded={buildInjectedJS()}
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
              if (
                url.startsWith("https://dt-tours.com") ||
                url.startsWith("http://dt-tours.com") ||
                url.startsWith("about:") ||
                url.startsWith("javascript:")
              ) {
                return true;
              }
              return false;
            }}
            contentInsetAdjustmentBehavior="never"
            bounces={false}
            overScrollMode="never"
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          />
        )}

        {loading && !hasError && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={gold} />
          </View>
        )}

        {hasError && !isOffline && (
          <View style={styles.errorScreen}>
            <Text style={[styles.errorIcon, isTablet && { fontSize: 64 }]}>✈️</Text>
            <Text style={[styles.errorTitle, isTablet && { fontSize: 24 }]}>
              {currentLang === "AR" ? "تعذّر الاتصال" : "Connection Failed"}
            </Text>
            <Text style={[styles.errorSub, isTablet && { fontSize: 16 }]}>
              {currentLang === "AR"
                ? "تحقق من اتصالك بالإنترنت وأعد المحاولة"
                : "Check your internet connection and try again"}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.8 }]}
              onPress={handleRetry}
            >
              <Text style={[styles.retryBtnText, isTablet && { fontSize: 16 }]}>
                {currentLang === "AR" ? "إعادة المحاولة" : "Retry"}
              </Text>
            </Pressable>
          </View>
        )}

        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={[styles.offlineIcon, isTablet && { fontSize: 64 }]}>📡</Text>
            <Text style={[styles.offlineTitle, isTablet && { fontSize: 26 }]}>
              لا يوجد اتصال بالإنترنت
            </Text>
            <Text style={[styles.offlineSub, isTablet && { fontSize: 16 }]}>
              {currentLang === "AR"
                ? "تحقق من اتصالك وسنحاول تلقائياً عند عودة الشبكة"
                : "Check your connection — we'll reload automatically when back online"}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.8 }]}
              onPress={handleRetry}
            >
              <Text style={[styles.retryBtnText, isTablet && { fontSize: 16 }]}>
                {currentLang === "AR" ? "إعادة المحاولة" : "Retry"}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <BottomTabBar
        activeTab={activeTab}
        onTabPress={handleTabPress}
        currentLang={currentLang}
      />

      <ProfileDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigate={handleNavigate}
        onLanguageChange={handleLanguageChange}
        currentLang={currentLang}
      />

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
              <Text style={styles.offlineToastTitle}>
                انقطع الاتصال — قد تفقد تقدمك الحالي
              </Text>
              <Text style={styles.offlineToastSub}>
                {currentLang === "AR"
                  ? "تحقق من اتصالك بالإنترنت"
                  : "Connection lost — you may lose unsaved progress"}
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

function WebIframeShell() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [webUrl, setWebUrl] = useState(TABS[0].url);
  const [currentLang, setCurrentLang] = useState<"EN" | "AR">("EN");

  const handleTabPress = (tab: Tab) => {
    setActiveTab(tab.key);
    setWebUrl(tab.url);
  };

  const handleNavigate = (url: string) => {
    setWebUrl(url);
    setActiveTab("home");
  };

  const handleLanguageChange = (lang: "EN" | "AR") => {
    setCurrentLang(lang);
    const target = lang === "AR"
      ? `${webUrl}${webUrl.includes("?") ? "&" : "?"}lang=ar`
      : `${webUrl}${webUrl.includes("?") ? "&" : "?"}lang=en`;
    setWebUrl(target);
  };

  return (
    <View style={styles.shellRoot}>
      <AppHeader
        onAvatarPress={() => setDrawerOpen(true)}
      />
      <View style={styles.webArea}>
        <iframe
          src={webUrl}
          style={{ flex: 1, width: "100%", height: "100%", border: "none" } as any}
          title="Dar AlTamaiz Tours"
        />
      </View>
      <BottomTabBar
        activeTab={activeTab}
        onTabPress={handleTabPress}
        currentLang={currentLang}
      />
      <ProfileDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigate={handleNavigate}
        onLanguageChange={handleLanguageChange}
        currentLang={currentLang}
      />
    </View>
  );
}

export default function HomeScreen() {
  const [phase, setPhase] = useState<"welcome" | "transitioning" | "shell">("welcome");
  const welcomeOpacity = useRef(new Animated.Value(1)).current;
  const shellOpacity = useRef(new Animated.Value(0)).current;

  const handleExplore = () => {
    setPhase("transitioning");
    Animated.parallel([
      Animated.timing(welcomeOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(shellOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => setPhase("shell"));
  };

  const ShellComponent = Platform.OS === "web" ? WebIframeShell : WebShell;

  return (
    <View style={styles.root}>
      {(phase === "transitioning" || phase === "shell") && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: shellOpacity }]}>
          <ShellComponent />
        </Animated.View>
      )}

      {phase !== "shell" && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: welcomeOpacity }]}>
          <WelcomeScreen onExplore={handleExplore} />
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
    backgroundColor: "#C9A84C",
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    shadowColor: "#C9A84C",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  ctaBtnText: {
    color: "#0A1628",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
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
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
    justifyContent: "center",
  },
  errorScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    backgroundColor: navy,
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
    writingDirection: "rtl",
    textAlign: "right",
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
    writingDirection: "rtl",
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
