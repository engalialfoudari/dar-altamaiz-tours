import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import Svg, { Circle, Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";

import colors from "@/constants/colors";
import type { HomeLang } from "@/components/LuxuryHome";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { LoadingCountdown } from "@/components/LoadingCountdown";
import { hotelPortalUrlFor } from "@/lib/hotelPortal";
import { buildPackageWhatsAppMessage } from "@/utils/packageBuilderWhatsApp";

const C = {
  ...colors.light,
  navy: "#003580",
  navyMid: "#003580",
  navyLight: "#0B448C",
  whatsapp: "#25D366",
  whatsappDark: "#075E54",
  blue: "#2E75C8",
  blueLight: "#B9D8FA",
  blueDark: "#0B448C",
  canvas: "#F2F2F2",
  canvasAlt: "#F2F2F2",
  textOnLight: "#1E293B",
  mutedOnLight: "#64748B",
  mutedForeground: "#64748B",
  borderOnLight: "#E2E8F0",
};

const CONFIGURED_API_BASE = process.env.EXPO_PUBLIC_API_BASE?.replace(/\/$/, "");
const API_BASE = CONFIGURED_API_BASE ?? "https://tours-dar-tamaiz--engalialfoudari.replit.app/api";

// The scraped bookUrl from hotel-search/hotel-name-search points at the
// internal dt-tours.com scraping target, which is not the customer-facing
// domain. Every other in-app hotel browser (main portal, flight handoff)
// opens the public dt-tour.com/hotels portal instead — do the same here so
// this popup's "view full hotel" and alternatives links match.
const HOTEL_PORTAL_URL = hotelPortalUrlFor(CONFIGURED_API_BASE, __DEV__);

const WHATSAPP_NUMBER = "96590087797";
const DEVICE_FP_KEY = "dtours_device_fp_v1";

type BuilderIconName =
  | "add"
  | "bed"
  | "beach"
  | "close"
  | "cloud-offline"
  | "compass"
  | "culture"
  | "diamond"
  | "dining"
  | "family"
  | "flower"
  | "infinite"
  | "leaf"
  | "moon"
  | "person"
  | "remove"
  | "shopping"
  | "sparkles"
  | "time"
  | "whatsapp";

function BuilderIcon({
  name,
  size = 20,
  color = C.navyLight,
  strokeWidth = 1.9,
}: {
  name: BuilderIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const stroke = {
    fill: "none" as const,
    stroke: color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const icon = (() => {
    switch (name) {
      case "add":
        return <Path {...stroke} d="M12 5v14M5 12h14" />;
      case "remove":
        return <Path {...stroke} d="M5 12h14" />;
      case "close":
        return <Path {...stroke} d="m6 6 12 12M18 6 6 18" />;
      case "time":
        return (
          <>
            <Circle {...stroke} cx="12" cy="12" r="8.5" />
            <Path {...stroke} d="M12 7v5l3.2 2" />
          </>
        );
      case "cloud-offline":
        return (
          <>
            <Path {...stroke} d="M7.3 18.2h9.9a4.3 4.3 0 0 0 .8-8.5A6.3 6.3 0 0 0 6 8.2a4.2 4.2 0 0 0 1.3 10Z" />
            <Path {...stroke} d="m5 5 14 14" />
          </>
        );
      case "sparkles":
        return (
          <>
            <Path {...stroke} d="m12 3 1.3 4.7L18 9l-4.7 1.3L12 15l-1.3-4.7L6 9l4.7-1.3L12 3Z" />
            <Path {...stroke} d="m19 15 .6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6L19 15Z" />
          </>
        );
      case "infinite":
        return <Path {...stroke} d="M7.2 16.5c-2.1 0-3.7-1.5-3.7-3.5s1.6-3.5 3.7-3.5c2.2 0 3.3 2.1 4.8 3.5 1.5 1.4 2.6 3.5 4.8 3.5 2.1 0 3.7-1.5 3.7-3.5S18.9 9.5 16.8 9.5c-2.2 0-3.3 2.1-4.8 3.5-1.5 1.4-2.6 3.5-4.8 3.5Z" />;
      case "moon":
        return <Path {...stroke} d="M19.5 15.2A7.8 7.8 0 0 1 8.8 4.5 8.2 8.2 0 1 0 19.5 15.2Z" />;
      case "person":
        return (
          <>
            <Circle {...stroke} cx="12" cy="7.5" r="3" />
            <Path {...stroke} d="M5.5 20a6.5 6.5 0 0 1 13 0" />
          </>
        );
      case "diamond":
        return <Path {...stroke} d="m12 3 7 7-7 11L5 10l7-7ZM5 10h14M9 6h6M8.5 10 12 21l3.5-11" />;
      case "culture":
        return (
          <>
            <Path {...stroke} d="M5 5.5h14M6 5.5v13M18 5.5v13M4 18.5h16M9 8.5h6M9 12h6M9 15.5h6" />
            <Path {...stroke} d="M3.5 5.5h17" />
          </>
        );
      case "dining":
        return (
          <>
            <Circle {...stroke} cx="14.5" cy="13.5" r="5" />
            <Path {...stroke} d="M4 5v6M6.5 5v6M5.25 5v14M4 11h2.5M19.5 5v14M17.5 5v5c0 1 1 1.5 2 1.5" />
          </>
        );
      case "shopping":
        return (
          <>
            <Path {...stroke} d="M5 8.5h14l-1 11H6l-1-11Z" />
            <Path {...stroke} d="M9 8.5a3 3 0 0 1 6 0" />
          </>
        );
      case "leaf":
        return (
          <>
            <Path {...stroke} d="M19.5 4.5C11 4.7 5.2 7.3 5.2 13.1c0 3.5 2.5 5.6 5.6 5.6 5.7 0 8.4-5.5 8.7-14.2Z" />
            <Path {...stroke} d="M4 20c2.7-4.4 6.4-7.2 11.1-9.3" />
          </>
        );
      case "beach":
        return (
          <>
            <Path {...stroke} d="M4 19h16M6 19c.8-4.5 2.7-7.7 6-9.5 3.3 1.8 5.2 5 6 9.5M12 9.5V5M9.5 5h5M7.3 7.4 12 9.5l4.7-2.1" />
          </>
        );
      case "compass":
        return (
          <>
            <Circle {...stroke} cx="12" cy="12" r="8.5" />
            <Path {...stroke} d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z" />
          </>
        );
      case "family":
        return (
          <>
            <Circle {...stroke} cx="9" cy="8" r="2.5" />
            <Circle {...stroke} cx="16.5" cy="9" r="2" />
            <Path {...stroke} d="M3.8 19a5.2 5.2 0 0 1 10.4 0M14 18a4.2 4.2 0 0 1 6.2-3.7" />
          </>
        );
      case "flower":
        return (
          <>
            <Circle {...stroke} cx="12" cy="12" r="2.2" />
            <Path {...stroke} d="M12 9.8C9 8.2 9.3 4.5 12 3.5c2.7 1 3 4.7 0 6.3ZM14.2 12c1.6-3 5.3-2.7 6.3 0-1 2.7-4.7 3-6.3 0ZM12 14.2c3 1.6 2.7 5.3 0 6.3-2.7-1-3-4.7 0-6.3ZM9.8 12c-1.6 3-5.3 2.7-6.3 0 1-2.7 4.7-3 6.3 0Z" />
          </>
        );
      case "bed":
        return (
          <>
            <Path {...stroke} d="M4 18V7.5M4 14h16M20 18v-5.5a2.5 2.5 0 0 0-2.5-2.5H4M7 10V7.5h3A3 3 0 0 1 13 10" />
            <Path {...stroke} d="M4 18h16" />
          </>
        );
      case "whatsapp":
        return (
          <>
            <Path {...stroke} d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.6-4.1A8 8 0 1 1 20 11.5Z" />
            <Path {...stroke} d="M9 8.5c.3-.4.6-.4.9-.1l.8 1c.2.3.2.6 0 .9l-.5.6c.7 1.2 1.5 2 2.7 2.7l.6-.5c.3-.2.6-.2.9 0l1 .8c.3.3.3.6-.1.9-.5.7-1.2 1-2 .8-2.8-.7-5.3-3.2-6-6-.2-.8.1-1.5.7-2.1Z" />
          </>
        );
    }
  })();

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel={`${name} icon`}>
      {icon}
    </Svg>
  );
}

const STR = {
  en: {
    title: "AI Package Builder",
    stepDest: "Where would you like to go?",
    destPlaceholder: "e.g. Paris, Maldives, Istanbul…",
    popular: "Popular",
    stepTrip: "Trip details",
    nights: "Nights",
    travelers: "Travelers",
    stepStyle: "Your style",
    luxury: "Ultra Luxury",
    premium: "Premium",
    comfort: "Comfort",
    interests: "Interests",
    next: "Next",
    backLbl: "Back",
    build: "Design my package",
    building: "Tamaiz AI is designing your package…",
    error: "Couldn't build the package. Please try again.",
    retry: "Retry",
    allowance: "Free package designs",
    unlimited: "Unlimited with your subscription",
    unavailable: "We couldn't check your package allowance. Please try again before building.",
    blockedTitle: "Your package designs are taking a short break",
    blockedBody: "You have used all three free designs in this cycle. Upgrade for unlimited package design.",
    retryIn: "Try again in",
    upgrade: "Upgrade to continue",
    refresh: "Check again",
    perPerson: "per person",
    total: "Estimated total",
    hotel: "Suggested stay",
    hotelPreviewLoading: "Looking up this hotel — this can take up to a couple of minutes…",
    hotelPreviewStars: "stars",
    hotelPreviewFrom: "From",
    hotelPreviewPerNight: "per night",
    hotelPreviewViewFull: "View full hotel page",
    hotelPreviewNotFound: "We couldn't find live details for this hotel right now.",
    hotelPreviewError: "Something went wrong looking up this hotel. Please try again.",
    hotelPreviewTimeout: "This is taking longer than expected. Please try again.",
    hotelPreviewRetry: "Try again",
    hotelPreviewClosestMatch: "Closest match to ",
    hotelPreviewClose: "Close",
    hotelPreviewAltLoading: "Looking for other hotel options…",
    hotelPreviewAltTitle: "Other hotels in ",
    hotelPreviewAltNone: "We couldn't find other live hotel options right now.",
    day: "Day",
    bookWa: "Chat with us on WhatsApp",
    newPkg: "Design another package",
  },
  ar: {
    title: "مصمم الباقات بالذكاء الاصطناعي",
    stepDest: "إلى أين تودّ السفر؟",
    destPlaceholder: "مثال: باريس، المالديف، إسطنبول…",
    popular: "الأكثر طلباً",
    stepTrip: "تفاصيل الرحلة",
    nights: "الليالي",
    travelers: "المسافرون",
    stepStyle: "أسلوبك",
    luxury: "فخامة مطلقة",
    premium: "بريميوم",
    comfort: "مريح",
    interests: "الاهتمامات",
    next: "التالي",
    backLbl: "رجوع",
    build: "صمّم باقتي",
    building: "تميز الذكي يصمم باقتك الآن…",
    error: "تعذّر تصميم الباقة. حاول مرة أخرى.",
    retry: "إعادة المحاولة",
    allowance: "تصاميم الباقات المجانية",
    unlimited: "تصاميم غير محدودة مع اشتراكك",
    unavailable: "تعذر التحقق من رصيد تصميم الباقات. حاول مرة أخرى قبل التصميم.",
    blockedTitle: "تصاميم باقاتك في استراحة قصيرة",
    blockedBody: "استخدمت التصاميم المجانية الثلاثة لهذه الدورة. رقِّ اشتراكك لتصميم باقات بلا حدود.",
    retryIn: "يمكنك المحاولة مجددًا خلال",
    upgrade: "رقِّ للمتابعة",
    refresh: "تحقق مرة أخرى",
    perPerson: "للشخص الواحد",
    total: "الإجمالي التقديري",
    hotel: "الإقامة المقترحة",
    hotelPreviewLoading: "جارٍ البحث عن هذا الفندق — قد يستغرق ذلك حتى دقيقتين…",
    hotelPreviewStars: "نجوم",
    hotelPreviewFrom: "من",
    hotelPreviewPerNight: "لليلة الواحدة",
    hotelPreviewViewFull: "عرض صفحة الفندق كاملة",
    hotelPreviewNotFound: "تعذّر إيجاد تفاصيل مباشرة لهذا الفندق الآن.",
    hotelPreviewError: "حدث خطأ أثناء البحث عن هذا الفندق. حاول مرة أخرى.",
    hotelPreviewTimeout: "استغرق هذا وقتًا أطول من المتوقع. حاول مرة أخرى.",
    hotelPreviewRetry: "حاول مرة أخرى",
    hotelPreviewClosestMatch: "أقرب تطابق لـ ",
    hotelPreviewClose: "إغلاق",
    hotelPreviewAltLoading: "جارٍ البحث عن خيارات فنادق أخرى…",
    hotelPreviewAltTitle: "فنادق أخرى في ",
    hotelPreviewAltNone: "تعذّر إيجاد خيارات فنادق مباشرة أخرى الآن.",
    day: "اليوم",
    bookWa: "تواصل معنا عبر واتساب",
    newPkg: "صمّم باقة أخرى",
  },
};

const POPULAR = ["Paris", "Istanbul", "Maldives", "Dubai", "Bali", "Switzerland"];

const INTERESTS: Array<{ key: string; en: string; ar: string; icon: BuilderIconName }> = [
  { key: "culture", en: "Culture", ar: "ثقافة", icon: "culture" },
  { key: "fine dining", en: "Fine dining", ar: "مطاعم فاخرة", icon: "dining" },
  { key: "shopping", en: "Shopping", ar: "تسوق", icon: "shopping" },
  { key: "nature", en: "Nature", ar: "طبيعة", icon: "leaf" },
  { key: "beach", en: "Beach", ar: "شاطئ", icon: "beach" },
  { key: "adventure", en: "Adventure", ar: "مغامرة", icon: "compass" },
  { key: "family", en: "Family", ar: "عائلي", icon: "family" },
  { key: "relaxation", en: "Spa & relax", ar: "سبا واسترخاء", icon: "flower" },
];

interface Estimate {
  title: string;
  summary: string;
  days: Array<{ day: number; title: string; plan: string }>;
  hotelSuggestion: string;
  estimatedPricePerPersonKwd: number;
  estimatedTotalKwd: number;
  priceNote: string;
}

interface BuilderEntitlement {
  allowed: boolean;
  isPremium: boolean;
  cycleRequests: number;
  cyclesUsedToday: number;
  remaining: number | null;
  maxPerCycle: number;
  blockUntil: number | null;
}

// The AI hotel suggestion occasionally hedges with "or similar", "or
// equivalent", or a parenthetical qualifier instead of naming one specific
// hotel (e.g. "The Ritz Paris or similar luxury 5-star hotel"). Searching
// for that whole phrase can't resolve to any real property on dt-tours, so
// strip trailing qualifiers before using it to look the hotel up or to
// judge whether a resolved result actually matches it.
function cleanHotelSuggestionName(raw: string): string {
  const cleaned = raw
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+(or|أو)\s+.*$/i, "")
    .trim();
  return cleaned || raw;
}

function formatTimeLeft(blockUntil: number | null, currentTime: number): string {
  if (!blockUntil) return "";
  const seconds = Math.max(0, Math.ceil((blockUntil - currentTime) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

async function getDeviceFingerprint(): Promise<string> {
  let hardwareId: string | null = null;
  try {
    if (Platform.OS === "android") hardwareId = Application.getAndroidId();
    if (Platform.OS === "ios") hardwareId = await Application.getIosIdForVendorAsync();
  } catch {
    // Fall back to the persisted app identifier when a device ID is unavailable.
  }
  let fingerprint = hardwareId ?? (await AsyncStorage.getItem(DEVICE_FP_KEY));
  if (!fingerprint) fingerprint = `fp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_FP_KEY, fingerprint);
  return fingerprint;
}

function Stepper({
  value,
  setValue,
  min,
  max,
}: {
  value: number;
  setValue: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        style={styles.stepBtn}
        onPress={() => setValue(Math.max(min, value - 1))}
        hitSlop={8}
      >
        <BuilderIcon name="remove" size={20} color={C.blueLight} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        style={styles.stepBtn}
        onPress={() => setValue(Math.min(max, value + 1))}
        hitSlop={8}
      >
        <BuilderIcon name="add" size={20} color={C.blueLight} />
      </Pressable>
    </View>
  );
}

export function PackageBuilderScreen({
  visible,
  lang,
  prefill,
  onClose,
  onUpgrade,
}: {
  visible: boolean;
  lang: HomeLang;
  prefill?: { destination: string; nights: number } | null;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const insets = useSafeAreaInsets();
  const s = STR[lang];
  const rtl = lang === "ar";

  const [step, setStep] = useState(0);
  const [destination, setDestination] = useState("");
  const [nights, setNights] = useState(5);
  const [travelers, setTravelers] = useState(2);
  const [style, setStyle] = useState<"luxury" | "premium" | "comfort">("premium");
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<Estimate | null>(null);
  const [suggestedHotelStars, setSuggestedHotelStars] = useState<number | null>(null);
  const [fingerprint, setFingerprint] = useState("");
  const [entitlement, setEntitlement] = useState<BuilderEntitlement | null>(null);
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const [entitlementError, setEntitlementError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [hotelPreview, setHotelPreview] = useState<{
    status: "loading" | "found" | "notfound" | "error" | "timeout";
    hotel?: { name: string; stars: number; price: string; bookUrl: string };
  } | null>(null);
  const [hotelAlternatives, setHotelAlternatives] = useState<{
    status: "loading" | "loaded" | "error";
    hotels: Array<{ name: string; stars: number; price: string; bookUrl: string }>;
  } | null>(null);
  const [hotelBrowserUrl, setHotelBrowserUrl] = useState<string | null>(null);
  const [hotelBrowserTitle, setHotelBrowserTitle] = useState<string | null>(null);
  const [hotelBrowserError, setHotelBrowserError] = useState(false);
  const [hotelBrowserKey, setHotelBrowserKey] = useState(0);

  const reqRef = React.useRef(0);
  const hotelPreviewReqRef = React.useRef(0);
  const hotelStarsReqRef = React.useRef(0);

  // Start fresh on every open; a prefill (from "Where to Go?") skips step 0.
  useEffect(() => {
    if (!visible) return;
    reqRef.current++;
    setResult(null);
    setError(false);
    setLoading(false);
    setStyle("premium");
    setInterests([]);
    setTravelers(2);
    if (prefill) {
      setDestination(prefill.destination);
      setNights(prefill.nights);
      setStep(1);
    } else {
      setDestination("");
      setNights(5);
      setStep(0);
    }
  }, [visible, prefill]);

  const refreshEntitlement = React.useCallback(async () => {
    setEntitlementLoading(true);
    setEntitlementError(false);
    try {
      const fp = await getDeviceFingerprint();
      setFingerprint(fp);
      const response = await fetch(`${API_BASE}/chat/builder-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": fp },
        body: JSON.stringify({ fingerprint: fp }),
      });
      const data = (await response.json()) as { ok?: boolean; builder?: BuilderEntitlement };
      if (!response.ok || !data.ok || !data.builder) throw new Error("entitlement unavailable");
      setEntitlement(data.builder);
    } catch {
      setEntitlementError(true);
      setEntitlement(null);
    } finally {
      setEntitlementLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void refreshEntitlement();
  }, [visible, refreshEntitlement]);

  useEffect(() => {
    const hotelSuggestion = result?.hotelSuggestion;
    if (!hotelSuggestion) {
      setSuggestedHotelStars(null);
      return;
    }

    const reqId = ++hotelStarsReqRef.current;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);
    setSuggestedHotelStars(null);

    const loadStars = async () => {
      try {
        const { checkin, checkout } = previewStayDates();
        const response = await fetch(`${API_BASE}/hotel-name-search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hotelName: cleanHotelSuggestionName(hotelSuggestion),
            checkin,
            checkout,
            rooms: 1,
            adults: Math.max(1, Math.min(9, travelers)),
            cityHint: destination,
            strictMatch: true,
          }),
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          ok?: boolean;
          hotels?: Array<{ stars: number }>;
        };
        if (hotelStarsReqRef.current !== reqId) return;
        const stars = data.hotels?.[0]?.stars;
        setSuggestedHotelStars(response.ok && data.ok && typeof stars === "number" && stars > 0 ? stars : null);
      } catch {
        if (hotelStarsReqRef.current === reqId) setSuggestedHotelStars(null);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    void loadStars();
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [result?.hotelSuggestion, destination, travelers]);

  useEffect(() => {
    const blockUntil = entitlement?.blockUntil;
    if (!visible || !blockUntil) return;

    let refreshRequested = false;
    const updateCooldown = () => {
      const current = Date.now();
      setNow(current);
      if (current >= blockUntil && !refreshRequested) {
        refreshRequested = true;
        void refreshEntitlement();
      }
    };

    updateCooldown();
    const id = setInterval(updateCooldown, 1_000);
    return () => clearInterval(id);
  }, [visible, entitlement?.blockUntil, refreshEntitlement]);

  const toggleInterest = (key: string) =>
    setInterests((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const build = async () => {
    if (!fingerprint || !entitlement || entitlementLoading || entitlementError || !entitlement.allowed) return;
    const reqId = ++reqRef.current;
    const requestKey = `package-${fingerprint}-${Date.now()}-${reqId}`;
    setLoading(true);
    setError(false);
    setResult(null);
    try {
      const request = () =>
        fetch(`${API_BASE}/ai-package-estimate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-device-id": fingerprint,
            "x-idempotency-key": requestKey,
          },
          body: JSON.stringify({ destination, nights, travelers, style, interests, lang, fingerprint }),
        });
      let response: Response;
      try {
        response = await request();
      } catch {
        await new Promise(resolve => setTimeout(resolve, 500));
        response = await request();
      }
      const data = (await response.json()) as Estimate & {
        error?: string;
        blocked?: boolean;
        builder?: BuilderEntitlement;
      };
      if (data.builder && reqRef.current === reqId) setEntitlement(data.builder);
      if (response.ok) {
        if (reqRef.current === reqId) setResult(data);
      } else if (data.blocked) {
        if (reqRef.current === reqId) setError(false);
      } else if (reqRef.current === reqId) {
        setError(true);
      }
    } catch {
      if (reqRef.current === reqId) setError(true);
    } finally {
      if (reqRef.current === reqId) setLoading(false);
    }
  };

  // Package Builder never collects exact travel dates — a reasonable
  // near-future window is used purely to price/locate hotels for this
  // quick preview, not treated as the customer's real trip.
  const previewStayDates = () => {
    const checkinDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const checkoutDate = new Date(checkinDate.getTime() + Math.max(1, nights) * 24 * 60 * 60 * 1000);
    const toIso = (d: Date) => d.toISOString().slice(0, 10);
    return { checkin: toIso(checkinDate), checkout: toIso(checkoutDate) };
  };

  // When the AI-suggested hotel doesn't resolve to a real, bookable dt-tours
  // property (e.g. the suggested name doesn't exist in live inventory), show
  // a few real alternatives in the same destination instead of a dead end.
  const loadHotelAlternatives = async (reqId: number) => {
    if (!destination) { setHotelAlternatives({ status: "error", hotels: [] }); return; }
    setHotelAlternatives({ status: "loading", hotels: [] });
    try {
      const { checkin, checkout } = previewStayDates();
      const response = await fetch(`${API_BASE}/hotel-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: destination,
          checkin,
          checkout,
          rooms: 1,
          adults: Math.max(1, Math.min(9, travelers)),
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        hotels?: Array<{ name: string; stars: number; price: string; bookUrl: string }>;
      };
      if (hotelPreviewReqRef.current !== reqId) return;
      if (response.ok && data.ok && data.hotels && data.hotels.length > 0) {
        const alternatives = data.hotels.slice(0, 3);
        setHotelAlternatives({ status: "loaded", hotels: alternatives });
        // Warm each alternative's portal search now, while the customer is
        // still reading the list — by the time they tap a name, the page
        // opens to an already-computed result instead of a fresh wait.
        alternatives.forEach((h) => prefetchHotelPortalSearch(h.bookUrl));
      } else {
        setHotelAlternatives({ status: "error", hotels: [] });
      }
    } catch {
      if (hotelPreviewReqRef.current !== reqId) return;
      setHotelAlternatives({ status: "error", hotels: [] });
    }
  };

  const openHotelPreview = async () => {
    if (!result?.hotelSuggestion) return;
    const reqId = ++hotelPreviewReqRef.current;
    setHotelPreview({ status: "loading" });
    setHotelAlternatives(null);
    const cleanHotelName = cleanHotelSuggestionName(result.hotelSuggestion);
    // This looks the hotel up live on dt-tours.com (no pre-built index for
    // free-text AI hotel names). The primary lookup is usually ~45-60s, but
    // a strict-match fallback (when the name alone doesn't resolve) can add
    // a second sequential scrape, so allow up to ~2 minutes before timing
    // out. (If it does time out, a retry resolves quickly since the server
    // caches the completed result even if the client gave up first.)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);
    try {
      const { checkin, checkout } = previewStayDates();
      const response = await fetch(`${API_BASE}/hotel-name-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelName: cleanHotelName,
          checkin,
          checkout,
          rooms: 1,
          adults: Math.max(1, Math.min(9, travelers)),
          // The destination is already known from Step 1 — use it as the
          // authoritative city instead of letting the server guess one from
          // the AI's hotel name text, and require an actual name match so a
          // wrong hotel from the same city is never silently substituted.
          cityHint: destination,
          strictMatch: true,
        }),
        signal: controller.signal,
      });
      const data = (await response.json()) as {
        ok?: boolean;
        hotels?: Array<{ name: string; stars: number; price: string; bookUrl: string }>;
      };
      if (hotelPreviewReqRef.current !== reqId) return;
      if (response.ok && data.ok && data.hotels && data.hotels.length > 0) {
        setHotelPreview({ status: "found", hotel: data.hotels[0] });
        // Warm the portal search now, while the customer is still reading
        // the preview card — tapping "view full hotel" then opens an
        // already-computed result instead of a fresh wait.
        prefetchHotelPortalSearch(data.hotels[0].bookUrl);
      } else {
        // The suggested hotel isn't a real bookable dt-tours property (this
        // happens when the AI names a hotel that doesn't exist in live
        // inventory) — offer real alternatives instead of a dead end.
        setHotelPreview({ status: "notfound" });
        void loadHotelAlternatives(reqId);
      }
    } catch (err) {
      if (hotelPreviewReqRef.current !== reqId) return;
      const isAbort = err instanceof Error && err.name === "AbortError";
      setHotelPreview({ status: isAbort ? "timeout" : "error" });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const closeHotelPreview = () => {
    setHotelPreview(null);
    setHotelAlternatives(null);
  };

  // Deep-link into the public hotel portal's own search, scoped to the exact
  // property when we know its dt-tours hotel_id (parsed from the scraped
  // bookUrl) so the portal runs a live, hotel-specific search instead of
  // just showing a pre-filled, unsubmitted form.
  const buildHotelPortalUrl = (bookUrl?: string) => {
    const { checkin, checkout } = previewStayDates();
    const params = new URLSearchParams({
      checkin,
      checkout,
      adults: String(Math.max(1, Math.min(9, travelers))),
      rooms: "1",
      autoSearch: "1",
      // Drive the portal's language from the app's current language so the
      // page the customer sees matches what they're already reading, and so
      // this exact search shape (see prefetchHotelPortalSearch) is cached
      // under the same key the page's own search will look up.
      lang,
    });
    if (destination) params.set("city", destination);
    const hotelIdMatch = bookUrl?.match(/[?&]hotel_id=(\d+)/);
    if (hotelIdMatch) params.set("hotelId", hotelIdMatch[1]);
    const joiner = HOTEL_PORTAL_URL.includes("?") ? "&" : "?";
    return `${HOTEL_PORTAL_URL}${joiner}${params.toString()}`;
  };

  // Warms the portal's own server-side search cache in the background, the
  // instant we know a hotel the customer might tap next (the single "found"
  // hotel, or each alternative in the fallback list) — before they've
  // tapped anything. When they do tap, the WebView runs the identical
  // search and gets the already-computed result back instantly instead of
  // waiting through a fresh live supplier search.
  const prefetchHotelPortalSearch = (bookUrl?: string) => {
    const portalUrl = buildHotelPortalUrl(bookUrl);
    const searchParams = new URL(portalUrl).searchParams;
    const streamParams = new URLSearchParams({
      city: searchParams.get("city") || destination,
      checkin: searchParams.get("checkin") || "",
      checkout: searchParams.get("checkout") || "",
      adults: searchParams.get("adults") || "2",
      rooms: searchParams.get("rooms") || "1",
      lang: searchParams.get("lang") || lang,
    });
    const hotelIdValue = searchParams.get("hotelId");
    if (hotelIdValue) streamParams.set("hotelId", hotelIdValue);
    const apiOrigin = CONFIGURED_API_BASE?.replace(/\/api$/, "") ?? "https://tours-dar-tamaiz--engalialfoudari.replit.app";
    const controller = new AbortController();
    // The stream can stay open for a while on a full city fallback search —
    // this is a best-effort warm-up, not something the UI waits on, so give
    // up well before it could interfere with the user's real interaction.
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    fetch(`${apiOrigin}/api/hotel-search-stream?${streamParams.toString()}`, { signal: controller.signal })
      .then((response) => response.body?.getReader())
      .then(async (reader) => {
        if (!reader) return;
        // Drain the stream so the server-side handler runs to completion and
        // populates its cache; the data itself isn't used here.
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeoutId));
  };

  const closeHotelBrowser = () => {
    setHotelBrowserUrl(null);
    setHotelBrowserTitle(null);
    setHotelBrowserError(false);
  };

  const bookViaWhatsApp = () => {
    if (!result) return;
    const msg = buildPackageWhatsAppMessage(
      result,
      { destination, nights, travelers },
      lang,
    );
    Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`).catch(() => {});
  };

  const resetAll = () => {
    setStep(0);
    setDestination("");
    setNights(5);
    setTravelers(2);
    setStyle("premium");
    setInterests([]);
    setResult(null);
    setError(false);
  };

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const canNext = step === 0 ? destination.trim().length >= 2 : true;
  const isBlocked =
    !!entitlement &&
    !entitlement.allowed &&
    (entitlement.blockUntil == null || entitlement.blockUntil > now);
  const timer = formatTimeLeft(entitlement?.blockUntil ?? null, now);

  return (
    <>
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <View style={styles.headerRow}>
            <Pressable onPress={onClose} hitSlop={10} style={styles.backBtn} testID="pb-close">
              <BuilderIcon name="close" size={22} color="#FFFFFF" strokeWidth={2.2} />
            </Pressable>
            <Text style={[styles.headerTitle, rtl && styles.rtlText]}>{s.title}</Text>
            <View style={{ width: 36 }} />
          </View>
          {/* Progress dots */}
          {!result && !loading && (
            <View style={styles.dots}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.dot, step >= i && styles.dotActive]} />
              ))}
            </View>
          )}
          <View style={styles.accentHairline} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30 }}
          keyboardShouldPersistTaps="handled"
        >
          {loading && (
            <View style={styles.loadingWrap}>
              <LoadingCountdown
                message={s.building}
                color={C.navy}
                mutedColor={C.mutedOnLight}
                rtl={rtl}
              />
            </View>
          )}

          {error && (
            <View style={styles.loadingWrap}>
              <Text style={styles.errorText}>{s.error}</Text>
              <Pressable style={styles.retryBtn} onPress={build}>
                <Text style={styles.retryText}>{s.retry}</Text>
              </Pressable>
            </View>
          )}

          {!loading && !error && isBlocked && (
            <View style={styles.quotaBlock} testID="pb-quota-block">
              <View style={styles.quotaIcon}>
                <BuilderIcon name="time" size={26} color={C.navyLight} />
              </View>
              <Text style={[styles.quotaTitle, rtl && styles.rtlText]}>{s.blockedTitle}</Text>
              <Text style={[styles.quotaCopy, rtl && styles.rtlText]}>{s.blockedBody}</Text>
              {!!timer && (
                <View style={styles.quotaTimerWrap} testID="pb-quota-timer">
                  <Text style={[styles.quotaTimerLabel, rtl && styles.rtlText]}>{s.retryIn}</Text>
                  <Text style={styles.quotaTimer}>{timer}</Text>
                </View>
              )}
              <Pressable
                style={styles.upgradeBtn}
                onPress={onUpgrade}
                testID="pb-upgrade"
                accessibilityRole="button"
                accessibilityLabel={s.upgrade}
              >
                <BuilderIcon name="sparkles" size={18} color="#FFFFFF" />
                <Text style={styles.upgradeText}>{s.upgrade}</Text>
              </Pressable>
              <Pressable
                style={styles.checkBtn}
                onPress={() => void refreshEntitlement()}
                testID="pb-refresh-entitlement"
              >
                <Text style={styles.checkText}>{s.refresh}</Text>
              </Pressable>
            </View>
          )}

          {!loading && !error && entitlementError && (
            <View style={styles.entitlementError} testID="pb-entitlement-error">
              <BuilderIcon name="cloud-offline" size={22} color={C.navyLight} />
              <Text style={[styles.entitlementErrorText, rtl && styles.rtlText]}>{s.unavailable}</Text>
              <Pressable style={styles.retryBtn} onPress={() => void refreshEntitlement()} testID="pb-entitlement-retry">
                <Text style={styles.retryText}>{s.retry}</Text>
              </Pressable>
            </View>
          )}

          {!loading && !error && !result && !isBlocked && !entitlementError && (
            <>
              {!isBlocked && !entitlementError && (
                <View style={styles.allowanceRow} testID="pb-allowance">
                  <BuilderIcon name={entitlement?.isPremium ? "infinite" : "sparkles"} size={17} color={C.navyLight} />
                  <Text style={styles.allowanceText}>
                    {entitlement?.isPremium
                      ? s.unlimited
                      : `${s.allowance}: ${entitlement?.remaining ?? 0}/${entitlement?.maxPerCycle ?? 3}`}
                  </Text>
                  {entitlementLoading && <ActivityIndicator size="small" color={C.navyLight} />}
                </View>
              )}
              {step === 0 && (
                <>
                  <Text style={[styles.q, rtl && styles.rtlTextRight]}>{s.stepDest}</Text>
                  <TextInput
                    style={[styles.input, rtl && { textAlign: "right" }]}
                    value={destination}
                    onChangeText={setDestination}
                    placeholder={s.destPlaceholder}
                    placeholderTextColor={C.mutedOnLight}
                    testID="pb-destination"
                  />
                  <Text style={[styles.subLbl, rtl && styles.rtlTextRight]}>{s.popular}</Text>
                  <View style={styles.chips}>
                    {POPULAR.map((p) => (
                      <Pressable
                        key={p}
                        onPress={() => setDestination(p)}
                        style={[styles.chip, destination === p && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, destination === p && styles.chipTextActive]}>{p}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {step === 1 && (
                <>
                  <Text style={[styles.q, rtl && styles.rtlTextRight]}>{s.stepTrip}</Text>
                  <View style={styles.tripRow}>
                    <View style={styles.tripCol}>
                      <View style={styles.tripLabelRow}>
                        <BuilderIcon name="moon" size={16} color={C.blueLight} />
                        <Text style={styles.tripLbl}>{s.nights}</Text>
                      </View>
                      <Stepper value={nights} setValue={setNights} min={1} max={30} />
                    </View>
                    <View style={styles.tripCol}>
                      <View style={styles.tripLabelRow}>
                        <BuilderIcon name="person" size={16} color={C.blueLight} />
                        <Text style={styles.tripLbl}>{s.travelers}</Text>
                      </View>
                      <Stepper value={travelers} setValue={setTravelers} min={1} max={12} />
                    </View>
                  </View>
                </>
              )}

              {step === 2 && (
                <>
                  <Text style={[styles.q, rtl && styles.rtlTextRight]}>{s.stepStyle}</Text>
                  <View style={styles.styleRow}>
                    {(
                      [
                        ["luxury", s.luxury, "diamond"],
                        ["premium", s.premium, "sparkles"],
                        ["comfort", s.comfort, "leaf"],
                      ] as const
                    ).map(([key, label, icon]) => (
                      <Pressable
                        key={key}
                        onPress={() => setStyle(key)}
                        style={[styles.styleCard, style === key && styles.styleCardActive]}
                        testID={`pb-style-${key}`}
                      >
                        <BuilderIcon name={icon} size={22} color={style === key ? "#FFFFFF" : C.blueLight} />
                        <Text style={styles.styleText}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={[styles.subLbl, rtl && styles.rtlTextRight]}>{s.interests}</Text>
                  <View style={styles.chips}>
                    {INTERESTS.map((it) => (
                      <Pressable
                        key={it.key}
                        onPress={() => toggleInterest(it.key)}
                        style={[styles.chip, interests.includes(it.key) && styles.chipActive]}
                      >
                        <BuilderIcon
                          name={it.icon}
                          size={15}
                          color={interests.includes(it.key) ? "#FFFFFF" : C.navyLight}
                        />
                        <Text style={[styles.chipText, interests.includes(it.key) && styles.chipTextActive]}>
                          {lang === "ar" ? it.ar : it.en}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <View style={[styles.navRow, rtl && { flexDirection: "row-reverse" }]}>
                {step > 0 ? (
                  <Pressable style={styles.backNav} onPress={() => setStep(step - 1)} testID="pb-back">
                    <Text style={styles.backNavText}>{s.backLbl}</Text>
                  </Pressable>
                ) : (
                  <View />
                )}
                <Pressable
                  style={[
                    styles.nextBtn,
                    (!canNext || entitlementLoading || !entitlement || !entitlement.allowed) && { opacity: 0.4 },
                  ]}
                  disabled={!canNext || entitlementLoading || !entitlement || !entitlement.allowed}
                  onPress={() => (step < 2 ? setStep(step + 1) : build())}
                  testID="pb-next"
                >
                  <Text style={styles.nextText}>{step < 2 ? s.next : s.build}</Text>
                </Pressable>
              </View>
            </>
          )}

          {result && (
            <>
              <Text style={[styles.resTitle, rtl && styles.rtlTextRight]}>{result.title}</Text>
              <Text style={[styles.resSummary, rtl && styles.rtlTextRight]}>{result.summary}</Text>

              <View style={styles.priceCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.priceLbl}>{s.perPerson}</Text>
                  <Text style={styles.priceVal}>KWD {result.estimatedPricePerPersonKwd}</Text>
                </View>
                <View style={styles.priceDivider} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.priceLbl}>{s.total}</Text>
                  <Text style={styles.priceVal}>KWD {result.estimatedTotalKwd}</Text>
                </View>
              </View>

              {!!result.hotelSuggestion && (
                <View style={styles.hotelCard} testID="pb-hotel-suggestion">
                  <BuilderIcon name="bed" size={18} color={C.navyLight} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.hotelLbl, rtl && styles.rtlTextRight]}>{s.hotel}</Text>
                    <Text style={[styles.hotelVal, rtl && styles.rtlTextRight]}>
                      {result.hotelSuggestion}
                      {suggestedHotelStars !== null && (
                        <Text style={styles.hotelStars}>
                          {`  •  ★ ${suggestedHotelStars} ${s.hotelPreviewStars}`}
                        </Text>
                      )}
                    </Text>
                  </View>
                </View>
              )}

              {result.days?.map((d) => (
                <View key={d.day} style={[styles.dayCard, rtl && { flexDirection: "row-reverse" }]}>
                  <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>{d.day}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dayTitle, rtl && styles.rtlTextRight]}>{d.title}</Text>
                    <Text style={[styles.dayPlan, rtl && styles.rtlTextRight]}>{d.plan}</Text>
                  </View>
                </View>
              ))}

              <Text style={[styles.priceNote, rtl && styles.rtlTextRight]}>{result.priceNote}</Text>

              <Pressable style={styles.waBtn} onPress={bookViaWhatsApp} testID="pb-whatsapp">
                <WhatsAppIcon size={21} color={C.whatsapp} outline />
                <Text style={[styles.waText, rtl && styles.rtlText]}>
                  {s.bookWa}
                </Text>
              </Pressable>
              <Pressable style={styles.againBtn} onPress={resetAll}>
                <Text style={styles.againText}>{s.newPkg}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>

    <Modal
      visible={!!hotelPreview}
      animationType="fade"
      transparent
      onRequestClose={closeHotelPreview}
    >
      <View style={styles.previewOverlay}>
        <View style={styles.previewCard}>
          <Pressable
            style={styles.previewClose}
            onPress={closeHotelPreview}
            hitSlop={10}
            testID="pb-hotel-preview-close"
          >
            <BuilderIcon name="close" size={16} color={C.mutedOnLight} />
          </Pressable>

          <Text style={[styles.previewHotelName, rtl && styles.rtlTextRight]} numberOfLines={2}>
            {hotelPreview?.status === "found" && hotelPreview.hotel
              ? hotelPreview.hotel.name
              : result?.hotelSuggestion}
          </Text>

          {hotelPreview?.status === "found" &&
            hotelPreview.hotel &&
            result?.hotelSuggestion &&
            (() => {
              const cleanName = cleanHotelSuggestionName(result.hotelSuggestion);
              const a = hotelPreview.hotel.name.toLowerCase();
              const b = cleanName.toLowerCase();
              if (a.includes(b) || b.includes(a)) return null;
              return (
                <Text style={[styles.previewClosestMatch, rtl && styles.rtlTextRight]} testID="pb-hotel-preview-closest-match">
                  {`${s.hotelPreviewClosestMatch}"${cleanName}"`}
                </Text>
              );
            })()}

          {hotelPreview?.status === "loading" && (
            <View style={styles.previewLoading} testID="pb-hotel-preview-loading">
              <LoadingCountdown
                message={s.hotelPreviewLoading}
                durationSeconds={45}
                color={C.navyLight}
                mutedColor={C.mutedOnLight}
                rtl={rtl}
              />
            </View>
          )}

          {hotelPreview?.status === "found" && hotelPreview.hotel && (
            <View testID="pb-hotel-preview-found">
              {hotelPreview.hotel.stars > 0 && (
                <Text style={[styles.previewStars, rtl && styles.rtlTextRight]}>
                  {"★".repeat(Math.round(hotelPreview.hotel.stars))} {hotelPreview.hotel.stars} {s.hotelPreviewStars}
                </Text>
              )}
              {!!hotelPreview.hotel.price && (
                <Text style={[styles.previewPrice, rtl && styles.rtlTextRight]}>
                  {s.hotelPreviewFrom} KWD {hotelPreview.hotel.price} {s.hotelPreviewPerNight}
                </Text>
              )}
              <Pressable
                style={styles.previewViewBtn}
                onPress={() => {
                  setHotelBrowserError(false);
                  setHotelBrowserTitle(hotelPreview.hotel!.name);
                  setHotelBrowserUrl(buildHotelPortalUrl(hotelPreview.hotel!.bookUrl));
                }}
                testID="pb-hotel-preview-view-full"
              >
                <Text style={styles.previewViewBtnText}>{s.hotelPreviewViewFull}</Text>
              </Pressable>
            </View>
          )}

          {hotelPreview?.status === "notfound" && (
            <View testID="pb-hotel-preview-notfound">
              <Text style={[styles.previewMsg, rtl && styles.rtlTextRight]}>
                {s.hotelPreviewNotFound}
              </Text>

              {hotelAlternatives?.status === "loading" && (
                <View style={styles.previewLoading} testID="pb-hotel-alt-loading">
                  <ActivityIndicator size="small" color={C.navyLight} />
                  <Text style={[styles.previewMsg, rtl && styles.rtlTextRight]}>{s.hotelPreviewAltLoading}</Text>
                </View>
              )}

              {hotelAlternatives?.status === "error" && (
                <Text style={[styles.previewMsg, rtl && styles.rtlTextRight]} testID="pb-hotel-alt-error">
                  {s.hotelPreviewAltNone}
                </Text>
              )}

              {hotelAlternatives?.status === "loaded" && hotelAlternatives.hotels.length > 0 && (
                <View style={styles.previewAltList} testID="pb-hotel-alt-list">
                  <Text style={[styles.previewAltTitle, rtl && styles.rtlTextRight]}>
                    {`${s.hotelPreviewAltTitle}${destination}`}
                  </Text>
                  {hotelAlternatives.hotels.map((h, i) => (
                    <Pressable
                      key={h.bookUrl || i}
                      style={styles.previewAltItem}
                      onPress={() => {
                        setHotelBrowserError(false);
                        setHotelBrowserTitle(h.name);
                        setHotelBrowserUrl(buildHotelPortalUrl(h.bookUrl));
                      }}
                      testID={`pb-hotel-alt-item-${i}`}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.previewAltName, rtl && styles.rtlTextRight]} numberOfLines={1}>
                          {h.name}
                        </Text>
                        {h.stars > 0 && (
                          <Text style={styles.previewAltStars}>{"★".repeat(Math.round(h.stars))}</Text>
                        )}
                      </View>
                      {!!h.price && <Text style={styles.previewAltPrice}>KWD {h.price}</Text>}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {hotelPreview?.status === "error" && (
            <Text style={[styles.previewMsg, rtl && styles.rtlTextRight]} testID="pb-hotel-preview-error">
              {s.hotelPreviewError}
            </Text>
          )}

          {hotelPreview?.status === "timeout" && (
            <View testID="pb-hotel-preview-timeout">
              <Text style={[styles.previewMsg, rtl && styles.rtlTextRight]}>{s.hotelPreviewTimeout}</Text>
              <Pressable style={styles.previewViewBtn} onPress={openHotelPreview} testID="pb-hotel-preview-retry">
                <Text style={styles.previewViewBtnText}>{s.hotelPreviewRetry}</Text>
              </Pressable>
            </View>
          )}

          <Pressable style={styles.previewCloseBtn} onPress={closeHotelPreview}>
            <Text style={styles.previewCloseBtnText}>{s.hotelPreviewClose}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>

    <Modal
      visible={!!hotelBrowserUrl}
      animationType="slide"
      onRequestClose={closeHotelBrowser}
      statusBarTranslucent
    >
      <View style={styles.browserRoot}>
        <View style={[styles.browserHeader, { paddingTop: insets.top + 6 }]}>
          <Text style={styles.browserTitle} numberOfLines={1}>
            {hotelBrowserTitle || result?.hotelSuggestion || ""}
          </Text>
          <Pressable
            onPress={closeHotelBrowser}
            hitSlop={12}
            testID="pb-hotel-browser-close"
          >
            <BuilderIcon name="close" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        {!!hotelBrowserUrl && (
          Platform.OS === "web" ? (
            // react-native-webview has no web implementation; embed via a
            // plain iframe instead (same pattern as the flight-results and
            // main hotel-portal browser handoffs).
            React.createElement("iframe", {
              src: hotelBrowserUrl,
              style: { flex: 1, border: "none", width: "100%", height: "100%" },
            })
          ) : hotelBrowserError ? (
            <View style={styles.browserErrorWrap} testID="pb-hotel-browser-error">
              <Text style={styles.browserErrorMsg}>{s.hotelPreviewTimeout}</Text>
              <Pressable
                style={styles.previewViewBtn}
                onPress={() => {
                  setHotelBrowserError(false);
                  setHotelBrowserKey((k) => k + 1);
                }}
                testID="pb-hotel-browser-retry"
              >
                <Text style={styles.previewViewBtnText}>{s.hotelPreviewRetry}</Text>
              </Pressable>
            </View>
          ) : (
            <WebView
              key={hotelBrowserKey}
              source={{ uri: hotelBrowserUrl }}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              // Matches the established WebView config used by the main
              // hotel portal and flight handoff (index.tsx / FlightResultsScreen):
              // dt-tours.com is served differently to default mobile WebView
              // user agents, and without this, Android can silently fail to
              // open the page when it tries to spawn a new window (e.g.
              // target="_blank" links).
              userAgent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
              setSupportMultipleWindows={false}
              onError={() => setHotelBrowserError(true)}
              onHttpError={() => setHotelBrowserError(true)}
            />
          )
        )}
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.canvas },
  header: {
    backgroundColor: C.navy,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.navyLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#FFFFFF", fontSize: 16.5, fontWeight: "800", flex: 1, textAlign: "center" },
  dots: { flexDirection: "row", gap: 6, alignSelf: "center", marginTop: 12 },
  dot: { width: 22, height: 4, borderRadius: 2, backgroundColor: C.navyLight },
  dotActive: { backgroundColor: C.blueLight },
  accentHairline: { height: 2, backgroundColor: C.blueLight, width: 56, borderRadius: 2, marginTop: 12, alignSelf: "center" },
  rtlText: { writingDirection: "rtl" },
  // For RTL body/paragraph text (headings, wrapped descriptions, labels):
  // without an explicit textAlign, wrapped Arabic text still lays out
  // left-aligned in this LTR-shelled app, so shorter wrapped lines drift to
  // the left instead of hugging the right edge like real RTL reading order.
  rtlTextRight: { writingDirection: "rtl", textAlign: "right" },

  allowanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(46,117,200,0.10)",
    borderWidth: 1,
    borderColor: "rgba(46,117,200,0.28)",
    marginBottom: 18,
  },
  allowanceText: { color: C.navyLight, fontSize: 12.5, fontWeight: "800", flex: 1 },
  entitlementError: { alignItems: "center", paddingVertical: 42, gap: 14 },
  entitlementErrorText: { color: C.mutedOnLight, fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 320 },
  quotaBlock: {
    alignItems: "center",
    paddingVertical: 34,
    paddingHorizontal: 22,
    backgroundColor: C.canvasAlt,
    borderWidth: 1,
    borderColor: "rgba(46,117,200,0.36)",
    borderRadius: 20,
  },
  quotaIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(46,117,200,0.13)",
    marginBottom: 14,
  },
  quotaTitle: { color: C.textOnLight, fontSize: 18, fontWeight: "800", textAlign: "center" },
  quotaCopy: { color: C.mutedOnLight, fontSize: 13.5, lineHeight: 20, textAlign: "center", marginTop: 9 },
  quotaTimerWrap: { alignItems: "center", marginTop: 14 },
  quotaTimerLabel: { color: C.mutedOnLight, fontSize: 12, fontWeight: "700" },
  quotaTimer: { color: C.navyLight, fontSize: 22, fontWeight: "900", letterSpacing: 1.2, marginTop: 3 },
  upgradeBtn: {
    marginTop: 20,
    minWidth: "100%",
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: C.blue,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  upgradeText: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "900" },
  checkBtn: { marginTop: 13, paddingVertical: 6, paddingHorizontal: 10 },
  checkText: { color: C.mutedOnLight, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },

  q: { color: C.textOnLight, fontSize: 18, fontWeight: "800", marginBottom: 14 },
  input: {
    backgroundColor: C.canvasAlt,
    borderWidth: 1,
    borderColor: C.borderOnLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.textOnLight,
  },
  subLbl: { color: C.mutedOnLight, fontSize: 12.5, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: C.borderOnLight,
    backgroundColor: C.canvasAlt,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: C.navy, borderColor: C.blueLight },
  chipText: { color: C.textOnLight, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF" },

  tripRow: { flexDirection: "row", gap: 12 },
  tripLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tripCol: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(46,117,200,0.35)",
    padding: 16,
    alignItems: "center",
    gap: 12,
  },
  tripLbl: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "700" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 16 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(46,117,200,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", minWidth: 28, textAlign: "center" },

  styleRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  styleCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(46,117,200,0.35)",
    alignItems: "center",
    paddingVertical: 14,
    gap: 6,
  },
  styleCardActive: { backgroundColor: C.blue, borderColor: C.blueLight },
  styleText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", textAlign: "center" },

  navRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 26 },
  backNav: { paddingVertical: 12, paddingHorizontal: 8 },
  backNavText: { color: C.mutedOnLight, fontSize: 14, fontWeight: "700" },
  nextBtn: {
    backgroundColor: C.blue,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  nextText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },

  loadingWrap: { alignItems: "center", paddingVertical: 70, gap: 16 },
  loadingText: { color: C.mutedOnLight, fontSize: 14, fontWeight: "600", textAlign: "center" },
  errorText: { color: C.textOnLight, fontSize: 14, fontWeight: "600" },
  retryBtn: { backgroundColor: C.navy, borderRadius: 10, paddingHorizontal: 22, paddingVertical: 10 },
  retryText: { color: "#FFFFFF", fontWeight: "800" },

  resTitle: { color: C.textOnLight, fontSize: 20, fontWeight: "800", lineHeight: 27 },
  resSummary: { color: C.mutedOnLight, fontSize: 13.5, lineHeight: 20, marginTop: 8 },
  priceCard: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(46,117,200,0.45)",
    padding: 16,
    marginTop: 16,
    alignItems: "center",
  },
  priceDivider: { width: 1, height: 36, backgroundColor: "rgba(46,117,200,0.35)", marginHorizontal: 14 },
  priceLbl: { color: C.cyanLight, fontSize: 11.5, fontWeight: "700" },
  priceVal: { color: C.blueLight, fontSize: 19, fontWeight: "800", marginTop: 3 },
  hotelCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: C.canvasAlt,
    borderWidth: 1,
    borderColor: C.borderOnLight,
    borderRadius: 14,
    padding: 13,
    marginTop: 12,
  },
  hotelLbl: { color: C.mutedOnLight, fontSize: 11, fontWeight: "700" },
  hotelVal: { color: C.textOnLight, fontSize: 13.5, fontWeight: "700", marginTop: 2 },
  hotelStars: { color: "#B8860B", fontSize: 13, fontWeight: "800" },

  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  previewCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 22,
    paddingTop: 30,
  },
  previewClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.canvasAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  previewHotelName: { color: C.textOnLight, fontSize: 16, fontWeight: "800", marginBottom: 4, paddingRight: 20 },
  previewClosestMatch: { color: C.mutedOnLight, fontSize: 12, fontStyle: "italic", marginBottom: 12 },
  previewLoading: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  previewMsg: { color: C.mutedOnLight, fontSize: 13.5, lineHeight: 20 },
  previewStars: { color: "#B8860B", fontSize: 13.5, fontWeight: "700", marginBottom: 6 },
  previewPrice: { color: C.navyLight, fontSize: 16, fontWeight: "800", marginBottom: 16 },
  previewViewBtn: {
    backgroundColor: C.blue,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  previewViewBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  previewAltList: { marginTop: 14, gap: 8 },
  previewAltTitle: { color: C.mutedOnLight, fontSize: 12, fontWeight: "700", marginBottom: 2, textTransform: "uppercase" },
  previewAltItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.canvasAlt,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  previewAltName: { color: C.textOnLight, fontSize: 13.5, fontWeight: "700" },
  previewAltStars: { color: "#B8860B", fontSize: 11.5, fontWeight: "700", marginTop: 2 },
  previewAltPrice: { color: C.navyLight, fontSize: 13.5, fontWeight: "800" },
  previewCloseBtn: { marginTop: 14, alignItems: "center", paddingVertical: 8 },
  previewCloseBtnText: { color: C.mutedOnLight, fontSize: 13, fontWeight: "700" },

  browserRoot: { flex: 1, backgroundColor: "#0A1628" },
  browserHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: C.navy,
  },
  browserTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", flex: 1, marginRight: 12 },
  browserErrorWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  browserErrorMsg: { color: "#C7D2E0", fontSize: 14, lineHeight: 20, textAlign: "center" },

  dayCard: { flexDirection: "row", gap: 12, marginTop: 14, alignItems: "flex-start" },
  dayBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.navy,
    borderWidth: 1,
    borderColor: C.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBadgeText: { color: C.blueLight, fontSize: 13, fontWeight: "800" },
  dayTitle: { color: C.textOnLight, fontSize: 14, fontWeight: "800" },
  dayPlan: { color: C.mutedOnLight, fontSize: 12.5, lineHeight: 18, marginTop: 3 },

  priceNote: { color: "#C62828", fontSize: 11.5, fontStyle: "italic", marginTop: 18, lineHeight: 16 },
  waBtn: {
    marginTop: 18,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: C.whatsappDark,
    borderRadius: 10,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  waText: { flex: 1, flexShrink: 1, color: C.navy, fontSize: 14, fontWeight: "700", textAlign: "center" },
  againBtn: { marginTop: 12, alignItems: "center", paddingVertical: 10 },
  againText: { color: C.mutedOnLight, fontSize: 13.5, fontWeight: "700", textDecorationLine: "underline" },
});
