import NetInfo from "@react-native-community/netinfo";
import { useAuth, useClerk } from "@clerk/expo";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scheduleRetentionNotifications } from "@/utils/notifications";
import { usesNativeDashboard } from "@/utils/home-navigation";
import {
  Animated,
  Alert,
  BackHandler,
  DeviceEventEmitter,
  Image,
  ImageBackground,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resolveStableViewport } from "@/utils/stableViewport";
import Svg, { Path } from "react-native-svg";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams } from "expo-router";

import { AppHeader } from "@/components/AppHeader";
import { BottomTabBar, Tab, TabKey, TABS } from "@/components/BottomTabBar";
import { ChatbotScreen } from "@/components/ChatbotScreen";
import { InfoModal } from "@/components/InfoModal";
import { SpecialRequestsScreen } from "@/components/SpecialRequestsScreen";
import { ProfileScreen } from "@/components/ProfileScreen";
import { LuxuryHome, HomeLang } from "@/components/LuxuryHome";
import { WhereToGoScreen } from "@/components/WhereToGoScreen";
import { PackageBuilderScreen } from "@/components/PackageBuilderScreen";
import { ContactScreen } from "@/components/ContactScreen";
import { PackagesScreen } from "@/components/PackagesScreen";
import { TravelStoreScreen } from "@/components/TravelStoreScreen";
import { MembersOffersScreen } from "@/components/MembersOffersScreen";
import { useCart } from "@/lib/cartContext";
import { requestClerkToken } from "@/lib/clerkTokenCoordinator";
import { FlightResultsScreen } from "@/components/FlightResultsScreen";
import { FlightApiResultsScreen } from "@/components/FlightApiResultsScreen";
import { FlightSearchScreen } from "@/components/FlightSearchScreen";
import { isSampleFlightPreviewUrl, type FlightSearchValues } from "@/lib/flightSearch";
import AsyncStorage from "@react-native-async-storage/async-storage";
import colors from "@/constants/colors";
import {
  hotelPortalPrefillJavaScript,
  requiresHotelPortalNavigation,
  hotelPortalUrlFor,
  hotelPortalUrlWithLanguage,
  HOTEL_PAYMENT_APP_RETURN_URL,
  isHotelPortalExternalAppUrl,
  DEFAULT_HOTEL_DISPLAY_PREFERENCES,
  HOTEL_DISPLAY_PREFERENCES_STORAGE_KEY,
  type HotelDisplayPreferences,
  isTrustedHotelPortalNavigation,
  parseHotelPortalAccountAction,
  parseHotelPortalHistoryMessage,
  parseHotelPortalLanguageMessage,
  parseHotelDisplayPreferences,
  parseHotelPaymentHandoffMessage,
  parseHotelPaymentReturnUrl,
  shouldOpenHotelPaymentExternally,
  serializeHotelDisplayPreferencesMessage,
} from "@/lib/hotelPortal";
import { HotelPortalIcon } from "@/components/HotelPortalIcon";

const { gold, navy } = colors.light;

const hasNativeStoreCheckout =
  Platform.OS === "web" ||
  Boolean(UIManager.getViewManagerConfig?.("AIRMap"));
const CompatibleCartScreen = hasNativeStoreCheckout
  ? (require("@/components/CartScreen").CartScreen as typeof import("@/components/CartScreen").CartScreen)
  : null;

const CONFIGURED_API_BASE = process.env["EXPO_PUBLIC_API_BASE"]?.replace(/\/$/, "");
const API_BASE = CONFIGURED_API_BASE ?? "https://tours-dar-tamaiz--engalialfoudari.replit.app/api";
const HOTEL_PORTAL_URL = hotelPortalUrlFor(CONFIGURED_API_BASE, __DEV__);
const HOTEL_PORTAL_LOGOUT_URL = `${HOTEL_PORTAL_URL}/logout`;
const ANDROID_CHROME_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

const INJECTED_JS = `
(function() {
  var style = document.createElement('style');
  style.id = '__dt_native_style';
  var existing = document.getElementById('__dt_native_style');
  if (existing) existing.remove();
  style.textContent = 'body{overflow-x:hidden!important}html{overflow-x:hidden!important}.bkd-wa-btn{background:#147A4B!important;color:#fff!important}';
  document.head.appendChild(style);

  // Rewrite target="_blank" ONLY for real navigable URLs (http/https/root-relative).
  // Modal triggers (href="#...", href="javascript:...", data-toggle) are left
  // completely untouched so the login pop-up and all DOM overlays keep working.
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el || el.target !== '_blank') return;
    var href = el.getAttribute('href') || '';
    if (href.startsWith('http://') || href.startsWith('https://') || (href.startsWith('/') && !href.startsWith('//'))) {
      el.target = '_self';
    }
  }, true);

  // React Native WebView does not reliably emit onNavigationStateChange for
  // same-document history.pushState calls. The hotel detail overlay uses
  // pushState, so report that history explicitly or Android's system-back
  // gesture can close the entire portal and return to Home.
  if (!window.__dtHotelHistoryBridgeInstalled) {
    window.__dtHotelHistoryBridgeInstalled = true;
    var dtHotelHistoryDepth = 0;
    var dtOriginalPushState = history.pushState;
    var dtReportHotelHistory = function() {
      if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'dt-hotel-history',
        canGoBack: dtHotelHistoryDepth > 0
      }));
    };
    history.pushState = function() {
      var result = dtOriginalPushState.apply(history, arguments);
      dtHotelHistoryDepth += 1;
      dtReportHotelHistory();
      return result;
    };
    window.addEventListener('popstate', function() {
      dtHotelHistoryDepth = Math.max(0, dtHotelHistoryDepth - 1);
      dtReportHotelHistory();
    });
    dtReportHotelHistory();
  }

  true;
})();
`;

function hotelPortalInjectedJavaScript(token: string | null): string {
  // JSON.stringify keeps a Clerk JWT safe inside the JavaScript template (a JWT
  // may contain characters that would otherwise terminate a quoted string).
  const serializedToken = JSON.stringify(token ?? "");
  return `
    (function() {
      var dtPortalToken = ${serializedToken};
      window.__dtPortalToken = dtPortalToken;
      if (dtPortalToken && !window.__dtPortalFetchBridgeInstalled) {
        window.__dtPortalFetchBridgeInstalled = true;
        var dtOriginalFetch = window.fetch;
        window.fetch = function(input, init) {
          try {
            var requestUrl = new URL(
              typeof input === 'string' ? input : input.url,
              window.location.origin
            );
            if (requestUrl.origin === window.location.origin &&
                requestUrl.pathname.indexOf('/api/') === 0) {
              var headers = new Headers(
                (init && init.headers) ||
                (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined)
              );
              if (window.__dtPortalToken) {
                headers.set('Authorization', 'Bearer ' + window.__dtPortalToken);
              }
              init = Object.assign({}, init || {}, { headers: headers });
            }
          } catch (error) {}
          return dtOriginalFetch.call(this, input, init);
        };
      }
    })();
    ${INJECTED_JS}
  `;
}

const WHATSAPP_URL = "https://wa.me/96590087797";
const FLIGHT_BOOKINGS_URL = "https://dt-tours.com/index.php/general/my_booking";

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
        resizeMode="contain"
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
            D.T. Tours
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
              <Text style={[styles.ctaBtnText, isTablet && { fontSize: 13 }, { fontSize: 12, opacity: 0.85 }]}>تسجيل دخول</Text>
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
            <Text style={[styles.guestBtnText, isTablet && { fontSize: 13 }, { fontSize: 12, opacity: 0.85 }]}>
              الدخول كزائر
            </Text>
          </Pressable>
        </Animated.View>
      </ImageBackground>
    </View>
  );
}

const WebView = require("react-native-webview").WebView;

function BookingChoiceModal({
  visible,
  lang,
  onClose,
  onChoose,
}: {
  visible: boolean;
  lang: HomeLang;
  onClose: () => void;
  onChoose: (type: "flights" | "hotels") => void;
}) {
  const rtl = lang === "ar";
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.bookingChoiceOverlay}>
        <View style={styles.bookingChoiceCard}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.bookingChoiceClose} testID="booking-choice-close">
            <HotelPortalIcon name="close" size={21} color="#64748B" />
          </Pressable>
          <Text style={[styles.bookingChoiceTitle, rtl && styles.rtlText]}>
            {rtl ? "ماذا تريد أن تتحقق منه؟" : "What would you like to check?"}
          </Text>
          <Text style={[styles.bookingChoiceSub, rtl && styles.rtlText]}>
            {rtl ? "اختر نوع الحجز للوصول إلى حجوزاتك." : "Choose a booking type to access your reservations."}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.bookingChoiceButton, pressed && { opacity: 0.84 }]}
            onPress={() => onChoose("flights")}
            testID="booking-choice-flights"
          >
            <View style={styles.bookingChoiceButtonIcon}>
              <HotelPortalIcon name="airplane" size={25} color={gold} />
            </View>
            <View style={styles.bookingChoiceButtonCopy}>
              <Text style={styles.bookingChoiceButtonTitle}>{rtl ? "حجوزات الطيران" : "Flight bookings"}</Text>
              <Text style={styles.bookingChoiceButtonSub}>{rtl ? "الرحلات وتذاكر الطيران" : "Flights and airline reservations"}</Text>
            </View>
            <HotelPortalIcon name={rtl ? "chevron-back" : "chevron-forward"} size={19} color={gold} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.bookingChoiceButton, pressed && { opacity: 0.84 }]}
            onPress={() => onChoose("hotels")}
            testID="booking-choice-hotels"
          >
            <View style={styles.bookingChoiceButtonIcon}>
              <HotelPortalIcon name="bed" size={25} color={gold} />
            </View>
            <View style={styles.bookingChoiceButtonCopy}>
              <Text style={styles.bookingChoiceButtonTitle}>{rtl ? "حجوزات الفنادق" : "Hotel bookings"}</Text>
              <Text style={styles.bookingChoiceButtonSub}>{rtl ? "إدارة حجوزات الفنادق" : "Manage your hotel reservations"}</Text>
            </View>
            <HotelPortalIcon name={rtl ? "chevron-back" : "chevron-forward"} size={19} color={gold} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function WebShell({
  initialUrl = TABS[0].url,
  externalNavigation = null,
  forceShowProfile = false,
  onProfileShown,
  forceShowRequests = false,
  onRequestsShown,
  onProfileVisibilityChange,
  nativeHome,
  onBookingsPress,
  onNativeTravelTab,
  hotelPortalVisible = false,
  hotelPortalOverrideUrl = null,
  onOpenHotelPortal,
  onCloseHotelPortal,
  onHotelPortalLanguageChange,
  onHotelPortalLoggedOut,
  activeLang = "en",
  hotelPaymentReturn = null,
  hotelDisplayPreferences,
  onHotelDisplayPreferencesChange,
  onOpenCart,
}: {
  initialUrl?: string;
  externalNavigation?: { url: string; seq: number } | null;
  forceShowProfile?: boolean;
  onProfileShown?: () => void;
  forceShowRequests?: boolean;
  onRequestsShown?: () => void;
  onProfileVisibilityChange?: (visible: boolean) => void;
  nativeHome?: React.ReactNode;
  onBookingsPress: () => void;
  onNativeTravelTab: (screen: "packages" | "contact") => void;
  hotelPortalVisible?: boolean;
  hotelPortalOverrideUrl?: string | null;
  onOpenHotelPortal: () => void;
  onCloseHotelPortal: (destination?: "packages" | "bookings" | "profile") => void;
  onHotelPortalLanguageChange: (language: HomeLang) => void;
  onHotelPortalLoggedOut: () => void | Promise<void>;
  activeLang?: HomeLang;
  hotelPaymentReturn?: { orderId: string; status: "success" | "failed"; seq: number } | null;
  hotelDisplayPreferences: HotelDisplayPreferences;
  onHotelDisplayPreferencesChange: (preferences: HotelDisplayPreferences) => void;
  onOpenCart?: () => void;
}) {
  const { getToken, isSignedIn, sessionId } = useAuth();
  const { addItems } = useCart();
  const webviewRef = useRef<any>(null);
  const canGoBack = useRef(false);
  const hotelPortalRef = useRef<any>(null);
  const hotelPortalNativeCanGoBack = useRef(false);
  const hotelPortalInPageCanGoBack = useRef(false);

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
  const [showProfile, setShowProfile] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showNativeHome, setShowNativeHome] = useState(initialUrl === TABS[0].url);
  const [canReturnToNativeHome, setCanReturnToNativeHome] = useState(false);
  const [hotelPortalUrl, setHotelPortalUrl] = useState(HOTEL_PORTAL_URL);
  const [hotelPortalInstance, setHotelPortalInstance] = useState(0);

  const [hotelPortalToken, setHotelPortalToken] = useState<string | null | undefined>(undefined);
  const [nativeSessionVersion, setNativeSessionVersion] = useState(0);
  const hotelPortalSourceLanguage = useRef(activeLang ?? "en");
  const localizedHotelPortalUrl = hotelPortalUrlWithLanguage(
    hotelPortalUrl,
    hotelPortalSourceLanguage.current,
  );
  const hotelPortalSource = useMemo(() => ({
    uri: localizedHotelPortalUrl,
  }), [hotelPortalInstance, localizedHotelPortalUrl]);
  const lastExternalPaymentUrl = useRef("");
  const hotelPortalDismissed = useRef(false);

  useEffect(() => {
    if (hotelPortalVisible) hotelPortalDismissed.current = false;
  }, [hotelPortalVisible]);

  useEffect(() => {
    if (!hotelPortalVisible || !hotelPortalOverrideUrl) return;
    if (requiresHotelPortalNavigation(hotelPortalOverrideUrl)) {
      setHotelPortalUrl(hotelPortalOverrideUrl);
      setHotelPortalInstance((value) => value + 1);
      return;
    }
    hotelPortalRef.current?.injectJavaScript?.(
      hotelPortalPrefillJavaScript(hotelPortalOverrideUrl),
    );
  }, [hotelPortalOverrideUrl, hotelPortalVisible]);

  useEffect(() => {
    if (!hotelPaymentReturn) return;
    const resultPath = hotelPaymentReturn.status === "failed"
      ? "hotel-payment-failed"
      : "hotel-payment-success";
    setHotelPortalUrl(`${API_BASE}/${resultPath}?orderId=${encodeURIComponent(hotelPaymentReturn.orderId)}`);
    setHotelPortalInstance((value) => value + 1);
    lastExternalPaymentUrl.current = "";
  }, [hotelPaymentReturn?.seq]);

  useEffect(() => {
    if (!hotelPortalVisible) {
      hotelPortalNativeCanGoBack.current = false;
      hotelPortalInPageCanGoBack.current = false;
      hotelPortalSourceLanguage.current = activeLang ?? "en";
    }
  }, [activeLang, hotelPortalVisible]);

  useEffect(() => {
    if (isSignedIn === false) {
      setHotelPortalToken(null);
      return;
    }
    let active = true;
    requestClerkToken({ sessionId, getToken })
      .then((token) => {
        if (active) setHotelPortalToken(token ?? null);
      })
      .catch(() => {
        if (active) setHotelPortalToken(null);
      });
    return () => { active = false; };
  }, [getToken, isSignedIn, nativeSessionVersion, sessionId]);

  useEffect(() => {
    if (hotelPortalToken === undefined) return;
    hotelPortalRef.current?.injectJavaScript?.(
      `window.__dtPortalToken=${JSON.stringify(hotelPortalToken ?? "")};`
      + `window.dispatchEvent(new MessageEvent('message',{data:{source:'dt-clerk-auth',token:${JSON.stringify(hotelPortalToken ?? "")}}}));`
      + `true;`,
    );
  }, [hotelPortalToken]);

  useEffect(() => {
    const serialized = serializeHotelDisplayPreferencesMessage(hotelDisplayPreferences);
    hotelPortalRef.current?.injectJavaScript?.(
      `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(serialized)}}));true;`,
    );
  }, [hotelDisplayPreferences]);

  const handleProfileAuthenticated = useCallback(() => {
    setNativeSessionVersion((version) => version + 1);
  }, []);

  const openGoogleSignInFromHotelPortal = useCallback(() => {
    onCloseHotelPortal("profile");
    setShowRequests(false);
    setShowNativeHome(false);
    setActiveTab("profile");
    setShowProfile(true);
  }, [onCloseHotelPortal]);

  const syncLoggedOutHotelPortalSession = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // The portal is already signed out; continue clearing the native session.
    }
    await onHotelPortalLoggedOut();
    setHotelPortalToken(null);
    setNativeSessionVersion((value) => value + 1);
  }, [onHotelPortalLoggedOut]);

  // Open profile tab when HomeScreen requests it (e.g. from chatbot price-lock badge)
  useEffect(() => {
    if (forceShowProfile) {
      setShowProfile(true);
      setShowRequests(false);
      setShowNativeHome(false);
      setActiveTab("profile");
      onProfileShown?.();
    }
  }, [forceShowProfile]);
  useEffect(() => {
    if (forceShowRequests) {
      setShowRequests(true);
      setShowProfile(false);
      setShowNativeHome(false);
      setActiveTab("requests");
      onRequestsShown?.();
    }
  }, [forceShowRequests]);
  useEffect(() => {
    onProfileVisibilityChange?.(showProfile);
  }, [onProfileVisibilityChange, showProfile]);
  const baseUrlRef = useRef<string>(initialUrl);
  const wasOffline = useRef(false);
  const toastSlide = useRef(new Animated.Value(-90)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const insets = useSafeAreaInsets();

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

  const returnToNativeHome = useCallback(() => {
    canGoBack.current = false;
    setCanGoBackState(false);
    setCanReturnToNativeHome(false);
    setShowNativeHome(true);
    setShowRequests(false);
    setShowProfile(false);
    setActiveTab("home");
    setWebUrl(TABS[0].url);
  }, []);

  const completeLoginToNativeHome = useCallback(() => {
    onCloseHotelPortal();
    returnToNativeHome();
  }, [onCloseHotelPortal, returnToNativeHome]);

  const handleShellBack = useCallback(() => {
    if (canGoBack.current && webviewRef.current) {
      webviewRef.current.goBack();
      return;
    }
    if (canReturnToNativeHome) returnToNativeHome();
  }, [canReturnToNativeHome, returnToNativeHome]);

  const handleHotelPortalBack = useCallback(() => {
    if (hotelPortalDismissed.current) return;
    if (
      (hotelPortalInPageCanGoBack.current || hotelPortalNativeCanGoBack.current) &&
      hotelPortalRef.current
    ) {
      hotelPortalRef.current.goBack();
      return;
    }
    hotelPortalDismissed.current = true;
    onCloseHotelPortal();
  }, [onCloseHotelPortal]);

  useEffect(() => {
    const onBackPress = () => {
      if (hotelPortalVisible) {
        if (!hotelPortalDismissed.current) handleHotelPortalBack();
        return true;
      }
      if (canGoBack.current && webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      if (canReturnToNativeHome) {
        returnToNativeHome();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [canReturnToNativeHome, handleHotelPortalBack, hotelPortalVisible, returnToNativeHome]);

  // Handle post-mount navigation from HomeScreen
  useEffect(() => {
    if (!externalNavigation) return;
    setWebUrl(externalNavigation.url);
    const matchingTab = TABS.find((tab) => tab.url === externalNavigation.url);
    const opensExternalDetail = !matchingTab;
    setShowNativeHome(!!matchingTab && usesNativeDashboard(matchingTab.key));
    setCanReturnToNativeHome(opensExternalDetail);
    setCanGoBackState(opensExternalDetail);
    setShowRequests(false);
    setShowProfile(false);
    if (matchingTab) setActiveTab(matchingTab.key);
    setLoading(true);
    setHasError(false);
    setWebError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalNavigation?.seq]);

  const handleTabPress = (tab: Tab) => {
    // The hotel portal is a full-screen native layer. Close it and route the
    // requested destination in one parent transaction; doing these as
    // separate state updates can leave the portal covering a newly mounted
    // Packages/Bookings screen on slower Android devices.
    if (hotelPortalVisible && (tab.key === "trips" || tab.key === "bookings")) {
      setActiveTab(tab.key);
      hotelPortalDismissed.current = true;
      onCloseHotelPortal(tab.key === "trips" ? "packages" : "bookings");
      return;
    }
    if (hotelPortalVisible && tab.key === "profile") {
      setActiveTab("profile");
      setShowNativeHome(false);
      setShowRequests(false);
      setShowProfile(true);
      hotelPortalDismissed.current = true;
      onCloseHotelPortal("profile");
      return;
    }
    if (hotelPortalVisible) {
      hotelPortalDismissed.current = true;
      onCloseHotelPortal();
    }
    // Account and Special Requests are full-screen overlays. Keep the tab bar
    // usable while they are open, and reveal the selected destination when
    // switching away from the current overlay.
    if (tab.key !== "profile") setShowProfile(false);
    if (tab.key !== "requests") setShowRequests(false);
    setCanReturnToNativeHome(false);
    setActiveTab(tab.key);
    setHasError(false);
    setWebError(null);
    if (tab.key === "bookings") {
      onBookingsPress();
      return;
    }
    if (tab.key === "trips") {
      onNativeTravelTab("packages");
      return;
    }
    if (tab.key === "settings") {
      onNativeTravelTab("contact");
      return;
    }
    if (usesNativeDashboard(tab.key)) {
      setShowNativeHome(true);
      setShowRequests(false);
      setShowProfile(false);
      return;
    }
    if (tab.isNative) {
      setShowNativeHome(false);
      if (tab.key === "profile") {
        setShowProfile(true);
        setShowRequests(false);
      } else {
        setShowRequests(true);
        setShowProfile(false);
      }
      return;
    }
    setShowNativeHome(false);
    setShowRequests(false);
    setShowProfile(false);
    // Only show loading overlay on very first page load; subsequent tab
    // switches use the cached WebView so no spinner is needed.
    if (!hasInitiallyLoaded.current) {
      setLoading(true);
    }
    // If webUrl state already equals the target URL (e.g. user pressed Home
    // while already on the Home tab after navigating internally to flight
    // results), React won't re-set the source prop so the WebView stays on
    // the internal page. Force-navigate via JS in that case.
    baseUrlRef.current = tab.url;
    if (webUrl === tab.url) {
      webviewRef.current?.injectJavaScript?.(
        `window.location.href=${JSON.stringify(tab.url)};true;`
      );
    }
    setWebUrl(tab.url);
  };

  const handleRetry = () => {
    setHasError(false);
    setWebError(null);
    setLoading(true);
    webviewRef.current?.reload?.();
  };

  const handleHotelPortalNavigation = useCallback((request: { url?: string; isTopFrame?: boolean }) => {
    const rawUrl = String(request.url ?? "");
    if (isHotelPortalExternalAppUrl(rawUrl)) {
      Linking.openURL(rawUrl).catch(() => {});
      return false;
    }
    if (shouldOpenHotelPaymentExternally(request, Platform.OS)) {
      if (lastExternalPaymentUrl.current !== rawUrl) {
        lastExternalPaymentUrl.current = rawUrl;
        WebBrowser.openAuthSessionAsync(rawUrl, HOTEL_PAYMENT_APP_RETURN_URL)
          .then((result) => {
            if (result.type !== "success") return;
            const paymentReturn = parseHotelPaymentReturnUrl(result.url);
            if (!paymentReturn) return;
            const resultPath = paymentReturn.status === "failed"
              ? "hotel-payment-failed"
              : "hotel-payment-success";
            setHotelPortalUrl(`${API_BASE}/${resultPath}?orderId=${encodeURIComponent(paymentReturn.orderId)}`);
            setHotelPortalInstance((value) => value + 1);
          })
          .catch(() => Linking.openURL(rawUrl).catch(() => {}))
          .finally(() => {
            lastExternalPaymentUrl.current = "";
          });
      }
      return false;
    }
    return allowHotelPortalNavigation(request, hotelPortalUrl);
  }, [hotelPortalUrl]);

  return (
    <View style={[styles.shellRoot, { width, height }]}>
      {(hotelPortalVisible || !showNativeHome || !nativeHome) && (
        <AppHeader
          onBack={hotelPortalVisible ? handleHotelPortalBack : handleShellBack}
          canGoBack={hotelPortalVisible || canGoBackState || canReturnToNativeHome}
          onInfo={() => setShowInfo(true)}
        />
      )}
      <InfoModal visible={showInfo} onClose={() => setShowInfo(false)} />

      <View style={styles.webArea}>
        {!hotelPortalVisible && (showNativeHome && nativeHome ? nativeHome : <WebView
          ref={webviewRef}
          source={{ uri: webUrl }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled={true}
          mixedContentMode="never"
          startInLoadingState
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          setSupportMultipleWindows={false}
          textZoom={100}
          injectedJavaScript={INJECTED_JS}
          injectedJavaScriptForMainFrameOnly
          onMessage={() => {}}
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
            hasInitiallyLoaded.current = true;
            setLoading(false);
          }}
          userAgent={ANDROID_CHROME_USER_AGENT}
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
            let destination: URL;
            try {
              destination = new URL(url);
            } catch {
              return false;
            }
            // Keep the privileged shell on the exact DT Tours HTTPS origins.
            // Approved external links leave the WebView and open in the OS.
            const isTrustedShellOrigin =
              destination.protocol === "https:" &&
              (destination.hostname.toLowerCase() === "dt-tours.com" ||
                destination.hostname.toLowerCase() === "www.dt-tours.com");
            if (isTrustedShellOrigin) return true;
            if (destination.protocol !== "https:") {
              Linking.openURL(url).catch(() => {});
              return false;
            }
            Linking.openURL(destination.toString()).catch(() => {});
            return false;
          }}
          allowsBackForwardNavigationGestures={true}
          contentInsetAdjustmentBehavior="never"
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />)}

        <View
          pointerEvents={hotelPortalVisible ? "auto" : "none"}
          style={[
            styles.hotelPortalLayer,
            hotelPortalVisible
              ? [StyleSheet.absoluteFillObject, styles.hotelPortalVisible]
              : styles.hotelPortalPreload,
          ]}
        >
            <WebView
              ref={hotelPortalRef}
              testID="hotel-portal-webview"
              key={`hotel-portal-${hotelPortalInstance}`}
              source={hotelPortalSource}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              cacheEnabled
              mixedContentMode="never"
              startInLoadingState
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              setSupportMultipleWindows={false}
              javaScriptCanOpenWindowsAutomatically
              userAgent={ANDROID_CHROME_USER_AGENT}
              injectedJavaScriptBeforeContentLoaded={hotelPortalInjectedJavaScript(hotelPortalToken ?? null)}
              injectedJavaScript={INJECTED_JS}
              injectedJavaScriptForMainFrameOnly
              onLoad={() => {
                hotelPortalRef.current?.injectJavaScript?.(
                  hotelPortalPrefillJavaScript(hotelPortalOverrideUrl),
                );
                hotelPortalRef.current?.injectJavaScript?.(
                  `window.__dtPortalToken=${JSON.stringify(hotelPortalToken ?? "")};`
                  + (hotelPortalToken
                    ? `window.dispatchEvent(new MessageEvent('message',{data:{source:'dt-clerk-auth',token:${JSON.stringify(hotelPortalToken)}}}));`
                    : `if(typeof initAuth==='function'){initAuth();}`)
                  + `true;`,
                );
                const serialized = serializeHotelDisplayPreferencesMessage(hotelDisplayPreferences);
                hotelPortalRef.current?.injectJavaScript?.(
                  `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(serialized)}}));true;`,
                );
              }}
              onMessage={(event: any) => {
                const rawMessage = event.nativeEvent?.data ?? "";
                try {
                  const message = JSON.parse(rawMessage);
                  if (message?.type === "dt-open-native-account") {
                    hotelPortalDismissed.current = true;
                    onCloseHotelPortal("profile");
                    return;
                  }
                  if (message?.type === "dt-add-to-cart") {
                    if (Array.isArray(message.items)) {
                      addItems(message.items);
                    }
                    return;
                  }
                } catch {}
                const language = parseHotelPortalLanguageMessage(rawMessage);
                if (language) {
                  onHotelPortalLanguageChange(language);
                  return;
                }
                const accountAction = parseHotelPortalAccountAction(rawMessage);
                if (accountAction === "google-signin") {
                  openGoogleSignInFromHotelPortal();
                  return;
                }
                if (accountAction === "signed-out") {
                  void syncLoggedOutHotelPortalSession();
                  return;
                }
                const canGoBack = parseHotelPortalHistoryMessage(rawMessage);
                if (canGoBack !== null) hotelPortalInPageCanGoBack.current = canGoBack;
              }}
              onNavigationStateChange={(navState: any) => {
                hotelPortalNativeCanGoBack.current = navState.canGoBack;
                if (!isTrustedHotelPortalNavigation(
                  String(navState.url ?? ""),
                  hotelPortalUrl,
                )) {
                  setHotelPortalToken(null);
                  hotelPortalRef.current?.injectJavaScript?.(
                    "window.__dtPortalToken='';true;",
                  );
                }
              }}
              onShouldStartLoadWithRequest={handleHotelPortalNavigation}
              allowsBackForwardNavigationGestures
              contentInsetAdjustmentBehavior="never"
              bounces={false}
              overScrollMode="never"
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            />
        </View>

        {loading && !hasError && !showNativeHome && !hotelPortalVisible && <SkeletonLoader />}

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
            <SpecialRequestsScreen language={activeLang} />
          </View>
        )}
      </View>

      <BottomTabBar activeTab={activeTab} onTabPress={handleTabPress} activeLang={activeLang} />
      <View
        pointerEvents={showProfile ? "auto" : "none"}
        accessibilityElementsHidden={!showProfile}
        importantForAccessibility={showProfile ? "auto" : "no-hide-descendants"}
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: "#0A1628", zIndex: 20, display: showProfile ? "flex" : "none" },
        ]}
      >
            <ProfileScreen sessionRefreshVersion={nativeSessionVersion} language={activeLang} hotelDisplayPreferences={hotelDisplayPreferences} onHotelDisplayPreferencesChange={onHotelDisplayPreferencesChange} onOpenCart={onOpenCart} onClose={() => {
            setShowProfile(false);
            setActiveTab("home");
            setShowNativeHome(true);
           }} onLoginSuccess={completeLoginToNativeHome} onAuthenticated={handleProfileAuthenticated} onLoggedOut={() => {
            setHotelPortalToken(null);
            setHotelPortalUrl(HOTEL_PORTAL_LOGOUT_URL);
          }}
          onOpenHotelPortal={(url) => {
            setShowProfile(false);
            setHotelPortalUrl(url);
            setHotelPortalInstance((value) => value + 1);
            onOpenHotelPortal();
          }} />
      </View>

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

export function WebIframeShell({
  initialUrl = TABS[0].url,
  externalNavigation = null,
  forceShowProfile = false,
  onProfileShown,
  forceShowRequests = false,
  onRequestsShown,
  onProfileVisibilityChange,
  nativeHome,
  onBookingsPress,
  onNativeTravelTab,
  hotelPortalVisible = false,
  hotelPortalOverrideUrl = null,
  onOpenHotelPortal,
  onCloseHotelPortal,
  onHotelPortalLanguageChange,
  onHotelPortalLoggedOut,
  activeLang = "en",
  hotelDisplayPreferences,
  onHotelDisplayPreferencesChange,
  onOpenCart,
}: {
  initialUrl?: string;
  externalNavigation?: { url: string; seq: number } | null;
  forceShowProfile?: boolean;
  onProfileShown?: () => void;
  forceShowRequests?: boolean;
  onRequestsShown?: () => void;
  onProfileVisibilityChange?: (visible: boolean) => void;
  nativeHome?: React.ReactNode;
  onBookingsPress: () => void;
  onNativeTravelTab: (screen: "packages" | "contact") => void;
  hotelPortalVisible?: boolean;
  hotelPortalOverrideUrl?: string | null;
  onOpenHotelPortal: () => void;
  onCloseHotelPortal: (destination?: "packages" | "bookings" | "profile") => void;
  onHotelPortalLanguageChange: (language: HomeLang) => void;
  onHotelPortalLoggedOut: () => void | Promise<void>;
  activeLang?: HomeLang;
  hotelDisplayPreferences: HotelDisplayPreferences;
  onHotelDisplayPreferencesChange: (preferences: HotelDisplayPreferences) => void;
  onOpenCart?: () => void;
}) {
  const { getToken, isSignedIn, sessionId } = useAuth();
  const { addItems } = useCart();
  const { width, height } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [webUrl, setWebUrl] = useState(initialUrl);
  const [showInfo, setShowInfo] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [showNativeHome, setShowNativeHome] = useState(initialUrl === TABS[0].url);
  const [hotelPortalUrl, setHotelPortalUrl] = useState(HOTEL_PORTAL_URL);
  const [hotelPortalInstance, setHotelPortalInstance] = useState(0);

  useEffect(() => {
    if (hotelPortalOverrideUrl) {
      setHotelPortalUrl(hotelPortalOverrideUrl);
      setHotelPortalInstance((v) => v + 1);
    }
  }, [hotelPortalOverrideUrl]);
  const [hotelPortalToken, setHotelPortalToken] = useState<string | null>(null);
  const hotelPortalFrameRef = useRef<any>(null);
  const hotelPortalSourceLanguage = useRef(activeLang ?? "en");
  const localizedHotelPortalUrl = hotelPortalUrlWithLanguage(hotelPortalUrl, hotelPortalSourceLanguage.current);
  const hotelPortalDismissed = useRef(false);

  useEffect(() => {
    if (isSignedIn === false) {
      setHotelPortalToken(null);
      return;
    }
    let active = true;
    requestClerkToken({ sessionId, getToken })
      .then((token) => {
        if (active) setHotelPortalToken(token ?? null);
      })
      .catch(() => {
        if (active) setHotelPortalToken(null);
      });
    return () => { active = false; };
  }, [getToken, hotelPortalInstance, isSignedIn, sessionId]);

  const sendHotelPortalToken = useCallback(() => {
    if (!hotelPortalFrameRef.current?.contentWindow) return;
    hotelPortalFrameRef.current.contentWindow.postMessage(
      { source: "dt-clerk-auth", token: hotelPortalToken ?? "" },
      new URL(localizedHotelPortalUrl).origin,
    );
  }, [hotelPortalToken, localizedHotelPortalUrl]);

  useEffect(() => {
    sendHotelPortalToken();
  }, [sendHotelPortalToken]);

  const sendHotelPortalDisplayPreferences = useCallback(() => {
    if (!hotelPortalFrameRef.current?.contentWindow) return;
    hotelPortalFrameRef.current.contentWindow.postMessage(
      serializeHotelDisplayPreferencesMessage(hotelDisplayPreferences),
      new URL(localizedHotelPortalUrl).origin,
    );
  }, [hotelDisplayPreferences, localizedHotelPortalUrl]);

  useEffect(() => {
    sendHotelPortalDisplayPreferences();
  }, [sendHotelPortalDisplayPreferences]);

  useEffect(() => {
    if (hotelPortalVisible) hotelPortalDismissed.current = false;
    else hotelPortalSourceLanguage.current = activeLang ?? "en";
  }, [activeLang, hotelPortalVisible]);

  const handleProfileAuthenticated = useCallback(() => {
    void requestClerkToken({ sessionId, getToken })
      .then((token) => setHotelPortalToken(token ?? null))
      .catch(() => setHotelPortalToken(null));
  }, [getToken, sessionId]);

  const completeLoginToNativeHome = useCallback(() => {
    onCloseHotelPortal();
    setShowProfile(false);
    setShowRequests(false);
    setShowNativeHome(true);
    setActiveTab("home");
    setWebUrl(TABS[0].url);
    setCanGoBack(false);
  }, [onCloseHotelPortal]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePortalMessage = (event: MessageEvent) => {
      if (event.source !== hotelPortalFrameRef.current?.contentWindow) return;
      // A frame reference alone is not sufficient: a page the portal navigates
      // to can retain the same window object. Never accept account, cart, or
      // payment messages (or deliver bearer tokens) from another origin.
      let expectedOrigin = "";
      try {
        expectedOrigin = new URL(localizedHotelPortalUrl).origin;
      } catch {
        return;
      }
      if (event.origin !== expectedOrigin) return;
      const rawMessage = typeof event.data === "string"
        ? event.data
        : JSON.stringify(event.data);
      try {
        const message = JSON.parse(rawMessage);
        if (message?.type === "dt-add-to-cart") {
          if (Array.isArray(message.items)) {
            addItems(message.items);
          }
          return;
        }
      } catch {}
      const paymentUrl = parseHotelPaymentHandoffMessage(rawMessage);
      if (paymentUrl) {
        // Hosted payment pages reject iframe rendering in Safari. Navigate the
        // app's top-level page so checkout remains visible and can return to
        // the server-hosted success/failure page.
        window.location.assign(paymentUrl);
        return;
      }
      const language = parseHotelPortalLanguageMessage(rawMessage);
      if (language) {
        onHotelPortalLanguageChange(language);
        return;
      }
      const accountAction = parseHotelPortalAccountAction(rawMessage);
      if (accountAction === "google-signin") {
        onCloseHotelPortal("profile");
        setShowNativeHome(false);
        setActiveTab("profile");
        setShowProfile(true);
        return;
      }
      if (accountAction === "signed-out") void onHotelPortalLoggedOut();
    };
    window.addEventListener("message", handlePortalMessage);
    return () => window.removeEventListener("message", handlePortalMessage);
  }, [localizedHotelPortalUrl, onCloseHotelPortal, onHotelPortalLanguageChange, onHotelPortalLoggedOut]);

  // Keep the Account icon native in browser preview as well as iOS/Android.
  useEffect(() => {
    if (forceShowProfile) {
      setShowProfile(true);
      setShowRequests(false);
      setShowNativeHome(false);
      setActiveTab("profile");
      onProfileShown?.();
    }
  }, [forceShowProfile]);
  useEffect(() => {
    if (forceShowRequests) {
      setShowRequests(true);
      setShowProfile(false);
      setShowNativeHome(false);
      setActiveTab("requests");
      onRequestsShown?.();
    }
  }, [forceShowRequests]);
  useEffect(() => {
    onProfileVisibilityChange?.(showProfile);
  }, [onProfileVisibilityChange, showProfile]);

  // Tab-level URL history for the back button.
  // Cross-origin iframes block contentWindow access, so we track
  // navigation ourselves instead of relying on iframe.contentWindow.history.
  const urlHistoryRef = useRef<string[]>([initialUrl]);

  useEffect(() => {
    if (!externalNavigation) return;
    const matchingTab = TABS.find((tab) => tab.url === externalNavigation.url);
    if (!matchingTab) {
      urlHistoryRef.current = [initialUrl, externalNavigation.url];
      setCanGoBack(true);
    }
    setShowNativeHome(!!matchingTab && usesNativeDashboard(matchingTab.key));
    setShowRequests(false);
    setShowProfile(false);
    setWebUrl(externalNavigation.url);
    if (matchingTab) setActiveTab(matchingTab.key);
  }, [externalNavigation?.seq]);

  const handleTabPress = (tab: Tab) => {
    // See the native shell: portal dismissal and destination routing must be
    // handled together so Packages/Bookings cannot be hidden behind the
    // portal during the same tap.
    if (hotelPortalVisible && (tab.key === "trips" || tab.key === "bookings")) {
      setActiveTab(tab.key);
      hotelPortalDismissed.current = true;
      onCloseHotelPortal(tab.key === "trips" ? "packages" : "bookings");
      return;
    }
    if (hotelPortalVisible && tab.key === "profile") {
      setActiveTab("profile");
      setShowNativeHome(false);
      setShowRequests(false);
      setShowProfile(true);
      hotelPortalDismissed.current = true;
      onCloseHotelPortal("profile");
      return;
    }
    if (hotelPortalVisible) {
      hotelPortalDismissed.current = true;
      onCloseHotelPortal();
    }
    // Account and Special Requests are full-screen overlays. The tab bar
    // stays above them, but switching to another destination must also close
    // the old overlay so the newly selected screen is visible.
    if (tab.key !== "profile") setShowProfile(false);
    if (tab.key !== "requests") setShowRequests(false);
    setActiveTab(tab.key);
    if (tab.key === "bookings") {
      onBookingsPress();
      return;
    }
    if (tab.key === "trips") {
      onNativeTravelTab("packages");
      return;
    }
    if (tab.key === "settings") {
      onNativeTravelTab("contact");
      return;
    }
    if (usesNativeDashboard(tab.key)) {
      setShowNativeHome(true);
      setShowRequests(false);
      setShowProfile(false);
      return;
    }
    if (tab.isNative) {
      setShowNativeHome(false);
      if (tab.key === "profile") {
        setShowProfile(true);
        setShowRequests(false);
      } else {
        setShowRequests(true);
        setShowProfile(false);
      }
      return;
    }
    setShowNativeHome(false);
    setShowRequests(false);
    setShowProfile(false);
    if (tab.url !== webUrl) {
      urlHistoryRef.current.push(tab.url);
      setCanGoBack(urlHistoryRef.current.length > 1);
    }
    setWebUrl(tab.url);
  };

  const handleBack = () => {
    if (urlHistoryRef.current.length > 1) {
      urlHistoryRef.current.pop();
      const prev = urlHistoryRef.current[urlHistoryRef.current.length - 1];
      const prevTab = TABS.find((t) => t.url === prev);
      if (prevTab) setActiveTab(prevTab.key);
      if (prev === initialUrl && usesNativeDashboard("home")) {
        setShowNativeHome(true);
        setShowRequests(false);
        setShowProfile(false);
      }
      setWebUrl(prev);
      setCanGoBack(urlHistoryRef.current.length > 1);
    }
  };

  const handleHotelPortalBack = () => {
    if (hotelPortalDismissed.current) return;
    hotelPortalDismissed.current = true;
    onCloseHotelPortal();
  };

  return (
    <View style={[styles.shellRoot, { width, height }]}>
      {(hotelPortalVisible || !showNativeHome || !nativeHome) && (
        <AppHeader
          onBack={hotelPortalVisible ? handleHotelPortalBack : handleBack}
          canGoBack={hotelPortalVisible || canGoBack}
          onInfo={() => setShowInfo(true)}
        />
      )}
      <View style={styles.webArea}>
        {!hotelPortalVisible && (showNativeHome && nativeHome ? nativeHome : <iframe
          src={webUrl}
          // sandbox without allow-popups forces target="_blank" hotel/tour links
          // to navigate inside the iframe (treated as _self per HTML spec)
          // instead of opening a new browser window/tab.
          // allow-same-origin preserves cookies so login/session stay active.
          // allow-top-navigation-by-user-activation lets payment redirect flows work.
          sandbox="allow-scripts allow-forms allow-same-origin allow-top-navigation-by-user-activation allow-modals"
          style={{ flex: 1, width: "100%", height: "100%", border: "none" } as any}
          title="D.T. Tours"
        />)}
        <View
          pointerEvents={hotelPortalVisible ? "auto" : "none"}
          style={[
            styles.hotelPortalLayer,
            hotelPortalVisible
              ? [StyleSheet.absoluteFillObject, styles.hotelPortalVisible]
              : styles.hotelPortalPreload,
          ]}
        >
            <iframe
              ref={hotelPortalFrameRef}
              key={`hotel-portal-${hotelPortalInstance}`}
              src={localizedHotelPortalUrl}
              onLoad={() => { sendHotelPortalToken(); sendHotelPortalDisplayPreferences(); }}
              sandbox="allow-scripts allow-forms allow-same-origin allow-top-navigation-by-user-activation allow-modals"
              style={{ flex: 1, width: "100%", height: "100%", border: "none" } as any}
              title="D.T. Tours Hotels"
            />
        </View>
        {showRequests && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#0A1628" }]}>
            <SpecialRequestsScreen language={activeLang} />
          </View>
        )}
      </View>
      <BottomTabBar activeTab={activeTab} onTabPress={handleTabPress} activeLang={activeLang} />
      <View
        pointerEvents={showProfile ? "auto" : "none"}
        accessibilityElementsHidden={!showProfile}
        importantForAccessibility={showProfile ? "auto" : "no-hide-descendants"}
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: "#0A1628", zIndex: 20, display: showProfile ? "flex" : "none" },
        ]}
      >
          <ProfileScreen language={activeLang} hotelDisplayPreferences={hotelDisplayPreferences} onHotelDisplayPreferencesChange={onHotelDisplayPreferencesChange} onOpenCart={onOpenCart} onClose={() => {
            setShowProfile(false);
            setActiveTab("home");
            setShowNativeHome(true);
           }} onLoginSuccess={completeLoginToNativeHome} onAuthenticated={handleProfileAuthenticated} onLoggedOut={() => {
            setHotelPortalToken(null);
            setHotelPortalUrl(HOTEL_PORTAL_LOGOUT_URL);
          }}
          onOpenHotelPortal={(url) => {
            setShowProfile(false);
            setHotelPortalUrl(url);
            setHotelPortalInstance((value) => value + 1);
            onOpenHotelPortal();
          }} />
      </View>
      <InfoModal visible={showInfo} onClose={() => setShowInfo(false)} />
    </View>
  );
}

export default function HomeScreen() {
  const [hotelPortalOverrideUrl, setHotelPortalOverrideUrl] = useState<string | null>(null);
  const { signOut: signOutClerk } = useClerk();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const paymentRouteParams = useLocalSearchParams<{
    hotelPaymentOrderId?: string | string[];
    hotelPaymentStatus?: string | string[];
    postAuth?: string | string[];
    portalAuth?: string | string[];
  }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const stableViewport = useRef({ width, height });
  const focusedElement = Platform.OS === "web" && typeof document !== "undefined"
    ? document.activeElement as HTMLElement | null
    : null;
  const hasTextInputFocus = !!focusedElement && (
    focusedElement.tagName === "INPUT" ||
    focusedElement.tagName === "TEXTAREA" ||
    focusedElement.tagName === "SELECT" ||
    focusedElement.isContentEditable
  );
  const viewportLayout = resolveStableViewport(
    stableViewport.current,
    { width, height },
    Platform.OS === "web",
    hasTextInputFocus,
  );
  stableViewport.current = viewportLayout.stable;
  const postAuthDestination = Array.isArray(paymentRouteParams.postAuth)
    ? paymentRouteParams.postAuth[0]
    : paymentRouteParams.postAuth;
  const portalAuth = Array.isArray(paymentRouteParams.portalAuth)
    ? paymentRouteParams.portalAuth[0]
    : paymentRouteParams.portalAuth;
  const [phase, setPhase] = useState<"welcome" | "transitioning" | "shell">(
    postAuthDestination === "home" ? "shell" : "welcome",
  );
  const [initialShellUrl, setInitialShellUrl] = useState(TABS[0].url);
  const [externalNav, setExternalNav] = useState<{ url: string; seq: number } | null>(null);
  const navSeq = useRef(0);
  const [isOffline, setIsOffline] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [forceShowProfile, setForceShowProfile] = useState(portalAuth === "1");
  const [forceShowRequests, setForceShowRequests] = useState(false);
  const [profileScreenOpen, setProfileScreenOpen] = useState(false);
  const [homeLang, setHomeLang] = useState<HomeLang>("en");
  const [homeLangReady, setHomeLangReady] = useState(false);
  const [hotelDisplayPreferences, setHotelDisplayPreferences] = useState<HotelDisplayPreferences>(DEFAULT_HOTEL_DISPLAY_PREFERENCES);
  const [showWhereToGo, setShowWhereToGo] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderPrefill, setBuilderPrefill] = useState<{ destination: string; nights: number } | null>(null);
  const [subscriptionRequest, setSubscriptionRequest] = useState(0);
  const [showBookingChoice, setShowBookingChoice] = useState(false);
  const [nativeScreen, setNativeScreen] = useState<"flights" | "packages" | "contact" | "store" | "cart" | "members-offers" | null>(null);
  const [showHotelPortal, setShowHotelPortal] = useState(false);
  const [hotelPaymentReturn, setHotelPaymentReturn] = useState<{
    orderId: string;
    status: "success" | "failed";
    seq: number;
  } | null>(null);
  const handledPaymentRoute = useRef("");
  const [flightResultsUrl, setFlightResultsUrl] = useState<string | null>(null);
  const [flightSearchDraft, setFlightSearchDraft] = useState<FlightSearchValues | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("home_lang")
      .then((l) => {
        if (l === "ar" || l === "en") setHomeLang(l);
      })
      .catch(() => {})
      .finally(() => setHomeLangReady(true));
  }, []);
  const updateHotelDisplayPreferences = useCallback((preferences: HotelDisplayPreferences) => {
    const validPreferences = parseHotelDisplayPreferences(preferences);
    if (!validPreferences) return;
    setHotelDisplayPreferences(validPreferences);
    AsyncStorage.setItem(HOTEL_DISPLAY_PREFERENCES_STORAGE_KEY, JSON.stringify(validPreferences)).catch(() => {});
  }, []);
  useEffect(() => {
    AsyncStorage.getItem(HOTEL_DISPLAY_PREFERENCES_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          const validPreferences = parseHotelDisplayPreferences(parsed);
          if (validPreferences) setHotelDisplayPreferences(validPreferences);
        } catch {}
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      "homeLanguageChanged",
      (language: HomeLang) => {
        if (language === "ar" || language === "en") setHomeLang(language);
      },
    );
    return () => subscription.remove();
  }, []);
  const welcomeOpacity = useRef(new Animated.Value(1)).current;
  const fabPulse = useRef(new Animated.Value(0)).current;
  const nd = Platform.OS !== "web";

  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn || phase === "shell") return;
    welcomeOpacity.stopAnimation();
    welcomeOpacity.setValue(0);
    setForceShowProfile(false);
    setForceShowRequests(false);
    setShowHotelPortal(false);
    setNativeScreen(null);
    setPhase("shell");
  }, [isAuthLoaded, isSignedIn, phase, welcomeOpacity]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsubscribe();
  }, []);

  // NOTE: scheduleRetentionNotifications() is intentionally NOT called here.
  // _layout.tsx handles scheduling on mount and on every foreground transition.
  // Calling it here too would cancel+reschedule on every home-tab navigation,
  // permanently resetting the 3-day inactivity timer.

  useEffect(() => {
    const sonar = Animated.loop(
      Animated.sequence([
        Animated.timing(fabPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(fabPulse, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(300),
      ])
    );
    sonar.start();
    return () => sonar.stop();
  }, [fabPulse]);

  const transitionToShell = (url: string) => {
    if (Platform.OS !== "web") {
      // Native: shell is pre-mounted. Push external nav only when target differs from default.
      if (url !== TABS[0].url) {
        navSeq.current += 1;
        setExternalNav({ url, seq: navSeq.current });
      }
    } else {
      setInitialShellUrl(url);
    }
    setPhase("transitioning");
    Animated.timing(welcomeOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: nd,
    }).start(() => setPhase("shell"));
  };

  useEffect(() => {
    if (Platform.OS === "web") return;
    const handlePaymentReturn = ({ url }: { url: string }) => {
      const parsed = parseHotelPaymentReturnUrl(url);
      if (!parsed) return;
      navSeq.current += 1;
      setHotelPaymentReturn({ ...parsed, seq: navSeq.current });
      setNativeScreen(null);
      setShowHotelPortal(true);
      if (phase !== "shell") transitionToShell(TABS[0].url);
    };
    const subscription = Linking.addEventListener("url", handlePaymentReturn);
    Linking.getInitialURL()
      .then((url) => {
        if (url) handlePaymentReturn({ url });
      })
      .catch(() => {});
    return () => subscription.remove();
  }, [phase]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const rawOrderId = Array.isArray(paymentRouteParams.hotelPaymentOrderId)
      ? paymentRouteParams.hotelPaymentOrderId[0]
      : paymentRouteParams.hotelPaymentOrderId;
    const orderId = String(rawOrderId ?? "")
      .replace(/[^A-Za-z0-9_-]/g, "")
      .slice(0, 100);
    if (!orderId) return;
    const rawStatus = Array.isArray(paymentRouteParams.hotelPaymentStatus)
      ? paymentRouteParams.hotelPaymentStatus[0]
      : paymentRouteParams.hotelPaymentStatus;
    const status = rawStatus === "failed" ? "failed" : "success";
    const routeKey = `${orderId}:${status}`;
    if (handledPaymentRoute.current === routeKey) return;
    handledPaymentRoute.current = routeKey;
    navSeq.current += 1;
    setHotelPaymentReturn({ orderId, status, seq: navSeq.current });
    setNativeScreen(null);
    setShowHotelPortal(true);
    if (phase !== "shell") transitionToShell(TABS[0].url);
  }, [
    paymentRouteParams.hotelPaymentOrderId,
    paymentRouteParams.hotelPaymentStatus,
    phase,
  ]);

  const handleExplore = () => transitionToShell(TABS[0].url);
  const navigateFromDashboard = (url: string) => {
    if (phase !== "shell") {
      transitionToShell(url);
      return;
    }
    navSeq.current += 1;
    setExternalNav({ url, seq: navSeq.current });
  };
  const handleLogin = () => {
    setNativeScreen(null);
    setForceShowProfile(true);
    if (phase !== "shell") transitionToShell(TABS[0].url);
  };
  const openNativeScreen = (screen: NonNullable<typeof nativeScreen>) => {
    if (screen === "cart" && !CompatibleCartScreen) {
      Alert.alert(
        homeLang === "ar" ? "يتطلب تحديث التطبيق" : "App update required",
        homeLang === "ar"
          ? "الدفع من متجر السفر متاح بعد تحديث التطبيق من Google Play."
          : "Travel Store checkout is available after updating the app from Google Play.",
      );
      return;
    }
    setNativeScreen(screen);
    if (phase !== "shell") transitionToShell(TABS[0].url);
  };
  const closeNativeScreen = () => {
    setNativeScreen(null);
    navigateFromDashboard(TABS[0].url);
  };
  const returnToMainHome = (destination?: "packages" | "bookings" | "profile") => {
    if (phase !== "shell") {
      welcomeOpacity.stopAnimation();
      welcomeOpacity.setValue(0);
      setPhase("shell");
    }
    setShowHotelPortal(false);
    setFlightResultsUrl(null);
    setFlightSearchDraft(null);
    setForceShowProfile(false);
    setForceShowRequests(false);
    if (destination === "packages") {
      setShowBookingChoice(false);
      setNativeScreen("packages");
      return;
    }
    setNativeScreen(null);
    if (destination === "bookings") {
      setShowBookingChoice(true);
      return;
    }
    if (destination === "profile") return;
    navigateFromDashboard(TABS[0].url);
  };
  const handleNativeHomeTabPress = (tab: Tab) => {
    if (tab.key === "home") return;
    if (tab.key === "profile") {
      handleLogin();
      return;
    }
    if (tab.key === "requests") {
      setForceShowRequests(true);
      transitionToShell(TABS[0].url);
      return;
    }
    if (tab.key === "bookings") {
      handleBookingsPress();
      return;
    }
    if (tab.key === "trips") {
      openNativeScreen("packages");
      return;
    }
    if (tab.key === "settings") {
      openNativeScreen("contact");
      return;
    }
    navigateFromDashboard(tab.url);
  };
  const handleNativeScreenTabPress = (tab: Tab) => {
    if (tab.key === "home") {
      closeNativeScreen();
      return;
    }
    if (tab.key === "trips") {
      setNativeScreen("packages");
      return;
    }
    if (tab.key === "settings") {
      setNativeScreen("contact");
      return;
    }
    setNativeScreen(null);
    if (tab.key === "bookings") {
      handleBookingsPress();
      return;
    }
    if (tab.key === "profile") {
      handleLogin();
      return;
    }
    setForceShowRequests(true);
    if (phase !== "shell") transitionToShell(TABS[0].url);
  };
  const handleFlightResultsTabPress = (tab: Tab) => {
    setFlightResultsUrl(null);
    handleNativeScreenTabPress(tab);
  };
  useEffect(() => {
    if (Platform.OS === "web" || (!nativeScreen && !flightResultsUrl)) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (flightResultsUrl) {
        setFlightResultsUrl(null);
        setNativeScreen("flights");
        return true;
      }
      closeNativeScreen();
      return true;
    });
    return () => subscription.remove();
  }, [flightResultsUrl, nativeScreen, phase]);
  const changeHomeLanguage = (nextLang: HomeLang) => {
    setHomeLang(nextLang);
    AsyncStorage.setItem("home_lang", nextLang).catch(() => {});
    DeviceEventEmitter.emit("homeLanguageChanged", nextLang);
  };
  const handleBookingsPress = () => setShowBookingChoice(true);
  const handleBookingChoice = (type: "flights" | "hotels") => {
    setShowBookingChoice(false);
    if (type === "hotels") {
      // Hotel bookings belong to the app-native account surface, where the
      // customer signs in with the exact same hotel-portal credentials.
      handleLogin();
      return;
    }
    navigateFromDashboard(FLIGHT_BOOKINGS_URL);
  };
  const openBuilderUpgrade = () => {
    setShowBuilder(false);
    setShowChatbot(true);
    setSubscriptionRequest((value) => value + 1);
  };
  const nativeHome = (
    <LuxuryHome
      lang={homeLang}
      onChangeLang={changeHomeLanguage}
      onFlights={() => openNativeScreen("flights")}
      onHotels={() => {
        setNativeScreen(null);
        setHotelPortalOverrideUrl(null);
        setShowHotelPortal(true);
        if (phase !== "shell") transitionToShell(TABS[0].url);
      }}
      onOpenHotelPortalUrl={(url) => {
        setNativeScreen(null);
        setHotelPortalOverrideUrl(url);
        setShowHotelPortal(true);
        if (phase !== "shell") transitionToShell(TABS[0].url);
      }}
      onAIBuilder={() => {
        setBuilderPrefill(null);
        setShowBuilder(true);
      }}
      onWhereToGo={() => setShowWhereToGo(true)}
      onTravelStore={() => openNativeScreen("store")}
      onMembersOffers={() => openNativeScreen("members-offers")}
      onOpenUrl={navigateFromDashboard}
      onExplore={handleExplore}
      isOffline={isOffline}
    />
  );

  const ShellComponent = Platform.OS === "web" ? WebIframeShell : WebShell;

  // Explicit pixel dimensions so every child in the tree receives a
  // guaranteed bounding box — prevents flex chains from collapsing to 0.
  const layerStyle = {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width,
    height: viewportLayout.layoutHeight,
  };

  return (
    <View style={[styles.root, { width, height: viewportLayout.layoutHeight }]}>
      {/* Native shell: always pre-mounted so the WebView starts fetching
          dt-tours.com in the background while the welcome screen is visible.
          Web iframe shell: only mount on transition to avoid a blank iframe. */}
      {homeLangReady && (Platform.OS !== "web" || phase !== "welcome") && (
        <View style={layerStyle}>
          {Platform.OS === "web" ? (
            <WebIframeShell
              initialUrl={initialShellUrl}
              externalNavigation={externalNav}
              forceShowProfile={forceShowProfile}
              onProfileShown={() => setForceShowProfile(false)}
              forceShowRequests={forceShowRequests}
              onRequestsShown={() => setForceShowRequests(false)}
              onProfileVisibilityChange={setProfileScreenOpen}
              nativeHome={nativeHome}
              onBookingsPress={handleBookingsPress}
              onNativeTravelTab={openNativeScreen}
              hotelPortalVisible={showHotelPortal}
              hotelPortalOverrideUrl={hotelPortalOverrideUrl}
              onOpenHotelPortal={() => setShowHotelPortal(true)}
              onCloseHotelPortal={returnToMainHome}
              onHotelPortalLanguageChange={changeHomeLanguage}
              onHotelPortalLoggedOut={() => signOutClerk().catch(() => {})}
              activeLang={homeLang}
              hotelDisplayPreferences={hotelDisplayPreferences}
              onHotelDisplayPreferencesChange={updateHotelDisplayPreferences}
              onOpenCart={() => openNativeScreen("cart")}
            />
          ) : (
            <WebShell
              initialUrl={TABS[0].url}
              externalNavigation={externalNav}
              forceShowProfile={forceShowProfile}
              onProfileShown={() => setForceShowProfile(false)}
              forceShowRequests={forceShowRequests}
              onRequestsShown={() => setForceShowRequests(false)}
              onProfileVisibilityChange={setProfileScreenOpen}
              nativeHome={nativeHome}
              onBookingsPress={handleBookingsPress}
              onNativeTravelTab={openNativeScreen}
              hotelPortalVisible={showHotelPortal}
              hotelPortalOverrideUrl={hotelPortalOverrideUrl}
              onOpenHotelPortal={() => setShowHotelPortal(true)}
              onCloseHotelPortal={returnToMainHome}
              onHotelPortalLanguageChange={changeHomeLanguage}
              onHotelPortalLoggedOut={() => signOutClerk().catch(() => {})}
              activeLang={homeLang}
              hotelDisplayPreferences={hotelDisplayPreferences}
              onHotelDisplayPreferencesChange={updateHotelDisplayPreferences}
              hotelPaymentReturn={hotelPaymentReturn}
              onOpenCart={() => openNativeScreen("cart")}
            />
          )}
        </View>
      )}

      {/* Welcome screen fades out on top; shell already fully visible behind */}
      {phase !== "shell" && (
        <Animated.View
          style={[layerStyle, { opacity: welcomeOpacity }]}
          pointerEvents={phase === "welcome" ? "auto" : "none"}
        >
          <View style={{ flex: 1 }}>
            {phase === "welcome" ? (
              <WelcomeScreen
                onExplore={handleExplore}
                onLogin={handleLogin}
                isOffline={isOffline}
              />
            ) : (
              <>
                {nativeHome}
                <BottomTabBar activeTab="home" activeLang={homeLang} onTabPress={handleNativeHomeTabPress} />
              </>
            )}
          </View>
        </Animated.View>
      )}

      {nativeScreen && (
        <View style={[layerStyle, styles.nativeTravelLayer]}>
          <View style={{ flex: 1 }}>
            {nativeScreen === "flights" && (
              <FlightSearchScreen
                lang={homeLang}
                onChangeLang={changeHomeLanguage}
                onBack={() => {
                  setFlightSearchDraft(null);
                  closeNativeScreen();
                }}
                initialValues={flightSearchDraft}
                onValuesChange={setFlightSearchDraft}
                onSearch={(url) => {
                  setNativeScreen(null);
                  setFlightResultsUrl(url);
                }}
              />
            )}
            {nativeScreen === "packages" && (
              <PackagesScreen
                lang={homeLang}
                onOpenPackage={(url) => {
                  setNativeScreen(null);
                  navigateFromDashboard(url);
                }}
                onBack={closeNativeScreen}
              />
            )}
            {nativeScreen === "contact" && (
              <ContactScreen
                lang={homeLang}
                onStartRequest={() => {
                  setNativeScreen(null);
                  setForceShowRequests(true);
                  if (phase !== "shell") transitionToShell(TABS[0].url);
                }}
                onBack={closeNativeScreen}
              />
            )}
            {nativeScreen === "store" && (
              <TravelStoreScreen
                lang={homeLang}
                onClose={closeNativeScreen}
                onOpenCart={() => openNativeScreen("cart")}
              />
            )}
            {nativeScreen === "cart" && CompatibleCartScreen && (
              <CompatibleCartScreen
                lang={homeLang}
                onClose={() => setNativeScreen("store")}
              />
            )}
            {nativeScreen === "members-offers" && (
              <MembersOffersScreen
                lang={homeLang}
                onClose={() => setNativeScreen(null)}
                onOpenHotelPortalUrl={(url) => {
                  setNativeScreen(null);
                  setHotelPortalOverrideUrl(url);
                  setShowHotelPortal(true);
                  if (phase !== "shell") transitionToShell(TABS[0].url);
                }}
              />
            )}
            <BottomTabBar
              activeTab={nativeScreen === "packages" ? "trips" : nativeScreen === "contact" ? "settings" : "home"}
              activeLang={homeLang}
              onTabPress={handleNativeScreenTabPress}
            />
          </View>
        </View>
      )}
      {flightResultsUrl && (
        <View style={[layerStyle, styles.nativeTravelLayer]}>
          <View style={{ flex: 1 }}>
            {isSampleFlightPreviewUrl(flightResultsUrl)
              ? <FlightResultsScreen
                  url={flightResultsUrl}
                  lang={homeLang}
                  onBack={() => {
                    setFlightResultsUrl(null);
                    setNativeScreen("flights");
                  }}
                  onClose={returnToMainHome}
                />
              : <FlightApiResultsScreen
                  url={flightResultsUrl}
                  values={flightSearchDraft}
                  lang={homeLang}
                  onBack={() => {
                    setFlightResultsUrl(null);
                    setNativeScreen("flights");
                  }}
                  onClose={returnToMainHome}
                />}
          </View>
          <BottomTabBar
            activeTab="home"
            activeLang={homeLang}
            onTabPress={handleFlightResultsTabPress}
          />
        </View>
      )}

      {/* Offline banner — floats over everything when connection drops */}
      {isOffline && <OfflineBanner />}

      {/* Chatbot FAB — floats above the tab bar, visible once shell is active */}
      {phase === "shell" && !profileScreenOpen && !viewportLayout.keyboardViewportReduced && (
        <View style={[styles.chatbotFabWrap, { bottom: insets.bottom + 72 }]}>
          {/* Sonar / live-pulse ring */}
          <Animated.View
            style={[
              styles.chatbotFabRing,
              {
                opacity: fabPulse.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.7, 0] }),
                transform: [{ scale: fabPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.75] }) }],
              },
            ]}
            pointerEvents="none"
          />
          <Pressable
            style={({ pressed }) => [
              styles.chatbotFab,
              pressed && { opacity: 0.85, transform: [{ scale: 0.93 }] },
            ]}
            onPress={() => setShowChatbot(true)}
            accessibilityLabel="Open Tamaiz AI travel advisor"
          >
            <Image
              source={require("../../assets/images/tamaiz-robot.png")}
              style={{ width: 40, height: 40, borderRadius: 20 }}
              resizeMode="cover"
            />
          </Pressable>
        </View>
      )}

      <WhereToGoScreen
        visible={showWhereToGo}
        lang={homeLang}
        onClose={() => setShowWhereToGo(false)}
        onCreatePackage={(destination, nights) => {
          setShowWhereToGo(false);
          setBuilderPrefill({ destination, nights });
          setShowBuilder(true);
        }}
      />
      <PackageBuilderScreen
        visible={showBuilder}
        lang={homeLang}
        prefill={builderPrefill}
        onClose={() => setShowBuilder(false)}
        onUpgrade={openBuilderUpgrade}
      />

      <BookingChoiceModal
        visible={showBookingChoice}
        lang={homeLang}
        onClose={() => setShowBookingChoice(false)}
        onChoose={handleBookingChoice}
      />

      <ChatbotScreen
        visible={showChatbot}
        onClose={() => setShowChatbot(false)}
        subscriptionRequest={subscriptionRequest}
        onNavigateToLocks={() => {
          setShowChatbot(false);
          setForceShowProfile(true);
        }}
      />
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
    position: "relative",
  },
  hotelPortalLayer: {
    zIndex: 30,
    backgroundColor: "#FFFFFF",
  },
  hotelPortalVisible: {
    zIndex: 30,
  },
  hotelPortalPreload: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    zIndex: 0,
    overflow: "hidden",
  },
  nativeTravelLayer: {
    zIndex: 40,
    backgroundColor: "#F2F2F2",
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
  chatbotFabWrap: {
    position: "absolute",
    right: 16,
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1001,
  },
  chatbotFabRing: {
    position: "absolute",
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: "#4A8FE7",
    backgroundColor: "transparent",
  },
  chatbotFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#000000",
    borderWidth: 2.5,
    borderColor: "#4A8FE7",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
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
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  bookingChoiceOverlay: {
    flex: 1,
    backgroundColor: "rgba(2, 10, 25, 0.74)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  bookingChoiceCard: {
    width: "100%",
    maxWidth: 410,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 22,
    // Keep the heading below the absolute close button, including in RTL.
    paddingTop: 58,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.52)",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  bookingChoiceClose: {
    position: "absolute",
    right: 12,
    top: 10,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  bookingChoiceCloseText: { color: "#60708A", fontSize: 28, lineHeight: 28, fontFamily: "Inter_400Regular" },
  bookingChoiceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,175,55,0.14)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.45)",
    marginBottom: 14,
  },
  bookingChoiceIconText: { color: gold, fontSize: 22, fontFamily: "Inter_700Bold" },
  bookingChoiceTitle: { color: navy, fontSize: 21, lineHeight: 27, fontFamily: "Inter_700Bold" },
  bookingChoiceSub: { color: "#60708A", fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 18, fontFamily: "Inter_400Regular" },
  bookingChoiceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: 1,
    borderColor: "#E2E8F2",
    borderRadius: 15,
    padding: 13,
    marginTop: 10,
    backgroundColor: "#F8FAFD",
  },
  bookingChoiceButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: navy,
  },
  bookingChoiceButtonCopy: { flex: 1 },
  bookingChoiceButtonTitle: { color: navy, fontSize: 14.5, fontFamily: "Inter_700Bold" },
  bookingChoiceButtonSub: { color: "#60708A", fontSize: 11.5, marginTop: 3, fontFamily: "Inter_400Regular" },
});

const HOTEL_PORTAL_EXTERNAL_SCHEMES = new Set(["tel:", "mailto:", "sms:", "whatsapp:"]);

function allowHotelPortalNavigation(
  request: { url?: string; isTopFrame?: boolean },
  portalUrl: string,
): boolean {
  const rawUrl = String(request.url ?? "");
  if (rawUrl === "about:blank") return true;
  if (isTrustedHotelPortalNavigation(rawUrl, portalUrl)) {
    return true;
  }
  try {
    const destination = new URL(rawUrl);
    if (HOTEL_PORTAL_EXTERNAL_SCHEMES.has(destination.protocol)) {
      Linking.openURL(destination.toString()).catch(() => {});
    }
  } catch {
    // Invalid links must not escape the in-app Hotel experience.
  }

  return false;
}