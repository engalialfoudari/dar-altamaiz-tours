import NetInfo from "@react-native-community/netinfo";
import React, { useEffect, useRef, useState } from "react";
import { scheduleRetentionNotifications } from "@/utils/notifications";
import {
  Animated,
  BackHandler,
  Image,
  ImageBackground,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { AppHeader } from "@/components/AppHeader";
import { BottomTabBar, Tab, TabKey, TABS } from "@/components/BottomTabBar";
import { InfoModal } from "@/components/InfoModal";
import { SpecialRequestsScreen } from "@/components/SpecialRequestsScreen";
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

const LOGIN_HOME_URL = "https://dt-tours.com/";
const WHATSAPP_URL = "https://wa.me/96590087797";

const BG_IMAGES = [
  require("../../assets/images/bg-01.jpg"),
  require("../../assets/images/bg-02.jpg"),
  require("../../assets/images/bg-03.jpg"),
  require("../../assets/images/bg-04.jpg"),
  require("../../assets/images/bg-05.jpg"),
  require("../../assets/images/bg-06.jpg"),
  require("../../assets/images/bg-07.jpg"),
  require("../../assets/images/bg-08.jpg"),
  require("../../assets/images/bg-09.jpg"),
  require("../../assets/images/bg-10.jpg"),
  require("../../assets/images/bg-11.jpg"),
];

const LOGIN_MODAL_JS = `
(function() {
  var selectors = [
    '[data-target="#myModal_new_emp"]',
    '.open_sign_in',
    '.logindown.open_sign_in',
    'a.logindown',
    '[data-toggle="modal"][data-target*="login"]'
  ];
  function tryClick(attempts) {
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) { el.click(); return; }
    }
    if (attempts > 0) setTimeout(function() { tryClick(attempts - 1); }, 500);
  }
  tryClick(8);
})(); true;
`;

function SkeletonLoader() {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={styles.skeletonWrap} pointerEvents="none">
      <Animated.View style={[styles.skeletonBar, { width: "72%", opacity: pulse }]} />
      <Animated.View style={[styles.skeletonBar, { width: "90%", height: 120, marginTop: 12, opacity: pulse }]} />
      <Animated.View style={[styles.skeletonBar, { width: "55%", marginTop: 12, opacity: pulse }]} />
      <Animated.View style={[styles.skeletonBar, { width: "80%", height: 80, marginTop: 12, opacity: pulse }]} />
      <Animated.View style={[styles.skeletonBar, { width: "40%", marginTop: 12, opacity: pulse }]} />
    </View>
  );
}

function OfflineBanner() {
  return (
    <View style={styles.offlineBanner} pointerEvents="none">
      <Text style={styles.offlineBannerText}>
        عذراً، اتصالك بالإنترنت غير مستقر. يرجى التحقق من الشبكة.
      </Text>
    </View>
  );
}

function WhatsAppFAB({ bottom }: { bottom: number }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.whatsappFab, { bottom }, pressed && { opacity: 0.75 }]}
      onPress={() => Linking.openURL(WHATSAPP_URL).catch(() => {})}
      accessibilityLabel="Contact support on WhatsApp"
    >
      <Svg width={26} height={26} viewBox="0 0 24 24">
        <Path
          d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
          fill={gold}
        />
        <Path
          d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.979-1.404A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.946 7.946 0 01-4.073-1.115l-.292-.174-3.035.855.806-3.02-.19-.31A7.948 7.948 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"
          fill={gold}
        />
      </Svg>
    </Pressable>
  );
}

function WelcomeScreen({ onExplore, onLogin, isOffline }: { onExplore: () => void; onLogin: () => void; isOffline: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const nd = Platform.OS !== "web";

  const bgImage = useRef(BG_IMAGES[Math.floor(Math.random() * 11)]).current;

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
        source={bgImage}
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
            numberOfLines={1}
            style={[
              styles.brandTitle,
              isTablet && { fontSize: 32 },
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
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.brandCashback, isTablet && { fontSize: 17 }]}
          >
            Book more &amp; get cashback on every booking!
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.brandTagline, isTablet && { fontSize: 13 }]}
          >
            Your Trusted Travel Partner Since 2008
          </Text>

          <Animated.View style={{ transform: [{ scale: btnScale }], width: "100%", opacity: isOffline ? 0.4 : 1 }}>
            <Pressable
              style={styles.ctaBtn}
              onPress={isOffline ? undefined : onLogin}
              onPressIn={isOffline ? undefined : handlePressIn}
              onPressOut={isOffline ? undefined : handlePressOut}
              disabled={isOffline}
            >
              <Text style={[styles.ctaBtnText, isTablet && { fontSize: 18 }]}>Log In</Text>
            </Pressable>
          </Animated.View>

          <Pressable
            style={({ pressed }) => [styles.guestBtn, pressed && !isOffline && { opacity: 0.7 }, isOffline && { opacity: 0.4 }]}
            onPress={isOffline ? undefined : onExplore}
            disabled={isOffline}
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

const WebView = require("react-native-webview").WebView;

function WebShell({
  initialUrl = TABS[0].url,
  openLoginOnLoad = false,
  externalNavigation = null,
}: {
  initialUrl?: string;
  openLoginOnLoad?: boolean;
  externalNavigation?: { url: string; login: boolean; seq: number } | null;
}) {
  const webviewRef = useRef<any>(null);
  const canGoBack = useRef(false);
  const pendingLoginTrigger = useRef(openLoginOnLoad);

  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [webUrl, setWebUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(true);
  const hasInitiallyLoaded = useRef(false);
  const [hasError, setHasError] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [canGoBackState, setCanGoBackState] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const wasOffline = useRef(false);
  const toastSlide = useRef(new Animated.Value(-90)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width, height } = useWindowDimensions();
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

  // Handle post-mount navigation from HomeScreen (Login flow while shell is pre-mounted)
  useEffect(() => {
    if (!externalNavigation) return;
    setWebUrl(externalNavigation.url);
    setLoading(true);
    setHasError(false);
    setWebError(null);
    if (externalNavigation.login) {
      pendingLoginTrigger.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalNavigation?.seq]);

  const handleTabPress = (tab: Tab) => {
    setActiveTab(tab.key);
    setHasError(false);
    setWebError(null);
    if (tab.isNative) {
      setShowRequests(true);
      return;
    }
    setShowRequests(false);
    // Only show loading overlay on very first page load; subsequent tab
    // switches use the cached WebView so no spinner is needed.
    if (!hasInitiallyLoaded.current) {
      setLoading(true);
    }
    setWebUrl(tab.url);
  };

  const handleRetry = () => {
    setHasError(false);
    setWebError(null);
    setLoading(true);
    webviewRef.current?.reload?.();
  };

  return (
    <View style={[styles.shellRoot, { width, height }]}>
      <AppHeader
        onBack={() => webviewRef.current?.goBack?.()}
        canGoBack={canGoBackState}
        onInfo={() => setShowInfo(true)}
      />
      <InfoModal visible={showInfo} onClose={() => setShowInfo(false)} />

      <View style={styles.webArea}>
        <WebView
          ref={webviewRef}
          source={{ uri: webUrl }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled={true}
          mixedContentMode="always"
          startInLoadingState
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          setSupportMultipleWindows={false}
          textZoom={100}
          injectedJavaScript={INJECTED_JS}
          injectedJavaScriptBeforeContentLoaded={INJECTED_JS}
          onNavigationStateChange={(navState: any) => {
            canGoBack.current = navState.canGoBack;
            setCanGoBackState(navState.canGoBack);
          }}
          onLoadStart={() => {
            // Only show loading overlay on the very first load of the session.
            if (!hasInitiallyLoaded.current) {
              setLoading(true);
            }
            setHasError(false);
            setWebError(null);
          }}
          onLoadProgress={({ nativeEvent }: any) => {
            // Hide the overlay as soon as 70% is painted — don't wait for
            // background tracking scripts that delay onLoad by seconds.
            if (nativeEvent.progress >= 0.7) {
              setLoading(false);
            }
          }}
          onLoadEnd={() => {
            // Final safety-net: ensure overlay is gone + trigger login modal.
            hasInitiallyLoaded.current = true;
            setLoading(false);
            if (pendingLoginTrigger.current) {
              pendingLoginTrigger.current = false;
              webviewRef.current?.injectJavaScript?.(LOGIN_MODAL_JS);
            }
          }}
          userAgent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
          onError={(syntheticEvent: any) => {
            const { nativeEvent } = syntheticEvent;
            setWebError(`WebView Error: ${nativeEvent.description} (Code: ${nativeEvent.code})`);
            setLoading(false);
            setHasError(true);
          }}
          onHttpError={(syntheticEvent: any) => {
            const { nativeEvent } = syntheticEvent;
            setWebError(`HTTP Error: ${nativeEvent.statusCode} for ${nativeEvent.url}`);
            setLoading(false);
            setHasError(true);
          }}
          onRenderProcessGone={(syntheticEvent: any) => {
            setWebError(`Render Process Gone: didCrash=${syntheticEvent.nativeEvent?.didCrash}`);
          }}
          onShouldStartLoadWithRequest={(request: any) => {
            const url: string = request.url;
            // Allow dt-tours.com (all subdomains), about:, javascript:, and any
            // intermediate redirects that the site may route through.
            // Block only clearly external navigations (non-dt-tours HTTP/HTTPS).
            if (
              url.startsWith("about:") ||
              url.startsWith("javascript:") ||
              url.includes("dt-tours.com")
            ) {
              return true;
            }
            // Allow all non-http schemes (tel:, mailto:, etc. handled by OS)
            if (!url.startsWith("http")) {
              return false;
            }
            // For any other HTTP/HTTPS URL (external site), allow it to load
            // inside the WebView rather than silently dropping it.
            return true;
          }}
          allowsBackForwardNavigationGestures={true}
          contentInsetAdjustmentBehavior="never"
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />

        {loading && !hasError && <SkeletonLoader />}

        {webError !== null && (
          <View style={[StyleSheet.absoluteFillObject, styles.webErrorScreen]}>
            <Text style={styles.webErrorText}>{webError}</Text>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.8 }]}
              onPress={handleRetry}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {hasError && !isOffline && webError === null && (
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

        {/* Special Requests form — absolute overlay so it always fills
            the full webArea height regardless of WebView flex layout */}
        {showRequests && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#0A1628" }]}>
            <SpecialRequestsScreen />
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
  const { width, height } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [webUrl, setWebUrl] = useState(initialUrl);

  const handleTabPress = (tab: Tab) => {
    setActiveTab(tab.key);
    setWebUrl(tab.url);
  };

  return (
    <View style={[styles.shellRoot, { width, height }]}>
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
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<"welcome" | "transitioning" | "shell">("welcome");
  const [initialShellUrl, setInitialShellUrl] = useState(TABS[0].url);
  const [triggerLogin, setTriggerLogin] = useState(false);
  const [externalNav, setExternalNav] = useState<{ url: string; login: boolean; seq: number } | null>(null);
  const navSeq = useRef(0);
  const [isOffline, setIsOffline] = useState(false);
  const welcomeOpacity = useRef(new Animated.Value(1)).current;
  const nd = Platform.OS !== "web";

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    scheduleRetentionNotifications();
  }, []);

  const transitionToShell = (url: string, loginTrigger = false) => {
    if (Platform.OS !== "web") {
      // Native: shell is already pre-mounted at TABS[0].url.
      // Only push an external navigation when the target differs or login is needed.
      if (url !== TABS[0].url || loginTrigger) {
        navSeq.current += 1;
        setExternalNav({ url, login: loginTrigger, seq: navSeq.current });
      }
    } else {
      // Web iframe shell: still uses the initial-prop approach.
      setInitialShellUrl(url);
      setTriggerLogin(loginTrigger);
    }
    setPhase("transitioning");
    Animated.timing(welcomeOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: nd,
    }).start(() => setPhase("shell"));
  };

  const handleExplore = () => transitionToShell(TABS[0].url, false);
  const handleLogin = () => transitionToShell(LOGIN_HOME_URL, true);

  const ShellComponent = Platform.OS === "web" ? WebIframeShell : WebShell;

  // Explicit pixel dimensions so every child in the tree receives a
  // guaranteed bounding box — prevents flex chains from collapsing to 0.
  const layerStyle = {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width,
    height,
  };

  return (
    <View style={[styles.root, { width, height }]}>
      {/* Native shell: always pre-mounted so the WebView starts fetching
          dt-tours.com in the background while the welcome screen is visible.
          Web iframe shell: only mount on transition to avoid a blank iframe. */}
      {(Platform.OS !== "web" || phase !== "welcome") && (
        <View style={layerStyle}>
          {Platform.OS === "web" ? (
            <WebIframeShell initialUrl={initialShellUrl} />
          ) : (
            <WebShell
              initialUrl={TABS[0].url}
              openLoginOnLoad={false}
              externalNavigation={externalNav}
            />
          )}
        </View>
      )}

      {/* Welcome screen fades out on top; shell already fully visible behind */}
      {phase !== "shell" && (
        <Animated.View
          style={[layerStyle, { opacity: welcomeOpacity }]}
          pointerEvents={phase === "transitioning" ? "none" : "auto"}
        >
          <WelcomeScreen onExplore={handleExplore} onLogin={handleLogin} isOffline={isOffline} />
        </Animated.View>
      )}

      {/* Offline banner — floats over everything when connection drops */}
      {isOffline && <OfflineBanner />}

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
    paddingHorizontal: 16,
    paddingVertical: 28,
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
    letterSpacing: 0.3,
  },
  brandCashback: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  brandTagline: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 20,
    letterSpacing: 0.1,
  },
  ctaBtn: {
    backgroundColor: "#0A1931",
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.4)",
  },
  ctaBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  guestBtn: {
    width: "100%",
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A1931",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  guestBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },

  shellRoot: {
    flex: 1,
    backgroundColor: navy,
    overflow: "hidden",
  },
  webArea: {
    flex: 1,
    minHeight: 0,
    backgroundColor: navy,
  },
  webErrorScreen: {
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 20,
  },
  webErrorText: {
    color: "red",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    padding: 20,
    marginBottom: 20,
    lineHeight: 22,
  },
  skeletonWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,22,40,0.93)",
    padding: 24,
    paddingTop: 48,
    zIndex: 5,
  },
  skeletonBar: {
    height: 20,
    borderRadius: 8,
    backgroundColor: "rgba(201,168,76,0.25)",
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(10,22,40,0.97)",
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: gold,
    zIndex: 9999,
  },
  offlineBannerText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 22,
  },
  whatsappFab: {
    position: "absolute",
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: navy,
    borderWidth: 2,
    borderColor: gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 1000,
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
