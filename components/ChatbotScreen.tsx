import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { WebView } from "react-native-webview";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { BOOKING_RULES, CUSTOMER_BOOKING_GUIDANCE } from "@/lib/bookingRules";
const GOLD = "#D4AF37";
const BLACK = "#000000";
const NAVY_BG = "#0A1628";
const NAVY = "#001F5B";
const WHATSAPP_URL = "https://wa.me/96590087797";
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ??
  "https://tours-dar-tamaiz--engalialfoudari.replit.app/api";

const WHATSAPP_SIGNAL = "[WHATSAPP]";
const GOODBYE_SIGNAL = "[GOODBYE]";
const HOTEL_SIGNAL = "[HOTEL]";
const HOTEL_SIGNAL_RE = /\[HOTEL:([^\]]+)\]/;
// token format: City|checkin|checkout|stars
const OFFERS_SIGNAL = "[OFFERS]";
const FLIGHT_SIGNAL_RE = /\[FLIGHT:([^\]]+)\]/;
const ITINERARY_SIGNAL_RE = /\[ITINERARY:(\{[\s\S]*\})\]/;
const MULTI_PKG_SIGNAL_RE = /\[MULTI_PKG:(\{[\s\S]*\})\]/;
const HOTEL_NAME_SIGNAL_RE = /\[HOTEL_NAME:[^\]]+\]/g;
const ESCALATE_AFTER_MESSAGES = 8;
const STORAGE_KEY = "dtours_chat_v1";
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const FLIGHT_RATE_KEY = "dtours_flight_rate_v2";
const FLIGHT_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_FLIGHT_SEARCHES = 3;
const BOT_NAME = "D.T. Tours Ai";
const DEVICE_FP_KEY = "dtours_device_fp_v1";

const PLAN_INQUIRY_AR = [
  "نوع باقتي", "شنو باقتي", "شنو نوع باقتي", "شو اشتراكي", "نوع اشتراكي",
  "ما نوع اشتراكي", "ما هو اشتراكي", "وضع باقتي", "حالة باقتي",
  "صلاحية باقتي", "شوف اشتراكي", "ايش اشتراكي", "شنو نوع اشتراكي",
  "باقتي ايش", "اشتراكي ايش",
];
const PLAN_INQUIRY_EN = [
  "my plan", "my subscription", "subscription status",
  "check plan", "check my subscription", "what is my plan",
  "what plan do i have", "my tier", "current plan",
];
function isPlanInquiry(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    PLAN_INQUIRY_AR.some((k) => lower.includes(k)) ||
    PLAN_INQUIRY_EN.some((k) => lower.includes(k))
  );
}


type Language = "ar" | "en";
type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
  showWhatsApp?: boolean;
  showHotel?: boolean;
  showOffers?: boolean;
  hotelParams?: { city: string; checkin: string; checkout: string; stars?: number; breakfast?: boolean };
  hotelNameParams?: { hotelName: string; hotelNames: string[]; checkin: string; checkout: string; adults: number; rooms: number };
  flightToken?: string;
  isPackage?: boolean;
  itineraryData?: ItineraryData;
  multiPkgData?: MultiPkgData;
}

interface ItineraryDay {
  day: number;
  title: string;
  items: string[];
}

interface ItineraryData {
  dest: string;
  days: number;
  travelers: number;
  interests?: string;
  budget?: string;
  startDate?: string;
  schedule: ItineraryDay[];
}

interface MultiPkgLeg {
  from: string;
  fromLabel: string;
  to: string;
  toLabel: string;
  dep: string;
  ret: string;
  adults: number;
  rooms: number;
  stars: number;
}

interface MultiPkgData {
  legs: MultiPkgLeg[];
}

interface SavedSession {
  messages: Message[];
  language: Language;
  userName: string;
  savedAt: number;
}

interface SessionState {
  blocked: boolean;
  blockUntil: number | null;
  cyclesUsedToday: number;
  cycleMessages: number;
  isPremium: boolean;
  premiumExpiresAt: number | null;
  promoTier?: string;
  maxFlightSearchesPerDay: number;
  flightSearchesToday: number;
  flightSearchesRemaining: number;
  maxItinerariesPerDay?: number;
  itinerariesToday?: number;
  itinerariesRemaining?: number;
}

const ROBOT_IMAGE = require("../assets/images/tamaiz-robot.png");

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function TamaizAvatar({ size = 36 }: { size?: number }) {
  return (
    <Image
      source={ROBOT_IMAGE}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode="cover"
    />
  );
}

export function KuwaitiManIcon({ size = 36 }: { size?: number }) {
  return <TamaizAvatar size={size} />;
}

function buildGreeting(lang: Language, name: string): string {
  if (lang === "ar") {
    return `السلام عليكم ورحمة الله وبركاته، حياكم الله 👋\nمعاكم ${BOT_NAME} مُساعدكم الشخصي في دار التميز تورز.\n\nأقدر أساعدكم في:\n✈️ أسعار تذاكر الطيران\n🏨 البحث عن الفنادق\n📦 باقات متعددة الوجهات\n🗺️ خطط رحلة يوم بيوم\n🎯 آخر العروض والتخفيضات\n\nشلون أقدر اساعدكم اليوم يا ${name}؟`;
  }
  return `Assalamu Alaikum, welcome! 👋\nI'm ${BOT_NAME}, your personal travel assistant at D.T. Tours.\n\nI can help you with:\n✈️ Live flight prices\n🏨 Hotel search & recommendations\n📦 Multi-destination travel packages\n🗺️ Day-by-day trip itineraries\n🎯 Latest deals & offers\n\nHow can I help you today, ${name}?`;
}

function buildAdminBuildInfo(): string {
  try {
    const id = Updates.updateId ?? null;
    const created = Updates.createdAt ?? null;
    if (!id && !created) return `🧩 نسخة التطوير (لا يوجد OTA)`;
    const shortId = id ? id.slice(0, 8) : "—";
    const createdStr = created
      ? new Date(created).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      : "—";
    return `🧩 نسخة التحديث: ${shortId} (${createdStr})`;
  } catch {
    return `🧩 تعذر قراءة رقم النسخة`;
  }
}

function detectLangFromText(text: string): Language {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latinChars  = (text.match(/[a-zA-Z]/g) ?? []).length;
  const total = arabicChars + latinChars;
  if (total === 0) return "ar";
  return arabicChars / total > 0.3 ? "ar" : "en";
}

function WhatsAppIcon({ size = 18, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 448 512">
      <Path
        d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.9 34.9 55.9 81.2 55.8 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"
        fill={color}
      />
    </Svg>
  );
}

function TypingDots() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, {
            toValue: -6,
            duration: 300,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
            easing: Easing.in(Easing.quad),
          }),
          Animated.delay(450 - i * 150),
        ])
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []);

  return (
    <View style={styles.typingBubble}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.typingDot, { transform: [{ translateY: dot }] }]}
        />
      ))}
    </View>
  );
}

interface HotelOptionData {
  name: string;
  stars: number;
  location: string;
  price: string;
  currency: string;
  nights?: number;
  bookUrl: string;
  isRefundable?: boolean;
}

// ── Itinerary Widget ──────────────────────────────────────────────────────────
function ItineraryWidget({ data, isAr }: { data: ItineraryData; isAr: boolean }) {
  const [expanded, setExpanded] = React.useState<number | null>(0);

  return (
    <View style={itinStyles.wrap}>
      <View style={itinStyles.header}>
        <Text style={itinStyles.headerIcon}>🗺️</Text>
        <View style={{ flex: 1 }}>
          <Text style={itinStyles.headerTitle}>
            {isAr ? `خطة رحلة ${data.dest}` : `${data.dest} Trip Plan`}
          </Text>
          <Text style={itinStyles.headerSub}>
            {data.days} {isAr ? "أيام" : "days"}
            {data.travelers ? ` · ${data.travelers} ${isAr ? "مسافرين" : "travelers"}` : ""}
            {data.budget ? ` · ${data.budget}` : ""}
          </Text>
        </View>
      </View>

      {data.schedule.map((dayObj) => {
        const isOpen = expanded === dayObj.day;
        return (
          <View key={dayObj.day} style={itinStyles.dayCard}>
            <Pressable
              style={({ pressed }) => [itinStyles.dayHeader, pressed && { opacity: 0.75 }]}
              onPress={() => setExpanded(isOpen ? null : dayObj.day)}
            >
              <View style={itinStyles.dayNumBadge}>
                <Text style={itinStyles.dayNumText}>{dayObj.day}</Text>
              </View>
              <Text style={[itinStyles.dayTitle, isAr && { textAlign: "right", writingDirection: "rtl" }]} numberOfLines={1}>
                {dayObj.title}
              </Text>
              <Text style={itinStyles.dayChevron}>{isOpen ? "▲" : "▼"}</Text>
            </Pressable>
            {isOpen && (
              <View style={itinStyles.dayBody}>
                {dayObj.items.map((item, idx) => (
                  <View key={idx} style={itinStyles.itemRow}>
                    <View style={itinStyles.itemDot} />
                    <Text style={[itinStyles.itemText, isAr && { textAlign: "right", writingDirection: "rtl" }]}>
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      <Pressable
        style={({ pressed }) => [itinStyles.waBtn, pressed && { opacity: 0.8 }]}
        onPress={() => {
          const city = data.dest;
          const days = data.days;
          const msg = isAr
            ? `السلام عليكم، أرغب في حجز رحلة إلى ${city} لمدة ${days} أيام. هل بإمكانكم مساعدتي؟`
            : `Hello, I'd like to book a ${days}-day trip to ${city}. Can you help?`;
          Linking.openURL(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`).catch(() => {});
        }}
      >
        <Text style={itinStyles.waBtnText}>
          {isAr ? "💬 احجز هذه الرحلة عبر واتساب" : "💬 Book This Trip via WhatsApp"}
        </Text>
      </Pressable>
    </View>
  );
}

const itinStyles = StyleSheet.create({
  wrap: {
    backgroundColor: "rgba(0,20,60,0.85)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)",
    padding: 12,
    gap: 8,
    marginTop: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(212,175,55,0.2)",
    marginBottom: 4,
  },
  headerIcon: {
    fontSize: 22,
    lineHeight: 26,
  },
  headerTitle: {
    color: GOLD,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  headerSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  dayCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(212,175,55,0.15)",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  dayNumBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(212,175,55,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumText: {
    color: GOLD,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  dayTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.1,
  },
  dayChevron: {
    color: "rgba(212,175,55,0.6)",
    fontSize: 9,
  },
  dayBody: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(212,175,55,0.15)",
    paddingTop: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  itemDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: GOLD,
    marginTop: 5,
  },
  itemText: {
    flex: 1,
    color: "rgba(255,255,255,0.80)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  waBtn: {
    backgroundColor: "#128C7E",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  waBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
});

// ── Itinerary Quota Block Banner ───────────────────────────────────────────────
function ItineraryBlockBanner({
  secondsLeft,
  max,
  isAr,
  onSubscribe,
}: {
  secondsLeft: number;
  max: number;
  isAr: boolean;
  onSubscribe: () => void;
}) {
  const [secs, setSecs] = React.useState(secondsLeft);
  useEffect(() => {
    if (secs <= 0) return;
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={itinBlockStyles.wrap}>
      <Text style={itinBlockStyles.icon}>⏳</Text>
      <Text style={itinBlockStyles.title}>
        {isAr
          ? `وصلت للحد اليومي (${max} خطة رحلة)`
          : `Daily itinerary limit reached (${max} plans)`}
      </Text>
      <Text style={itinBlockStyles.sub}>
        {isAr ? "يتجدد الرصيد منتصف الليل" : "Resets at midnight UTC"}
      </Text>
      {secs > 0 && (
        <Text style={itinBlockStyles.timer}>{formatCountdown(secs)}</Text>
      )}
      <Pressable
        style={({ pressed }) => [itinBlockStyles.btn, pressed && { opacity: 0.8 }]}
        onPress={onSubscribe}
      >
        <Text style={itinBlockStyles.btnText}>
          {isAr ? "⭐ ترقية للبريميوم" : "⭐ Upgrade to Premium"}
        </Text>
      </Pressable>
    </View>
  );
}

const itinBlockStyles = StyleSheet.create({
  wrap: {
    backgroundColor: "rgba(212,175,55,0.08)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)",
    padding: 16,
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  icon: { fontSize: 28 },
  title: {
    color: GOLD,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  sub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  timer: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
  btn: {
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 9,
    marginTop: 4,
  },
  btnText: {
    color: "#000",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function addDays(dateStr: string, n: number): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmtShortDate(iso: string): string {
  if (!iso) return "";
  const p = iso.split("-");
  if (p.length !== 3) return iso;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(p[2]!)} ${months[parseInt(p[1]!) - 1]}`;
}

interface LegFetchResult {
  flightTotal: number | null;
  hotelTotal: number | null;
  flightInfo: { airline: string; dep: string; arr: string; dur: string; stops: number } | null;
  hotelInfo: { name: string; stars?: number; bookUrl?: string; pricePerNight?: number } | null;
  flightBlocked: boolean;
}

// ── Multi-Destination Package Widget v2 ───────────────────────────────────────
function MultiPkgWidget({
  data,
  isAr,
  apiBase,
  openInApp,
  deviceId,
  onAnotherOption,
}: {
  data: MultiPkgData;
  isAr: boolean;
  apiBase: string;
  openInApp: (url: string) => void;
  deviceId: string;
  onAnotherOption?: () => void;
}) {
  // ── Day distribution state ──────────────────────────────────────────────
  const [daysPerLeg, setDaysPerLeg] = useState<number[]>(() =>
    data.legs.map((l, i) => {
      const isLast = i === data.legs.length - 1;
      const nights = calcNightsNative(l.dep, l.ret);
      // Last leg with no return date (travel day only) defaults to 0
      return Math.max(isLast ? 0 : 1, nights);
    })
  );
  const [phase, setPhase] = useState<"distribute" | "results">("distribute");
  const [adjustedLegs, setAdjustedLegs] = useState<MultiPkgLeg[]>(data.legs);

  // Compute preview dates reactively from daysPerLeg
  const previewLegs: MultiPkgLeg[] = (() => {
    let cur = data.legs[0]?.dep ?? "";
    return data.legs.map((leg, i) => {
      const dep = cur;
      const ret = addDays(dep, daysPerLeg[i]!);
      cur = ret;
      return { ...leg, dep, ret };
    });
  })();

  const totalDays = daysPerLeg.reduce((a, b) => a + b, 0);
  const adults = String(data.legs[0]?.adults ?? 2);

  // ── Results state ───────────────────────────────────────────────────────
  const emptyResult = (): LegFetchResult => ({
    flightTotal: null, hotelTotal: null, flightInfo: null, hotelInfo: null, flightBlocked: false,
  });
  const [legResults, setLegResults] = useState<LegFetchResult[]>(() =>
    data.legs.map(emptyResult)
  );
  const [expandedLeg, setExpandedLeg] = useState<number | null>(null);
  const priceCur = "KWD";

  // ── Booking modal state ─────────────────────────────────────────────────
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showTnC, setShowTnC] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [passportFirst, setPassportFirst] = useState("");
  const [passportLast, setPassportLast] = useState("");
  const [passportNo, setPassportNo] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const checkoutStarted = useRef(false);

  // ── Fetch one leg (ONE-WAY flight, no return date) ──────────────────────
  const fetchOneLeg = useCallback((leg: MultiPkgLeg, idx: number) => {
    const nights = calcNightsNative(leg.dep, leg.ret);
    const rooms = Math.max(1, Math.ceil((leg.adults || 2) / 2));

    const flParams = new URLSearchParams({
      origin: leg.from,
      destination: leg.to,
      departure: leg.dep,
      adults: String(leg.adults),
    });

    fetch(`${apiBase}/flights?${flParams}`, { headers: { "x-device-id": deviceId } })
      .then(async (r) => {
        const d: any = await r.json();
        if (r.status === 429 || d?.quota_exceeded) {
          setLegResults((prev) => { const n = [...prev]; n[idx] = { ...n[idx]!, flightTotal: 0, flightBlocked: true }; return n; });
          return;
        }
        const flights: any[] = d.flights ?? [];
        if (flights.length > 0) {
          const best = [...flights].sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0]!;
          setLegResults((prev) => {
            const n = [...prev];
            n[idx] = { ...n[idx]!, flightTotal: parseFloat(best.price) || 0, flightInfo: { airline: best.airline ?? best.airlineCode ?? "", dep: best.departure ?? "", arr: best.arrival ?? "", dur: best.duration ?? "", stops: best.stops ?? 0 } };
            return n;
          });
        } else {
          setLegResults((prev) => { const n = [...prev]; n[idx] = { ...n[idx]!, flightTotal: 0 }; return n; });
        }
      })
      .catch(() => setLegResults((prev) => { const n = [...prev]; n[idx] = { ...n[idx]!, flightTotal: 0 }; return n; }));

    // When the leg has 0 nights it is a travel-day-only leg — no hotel stay needed.
    if (nights === 0) {
      setLegResults((prev) => { const n = [...prev]; n[idx] = { ...n[idx]!, hotelTotal: 0, hotelInfo: null }; return n; });
      return;
    }

    fetch(`${apiBase}/hotel-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city: leg.toLabel, checkin: leg.dep, checkout: leg.ret, stars: leg.stars ?? 0, adults: leg.adults, rooms }),
    })
      .then((r) => r.json())
      .then((d: any) => {
        if (d.ok && d.hotels?.length > 0) {
          const best = [...d.hotels].sort((a: any, b: any) => parseFloat(a.price) - parseFloat(b.price))[0]!;
          const pRN = parseFloat(best.price) || 0;
          setLegResults((prev) => {
            const n = [...prev];
            n[idx] = { ...n[idx]!, hotelTotal: pRN * rooms * nights, hotelInfo: { name: best.name ?? leg.toLabel, stars: best.stars, bookUrl: best.bookUrl, pricePerNight: pRN * rooms } };
            return n;
          });
        } else {
          setLegResults((prev) => { const n = [...prev]; n[idx] = { ...n[idx]!, hotelTotal: 0 }; return n; });
        }
      })
      .catch(() => setLegResults((prev) => { const n = [...prev]; n[idx] = { ...n[idx]!, hotelTotal: 0 }; return n; }));
  }, [apiBase, deviceId]);

  const handleConfirmDistribution = () => {
    const legs = previewLegs;
    setAdjustedLegs(legs);
    setLegResults(legs.map(emptyResult));
    setPhase("results");
    legs.forEach((leg, idx) => fetchOneLeg(leg, idx));
  };

  // ── Aggregated pricing ──────────────────────────────────────────────────
  const allLoaded = legResults.every((r) => r.flightTotal !== null && r.hotelTotal !== null);
  const totalFlight = legResults.reduce((s, r) => s + (r.flightTotal ?? 0), 0);
  const totalHotel = legResults.reduce((s, r) => s + (r.hotelTotal ?? 0), 0);
  const grandTotal = totalFlight + totalHotel;
  const deposit = grandTotal > 0 ? (grandTotal * BOOKING_RULES.packageDeposit.rate).toFixed(3) : null;
  const hasPrice = allLoaded && grandTotal > 0;

  // ── Search elapsed timer ─────────────────────────────────────────────────
  const [searchElapsed, setSearchElapsed] = useState(0);
  useEffect(() => {
    if (phase !== "results" || allLoaded) { setSearchElapsed(0); return; }
    const t = setInterval(() => setSearchElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase, allLoaded]);

  const routeBreadcrumb = [data.legs[0]?.fromLabel, ...data.legs.map((l) => l.toLabel)].join(" → ");

  // ── Booking handlers ────────────────────────────────────────────────────
  const fireCheckoutStart = () => {
    if (checkoutStarted.current) return;
    checkoutStarted.current = true;
    fetch(`${apiBase}/checkout/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId, destination: routeBreadcrumb }) }).catch(() => {});
  };

  // Rooms derived from adults (same formula used per-leg in fetchOneLeg)
  const multiPkgRooms = Math.max(1, Math.ceil((parseInt(adults) || 2) / 2));

  const buildWAMsg = () => {
    const legLines = adjustedLegs.map((l, i) =>
      isAr
        ? `📍 وجهة ${i + 1}: ${l.fromLabel} ← ${l.toLabel} · ${l.dep} - ${l.ret} (${daysPerLeg[i]} ${daysPerLeg[i] === 1 ? "يوم" : "أيام"}) · ${l.stars}⭐`
        : `📍 Leg ${i + 1}: ${l.fromLabel} → ${l.toLabel} · ${l.dep}–${l.ret} (${daysPerLeg[i]} nights) · ${l.stars}★`
    ).join("\n");
    return isAr
      ? `السلام عليكم، أريد حجز باقة متعددة الوجهات:\n\n${legLines}\n\n👥 المسافرون: ${adults}${multiPkgRooms > 1 ? ` · ${multiPkgRooms} غرف` : ""}${hasPrice ? `\n💰 الإجمالي: ${priceCur} ${grandTotal.toFixed(3)}` : ""}`
      : `Hello, I'd like to book a multi-destination package:\n\n${legLines}\n\n👥 Travelers: ${adults}${multiPkgRooms > 1 ? ` · ${multiPkgRooms} rooms` : ""}${hasPrice ? `\n💰 Total: ${priceCur} ${grandTotal.toFixed(3)}` : ""}`;
  };

  const handleBooking = async () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      setSubmitError(isAr ? "الاسم ورقم الهاتف مطلوبان" : "Name and phone are required");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const requestId = "DAT-MPKG-" + Date.now().toString(36).toUpperCase();
      const total = grandTotal > 0 ? grandTotal.toFixed(3) : "1.000";
      const firstLeg = adjustedLegs[0]!;
      const lastLeg = adjustedLegs[adjustedLegs.length - 1]!;
      const r = await fetch(`${apiBase}/upayment/create-charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalKWD: total, requestId,
          contactName: contactName.trim(), contactPhone: contactPhone.trim(),
          passportFirst: passportFirst.trim(), passportLast: passportLast.trim(), passportNo: passportNo.trim(),
          flightFrom: firstLeg.fromLabel, flightTo: lastLeg.toLabel,
          dep: firstLeg.dep, ret: lastLeg.ret,
          airline: "", flightDepTime: "", flightArrTime: "", flightDur: "", retDepTime: "", retArrTime: "",
          hotelCity: adjustedLegs.map((l) => l.toLabel).join(", "),
          hotelName: adjustedLegs.map((l) => l.toLabel).join(" + "),
          checkin: firstLeg.dep, checkout: lastLeg.ret,
          hotelStars: 0, breakfast: "no",
          adults, rooms: String(multiPkgRooms),
          notes: `Multi-destination: ${routeBreadcrumb}\n${notes.trim()}`,
          cur: priceCur,
        }),
      });
      const rdata = await r.json() as { ok: boolean; url?: string; error?: string };
      if (rdata.ok && rdata.url) { setShowBookingModal(false); openInApp(rdata.url); }
      else { setSubmitError(rdata.error || (isAr ? "فشل الدفع. حاول مرة ثانية." : "Payment failed. Try again.")); }
    } catch {
      setSubmitError(isAr ? "تعذر الاتصال. تحقق من الإنترنت." : "Connection error. Check internet.");
    } finally { setSubmitting(false); }
  };

  // ────────────────────────────────────────────────────────────────────────
  // RENDER — Distribution Phase
  // ────────────────────────────────────────────────────────────────────────
  if (phase === "distribute") {
    return (
      <View style={mpkgV2.wrap}>
        <View style={mpkgV2.distHeader}>
          <Text style={mpkgV2.distHeaderTitle}>
            {isAr ? "🗓 وزّع أيام رحلتك" : "🗓 Distribute Your Trip Days"}
          </Text>
          <Text style={mpkgV2.distHeaderSub}>
            {isAr
              ? `الإجمالي: ${totalDays} ${totalDays === 1 ? "يوم" : "أيام"} · ${adults} مسافرين · ${data.legs.length} وجهات`
              : `${totalDays} ${totalDays === 1 ? "day" : "days"} total · ${adults} travelers · ${data.legs.length} destinations`}
          </Text>
        </View>

        {data.legs.map((leg, i) => (
          <View key={i} style={mpkgV2.distRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={mpkgV2.distLegRoute}>{leg.fromLabel} → {leg.toLabel}</Text>
              {daysPerLeg[i] === 0 ? (
                <Text style={[mpkgV2.distLegDates, { color: GOLD }]}>
                  {fmtShortDate(previewLegs[i]!.dep)} · {isAr ? "يوم السفر" : "Travel day"}
                </Text>
              ) : (
                <Text style={mpkgV2.distLegDates}>
                  {fmtShortDate(previewLegs[i]!.dep)} – {fmtShortDate(previewLegs[i]!.ret)}
                </Text>
              )}
            </View>
            <View style={mpkgV2.counterWrap}>
              <Pressable
                style={mpkgV2.counterBtn}
                hitSlop={8}
                onPress={() => setDaysPerLeg((prev) => { const n = [...prev]; const isLast = i === data.legs.length - 1; n[i] = Math.max(isLast ? 0 : 1, n[i]! - 1); return n; })}
              >
                <Text style={mpkgV2.counterBtnTxt}>−</Text>
              </Pressable>
              <Text style={mpkgV2.counterVal}>{daysPerLeg[i]}</Text>
              <Pressable
                style={mpkgV2.counterBtn}
                hitSlop={8}
                onPress={() => setDaysPerLeg((prev) => { const n = [...prev]; n[i] = n[i]! + 1; return n; })}
              >
                <Text style={mpkgV2.counterBtnTxt}>+</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <View style={mpkgV2.distTotalRow}>
          <Text style={mpkgV2.distTotalLabel}>{isAr ? "مجموع الأيام" : "Total days"}</Text>
          <Text style={mpkgV2.distTotalValue}>{totalDays}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [mpkgV2.confirmBtn, pressed && { opacity: 0.85 }]}
          onPress={handleConfirmDistribution}
        >
          <Text style={mpkgV2.confirmBtnTxt}>
            {isAr ? "✓ تأكيد والبحث عن أفضل الأسعار" : "✓ Confirm & Search Best Prices"}
          </Text>
        </Pressable>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // RENDER — Master Card (Results Phase)
  // ────────────────────────────────────────────────────────────────────────
  return (
    <View style={mpkgV2.wrap}>
      {/* Master header — route breadcrumb */}
      <View style={mpkgV2.masterHeader}>
        <Text style={mpkgV2.masterRoute} numberOfLines={2}>{routeBreadcrumb}</Text>
        <View style={mpkgV2.masterMeta}>
          <Text style={mpkgV2.masterMetaTxt}>✈️ {totalDays} {isAr ? "أيام" : "days"}</Text>
          <Text style={mpkgV2.masterMetaDot}>·</Text>
          <Text style={mpkgV2.masterMetaTxt}>👥 {adults} {isAr ? "مسافرين" : "travelers"}</Text>
          <Text style={mpkgV2.masterMetaDot}>·</Text>
          <Text style={mpkgV2.masterMetaTxt}>{adjustedLegs.length} {isAr ? "وجهات" : "destinations"}</Text>
        </View>
      </View>

      {/* Leg accordions */}
      {adjustedLegs.map((leg, idx) => {
        const result = legResults[idx]!;
        const legNights = calcNightsNative(leg.dep, leg.ret);
        const isExpanded = expandedLeg === idx;
        const legLoaded = result.flightTotal !== null && result.hotelTotal !== null;
        const legSubtotal = (result.flightTotal ?? 0) + (result.hotelTotal ?? 0);

        return (
          <View key={idx} style={mpkgV2.legAccordion}>
            <Pressable
              style={mpkgV2.legAccHeader}
              onPress={() => setExpandedLeg(isExpanded ? null : idx)}
            >
              <View style={mpkgV2.legBadge}>
                <Text style={mpkgV2.legBadgeTxt}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={mpkgV2.legAccRoute}>{leg.fromLabel} → {leg.toLabel}</Text>
                {legNights === 0 ? (
                  <Text style={[mpkgV2.legAccDates, { color: GOLD }]}>
                    {fmtShortDate(leg.dep)} · {isAr ? "يوم السفر" : "Travel day"}
                  </Text>
                ) : (
                  <Text style={mpkgV2.legAccDates}>
                    {fmtShortDate(leg.dep)} – {fmtShortDate(leg.ret)} · {legNights} {isAr ? "ليالٍ" : "nights"}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: "flex-end", gap: 3 }}>
                {!legLoaded ? (
                  <View style={{ alignItems: "center", gap: 1 }}>
                    <ActivityIndicator size="small" color={GOLD} />
                    <Text style={{ color: GOLD, fontSize: 9, fontFamily: "Inter_500Medium" }}>{searchElapsed}s</Text>
                  </View>
                ) : legSubtotal > 0
                  ? <Text style={mpkgV2.legAccPrice}>{priceCur} {legSubtotal.toFixed(3)}</Text>
                  : <Text style={mpkgV2.legAccPriceDash}>—</Text>
                }
                <Text style={mpkgV2.legAccChevron}>{isExpanded ? "▲" : "▼"}</Text>
              </View>
            </Pressable>

            {isExpanded && (
              <View style={mpkgV2.legAccBody}>
                {/* ── Flight ── */}
                <Text style={mpkgV2.legAccSectionTitle}>✈️ {isAr ? "الطيران" : "Flight"}</Text>
                {result.flightTotal === null ? (
                  <Text style={mpkgV2.legAccLoading}>{isAr ? "جاري البحث..." : "Searching..."}</Text>
                ) : result.flightBlocked ? (
                  <Text style={mpkgV2.legAccEmpty}>{isAr ? "تجاوزت حد البحث اليومي" : "Daily search limit reached"}</Text>
                ) : result.flightInfo ? (
                  <View style={{ gap: 4 }}>
                    {([
                      [isAr ? "شركة الطيران" : "Airline", result.flightInfo.airline],
                      [isAr ? "المغادرة" : "Departs", `${result.flightInfo.dep} → ${result.flightInfo.arr}`],
                      ...(result.flightInfo.dur ? [[isAr ? "المدة" : "Duration", result.flightInfo.dur]] : []),
                      [isAr ? "النوع" : "Type", result.flightInfo.stops === 0 ? (isAr ? "مباشرة ✅" : "Direct ✅") : `${result.flightInfo.stops} ${isAr ? "توقف" : "stop(s)"}`],
                      [isAr ? "السعر" : "Price", `${priceCur} ${(result.flightTotal ?? 0).toFixed(3)}`],
                    ] as [string, string][]).map(([lbl, val]) => (
                      <View key={lbl} style={mpkgV2.detailRow}>
                        <Text style={mpkgV2.detailLabel}>{lbl}</Text>
                        <Text style={[mpkgV2.detailVal, lbl.includes("السعر") || lbl === "Price" ? { color: GOLD } : val.includes("✅") ? { color: "#4CAF50" } : val.includes("توقف") || val.includes("stop") ? { color: "#FFB300" } : {}]}>{val}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={{ gap: 6 }}>
                    <Text style={mpkgV2.legAccEmpty}>{isAr ? "لا توجد رحلات بهذا التاريخ" : "No flights found for this date"}</Text>
                    <Pressable onPress={() => {
                      const msg = isAr
                        ? `السلام عليكم، أريد الاستعلام عن رحلة من ${leg.fromLabel} إلى ${leg.toLabel} بتاريخ ${leg.dep} لـ ${adults} مسافرين`
                        : `Hello, I'd like to enquire about ${leg.fromLabel} → ${leg.toLabel} on ${leg.dep} for ${adults} travelers`;
                      Linking.openURL(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`).catch(() => {});
                    }}>
                      <Text style={mpkgV2.waInlineLink}>💬 {isAr ? "استفسر عبر واتساب" : "Enquire on WhatsApp"}</Text>
                    </Pressable>
                  </View>
                )}

                <View style={mpkgV2.legAccDivider} />

                {/* ── Hotel ── */}
                {legNights === 0 ? (
                  <Text style={mpkgV2.legAccEmpty}>🏨 {isAr ? "لا إقامة — يوم سفر فقط" : "No hotel — travel day only"}</Text>
                ) : (
                <>
                <Text style={mpkgV2.legAccSectionTitle}>🏨 {isAr ? "الفندق" : "Hotel"} · {leg.toLabel}</Text>
                {result.hotelTotal === null ? (
                  <Text style={mpkgV2.legAccLoading}>{isAr ? "جاري البحث..." : "Searching..."}</Text>
                ) : result.hotelInfo ? (
                  <View style={{ gap: 4 }}>
                    {([
                      [isAr ? "الفندق" : "Hotel", result.hotelInfo.name],
                      ...(result.hotelInfo.stars ? [[isAr ? "التصنيف" : "Rating", "★".repeat(result.hotelInfo.stars)]] : []),
                      [isAr ? "الإقامة" : "Stay", `${legNights} ${isAr ? "ليالٍ" : "nights"} · ${fmtShortDate(leg.dep)} – ${fmtShortDate(leg.ret)}`],
                      ...(result.hotelTotal ? [[isAr ? "تكلفة الإقامة" : "Stay cost", `${priceCur} ${(result.hotelTotal).toFixed(3)}`]] : []),
                    ] as [string, string][]).map(([lbl, val]) => (
                      <View key={lbl} style={mpkgV2.detailRow}>
                        <Text style={mpkgV2.detailLabel}>{lbl}</Text>
                        <Text style={[mpkgV2.detailVal, lbl.includes("تكلفة") || lbl === "Stay cost" ? { color: GOLD } : {}]}>{val}</Text>
                      </View>
                    ))}
                    <Text style={mpkgV2.legAccNote}>⚠️ {isAr ? "نوع الغرفة يُؤكَّد عند إتمام الحجز" : "Room type confirmed upon final booking"}</Text>
                  </View>
                ) : (
                  <Text style={mpkgV2.legAccEmpty}>{isAr ? "لا توجد فنادق متاحة" : "No hotels available"}</Text>
                )}
                </>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* ── Unified Pricing Summary ── */}
      <View style={mpkgV2.priceBox}>
        {!allLoaded ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 6 }}>
            <ActivityIndicator size="small" color={GOLD} />
            <Text style={mpkgV2.priceLoading}>
              {isAr ? "جاري احتساب الإجمالي..." : "Calculating total..."}{" "}
              <Text style={{ color: GOLD, fontFamily: "Inter_700Bold" }}>({searchElapsed}{isAr ? "ث" : "s"})</Text>
            </Text>
          </View>
        ) : (
          <>
            {totalFlight > 0 && (
              <View style={mpkgV2.priceRow}>
                <Text style={mpkgV2.priceLbl}>✈️ {isAr ? `الطيران · ${adults} مسافرين` : `Flights · ${adults} travelers`}</Text>
                <Text style={mpkgV2.priceAmt}>{priceCur} {totalFlight.toFixed(3)}</Text>
              </View>
            )}
            {totalHotel > 0 && (
              <View style={mpkgV2.priceRow}>
                <Text style={mpkgV2.priceLbl}>🏨 {isAr ? `الفنادق · ${totalDays} ليالٍ` : `Hotels · ${totalDays} nights`}</Text>
                <Text style={mpkgV2.priceAmt}>{priceCur} {totalHotel.toFixed(3)}</Text>
              </View>
            )}
            {hasPrice ? (
              <>
                <View style={mpkgV2.priceDivider} />
                <View style={mpkgV2.priceRow}>
                  <Text style={mpkgV2.totalLbl}>{isAr ? "الإجمالي الكامل" : "Grand Total"}</Text>
                  <Text style={mpkgV2.totalAmt}>{priceCur} {grandTotal.toFixed(3)}</Text>
                </View>
                <View style={mpkgV2.depositRow}>
                  <Text style={mpkgV2.depositLbl}>💳 {isAr ? `العربون المطلوب (${BOOKING_RULES.packageDeposit.percent}%)` : `Deposit Due (${BOOKING_RULES.packageDeposit.percent}%)`}</Text>
                  <Text style={mpkgV2.depositAmt}>{priceCur} {deposit}</Text>
                </View>
              </>
            ) : (
              <Text style={[mpkgV2.priceLoading, { textAlign: "center" }]}>
                {isAr ? "تواصل معنا للحصول على تسعيرة مخصصة" : "Contact us for custom pricing"}
              </Text>
            )}
          </>
        )}
      </View>

      <Text style={mpkgV2.priceNote}>
        ⚠️ {isAr ? "قد تتغير الأسعار بناءً على وقت التأكيد" : "Prices may vary depending on confirmation time"}
      </Text>

      {/* ── CTAs ── */}
      <View style={mpkgV2.ctaRow}>
        <Pressable
          style={({ pressed }) => [mpkgV2.bookBtn, pressed && { opacity: 0.85 }]}
          onPress={() => { setShowBookingModal(true); fireCheckoutStart(); }}
        >
          <Text style={mpkgV2.bookBtnTxt}>💳 {isAr ? `احجز بعربون ${BOOKING_RULES.packageDeposit.percent}%` : `Book — ${BOOKING_RULES.packageDeposit.percent}% Deposit`}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [mpkgV2.waBtn, pressed && { opacity: 0.8 }]}
          onPress={() => Linking.openURL(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(buildWAMsg())}`).catch(() => {})}
        >
          <Text style={mpkgV2.waBtnTxt}>💬</Text>
        </Pressable>
      </View>

      {onAnotherOption && (
        <Pressable
          style={({ pressed }) => [mpkgV2.anotherBtn, pressed && { opacity: 0.75 }]}
          onPress={onAnotherOption}
        >
          <Text style={mpkgV2.anotherBtnTxt}>🔄 {isAr ? "خيار آخر (ميزانية أعلى)" : "Another Option (Higher Budget)"}</Text>
        </Pressable>
      )}

      {/* ── Booking Modal ── */}
      <Modal visible={showBookingModal} transparent animationType="slide" onRequestClose={() => setShowBookingModal(false)}>
        <View style={pkgStyles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
            <ScrollView style={pkgStyles.modalSheet} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
              <View style={pkgStyles.modalHeader}>
                <Text style={pkgStyles.modalTitle}>{isAr ? "بيانات الحجز" : "Booking Details"}</Text>
                <Pressable onPress={() => setShowBookingModal(false)} hitSlop={12}><Text style={{ color: "#888", fontSize: 22 }}>✕</Text></Pressable>
              </View>
              <View style={{ backgroundColor: "rgba(212,175,55,0.08)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                <Text style={{ color: GOLD, fontSize: 12, fontFamily: "Inter_700Bold", marginBottom: 3 }}>{routeBreadcrumb}</Text>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "Inter_400Regular" }}>
                  {totalDays} {isAr ? "أيام" : "days"} · {adults} {isAr ? "مسافرين" : "travelers"}{multiPkgRooms > 1 ? ` · ${multiPkgRooms} ${isAr ? "غرف" : "rooms"}` : ""}
                </Text>
              </View>
              {([
                [isAr ? "الاسم الكامل *" : "Full Name *", contactName, setContactName, isAr ? "مثال: أحمد محمد" : "e.g. Ahmed Al Kuwaiti", "words"],
                [isAr ? "رقم الهاتف *" : "Phone Number *", contactPhone, setContactPhone, "+965 XXXX XXXX", "phone-pad"],
              ] as any[]).map(([lbl, val, setter, ph, kb]) => (
                <View key={lbl}>
                  <Text style={pkgStyles.fieldLabel}>{lbl}</Text>
                  <TextInput style={pkgStyles.field} value={val} onChangeText={setter} placeholder={ph} placeholderTextColor="#555" keyboardType={kb} autoCapitalize={kb === "words" ? "words" : "none"} />
                </View>
              ))}
              <Text style={pkgStyles.sectionTitle}>{isAr ? "بيانات جواز السفر (اختياري)" : "Passport Info (optional)"}</Text>
              {([
                [isAr ? "الاسم الأول" : "First Name", passportFirst, setPassportFirst, "FIRST NAME"],
                [isAr ? "الاسم الأخير" : "Last Name", passportLast, setPassportLast, "LAST NAME"],
                [isAr ? "رقم جواز السفر" : "Passport No", passportNo, setPassportNo, "A12345678"],
              ] as any[]).map(([lbl, val, setter, ph]) => (
                <View key={lbl}>
                  <Text style={pkgStyles.fieldLabel}>{lbl}</Text>
                  <TextInput style={[pkgStyles.field, { textAlign: "left" }]} value={val} onChangeText={setter} placeholder={ph} placeholderTextColor="#555" autoCapitalize="characters" />
                </View>
              ))}
              <Text style={pkgStyles.fieldLabel}>{isAr ? "ملاحظات إضافية" : "Additional Notes"}</Text>
              <TextInput style={[pkgStyles.field, { minHeight: 60, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} placeholder={isAr ? "أي طلبات خاصة..." : "Any special requests..."} placeholderTextColor="#555" multiline />
              {hasPrice && (
                <View style={[pkgStyles.priceBox, { marginTop: 12 }]}>
                  <View style={pkgStyles.priceRow}>
                    <Text style={pkgStyles.totalLbl}>{isAr ? "الإجمالي" : "Total"}</Text>
                    <Text style={pkgStyles.totalAmt}>{priceCur} {grandTotal.toFixed(3)}</Text>
                  </View>
                  <View style={[pkgStyles.priceRow, { backgroundColor: "rgba(212,175,55,0.12)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, marginTop: 4 }]}>
                    <Text style={pkgStyles.depositLbl}>{isAr ? `💳 العربون المطلوب (${BOOKING_RULES.packageDeposit.percent}%)` : `💳 Deposit Due (${BOOKING_RULES.packageDeposit.percent}%)`}</Text>
                    <Text style={pkgStyles.depositAmt}>{priceCur} {deposit}</Text>
                  </View>
                </View>
              )}
              <Text style={pkgStyles.priceVaryNote}>⚠️ {isAr ? "قد تتغير الأسعار بناءً على وقت التأكيد" : "Prices may vary depending on confirmation time"}</Text>
              <Pressable style={pkgStyles.tncRow} onPress={() => setShowTnC(true)} hitSlop={6}>
                <Pressable style={[pkgStyles.tncCheckbox, termsAccepted && pkgStyles.tncCheckboxChecked]} onPress={() => setTermsAccepted(v => !v)} hitSlop={10}>
                  {termsAccepted && <Text style={pkgStyles.tncCheckmark}>✓</Text>}
                </Pressable>
                <Text style={pkgStyles.tncBtnTxt}>📋 {isAr ? "الشروط والأحكام" : "Terms & Conditions"}</Text>
              </Pressable>
              {submitError && <Text style={{ color: "#FF5252", fontSize: 13, textAlign: "center", marginTop: 10 }}>{submitError}</Text>}
              <Pressable
                style={({ pressed }) => [pkgStyles.bookBtn, { marginTop: 12, backgroundColor: termsAccepted ? "#1A7F3C" : "#1B3A6B" }, pressed && { opacity: 0.85 }, (!termsAccepted || submitting) && { opacity: 0.6 }]}
                onPress={handleBooking}
                disabled={submitting || !termsAccepted}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={[pkgStyles.bookBtnTxt, { color: "#fff" }]}>{isAr ? "إحجز تجربتك الآن" : "Book Your Experience Now"}</Text>}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── T&C Modal ── */}
      <Modal visible={showTnC} transparent animationType="fade" onRequestClose={() => setShowTnC(false)}>
        <View style={pkgStyles.modalOverlay}>
          <View style={[pkgStyles.modalSheet, { maxHeight: "85%", paddingBottom: 24 }]}>
            <View style={pkgStyles.modalHeader}>
              <Text style={pkgStyles.modalTitle}>{isAr ? "📋 الشروط والأحكام" : "📋 Terms & Conditions"}</Text>
              <Pressable onPress={() => setShowTnC(false)} hitSlop={12}><Text style={{ color: "#888", fontSize: 22 }}>✕</Text></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              {[
                { title: isAr ? "١. سياسة الإلغاء والاسترداد" : "1. Cancellation & Refund Policy", body: isAr ? CUSTOMER_BOOKING_GUIDANCE.packageTerms.cancellation.concise.ar : CUSTOMER_BOOKING_GUIDANCE.packageTerms.cancellation.concise.en },
                { title: isAr ? "٢. تغيير الأسعار" : "2. Price Variation", body: isAr ? "الأسعار المعروضة تقديرية وقد تتغير عند التأكيد. تحتفظ دار التميز بحق تعديل السعر النهائي وفق أسعار السوق وقت إصدار التذاكر." : "Prices shown are estimates and may change upon confirmation. Dar AlTamaiz reserves the right to adjust the final price in line with market rates at time of ticketing." },
                { title: isAr ? "٣. دور الشركة" : "3. Agency Role", body: isAr ? "تعمل دار التميز وكيلاً سياحياً ووسيطاً بين العميل وشركات الطيران والفنادق. لا تتحمل الشركة مسؤولية أي تغييرات أو تأخيرات أو إلغاءات من جانب الناقل أو مزود الإقامة." : "D.T. Tours operates as a travel agent and intermediary. The company is not liable for changes, delays, or cancellations made by carriers or accommodation providers." },
                { title: isAr ? "٤. متطلبات السفر" : "4. Travel Requirements", body: isAr ? "العميل مسؤول عن توفر جواز سفر ساري المفعول لمدة لا تقل عن ٦ أشهر من تاريخ السفر، وعن الحصول على جميع التأشيرات المطلوبة." : "The client is solely responsible for holding a valid passport (≥6 months validity) and obtaining all required visas for the chosen destinations." },
                { title: isAr ? "٥. الحجز والتأكيد" : "5. Booking Confirmation", body: isAr ? CUSTOMER_BOOKING_GUIDANCE.packageTerms.confirmation.concise.ar : CUSTOMER_BOOKING_GUIDANCE.packageTerms.confirmation.concise.en },
              ].map((item) => (
                <View key={item.title} style={pkgStyles.tncItem}>
                  <Text style={pkgStyles.tncItemTitle}>{item.title}</Text>
                  <Text style={pkgStyles.tncItemBody}>{item.body}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable style={[pkgStyles.bookBtn, { marginTop: 12, backgroundColor: "#1A7F3C" }]} onPress={() => { setTermsAccepted(true); setShowTnC(false); }}>
              <Text style={[pkgStyles.bookBtnTxt, { color: "#fff" }]}>{isAr ? "✓ فهمت وأوافق" : "✓ I Understand & Agree"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const mpkgV2 = StyleSheet.create({
  wrap: {
    backgroundColor: "rgba(0,8,30,0.97)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.4)",
    overflow: "hidden",
    marginTop: 6,
  },
  // ── Distribution phase ──
  distHeader: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(212,175,55,0.2)",
  },
  distHeaderTitle: {
    color: GOLD,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  distHeaderSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
  },
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  distLegRoute: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  distLegDates: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  counterWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(212,175,55,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
  },
  counterBtnTxt: {
    color: GOLD,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    lineHeight: 24,
  },
  counterVal: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    minWidth: 30,
    textAlign: "center",
  },
  distTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(212,175,55,0.07)",
  },
  distTotalLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  distTotalValue: {
    color: GOLD,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  confirmBtn: {
    margin: 14,
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  confirmBtnTxt: {
    color: "#000",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  // ── Results phase ──
  masterHeader: {
    padding: 14,
    backgroundColor: "rgba(212,175,55,0.05)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(212,175,55,0.25)",
  },
  masterRoute: {
    color: GOLD,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  masterMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
    flexWrap: "wrap",
  },
  masterMetaTxt: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  masterMetaDot: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 11,
  },
  // ── Leg accordion ──
  legAccordion: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  legAccHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  legBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(212,175,55,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  legBadgeTxt: {
    color: GOLD,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  legAccRoute: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  legAccDates: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  legAccPrice: {
    color: GOLD,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  legAccPriceDash: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  legAccChevron: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 9,
  },
  legAccBody: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 12,
    backgroundColor: "rgba(255,255,255,0.02)",
    gap: 8,
  },
  legAccSectionTitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  legAccDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(212,175,55,0.15)",
    marginVertical: 4,
  },
  legAccLoading: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  legAccEmpty: {
    color: "#FF6B6B",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  legAccNote: {
    color: "rgba(212,175,55,0.6)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  detailLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  detailVal: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "right",
    flex: 2,
  },
  waInlineLink: {
    color: "#25D366",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  // ── Pricing ──
  priceBox: {
    margin: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(212,175,55,0.2)",
    gap: 2,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  priceLbl: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  priceAmt: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  priceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(212,175,55,0.25)",
    marginVertical: 6,
  },
  totalLbl: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  totalAmt: {
    color: GOLD,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  depositRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(212,175,55,0.1)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 4,
  },
  depositLbl: {
    color: GOLD,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
  depositAmt: {
    color: GOLD,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    marginLeft: 6,
  },
  priceLoading: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  priceNote: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginHorizontal: 14,
    marginBottom: 10,
  },
  // ── CTAs ──
  ctaRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  bookBtn: {
    flex: 1,
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: GOLD,
  },
  bookBtnTxt: {
    color: GOLD,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  waBtn: {
    width: 44,
    height: 44,
    backgroundColor: "#25D366",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#25D366",
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  waBtnTxt: {
    fontSize: 20,
    lineHeight: 24,
  },
  anotherBtn: {
    marginHorizontal: 14,
    marginBottom: 14,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  anotherBtnTxt: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});

interface OfferCardData {
  title: string;
  description: string;
  price?: string;
  image?: string;
  link: string;
}

function SearchLoadingCard({
  isAr,
  elapsed,
  label,
}: {
  isAr: boolean;
  elapsed: number;
  label: "flight" | "hotel" | "offers";
}) {
  const messages = {
    flight: {
      ar: "جاري البحث عن أفضل أسعار الطيران... ✈️",
      en: "Searching the best flight prices for you... ✈️",
    },
    hotel: {
      ar: "جاري البحث عن أفضل الفنادق المتاحة لك... 🏨",
      en: "Searching the best available hotels for you... 🏨",
    },
    offers: {
      ar: "جاري تحميل أحدث العروض والصفقات... 🎯",
      en: "Loading the latest deals and offers... 🎯",
    },
  };
  const msg = isAr ? messages[label].ar : messages[label].en;
  const secLabel = isAr ? "ثانية" : "s";

  return (
    <View style={flightStyles.card}>
      <View style={flightStyles.loadingRow}>
        <ActivityIndicator size="small" color={GOLD} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[flightStyles.loadingText, { fontSize: 13 }]}>{msg}</Text>
          <Text style={flightStyles.elapsedText}>
            {elapsed > 0 ? `${elapsed} ${secLabel}` : ""}
          </Text>
        </View>
      </View>
    </View>
  );
}

interface FlightResult {
  id: string;
  airlineCode: string;
  airline: string;
  departure: string;
  arrival: string;
  depDate: string;
  retDate?: string;
  duration: string;
  stops: number;
  price: string;
  currency: string;
}

const WA_NUMBER = "96590087797";

const SUBSCRIPTION_PLANS = [
  { id: "tamaiz"   as const, arLabel: "تميز",           enLabel: "TAMAIZ",          price: 3,  searches: 15, devices: 1, badge: null,          platinum: false },
  { id: "plus"     as const, arLabel: "تميز بلاس",      enLabel: "TAMAIZ Plus",     price: 6,  searches: 30, devices: 2, badge: "⭐ الأفضل",   platinum: false },
  { id: "platinum" as const, arLabel: "تميز بلاتينيوم", enLabel: "TAMAIZ Platinum", price: 10, searches: 40, devices: 4, badge: "💎 بلاتينيوم", platinum: true  },
] as const;
type SubscriptionPlanId = "tamaiz" | "plus" | "platinum";

function buildFlightWaMsg(
  isAr: boolean,
  toLabel: string,
  depDate: string,
  retDate: string | undefined,
  adults: string,
  price: string,
  currency: string,
): string {
  const dateStr = retDate ? `${depDate} → ${retDate}` : depDate;
  if (isAr) {
    return (
      `السلام عليكم ورحمة الله وبركاته، أرغب في تأكيد حجز تذكرة طيران عبر D.T. Tours بناءً على العرض الظاهر في الشات:\n` +
      `- الوجهة: ${toLabel}\n` +
      `- التاريخ: ${dateStr}\n` +
      `- عدد الركاب: ${adults}\n` +
      `- السعر المعروض: ${currency} ${price}`
    );
  }
  return (
    `Assalamu Alaikum Wa Rahmatullah Wa Barakatuh, I would like to confirm a flight booking via D.T. Tours based on the offer displayed in the chat:\n` +
    `- Destination: ${toLabel}\n` +
    `- Dates: ${dateStr}\n` +
    `- Passengers: ${adults}\n` +
    `- Displayed Price: ${currency} ${price}`
  );
}

function FlightRateLimitCountdown({ resetAt, isAr }: { resetAt: number; isAr: boolean }) {
  const [remaining, setRemaining] = React.useState(() => Math.max(0, resetAt - Date.now()));

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => setRemaining(Math.max(0, resetAt - Date.now())), 1000);
    return () => clearInterval(t);
  }, [resetAt]);

  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const expired = remaining <= 0;

  return (
    <View style={{ alignItems: "center", gap: 8, paddingVertical: 6 }}>
      <Text
        style={{
          color: "rgba(255,255,255,0.5)",
          fontSize: 10.5,
          fontFamily: "Inter_400Regular",
          letterSpacing: 0,
        }}
      >
        {isAr ? "تتجدد محاولاتك خلال" : "Your attempts reset in"}
      </Text>
      {expired ? (
        <Text
          style={{
            color: GOLD,
            fontSize: 11,
            fontFamily: "Inter_400Regular",
            textAlign: "center",
            letterSpacing: 0,
          }}
        >
          {isAr ? "أغلق الشات وأعد فتحه لتجديد المحاولات" : "Close & reopen chat to refresh"}
        </Text>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {[pad(h), pad(m), pad(s)].map((unit, i) => (
            <React.Fragment key={i}>
              <View
                style={{
                  backgroundColor: "rgba(0,0,0,0.55)",
                  borderWidth: 1,
                  borderColor: "rgba(212,175,55,0.45)",
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 5,
                  minWidth: 40,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: GOLD,
                    fontSize: 20,
                    fontFamily: "Inter_700Bold",
                    letterSpacing: 1,
                  }}
                >
                  {unit}
                </Text>
              </View>
              {i < 2 && (
                <Text style={{ color: GOLD, fontSize: 18, fontFamily: "Inter_700Bold" }}>
                  :
                </Text>
              )}
            </React.Fragment>
          ))}
        </View>
      )}
      <Text
        style={{
          color: "rgba(255,255,255,0.25)",
          fontSize: 9,
          fontFamily: "Inter_400Regular",
        }}
      >
        {isAr ? "ساعة : دقيقة : ثانية" : "HH : MM : SS"}
      </Text>
    </View>
  );
}

const MOCK_ROUTE_DB: Record<string, Array<{ airline: string; code: string; dep: string; arr: string; dur: string; stops: number; kwd: string }>> = {
  "KWI-LHR": [
    { airline: "Kuwait Airways", code: "KU", dep: "10:00", arr: "14:45", dur: "6h 45m", stops: 0, kwd: "77.188" },
    { airline: "British Airways", code: "BA", dep: "08:30", arr: "14:20", dur: "6h 50m", stops: 0, kwd: "95.625" },
    { airline: "Emirates", code: "EK", dep: "22:00", arr: "09:45", dur: "11h 45m", stops: 1, kwd: "85.000" },
    { airline: "Lufthansa", code: "LH", dep: "06:15", arr: "13:30", dur: "10h 15m", stops: 1, kwd: "89.375" },
    { airline: "Air Arabia", code: "G9", dep: "05:00", arr: "14:10", dur: "9h 10m", stops: 1, kwd: "58.594" },
  ],
  "LHR-KWI": [
    { airline: "Kuwait Airways", code: "KU", dep: "15:30", arr: "23:45", dur: "6h 15m", stops: 0, kwd: "77.188" },
    { airline: "British Airways", code: "BA", dep: "09:10", arr: "18:00", dur: "7h 50m", stops: 0, kwd: "95.625" },
    { airline: "Emirates", code: "EK", dep: "14:00", arr: "06:30", dur: "16h 30m", stops: 1, kwd: "85.000" },
  ],
  "KWI-IST": [
    { airline: "Turkish Airlines", code: "TK", dep: "09:00", arr: "12:45", dur: "4h 45m", stops: 0, kwd: "58.594" },
    { airline: "Kuwait Airways", code: "KU", dep: "06:30", arr: "10:15", dur: "4h 45m", stops: 0, kwd: "52.188" },
    { airline: "Pegasus", code: "PC", dep: "23:55", arr: "05:30", dur: "5h 35m", stops: 0, kwd: "44.531" },
    { airline: "FlyDubai", code: "FZ", dep: "15:00", arr: "22:30", dur: "7h 30m", stops: 1, kwd: "38.750" },
  ],
  "KWI-DXB": [
    { airline: "Kuwait Airways", code: "KU", dep: "07:00", arr: "08:40", dur: "1h 40m", stops: 0, kwd: "28.125" },
    { airline: "Emirates", code: "EK", dep: "14:30", arr: "16:10", dur: "1h 40m", stops: 0, kwd: "34.375" },
    { airline: "FlyDubai", code: "FZ", dep: "18:00", arr: "19:45", dur: "1h 45m", stops: 0, kwd: "25.000" },
    { airline: "Air Arabia", code: "G9", dep: "22:00", arr: "23:35", dur: "1h 35m", stops: 0, kwd: "21.875" },
  ],
  "KWI-CAI": [
    { airline: "EgyptAir", code: "MS", dep: "08:45", arr: "11:15", dur: "2h 30m", stops: 0, kwd: "38.281" },
    { airline: "Kuwait Airways", code: "KU", dep: "14:00", arr: "16:30", dur: "2h 30m", stops: 0, kwd: "42.188" },
    { airline: "Air Arabia", code: "G9", dep: "06:00", arr: "09:30", dur: "3h 30m", stops: 0, kwd: "29.688" },
  ],
  "KWI-DOH": [
    { airline: "Qatar Airways", code: "QR", dep: "07:30", arr: "08:35", dur: "1h 05m", stops: 0, kwd: "22.656" },
    { airline: "Kuwait Airways", code: "KU", dep: "12:00", arr: "13:05", dur: "1h 05m", stops: 0, kwd: "19.531" },
  ],
  "KWI-BKK": [
    { airline: "Thai Airways", code: "TG", dep: "23:55", arr: "10:30", dur: "9h 35m", stops: 0, kwd: "92.188" },
    { airline: "Kuwait Airways", code: "KU", dep: "06:30", arr: "21:00", dur: "14h 30m", stops: 1, kwd: "82.813" },
    { airline: "Emirates", code: "EK", dep: "22:00", arr: "15:30", dur: "17h 30m", stops: 1, kwd: "78.125" },
  ],
  "KWI-KUL": [
    { airline: "AirAsia", code: "AK", dep: "23:45", arr: "12:30", dur: "8h 45m", stops: 0, kwd: "68.750" },
    { airline: "Malaysia Airlines", code: "MH", dep: "01:00", arr: "12:40", dur: "9h 40m", stops: 0, kwd: "78.125" },
    { airline: "Emirates", code: "EK", dep: "22:00", arr: "16:00", dur: "18h", stops: 1, kwd: "85.938" },
  ],
  "KWI-FCO": [
    { airline: "ITA Airways", code: "AZ", dep: "08:00", arr: "13:30", dur: "5h 30m", stops: 0, kwd: "82.031" },
    { airline: "Kuwait Airways", code: "KU", dep: "10:00", arr: "16:00", dur: "6h", stops: 0, kwd: "75.000" },
    { airline: "Lufthansa", code: "LH", dep: "06:00", arr: "14:30", dur: "8h 30m", stops: 1, kwd: "70.313" },
  ],
  "KWI-CDG": [
    { airline: "Kuwait Airways", code: "KU", dep: "09:30", arr: "15:45", dur: "6h 15m", stops: 0, kwd: "85.938" },
    { airline: "Air France", code: "AF", dep: "07:00", arr: "13:00", dur: "6h", stops: 0, kwd: "98.438" },
    { airline: "Emirates", code: "EK", dep: "22:00", arr: "11:30", dur: "13h 30m", stops: 1, kwd: "82.813" },
  ],
  "KWI-BCN": [
    { airline: "Vueling", code: "VY", dep: "06:15", arr: "14:00", dur: "7h 45m", stops: 0, kwd: "76.563" },
    { airline: "Iberia", code: "IB", dep: "08:00", arr: "16:20", dur: "8h 20m", stops: 1, kwd: "89.063" },
  ],
  "KWI-JED": [
    { airline: "Kuwait Airways", code: "KU", dep: "09:00", arr: "11:30", dur: "2h 30m", stops: 0, kwd: "32.813" },
    { airline: "Saudia", code: "SV", dep: "14:00", arr: "16:30", dur: "2h 30m", stops: 0, kwd: "28.125" },
    { airline: "Air Arabia", code: "G9", dep: "06:00", arr: "08:30", dur: "2h 30m", stops: 0, kwd: "23.438" },
  ],
  "KWI-AMM": [
    { airline: "Kuwait Airways", code: "KU", dep: "08:00", arr: "10:00", dur: "2h", stops: 0, kwd: "28.125" },
    { airline: "Royal Jordanian", code: "RJ", dep: "14:30", arr: "16:30", dur: "2h", stops: 0, kwd: "32.813" },
  ],
  "KWI-CMB": [
    { airline: "SriLankan", code: "UL", dep: "01:00", arr: "08:30", dur: "7h 30m", stops: 0, kwd: "62.500" },
    { airline: "Kuwait Airways", code: "KU", dep: "23:00", arr: "07:30", dur: "8h 30m", stops: 0, kwd: "55.469" },
  ],
  "KWI-MLE": [
    { airline: "Kuwait Airways", code: "KU", dep: "22:00", arr: "06:30", dur: "8h 30m", stops: 1, kwd: "85.938" },
    { airline: "Emirates", code: "EK", dep: "08:00", arr: "18:30", dur: "10h 30m", stops: 1, kwd: "92.188" },
  ],
};

function generateMockFlights(fromIATA: string, toIATA: string, dep: string): FlightResult[] {
  const key = `${fromIATA.toUpperCase()}-${toIATA.toUpperCase()}`;
  const reverse = `${toIATA.toUpperCase()}-${fromIATA.toUpperCase()}`;
  const tpls = MOCK_ROUTE_DB[key] ?? MOCK_ROUTE_DB[reverse];
  const list = tpls ?? [
    { airline: "Kuwait Airways", code: "KU", dep: "09:00", arr: "14:30", dur: "5h 30m", stops: 0, kwd: "65.000" },
    { airline: "Emirates", code: "EK", dep: "22:00", arr: "08:15", dur: "10h 15m", stops: 1, kwd: "72.500" },
    { airline: "Air Arabia", code: "G9", dep: "06:00", arr: "14:00", dur: "8h", stops: 1, kwd: "48.438" },
    { airline: "FlyDubai", code: "FZ", dep: "15:30", arr: "23:00", dur: "7h 30m", stops: 1, kwd: "55.000" },
  ];
  const depDisplay = dep ? dep.split("-").reverse().join("/") : "";
  return list.map((t, i) => ({
    id: `mock_${i}`,
    airline: t.airline,
    airlineCode: t.code,
    departure: t.dep,
    arrival: t.arr,
    depDate: depDisplay,
    duration: t.dur,
    stops: t.stops,
    price: t.kwd,
    currency: "KWD",
  }));
}

function airlineLogoColor(code: string): string {
  const map: Record<string, string> = {
    KU: "#0055A5", BA: "#1C3F6E", EK: "#C8102E", TK: "#C8102E", QR: "#5C0632",
    MS: "#1C5D99", LH: "#05164D", G9: "#EE2E24", FZ: "#FF6600", PC: "#FF6600",
    TG: "#6D1F7C", MH: "#003380", IB: "#F01716", AF: "#002395", AZ: "#007FFF",
    VY: "#FFE103", RJ: "#006341", UL: "#FF6600", SV: "#006941", AK: "#FF0000",
  };
  return map[code.toUpperCase()] ?? "#2A4A7F";
}

function FlightInlineSearch({
  token,
  apiBase,
  isAr,
  openInApp,
  searchCount,
  onSearchConsumed,
  resetAt,
  maxSearches = MAX_FLIGHT_SEARCHES,
  deviceId = "",
}: {
  token: string;
  apiBase: string;
  isAr: boolean;
  openInApp: (url: string) => void;
  searchCount: number;
  onSearchConsumed: () => void;
  resetAt: number;
  maxSearches?: number;
  deviceId?: string;
}) {
  const parts = token.split("|");
  const [fromIATA, fromLabel, toIATA, toLabel, dep, ret, adultsStr] = parts;
  const adults = adultsStr ?? "1";

  const consumed = useRef(false);
  const [status, setStatus] = useState<"loading" | "done" | "ratelimited" | "noFlights">(
    searchCount >= maxSearches ? "ratelimited" : "loading"
  );
  const [flights, setFlights] = useState<FlightResult[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [isMock, setIsMock] = useState(false);
  const [serverBlocked, setServerBlocked] = useState(false);

  useEffect(() => {
    if (searchCount >= maxSearches) return;

    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    const params = new URLSearchParams({
      origin: fromIATA ?? "KWI",
      destination: toIATA ?? "DXB",
      departure: dep ?? "",
      adults,
    });
    if (ret) params.set("return", ret);

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 25000);

    const applyMock = () => {
      clearTimeout(timeout);
      clearInterval(t);
      setFlights(generateMockFlights(fromIATA ?? "KWI", toIATA ?? "LHR", dep ?? ""));
      setIsMock(true);
      setStatus("done");
    };

    (async () => {
      try {
        const r = await fetch(`${apiBase}/flights?${params}`, {
          signal: ctrl.signal,
          headers: { "x-device-id": deviceId },
        });

        // Server-side hard block — quota exceeded in DB
        if (r.status === 429) {
          clearTimeout(timeout);
          clearInterval(t);
          setServerBlocked(true);
          setStatus("ratelimited");
          return;
        }

        const ct = r.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) { applyMock(); return; }

        type FlightsResp = { configured: boolean; flights: FlightResult[]; quota_exceeded?: boolean };
        let data: FlightsResp | null = null;
        try { data = await r.json() as FlightsResp; } catch { applyMock(); return; }

        if (!data || data.quota_exceeded) {
          clearTimeout(timeout);
          clearInterval(t);
          setServerBlocked(true);
          setStatus("ratelimited");
          return;
        }

        if (!data.configured) { applyMock(); return; }

        if (data.flights.length === 0) {
          clearTimeout(timeout);
          clearInterval(t);
          setStatus("noFlights");
          return;
        }

        clearTimeout(timeout);
        clearInterval(t);
        if (!consumed.current) { consumed.current = true; onSearchConsumed(); }
        setFlights(data.flights);
        setStatus("done");
      } catch {
        applyMock();
      }
    })();

    return () => { clearInterval(t); clearTimeout(timeout); };
  }, []);

  const depDisplay = dep ? dep.split("-").reverse().join("/") : "";
  const retDisplay = ret ? ret.split("-").reverse().join("/") : undefined;

  if (status === "loading") {
    return <SearchLoadingCard isAr={isAr} elapsed={elapsed} label="flight" />;
  }

  if (status === "noFlights") {
    const noFlightWaMsg = isAr
      ? `السلام عليكم، أبحث عن رحلة من ${fromLabel ?? fromIATA ?? ""} إلى ${toLabel ?? toIATA ?? ""} بتاريخ ${dep ?? ""} ولا توجد نتائج — أرجو المساعدة`
      : `Assalamu Alaikum, I'm searching for a flight from ${fromLabel ?? fromIATA ?? ""} to ${toLabel ?? toIATA ?? ""} on ${dep ?? ""} but no flights were found — please help`;
    const noFlightWaUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(noFlightWaMsg)}`;
    return (
      <View style={[flightStyles.card, { gap: 12, alignItems: "center" }]}>
        <Text style={{ fontSize: 28 }}>✈️</Text>
        <Text style={{ color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_700Bold", textAlign: "center", lineHeight: 24 }}>
          {isAr
            ? `لا توجد رحلات متاحة في نظامنا بهذا التاريخ`
            : `No flights available for this date in our system`}
        </Text>
        <Text style={{ color: "rgba(212,175,55,0.8)", fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 }}>
          {isAr
            ? `${fromLabel ?? fromIATA} → ${toLabel ?? toIATA}  ·  ${depDisplay}${retDisplay ? " ← " + retDisplay : ""}`
            : `${fromLabel ?? fromIATA} → ${toLabel ?? toIATA}  ·  ${depDisplay}${retDisplay ? " ← " + retDisplay : ""}`}
        </Text>
        <View style={{ width: "100%", height: StyleSheet.hairlineWidth, backgroundColor: "rgba(212,175,55,0.2)", marginVertical: 2 }} />
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 }}>
          {isAr ? "تواصل معنا وسنساعدك في إيجاد أفضل الأسعار" : "Contact us and we'll help you find the best prices"}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.flightCta, { width: "100%" }, pressed && { opacity: 0.8 }]}
          onPress={() => Linking.openURL(noFlightWaUrl)}
        >
          <Text style={styles.flightCtaText}>
            {isAr ? "💬 تواصل معنا عبر واتساب" : "💬 Contact us via WhatsApp"}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (status === "ratelimited") {
    const limitWaMsg = isAr
      ? `السلام عليكم، وصلت لحد البحث المجاني (${maxSearches} بحث) وأرغب في الاستعلام عن رحلة من ${fromLabel ?? fromIATA ?? ""} إلى ${toLabel ?? toIATA ?? ""}`
      : `Assalamu Alaikum, I have reached my free flight search limit (${maxSearches} searches) and would like to enquire about a flight from ${fromLabel ?? fromIATA ?? ""} to ${toLabel ?? toIATA ?? ""}`;
    const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(limitWaMsg)}`;

    // Server-blocked: quota confirmed exhausted in the live DB record
    if (serverBlocked) {
      return (
        <View style={[flightStyles.card, { gap: 12, alignItems: "center" }]}>
          <Text style={{ fontSize: 26 }}>🚫</Text>
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 14,
              fontFamily: "Inter_700Bold",
              textAlign: "center",
              lineHeight: 24,
              letterSpacing: 0,
            }}
          >
            {isAr
              ? "عذراً، لقد نفدت محاولات البحث المتاحة لباقتك اليوم."
              : `You have used all ${maxSearches} searches for today.`}
          </Text>
          <Text
            style={{
              color: "rgba(212,175,55,0.75)",
              fontSize: 11,
              fontFamily: "Inter_400Regular",
              textAlign: "center",
              lineHeight: 17,
              letterSpacing: 0,
            }}
          >
            {isAr ? "تجدد المحاولات في منتصف الليل" : "Your quota resets at midnight"}
          </Text>
          <View style={{ width: "100%", height: StyleSheet.hairlineWidth, backgroundColor: "rgba(212,175,55,0.2)", marginVertical: 2 }} />
          {resetAt > 0 && <FlightRateLimitCountdown resetAt={resetAt} isAr={isAr} />}
          <View style={{ width: "100%", height: StyleSheet.hairlineWidth, backgroundColor: "rgba(212,175,55,0.2)", marginVertical: 2 }} />
          <Pressable
            style={({ pressed }) => [styles.flightCta, { width: "100%" }, pressed && { opacity: 0.8 }]}
            onPress={() => Linking.openURL(waUrl)}
          >
            <Text style={styles.flightCtaText}>
              {isAr ? "💬 تواصل معنا عبر واتساب" : "💬 Contact us via WhatsApp"}
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={[flightStyles.card, { gap: 12, alignItems: "center" }]}>
        <Text style={{ fontSize: 26 }}>✈️</Text>
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 13,
            fontFamily: "Inter_700Bold",
            textAlign: "center",
            lineHeight: 23,
            letterSpacing: 0,
          }}
        >
          {isAr
            ? `لقد استنفدت المحاولات الـ ${maxSearches} المجانية للبحث عن تذاكر الطيران.`
            : `You have used all ${maxSearches} free flight search attempts.`}
        </Text>
        {!isAr && (
          <Text
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: 11,
              fontFamily: "Inter_400Regular",
              textAlign: "center",
              lineHeight: 17,
              letterSpacing: 0,
            }}
          >
            Upgrade to premium for 15 searches/day.
          </Text>
        )}
        <View style={{ width: "100%", height: StyleSheet.hairlineWidth, backgroundColor: "rgba(212,175,55,0.2)", marginVertical: 2 }} />
        {resetAt > 0 && <FlightRateLimitCountdown resetAt={resetAt} isAr={isAr} />}
        <View style={{ width: "100%", height: StyleSheet.hairlineWidth, backgroundColor: "rgba(212,175,55,0.2)", marginVertical: 2 }} />
        <Pressable
          style={({ pressed }) => [styles.flightCta, { width: "100%" }, pressed && { opacity: 0.8 }]}
          onPress={() => Linking.openURL(waUrl)}
        >
          <Text style={styles.flightCtaText}>
            {isAr ? "💬 احجز عبر واتساب الآن" : "💬 Book via WhatsApp Now"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={flightStyles.resultsWrap}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={flightStyles.resultsHeader}>
          {isAr
            ? `✈️ أفضل أسعار الطيران (${flights.length} رحلات)`
            : `✈️ Best Flights Found (${flights.length})`}
        </Text>
        {isMock && (
          <Text style={{ color: "rgba(212,175,55,0.55)", fontSize: 9, fontFamily: "Inter_400Regular" }}>
            {isAr ? "أسعار تقديرية" : "Est. prices"}
          </Text>
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Text style={{
          backgroundColor: !!ret ? "rgba(212,175,55,0.15)" : "rgba(0,31,91,0.4)",
          color: !!ret ? GOLD : "#aaa",
          fontSize: 11,
          fontFamily: "Inter_700Bold",
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 6,
          overflow: "hidden",
        }}>
          {!!ret
            ? `🔄 ${isAr ? "ذهاب وعودة" : "Round Trip"}`
            : `➡️ ${isAr ? "ذهاب فقط" : "One Way"}`}
        </Text>
        <Text style={{ color: "#666", fontSize: 11, fontFamily: "Inter_400Regular" }}>
          {depDisplay}{retDisplay ? ` ↔ ${retDisplay}` : ""}
        </Text>
      </View>

      {flights.map((f) => {
        const waMsg = buildFlightWaMsg(isAr, toLabel ?? "", f.depDate, f.retDate, adults, f.price, f.currency);
        const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMsg)}`;
        const isDirect = f.stops === 0;
        const stopsLabel = isDirect
          ? (isAr ? "مباشر" : "Direct")
          : (isAr ? `${f.stops} توقف` : `${f.stops} stop${f.stops > 1 ? "s" : ""}`);
        const dateLabel = f.retDate ? `${f.depDate}  →  ${f.retDate}` : f.depDate;
        const logoColor = airlineLogoColor(f.airlineCode);

        return (
          <Pressable
            key={f.id}
            style={({ pressed }) => [flightStyles.flightCard, pressed && { opacity: 0.85, borderColor: GOLD }]}
            onPress={() => Linking.openURL(waUrl)}
          >
            {/* Airline row */}
            <View style={flightStyles.cardTopRow}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}>
                <View style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  backgroundColor: logoColor,
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 }}>
                    {f.airlineCode || f.airline.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={flightStyles.airlineName} numberOfLines={1}>{f.airline}</Text>
                  {f.airlineCode ? (
                    <Text style={flightStyles.airlineCode}>{f.airlineCode}</Text>
                  ) : null}
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={flightStyles.flightPrice}>{f.currency} {f.price}</Text>
                <Text style={flightStyles.perPax}>{isAr ? "للمسافر" : "per pax"}</Text>
              </View>
            </View>

            {/* Divider */}
            <View style={flightStyles.cardDivider} />

            {/* Times + route row */}
            <View style={flightStyles.timeRow}>
              <View style={{ alignItems: "center", minWidth: 48 }}>
                <Text style={flightStyles.timeText}>{f.departure}</Text>
                <Text style={flightStyles.iataCode}>{fromIATA}</Text>
              </View>
              <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
                <Text style={flightStyles.durationLabel}>{f.duration}</Text>
                <View style={flightStyles.routeLine}>
                  <View style={flightStyles.routeDot} />
                  <View style={flightStyles.routeBar} />
                  <Text style={flightStyles.planeEmoji}>✈</Text>
                  <View style={flightStyles.routeBar} />
                  <View style={flightStyles.routeDot} />
                </View>
                <Text style={isDirect ? flightStyles.directBadge : flightStyles.stopsBadge}>
                  {stopsLabel}
                </Text>
              </View>
              <View style={{ alignItems: "center", minWidth: 48 }}>
                <Text style={flightStyles.timeText}>{f.arrival}</Text>
                <Text style={flightStyles.iataCode}>{toIATA}</Text>
              </View>
            </View>

            {/* Date + book button */}
            <View style={flightStyles.cardBottomRow}>
              <Text style={flightStyles.dateLabel} numberOfLines={1} adjustsFontSizeToFit>📅 {dateLabel}</Text>
              <View style={flightStyles.bookBtn}>
                <Text style={flightStyles.bookBtnText}>{isAr ? "احجز ◀" : "Book ▶"}</Text>
              </View>
            </View>
          </Pressable>
        );
      })}

      {isMock && (
        <Text style={{
          color: "rgba(212,175,55,0.45)",
          fontSize: 9,
          fontFamily: "Inter_400Regular",
          textAlign: "center",
          marginTop: 2,
          letterSpacing: 0,
        }}>
          {isAr
            ? "* الأسعار تقديرية — اضغط احجز للتأكيد عبر واتساب"
            : "* Indicative prices — tap Book to confirm via WhatsApp"}
        </Text>
      )}

      <Pressable
        style={({ pressed }) => [{
          marginTop: 10,
          paddingVertical: 8,
          alignItems: "center",
          opacity: pressed ? 0.65 : 0.5,
        }]}
        onPress={() => {
          const waMsg = buildFlightWaMsg(isAr, toLabel ?? toIATA ?? "", depDisplay, retDisplay, adults, "", "");
          Linking.openURL(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMsg)}`);
        }}
      >
        <Text style={{
          color: "rgba(255,255,255,0.55)",
          fontSize: 10,
          fontFamily: "Inter_400Regular",
          letterSpacing: 0,
        }}>
          {isAr ? "💬 تحتاج مساعدة؟ تواصل عبر واتساب" : "💬 Need help? Chat on WhatsApp"}
        </Text>
      </Pressable>
    </View>
  );
}

function HotelInlineSearch({
  apiBase,
  isAr,
  params,
  openInApp,
}: {
  apiBase: string;
  isAr: boolean;
  params?: { city: string; checkin: string; checkout: string; stars?: number };
  openInApp: (url: string) => void;
}) {
  const [status, setStatus] = React.useState<"loading" | "done" | "fallback">("loading");
  const [hotels, setHotels] = React.useState<HotelOptionData[]>([]);
  const [starsMismatch, setStarsMismatch] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const hasFetched = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    (async () => {
      try {
        if (!params?.checkin) { setStatus("fallback"); return; }
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 90_000);
        const res = await fetch(`${apiBase}/hotel-search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            city: params.city,
            checkin: params.checkin,
            checkout: params.checkout,
            stars: params.stars ?? 0,
          }),
        });
        clearTimeout(tid);
        const data = (await res.json()) as {
          ok: boolean; hotels?: HotelOptionData[];
          starsMismatch?: boolean; error?: string;
        };
        if (data.ok && data.hotels && data.hotels.length > 0) {
          setHotels(data.hotels);
          setStarsMismatch(data.starsMismatch ?? false);
          setStatus("done");
        } else {
          setStatus("fallback");
        }
      } catch {
        setStatus("fallback");
      }
    })();
  }, []);

  const openWebsite = () => openInApp("https://dt-tours.com/index.php/hotel");

  if (status === "loading") {
    return <SearchLoadingCard isAr={isAr} elapsed={elapsed} label="hotel" />;
  }

  if (status === "fallback" || hotels.length === 0) {
    return (
      <Pressable
        style={({ pressed }) => [styles.flightCta, pressed && { opacity: 0.8 }]}
        onPress={openWebsite}
      >
        <Text style={styles.flightCtaText}>
          {isAr ? "🏨 شوف الفنادق المتاحة" : "🏨 View Available Hotels"}
        </Text>
      </Pressable>
    );
  }

  const starsLabel = params?.stars && params.stars > 0 ? ` ${params.stars}★` : "";

  return (
    <View style={flightStyles.resultsWrap}>
      <Text style={flightStyles.resultsHeader}>
        {isAr
          ? `🏨 فنادق${starsLabel} في ${params?.city ?? ""} (4-5★ أولاً)`
          : `🏨 Hotels${starsLabel} in ${params?.city ?? ""} (4-5★ first)`}
      </Text>
      {starsMismatch && params?.stars && params.stars > 0 && (
        <Text style={{ color: "#D4AF37", fontSize: 12, marginBottom: 6, textAlign: "center" }}>
          {isAr
            ? `⚠️ لم نجد فنادق ${params.stars}★ بالضبط — نعرض أقرب الخيارات المتاحة`
            : `⚠️ No exact ${params.stars}★ match — showing closest available`}
        </Text>
      )}
      {hotels.map((h, idx) => (
        <Pressable
          key={idx}
          style={({ pressed }) => [flightStyles.flightCard, pressed && { opacity: 0.85 }]}
          onPress={() => openInApp(h.bookUrl || "https://dt-tours.com")}
        >
          <View style={flightStyles.cardTopRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={flightStyles.airlineName} numberOfLines={2}>{h.name}</Text>
              <Text style={flightStyles.flightStops}>
                {"★".repeat(Math.min(h.stars, 5))} {h.location}
              </Text>
              {h.isRefundable && (
                <View style={flightStyles.refundBadge}>
                  <Text style={flightStyles.refundBadgeText}>
                    {isAr ? "✓ إلغاء مجاني" : "✓ Free cancellation"}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ alignItems: "flex-end", gap: 2 }}>
              <Text style={flightStyles.flightPrice}>{h.currency} {h.price}</Text>
              <Text style={flightStyles.flightBook}>{isAr ? "احجز" : "Book"}</Text>
            </View>
          </View>
        </Pressable>
      ))}
      <Pressable
        style={({ pressed }) => [flightStyles.moreBtn, pressed && { opacity: 0.8 }]}
        onPress={openWebsite}
      >
        <Text style={flightStyles.moreBtnText}>
          {isAr ? "← عرض جميع الفنادق على الموقع" : "View all hotels on website →"}
        </Text>
      </Pressable>
    </View>
  );
}

function OffersDisplay({
  apiBase,
  isAr,
  openInApp,
}: {
  apiBase: string;
  isAr: boolean;
  openInApp: (url: string) => void;
}) {
  const [status, setStatus] = React.useState<"loading" | "done" | "empty">("loading");
  const [offers, setOffers] = React.useState<OfferCardData[]>([]);
  const [elapsed, setElapsed] = React.useState(0);
  const hasFetched = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    void (async () => {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 90_000);
        const res = await fetch(`${apiBase}/offers`, { signal: ctrl.signal });
        clearTimeout(tid);
        const data = (await res.json()) as { ok: boolean; offers?: OfferCardData[] };
        if (data.ok && data.offers && data.offers.length > 0) {
          setOffers(data.offers.slice(0, 8));
          setStatus("done");
        } else {
          setStatus("empty");
        }
      } catch {
        setStatus("empty");
      }
    })();
  }, []);

  if (status === "loading") {
    return <SearchLoadingCard isAr={isAr} elapsed={elapsed} label="offers" />;
  }

  if (status === "empty" || offers.length === 0) {
    return (
      <Pressable
        style={({ pressed }) => [styles.flightCta, pressed && { opacity: 0.8 }]}
        onPress={() => openInApp("https://dt-tours.com")}
      >
        <Text style={styles.flightCtaText}>
          {isAr ? "🎯 شوف أحدث العروض على موقعنا" : "🎯 View latest offers on our website"}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={flightStyles.resultsWrap}>
      <Text style={flightStyles.resultsHeader}>
        {isAr ? "🎯 أحدث عروضنا المميزة" : "🎯 Our Latest Deals"}
      </Text>
      {offers.map((o, idx) => (
        <Pressable
          key={idx}
          style={({ pressed }) => [flightStyles.offerRow, pressed && { opacity: 0.85 }]}
          onPress={() => openInApp(o.link || "https://dt-tours.com")}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={flightStyles.offerTitle} numberOfLines={2}>{o.title}</Text>
            {o.description ? (
              <Text style={flightStyles.offerDesc} numberOfLines={1}>{o.description}</Text>
            ) : null}
          </View>
          {o.price ? (
            <Text style={flightStyles.flightPrice}>{o.price}</Text>
          ) : (
            <Text style={flightStyles.flightBook}>{isAr ? "← تفاصيل" : "Details →"}</Text>
          )}
        </Pressable>
      ))}
      <Pressable
        style={({ pressed }) => [flightStyles.moreBtn, pressed && { opacity: 0.8 }]}
        onPress={() => openInApp("https://dt-tours.com/index.php/tours/search")}
      >
        <Text style={flightStyles.moreBtnText}>
          {isAr ? "← عرض جميع العروض" : "View all offers →"}
        </Text>
      </Pressable>
    </View>
  );
}

function InAppBrowserModal({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = React.useState(true);

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: BLACK }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingTop: insets.top + 6,
            paddingBottom: 10,
            paddingHorizontal: 14,
            backgroundColor: "#0A1628",
            borderBottomWidth: 1,
            borderBottomColor: "rgba(212,175,55,0.25)",
            gap: 10,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: GOLD, fontSize: 11, fontFamily: "Inter_400Regular" }}
              numberOfLines={1}
            >
              {url.replace(/^https?:\/\//, "")}
            </Text>
          </View>
          {loading && <ActivityIndicator size="small" color={GOLD} />}
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path
                d="M18 6L6 18M6 6l12 12"
                stroke="#aaa"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>

        <WebView
          source={{ uri: url }}
          style={{ flex: 1, backgroundColor: BLACK }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          startInLoadingState={false}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
        />
      </View>
    </Modal>
  );
}

const flightStyles = StyleSheet.create({
  card: {
    marginTop: 8,
    backgroundColor: "rgba(10,22,40,0.9)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.25)",
    padding: 14,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  loadingText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  elapsedText: {
    color: "rgba(212,175,55,0.55)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  resultsWrap: {
    marginTop: 8,
    gap: 6,
  },
  resultsHeader: {
    color: GOLD,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  flightCard: {
    backgroundColor: "rgba(0,20,60,0.55)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.22)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  airlineName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    flexShrink: 1,
  },
  airlineCode: {
    color: "rgba(212,175,55,0.65)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  perPax: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(212,175,55,0.18)",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  iataCode: {
    color: "rgba(212,175,55,0.75)",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  durationLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  routeLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  routeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(212,175,55,0.5)",
  },
  routeBar: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(212,175,55,0.3)",
    minWidth: 18,
  },
  planeEmoji: {
    fontSize: 12,
    color: GOLD,
  },
  refundBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(34,197,94,0.15)",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.45)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  refundBadgeText: {
    color: "rgba(74,222,128,0.95)",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  directBadge: {
    color: "rgba(80,200,120,0.9)",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  stopsBadge: {
    color: "rgba(255,120,80,0.9)",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  dateLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  bookBtn: {
    backgroundColor: GOLD,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  bookBtnText: {
    color: "#000000",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  flightStops: {
    color: "rgba(255,120,80,0.9)",
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  flightDirect: {
    color: "rgba(80,200,120,0.9)",
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  flightPrice: {
    color: GOLD,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  flightBook: {
    color: "rgba(212,175,55,0.6)",
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  offerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,31,91,0.35)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  offerTitle: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontFamily: "Inter_700Bold",
    lineHeight: 17,
  },
  offerDesc: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  moreBtn: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(212,175,55,0.08)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.2)",
    alignItems: "center",
  },
  moreBtnText: {
    color: GOLD,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  flightDateLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 9.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  bookingInfo: {
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(212,175,55,0.05)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.15)",
  },
  bookingInfoText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 16,
  },
  errorNote: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});

/* ─────────────────────────────────────────────────────────────
   HotelNameWidget — shown when AI sends [HOTEL_NAME] token
 ═══════════════════════════════════════════════════════════════════════════ */
type PriceLockRow = {
  id: number;
  hotelName: string | null;
  checkin: string | null;
  checkout: string | null;
  status: string;
  expiresAt: string | null;
  lockedPriceKwd: string | null;
  lockHours: number;
  roomName: string | null;
  mealPlan: string | null;
  adults: number;
  rooms: number;
};

/** Normalize a hotel name for fuzzy matching: lowercase, strip non-alphanum, first 10 chars. */
function lockNameKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, "").slice(0, 10);
}

function fmtLockCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function HotelNameWidget({
  params,
  apiBase,
  isAr,
  openInApp,
  onNavigateToLocks,
}: {
  params: { hotelName: string; hotelNames: string[]; checkin: string; checkout: string; adults: number; rooms: number };
  apiBase: string;
  isAr: boolean;
  openInApp: (url: string) => void;
  onNavigateToLocks?: () => void;
}) {
  type HotelResult = { name: string; stars: number; price: string; bookUrl: string };
  const [status, setStatus] = useState<"loading" | "found" | "not_found">("loading");
  const [hotels, setHotels] = useState<HotelResult[]>([]);
  const [elapsed, setElapsed] = useState(0);

  // ── Price lock state ────────────────────────────────────────────────────────
  const [activeLock, setActiveLock] = useState<PriceLockRow | null>(null);
  const [lockCountdown, setLockCountdown] = useState("");
  const [lockModalVisible, setLockModalVisible] = useState(false);

  // Fetch active price locks once hotels are found; match by name + dates
  useEffect(() => {
    if (status !== "found") return;
    fetch(`${apiBase}/my-price-locks`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: any) => {
        if (!data?.ok || !data.locks?.length) return;
        const ci = params.checkin;
        const co = params.checkout;
        const targetNames = [
          params.hotelName,
          ...(params.hotelNames || []),
        ].filter(Boolean).map(lockNameKey);

        const match = (data.locks as PriceLockRow[]).find((lock) => {
          if (lock.status !== "active") return false;
          if (lock.checkin !== ci || lock.checkout !== co) return false;
          if (!lock.hotelName) return false;
          const lKey = lockNameKey(lock.hotelName);
          return targetNames.some(
            (t) => lKey.startsWith(t.slice(0, 6)) || t.startsWith(lKey.slice(0, 6))
          );
        });
        if (match) setActiveLock(match);
      })
      .catch(() => {});
  }, [status]);

  // Live countdown — update every minute
  useEffect(() => {
    if (!activeLock?.expiresAt) return;
    const tick = () => {
      const cd = fmtLockCountdown(activeLock.expiresAt!);
      if (!cd) { setActiveLock(null); return; }
      setLockCountdown(cd);
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [activeLock?.expiresAt]);

  useEffect(() => {
    let dead = false;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    fetch(`${apiBase}/hotel-name-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotelNames: params.hotelNames?.length ? params.hotelNames : [params.hotelName],
        checkin: params.checkin,
        checkout: params.checkout,
        adults: params.adults,
        rooms: params.rooms,
      }),
    })
      .then((r) => r.json())
      .then((d: any) => {
        clearInterval(t);
        if (dead) return;
        if (d.ok && d.hotels?.length > 0) { setHotels(d.hotels); setStatus("found"); }
        else setStatus("not_found");
      })
      .catch(() => { clearInterval(t); if (!dead) setStatus("not_found"); });
    return () => { dead = true; clearInterval(t); };
  }, []);

  const nights = Math.max(1, calcNightsNative(params.checkin, params.checkout));
  const rooms = Math.max(1, params.rooms ?? 1);

  const buildWAMsg = (hotelName: string) =>
    isAr
      ? `السلام عليكم، أريد الاستعلام عن فندق ${hotelName}\nتسجيل الوصول: ${params.checkin}\nتسجيل المغادرة: ${params.checkout}\nعدد الأشخاص: ${params.adults}\nعدد الغرف: ${rooms}`
      : `Hello, I'd like to enquire about ${hotelName}\nCheck-in: ${params.checkin}\nCheck-out: ${params.checkout}\nGuests: ${params.adults}\nRooms: ${rooms}`;

  if (status === "loading") {
    return (
      <View style={hnStyles.card}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ActivityIndicator size="small" color={GOLD} />
          <Text style={hnStyles.loadingText}>
            {params.hotelNames?.length > 1
            ? (isAr ? `جاري البحث عن ${params.hotelNames.length} فنادق...` : `Searching ${params.hotelNames.length} hotels...`)
            : (isAr ? `جاري البحث عن ${params.hotelName}` : `Searching ${params.hotelName}`)}
            {"  "}<Text style={{ color: GOLD, fontFamily: "Inter_700Bold" }}>{elapsed}s</Text>
          </Text>
        </View>
      </View>
    );
  }

  if (status === "not_found" || hotels.length === 0) {
    const searchLabel = params.hotelNames?.length > 1
      ? (isAr ? `${params.hotelNames.length} فنادق` : `${params.hotelNames.length} hotels`)
      : params.hotelName;
    const enquireMsg = isAr
      ? `السلام عليكم، أريد الاستعلام عن فندق ${searchLabel} من ${params.checkin} إلى ${params.checkout} لـ ${params.adults} أشخاص${rooms > 1 ? `، عدد الغرف: ${rooms}` : ""}`
      : `Hello, I'd like to enquire about ${searchLabel} from ${params.checkin} to ${params.checkout} for ${params.adults} guests${rooms > 1 ? `, ${rooms} rooms` : ""}`;
    return (
      <View style={hnStyles.card}>
        <Text style={hnStyles.notFoundText}>
          🔍 {isAr ? `لم نجد "${searchLabel}" في نظامنا` : `"${searchLabel}" not found in our system`}
        </Text>
        <Text style={hnStyles.notFoundSub}>
          {isAr ? "يمكنكم التواصل معنا مباشرةً لمساعدتك في البحث" : "Our team can help you find availability directly"}
        </Text>
        <Pressable
          style={({ pressed }) => [hnStyles.waSmallBtn, pressed && { opacity: 0.75 }]}
          onPress={() => Linking.openURL(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(enquireMsg)}`).catch(() => {})}
        >
          <Text style={hnStyles.waSmallBtnTxt}>💬 {isAr ? "استفسر عبر واتساب" : "Enquire on WhatsApp"} ↗</Text>
        </Pressable>
      </View>
    );
  }

  const cheapest = hotels[0]!;
  const cheapestTotal = parseFloat(cheapest.price) * nights * rooms;
  const cheapestDeposit = (cheapestTotal * BOOKING_RULES.packageDeposit.rate).toFixed(3);

  return (
    <View style={hnStyles.card}>
      {/* Header */}
      <View style={hnStyles.headerRow}>
        <Text style={hnStyles.headerTitle}>🏨 {isAr ? "نتائج الفنادق" : "Hotel Results"}</Text>
        <Text style={hnStyles.headerSub}>
          {params.checkin} → {params.checkout}{"  ·  "}{nights} {isAr ? "ليالٍ" : "nts"}{"  ·  "}{params.adults} {isAr ? "أشخاص" : "guests"}{rooms > 1 ? `  ·  ${rooms} ${isAr ? "غرف" : "rooms"}` : ""}
        </Text>
      </View>

      <View style={hnStyles.divider} />

      {/* Hotel rows — all results */}
      {hotels.map((h, idx) => {
        const ppn = parseFloat(h.price);
        const total = ppn * nights * rooms;
        return (
          <View key={idx}>
            <View style={hnStyles.hotelRow}>
              {/* Left: name + stars */}
              <View style={{ flex: 1, gap: 2, paddingRight: 8 }}>
                <Text style={hnStyles.hotelRowName} numberOfLines={2}>{h.name}</Text>
                {h.stars > 0 && <Text style={hnStyles.stars}>{"★".repeat(Math.min(h.stars, 5))}</Text>}
              </View>
              {/* Right: per-night + total */}
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Text style={hnStyles.ppnAmt}>KWD {ppn.toFixed(3)}</Text>
                <Text style={hnStyles.ppnLbl}>{isAr ? `/ ليلة${rooms > 1 ? " / غرفة" : ""}` : `/ night${rooms > 1 ? " / room" : ""}`}</Text>
                <Text style={hnStyles.rowTotal}>= KWD {total.toFixed(3)}</Text>
              </View>
            </View>
            {idx < hotels.length - 1 && <View style={hnStyles.rowDivider} />}
          </View>
        );
      })}

      <View style={hnStyles.divider} />

      {/* Deposit block — based on cheapest */}
      <View style={hnStyles.depositRow}>
        <View style={{ flex: 1 }}>
          <Text style={hnStyles.depositTopLbl}>
            💳 {isAr ? `العربون المطلوب (${BOOKING_RULES.packageDeposit.percent}%)` : `Required Deposit (${BOOKING_RULES.packageDeposit.percent}%)`}
          </Text>
          <Text style={hnStyles.depositSubLbl} numberOfLines={1}>
            {isAr ? `بناءً على أرخص خيار · ${cheapest.name}` : `Based on cheapest · ${cheapest.name}`}
          </Text>
        </View>
        <Text style={hnStyles.depositAmt}>KWD {cheapestDeposit}</Text>
      </View>

      {/* 🔒 Price lock badge — shown when an active lock matches this hotel + dates */}
      {activeLock && lockCountdown ? (
        <Pressable
          onPress={() => setLockModalVisible(true)}
          style={({ pressed }) => [hnStyles.lockBadge, pressed && { opacity: 0.85 }]}
        >
          <Text style={hnStyles.lockBadgeTxt}>
            🔒 {isAr ? `السعر محجوز — ${lockCountdown} متبقٍ` : `Price held — ${lockCountdown} left`}
          </Text>
          <Text style={hnStyles.lockBadgeSub}>
            {isAr ? "اضغط لعرض تفاصيل الحجز المؤقت" : "Tap to view your hold details"}
          </Text>
        </Pressable>
      ) : null}

      {/* Small professional WA button */}
      <Pressable
        style={({ pressed }) => [hnStyles.waSmallBtn, { alignSelf: isAr ? "flex-start" : "flex-end" }, pressed && { opacity: 0.75 }]}
        onPress={() => Linking.openURL(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(buildWAMsg(cheapest.name))}`).catch(() => {})}
      >
        <Text style={hnStyles.waSmallBtnTxt}>💬 {isAr ? "احجز عبر واتساب" : "Book via WhatsApp"} ↗</Text>
      </Pressable>

      {/* 🔒 Lock details modal */}
      {activeLock && (
        <Modal
          visible={lockModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setLockModalVisible(false)}
        >
          <Pressable
            style={hnStyles.lockOverlay}
            onPress={() => setLockModalVisible(false)}
          >
            <Pressable style={hnStyles.lockSheet} onPress={() => {}}>
              <View style={hnStyles.lockSheetHandle} />
              <Text style={hnStyles.lockSheetTitle}>
                🔒 {isAr ? "السعر محجوز مؤقتاً" : "Price Hold Active"}
              </Text>
              <View style={hnStyles.lockCountdownBox}>
                <Text style={hnStyles.lockCountdownNum}>{lockCountdown}</Text>
                <Text style={hnStyles.lockCountdownLbl}>
                  {isAr ? "متبقٍ قبل انتهاء الحجز المؤقت" : "remaining on your price hold"}
                </Text>
              </View>
              <View style={hnStyles.lockDetailRow}>
                <Text style={hnStyles.lockDetailKey}>{isAr ? "الفندق" : "Hotel"}</Text>
                <Text style={hnStyles.lockDetailVal} numberOfLines={2}>{activeLock.hotelName || "—"}</Text>
              </View>
              {activeLock.roomName ? (
                <View style={hnStyles.lockDetailRow}>
                  <Text style={hnStyles.lockDetailKey}>{isAr ? "الغرفة" : "Room"}</Text>
                  <Text style={hnStyles.lockDetailVal} numberOfLines={1}>{activeLock.roomName}</Text>
                </View>
              ) : null}
              <View style={hnStyles.lockDetailRow}>
                <Text style={hnStyles.lockDetailKey}>{isAr ? "الوصول" : "Check-in"}</Text>
                <Text style={hnStyles.lockDetailVal}>{activeLock.checkin || "—"}</Text>
              </View>
              <View style={hnStyles.lockDetailRow}>
                <Text style={hnStyles.lockDetailKey}>{isAr ? "المغادرة" : "Check-out"}</Text>
                <Text style={hnStyles.lockDetailVal}>{activeLock.checkout || "—"}</Text>
              </View>
              {activeLock.lockedPriceKwd ? (
                <View style={hnStyles.lockDetailRow}>
                  <Text style={hnStyles.lockDetailKey}>{isAr ? "السعر المحجوز" : "Locked price"}</Text>
                  <Text style={[hnStyles.lockDetailVal, { color: "#D4AF37", fontFamily: "Inter_700Bold" }]}>
                    KWD {parseFloat(activeLock.lockedPriceKwd).toFixed(3)}
                  </Text>
                </View>
              ) : null}
              <Pressable
                style={({ pressed }) => [hnStyles.lockGoToAccount, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  setLockModalVisible(false);
                  onNavigateToLocks?.();
                }}
              >
                <Text style={hnStyles.lockGoToAccountTxt}>
                  {isAr ? "📋 عرض في حسابي" : "📋 View in My Account"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setLockModalVisible(false)}
                style={hnStyles.lockDismiss}
              >
                <Text style={hnStyles.lockDismissTxt}>{isAr ? "إغلاق" : "Close"}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const hnStyles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(212,175,55,0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.22)",
    padding: 13,
    marginTop: 10,
    gap: 10,
  },
  headerRow: { gap: 3 },
  headerTitle: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontFamily: "Inter_400Regular" },
  divider: { height: 1, backgroundColor: "rgba(212,175,55,0.15)" },
  rowDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginVertical: 6 },
  hotelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hotelRowName: { color: "#e8e8e8", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  stars: { color: GOLD, fontSize: 11, letterSpacing: 0.5 },
  ppnAmt: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  ppnLbl: { color: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "Inter_400Regular" },
  rowTotal: { color: GOLD, fontSize: 12, fontFamily: "Inter_700Bold" },
  depositRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "rgba(212,175,55,0.09)", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, gap: 8,
  },
  depositTopLbl: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_500Medium" },
  depositSubLbl: { color: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  depositAmt: { color: GOLD, fontSize: 14, fontFamily: "Inter_700Bold" },
  waSmallBtn: {
    borderWidth: 1,
    borderColor: "rgba(37,211,102,0.4)",
    borderRadius: 7,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(37,211,102,0.07)",
  },
  waSmallBtnTxt: { color: "#4cd97b", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  loadingText: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "Inter_400Regular" },
  notFoundText: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  notFoundSub: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  // ── Price lock badge ──────────────────────────────────────────────────────
  lockBadge: {
    backgroundColor: "rgba(30,58,138,0.7)",
    borderWidth: 1.5,
    borderColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 3,
  },
  lockBadgeTxt: { color: "#93c5fd", fontSize: 13, fontFamily: "Inter_700Bold" },
  lockBadgeSub: { color: "rgba(147,197,253,0.6)", fontSize: 11, fontFamily: "Inter_400Regular" },
  // ── Lock details bottom-sheet modal ───────────────────────────────────────
  lockOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  lockSheet: {
    backgroundColor: "#0f2040",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingTop: 12,
    gap: 12,
  },
  lockSheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 8,
  },
  lockSheetTitle: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  lockCountdownBox: {
    backgroundColor: "rgba(59,130,246,0.12)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.3)",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 4,
  },
  lockCountdownNum: { color: "#60a5fa", fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  lockCountdownLbl: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  lockDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  lockDetailKey: { color: "rgba(255,255,255,0.45)", fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  lockDetailVal: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold", flex: 2, textAlign: "right" },
  lockGoToAccount: {
    backgroundColor: "#003580",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  lockGoToAccountTxt: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  lockDismiss: { alignItems: "center", paddingVertical: 8 },
  lockDismissTxt: { color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: "Inter_400Regular" },
});

/* ═══════════════════════════════════════════════════════════════════════════
   PackageBookingSection — shown when AI sends both FLIGHT + HOTEL
   ───────────────────────────────────────────────────────────── */
function calcNightsNative(checkin: string, checkout: string): number {
  if (!checkin || !checkout) return 0;
  const d1 = new Date(checkin).getTime();
  const d2 = new Date(checkout).getTime();
  if (isNaN(d1) || isNaN(d2)) return 0;
  return Math.max(0, Math.round((d2 - d1) / 86400000));
}

function PackageBookingSection({
  flightToken,
  hotelParams,
  apiBase,
  isAr,
  openInApp,
  deviceId,
  onAnotherOption,
}: {
  flightToken: string;
  hotelParams: { city: string; checkin: string; checkout: string; stars?: number; breakfast?: boolean };
  apiBase: string;
  isAr: boolean;
  openInApp: (url: string) => void;
  deviceId: string;
  onAnotherOption?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const parts = flightToken.split("|");
  const [fromIATA, fromLabel, toIATA, toLabel, dep, ret, adultsStr, preferredAirline, roomsStr] = parts;
  const adults = adultsStr ?? "1";
  // rooms: use token value if present, else derive: 1 room per 2 adults (rounded up), min 1
  const rooms = Math.max(1, parseInt(roomsStr ?? "") || Math.ceil((parseInt(adults) || 1) / 2));
  const isRoundTrip = !!ret;
  const nights = calcNightsNative(hotelParams.checkin, hotelParams.checkout);

  const [flightTotal, setFlightTotal] = useState<number | null>(null);
  const [hotelTotal, setHotelTotal] = useState<number | null>(null);
  const [priceCur, setPriceCur] = useState("KWD");
  const [selectedFlight, setSelectedFlight] = useState<{ airline: string; dep: string; arr: string; dur: string; stops: number; retDep?: string; retArr?: string } | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<{ name: string; breakfast?: boolean; bookUrl?: string; stars?: number; pricePerNight?: number } | null>(null);
  const [hotelModalVisible, setHotelModalVisible] = useState(false);
  const [flightModalVisible, setFlightModalVisible] = useState(false);
  const [flightBlocked, setFlightBlocked] = useState(false);
  const hasFetched = useRef(false);
  const checkoutStarted = useRef(false);

  const fireCheckoutStart = useCallback(() => {
    if (checkoutStarted.current) return;
    checkoutStarted.current = true;
    fetch(`${apiBase}/checkout/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, destination: toLabel ?? toIATA ?? "" }),
    }).catch(() => {});
  }, [apiBase, deviceId, toLabel, toIATA]);

  const fireCheckoutComplete = useCallback(() => {
    fetch(`${apiBase}/checkout/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    }).catch(() => {});
  }, [apiBase, deviceId]);

  const [showModal, setShowModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [passportFirst, setPassportFirst] = useState("");
  const [passportLast, setPassportLast] = useState("");
  const [passportNo, setPassportNo] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showTnC, setShowTnC] = useState(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const flParams = new URLSearchParams({ origin: fromIATA ?? "KWI", destination: toIATA ?? "", departure: dep ?? "", adults });
    if (ret) flParams.set("return", ret);

    const outboundPromise = fetch(`${apiBase}/flights?${flParams}`, { headers: { "x-device-id": deviceId } })
      .then(async (r) => {
        const data: any = await r.json();
        if (r.status === 429 || data?.quota_exceeded) {
          setFlightBlocked(true);
          setFlightTotal(0);
          return null;
        }
        if (data.flights && data.flights.length > 0) {
          const pref = (preferredAirline ?? "").trim().toLowerCase();
          const sorted = [...data.flights].sort((a: any, b: any) => {
            if (pref) {
              const aMatch = (a.airline ?? "").toLowerCase().includes(pref) || (a.airlineCode ?? "").toLowerCase() === pref;
              const bMatch = (b.airline ?? "").toLowerCase().includes(pref) || (b.airlineCode ?? "").toLowerCase() === pref;
              if (aMatch && !bMatch) return -1;
              if (!aMatch && bMatch) return 1;
            }
            return parseFloat(a.price) - parseFloat(b.price);
          });
          const selected = sorted[0];
          setFlightTotal(parseFloat(selected.price) || 0);
          setPriceCur(selected.currency ?? "KWD");
          return {
            airline: selected.airline ?? selected.airlineCode ?? "",
            dep: selected.departure ?? "",
            arr: selected.arrival ?? "",
            dur: selected.duration ?? "",
            stops: (selected.stops as number) ?? 0,
          };
        }
        setFlightTotal(0);
        return null;
      })
      .catch(() => { setFlightTotal(0); return null; });

    // Set selectedFlight as soon as the outbound resolves — don't wait for the return leg
    outboundPromise.then((outbound) => { if (outbound) setSelectedFlight(outbound); });

    if (isRoundTrip && ret && toIATA && fromIATA) {
      const retParams = new URLSearchParams({ origin: toIATA, destination: fromIATA, departure: ret, adults });
      fetch(`${apiBase}/flights?${retParams}`, { headers: { "x-device-id": deviceId } })
        .then((r) => r.json())
        .then((data: any) => {
          if (data.flights && data.flights.length > 0) {
            const cheap = [...data.flights].sort((a: any, b: any) => parseFloat(a.price) - parseFloat(b.price))[0];
            return { dep: cheap.departure ?? "", arr: cheap.arrival ?? "", price: parseFloat(cheap.price) || 0 };
          }
          return null;
        })
        .catch(() => null)
        .then((retFlight) => {
          if (retFlight) {
            // Patch in the return leg times once the second search resolves.
            // NOTE: We do NOT add retFlight.price to flightTotal here because
            // the outbound search was already called with returnDate, so
            // sky-scrapper already returned the full round-trip total price.
            setSelectedFlight((prev) => prev ? { ...prev, retDep: retFlight.dep, retArr: retFlight.arr } : prev);
          }
        });
    }

    if (hotelParams.checkin) {
      fetch(`${apiBase}/hotel-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: hotelParams.city, checkin: hotelParams.checkin, checkout: hotelParams.checkout, stars: hotelParams.stars ?? 0, adults: parseInt(adults) || 1, rooms }),
      })
        .then((r) => r.json())
        .then((data: any) => {
          if (data.ok && data.hotels && data.hotels.length > 0) {
            const cheap = [...data.hotels].sort((a: any, b: any) => parseFloat(a.price) - parseFloat(b.price))[0];
            const perRoomPerNight = parseFloat(cheap.price) || 0;
            setSelectedHotel({ name: cheap.name ?? hotelParams.city, breakfast: hotelParams.breakfast, bookUrl: cheap.bookUrl, stars: cheap.stars, pricePerNight: perRoomPerNight * rooms });
            setHotelTotal(perRoomPerNight * rooms * nights);
          } else { setHotelTotal(0); }
        })
        .catch(() => setHotelTotal(0));
    } else { setHotelTotal(0); }
  }, []);

  const priceLoading = flightTotal === null || hotelTotal === null;
  const grandTotal = (flightTotal ?? 0) + (hotelTotal ?? 0);
  const hasPrice = !priceLoading && grandTotal > 0;

  const [loadingElapsed, setLoadingElapsed] = useState(0);
  useEffect(() => {
    if (!priceLoading) { setLoadingElapsed(0); return; }
    setLoadingElapsed(0);
    const t = setInterval(() => setLoadingElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [priceLoading]);
  const deposit = hasPrice ? (grandTotal * BOOKING_RULES.packageDeposit.rate).toFixed(3) : null;
  const tripType = isRoundTrip ? (isAr ? "ذهاب وعودة" : "Round Trip") : (isAr ? "ذهاب فقط" : "One Way");

  const handleBooking = async () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      setSubmitError(isAr ? "الاسم ورقم الهاتف مطلوبان" : "Name and phone are required");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const requestId = "DAT-" + Date.now().toString(36).toUpperCase();
      const total = grandTotal > 0 ? grandTotal.toFixed(3) : "1.000";
      const r = await fetch(`${apiBase}/upayment/create-charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalKWD: total, requestId,
          contactName: contactName.trim(), contactPhone: contactPhone.trim(),
          passportFirst: passportFirst.trim(), passportLast: passportLast.trim(), passportNo: passportNo.trim(),
          flightFrom: fromLabel ?? fromIATA ?? "", flightTo: toLabel ?? toIATA ?? "",
          dep: dep ?? "", ret: ret ?? "",
          airline: selectedFlight?.airline ?? "",
          flightDepTime: selectedFlight?.dep ?? "",
          flightArrTime: selectedFlight?.arr ?? "",
          flightDur: selectedFlight?.dur ?? "",
          retDepTime: selectedFlight?.retDep ?? "",
          retArrTime: selectedFlight?.retArr ?? "",
          hotelCity: hotelParams.city, hotelName: selectedHotel?.name ?? hotelParams.city,
          checkin: hotelParams.checkin, checkout: hotelParams.checkout,
          hotelStars: hotelParams.stars ?? 0,
          breakfast: hotelParams.breakfast ? "yes" : "no",
          adults, rooms: String(rooms), notes: notes.trim(), cur: priceCur,
        }),
      });
      const data = await r.json() as { ok: boolean; url?: string; error?: string };
      if (data.ok && data.url) { setShowModal(false); openInApp(data.url); }
      else { setSubmitError(data.error || (isAr ? "فشل الدفع. حاول مرة ثانية." : "Payment failed. Try again.")); }
    } catch { setSubmitError(isAr ? "تعذر الاتصال. تحقق من الإنترنت." : "Connection error. Check internet."); }
    finally { setSubmitting(false); }
  };

  return (
    <View style={pkgStyles.wrap}>
      <View style={pkgStyles.header}>
        <Text style={pkgStyles.headerIcon}>📦</Text>
        <Text style={pkgStyles.headerTxt}>{isAr ? "باقة متكاملة: طيران + فندق" : "Complete Package: Flight + Hotel"}</Text>
      </View>

      {[
        [isAr ? "الوجهة" : "Route", `${fromLabel ?? fromIATA} ${isRoundTrip ? "↔" : "→"} ${toLabel ?? toIATA}`],
        [isAr ? "النوع" : "Type", tripType],
        [isAr ? "التاريخ" : "Date", `${dep ?? ""}${ret ? ` → ${ret}` : ""}`],
        [isAr ? "المسافرون" : "Passengers", `${adults} ${isAr ? (parseInt(adults) === 1 ? "راشد" : "راشدون") : (parseInt(adults) === 1 ? "Adult" : "Adults")}`],
      ].map(([lbl, val]) => (
        <View key={lbl} style={pkgStyles.infoRow}>
          <Text style={pkgStyles.infoLabel}>{lbl}</Text>
          <Text style={pkgStyles.infoVal}>{val}</Text>
        </View>
      ))}

      {/* Flight details */}
      <View style={pkgStyles.detailSection}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <Text style={pkgStyles.detailSectionTitle}>✈️ {isAr ? "تفاصيل الطيران" : "Flight Details"}</Text>
          {selectedFlight && (
            <Pressable onPress={() => setFlightModalVisible(true)}>
              <Text style={{ color: GOLD, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
                {isAr ? "عرض التفاصيل ←" : "View Details →"}
              </Text>
            </Pressable>
          )}
        </View>
        {selectedFlight ? (
          <>
            <View style={pkgStyles.infoRow}>
              <Text style={pkgStyles.infoLabel}>{isAr ? "شركة الطيران" : "Airline"}</Text>
              <Text style={pkgStyles.infoVal}>{selectedFlight.airline}</Text>
            </View>
            <View style={pkgStyles.infoRow}>
              <Text style={pkgStyles.infoLabel}>{isAr ? "ذهاب" : "Outbound"}</Text>
              <Text style={pkgStyles.infoVal}>{fromLabel ?? fromIATA}  {selectedFlight.dep} → {selectedFlight.arr}  {toLabel ?? toIATA}</Text>
            </View>
            {isRoundTrip && (
              <View style={pkgStyles.infoRow}>
                <Text style={pkgStyles.infoLabel}>{isAr ? "عودة" : "Return"}</Text>
                <Text style={pkgStyles.infoVal}>
                  {selectedFlight.retDep && selectedFlight.retArr
                    ? `${toLabel ?? toIATA}  ${selectedFlight.retDep} → ${selectedFlight.retArr}  ${fromLabel ?? fromIATA}`
                    : `${toLabel ?? toIATA} → ${fromLabel ?? fromIATA}${ret ? `  (${ret})` : ""}`}
                </Text>
              </View>
            )}
            {selectedFlight.dur ? (
              <View style={pkgStyles.infoRow}>
                <Text style={pkgStyles.infoLabel}>{isAr ? "مدة الرحلة" : "Duration"}</Text>
                <Text style={pkgStyles.infoVal}>{selectedFlight.dur}</Text>
              </View>
            ) : null}
            <View style={pkgStyles.infoRow}>
              <Text style={pkgStyles.infoLabel}>{isAr ? "نوع الرحلة" : "Flight Type"}</Text>
              <Text style={[pkgStyles.infoVal, { color: selectedFlight.stops === 0 ? "#4CAF50" : "#FFB300" }]}>
                {selectedFlight.stops === 0
                  ? (isAr ? "رحلة مباشرة ✅" : "Direct Flight ✅")
                  : `${selectedFlight.stops} ${isAr ? (selectedFlight.stops === 1 ? "توقف" : "توقفات") : (selectedFlight.stops === 1 ? "Stop" : "Stops")}`}
              </Text>
            </View>
          </>
        ) : flightBlocked ? (
          <View style={{ gap: 10, alignItems: "center", paddingVertical: 8 }}>
            <Text style={{ fontSize: 22 }}>🚫</Text>
            <Text style={{ color: "#FF6B6B", fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "center", lineHeight: 22 }}>
              {isAr ? "عذراً، لقد نفدت محاولات البحث المتاحة لباقتك اليوم" : "You've reached your daily flight search limit"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 }}>
              {isAr ? "تواصل معنا وسنساعدك في إيجاد أفضل الأسعار" : "Contact us and we'll find the best prices for you"}
            </Text>
            <Pressable
              style={({ pressed }) => [pkgStyles.hotelModalBtn, { backgroundColor: "#25D366", marginTop: 4 }, pressed && { opacity: 0.8 }]}
              onPress={() => {
                const msg = isAr
                  ? `السلام عليكم، أرغب في الاستعلام عن رحلة من ${fromLabel ?? fromIATA} إلى ${toLabel ?? toIATA} بتاريخ ${dep ?? ""} لـ ${adults} أشخاص`
                  : `Assalamu Alaikum, I'd like to enquire about a flight from ${fromLabel ?? fromIATA} to ${toLabel ?? toIATA} on ${dep ?? ""} for ${adults} passengers`;
                Linking.openURL(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`);
              }}
            >
              <Text style={pkgStyles.hotelModalBtnTxt}>💬 {isAr ? "تواصل معنا عبر واتساب" : "Contact us via WhatsApp"}</Text>
            </Pressable>
          </View>
        ) : flightTotal === 0 ? (
          <View style={{ gap: 10, alignItems: "center", paddingVertical: 8 }}>
            <Text style={{ fontSize: 22 }}>✈️</Text>
            <Text style={{ color: "#FF6B6B", fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "center", lineHeight: 22 }}>
              {isAr ? "لا توجد رحلات متاحة بهذا التاريخ في نظامنا" : "No flights available for this date in our system"}
            </Text>
            <Pressable
              style={({ pressed }) => [{
                alignSelf: "center",
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "transparent",
                borderWidth: 1,
                borderColor: "#25D366",
                borderRadius: 20,
                paddingVertical: 6,
                paddingHorizontal: 16,
                marginTop: 6,
                gap: 6,
                opacity: pressed ? 0.7 : 1,
              }]}
              onPress={() => {
                const msg = isAr
                  ? `السلام عليكم، أرغب في الاستعلام عن رحلة من ${fromLabel ?? fromIATA} إلى ${toLabel ?? toIATA} بتاريخ ${dep ?? ""} لـ ${adults} أشخاص`
                  : `Assalamu Alaikum, I'd like to enquire about a flight from ${fromLabel ?? fromIATA} to ${toLabel ?? toIATA} on ${dep ?? ""} for ${adults} passengers`;
                Linking.openURL(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`);
              }}
            >
              <Text style={{ fontSize: 13 }}>💬</Text>
              <Text style={{ color: "#25D366", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                {isAr ? "تواصل معنا للمساعدة" : "Contact us for help"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={pkgStyles.infoRow}>
            <Text style={pkgStyles.infoLabel}>{isAr ? "الرحلة" : "Flight"}</Text>
            <Text style={pkgStyles.infoVal}>{fromLabel ?? fromIATA} → {toLabel ?? toIATA}</Text>
          </View>
        )}
      </View>

      {/* Flight detail modal */}
      <Modal visible={flightModalVisible} transparent animationType="slide" onRequestClose={() => setFlightModalVisible(false)}>
        <Pressable style={pkgStyles.modalOverlay} onPress={() => setFlightModalVisible(false)}>
          <Pressable style={[pkgStyles.hotelModalSheet, { paddingBottom: 28 + insets.bottom }]} onPress={() => {}}>
            <View style={pkgStyles.hotelModalHandle} />
            <Text style={pkgStyles.hotelModalTitle}>✈️ {isAr ? "تفاصيل الرحلة" : "Flight Details"}</Text>
            {selectedFlight && (() => {
              const stopsLabel = selectedFlight.stops === 0
                ? (isAr ? "رحلة مباشرة ✅" : "Direct Flight ✅")
                : `${selectedFlight.stops} ${isAr ? (selectedFlight.stops === 1 ? "توقف" : "توقفات") : (selectedFlight.stops === 1 ? "Stop" : "Stops")}`;
              const rows: [string, string][] = [
                [isAr ? "شركة الطيران" : "Airline", selectedFlight.airline],
                [isAr ? "ذهاب" : "Outbound", `${fromLabel ?? fromIATA}  ${selectedFlight.dep} → ${selectedFlight.arr}  ${toLabel ?? toIATA}`],
                ...(isRoundTrip ? [[isAr ? "عودة" : "Return", selectedFlight.retDep && selectedFlight.retArr
                  ? `${toLabel ?? toIATA}  ${selectedFlight.retDep} → ${selectedFlight.retArr}  ${fromLabel ?? fromIATA}`
                  : `${toLabel ?? toIATA} → ${fromLabel ?? fromIATA}${ret ? `  (${ret})` : ""}`] as [string, string]] : []),
                [isAr ? "مدة الرحلة" : "Duration", selectedFlight.dur],
                [isAr ? "نوع الرحلة" : "Flight Type", stopsLabel],
              ];
              return rows.map(([lbl, val]) => (
                <View key={lbl} style={pkgStyles.hotelModalRow}>
                  <Text style={pkgStyles.hotelModalLbl}>{lbl}</Text>
                  <Text style={[pkgStyles.hotelModalVal, val.includes("✅") ? { color: "#4CAF50" } : {}]}>{val}</Text>
                </View>
              ));
            })()}
            <Pressable style={pkgStyles.hotelModalClose} onPress={() => setFlightModalVisible(false)}>
              <Text style={pkgStyles.hotelModalCloseTxt}>{isAr ? "إغلاق" : "Close"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Hotel detail modal */}
      <Modal visible={hotelModalVisible} transparent animationType="slide" onRequestClose={() => setHotelModalVisible(false)}>
        <Pressable style={pkgStyles.modalOverlay} onPress={() => setHotelModalVisible(false)}>
          <Pressable style={[pkgStyles.hotelModalSheet, { paddingBottom: 28 + insets.bottom }]} onPress={() => {}}>
            <View style={pkgStyles.hotelModalHandle} />
            <Text style={pkgStyles.hotelModalTitle}>
              {selectedHotel?.name ?? hotelParams.city}
            </Text>
            {(selectedHotel?.stars ?? 0) > 0 && (
              <Text style={pkgStyles.hotelModalStars}>{"★".repeat(selectedHotel!.stars!)}</Text>
            )}
            {[
              [isAr ? "المدينة" : "City", hotelParams.city],
              [isAr ? "تسجيل الوصول" : "Check-in", hotelParams.checkin],
              [isAr ? "تسجيل المغادرة" : "Check-out", hotelParams.checkout],
              [isAr ? "عدد الليالي" : "Nights", String(nights)],
              [isAr ? "المسافرون" : "Guests", `${adults} ${isAr ? (parseInt(adults) === 1 ? "راشد" : "راشدون") : (parseInt(adults) === 1 ? "Adult" : "Adults")}`],
              [isAr ? "نوع الغرفة" : "Room Type", isAr ? `غرفة قياسية × ${rooms}` : `Standard Room × ${rooms}`],
              [isAr ? "الإفطار" : "Breakfast", selectedHotel?.breakfast ? (isAr ? "يشمل الإفطار ✅" : "Included ✅") : (isAr ? "غير مشمول ❌" : "Not included ❌")],
              ...(selectedHotel?.pricePerNight ? [[isAr ? "السعر / ليلة" : "Price / night", `${priceCur} ${selectedHotel.pricePerNight.toFixed(3)}`]] : []),
              ...(hotelTotal ? [[isAr ? "إجمالي الإقامة" : "Stay total", `${priceCur} ${(hotelTotal).toFixed(3)}`]] : []),
            ].map(([lbl, val]) => (
              <View key={lbl} style={pkgStyles.hotelModalRow}>
                <Text style={pkgStyles.hotelModalLbl}>{lbl}</Text>
                <Text style={pkgStyles.hotelModalVal}>{val}</Text>
              </View>
            ))}
            <View style={{ paddingHorizontal: 6, paddingVertical: 6, backgroundColor: "rgba(212,175,55,0.08)", borderRadius: 8, marginTop: 4, marginBottom: 8 }}>
              <Text style={{ color: "rgba(212,175,55,0.8)", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: isAr ? "right" : "left", lineHeight: 17 }}>
                ⚠️ {isAr ? "نوع الغرفة سيتم تأكيده عند إتمام الحجز مع فريقنا" : "Room type will be confirmed upon final booking with our team"}
              </Text>
            </View>
            {selectedHotel?.bookUrl ? (
              <Pressable
                style={({ pressed }) => [pkgStyles.hotelModalBtn, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  setHotelModalVisible(false);
                  let url = selectedHotel!.bookUrl!;
                  try {
                    const u = new URL(url);
                    u.searchParams.set("checkin", hotelParams.checkin);
                    u.searchParams.set("checkout", hotelParams.checkout);
                    u.searchParams.set("group_adults", adults);
                    u.searchParams.set("no_rooms", String(rooms));
                    url = u.toString();
                  } catch {
                    const sep = url.includes("?") ? "&" : "?";
                    url = `${url}${sep}checkin=${hotelParams.checkin}&checkout=${hotelParams.checkout}&group_adults=${adults}&no_rooms=${rooms}`;
                  }
                  openInApp(url);
                }}
              >
                <Text style={pkgStyles.hotelModalBtnTxt}>{isAr ? "🔍 عرض الغرف والتفاصيل" : "🔍 View Rooms & Details"}</Text>
              </Pressable>
            ) : null}
            <Pressable style={pkgStyles.hotelModalClose} onPress={() => setHotelModalVisible(false)}>
              <Text style={pkgStyles.hotelModalCloseTxt}>{isAr ? "إغلاق" : "Close"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Hotel details */}
      <View style={pkgStyles.detailSection}>
        <Text style={pkgStyles.detailSectionTitle}>🏨 {isAr ? "تفاصيل الفندق" : "Hotel Details"}</Text>
        {hotelTotal === 0 ? (
          <View style={{ gap: 10, alignItems: "center", paddingVertical: 8 }}>
            <Text style={{ fontSize: 22 }}>🏨</Text>
            <Text style={{ color: "#FF6B6B", fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "center", lineHeight: 22 }}>
              {isAr ? "لا توجد فنادق متاحة بهذا التاريخ في نظامنا" : "No hotels available for these dates in our system"}
            </Text>
            <Pressable
              style={({ pressed }) => [{
                alignSelf: "center",
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "transparent",
                borderWidth: 1,
                borderColor: "#25D366",
                borderRadius: 20,
                paddingVertical: 6,
                paddingHorizontal: 16,
                marginTop: 6,
                gap: 6,
                opacity: pressed ? 0.7 : 1,
              }]}
              onPress={() => {
                const msg = isAr
                  ? `السلام عليكم، أرغب في الاستعلام عن فندق في ${hotelParams.city} من ${hotelParams.checkin} إلى ${hotelParams.checkout} لـ ${adults} أشخاص${rooms > 1 ? `، عدد الغرف: ${rooms}` : ""}`
                  : `Assalamu Alaikum, I'd like to enquire about a hotel in ${hotelParams.city} from ${hotelParams.checkin} to ${hotelParams.checkout} for ${adults} guests${rooms > 1 ? `, ${rooms} rooms` : ""}`;
                Linking.openURL(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`);
              }}
            >
              <Text style={{ fontSize: 13 }}>💬</Text>
              <Text style={{ color: "#25D366", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                {isAr ? "تواصل معنا للمساعدة" : "Contact us for help"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={pkgStyles.infoRow}>
              <Text style={pkgStyles.infoLabel}>{isAr ? "الفندق" : "Hotel"}</Text>
              <Pressable onPress={() => selectedHotel && setHotelModalVisible(true)}>
                <Text style={[pkgStyles.infoVal, selectedHotel ? { color: "#22C55E", textDecorationLine: "underline" } : {}]}>
                  {selectedHotel ? selectedHotel.name : `${hotelParams.city}${hotelParams.stars ? ` ${hotelParams.stars}★` : ""}`}
                </Text>
              </Pressable>
            </View>
            <View style={pkgStyles.infoRow}>
              <Text style={pkgStyles.infoLabel}>{isAr ? "المدة" : "Duration"}</Text>
              <Text style={pkgStyles.infoVal}>{nights} {isAr ? "ليلة" : "nights"}{hotelParams.stars ? ` · ${hotelParams.stars}★` : ""}</Text>
            </View>
            <View style={pkgStyles.infoRow}>
              <Text style={pkgStyles.infoLabel}>{isAr ? "نوع الغرفة" : "Room Type"}</Text>
              <Text style={pkgStyles.infoVal}>
                {isAr ? `غرفة قياسية × ${rooms}` : `Standard Room × ${rooms}`}
              </Text>
            </View>
            <View style={{ paddingHorizontal: 4, paddingVertical: 4, backgroundColor: "rgba(212,175,55,0.08)", borderRadius: 6, marginTop: 2, marginBottom: 4 }}>
              <Text style={{ color: "rgba(212,175,55,0.75)", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: isAr ? "right" : "left", lineHeight: 16 }}>
                ⚠️ {isAr ? "نوع الغرفة سيتم تأكيده عند إتمام الحجز مع فريقنا" : "Room type will be confirmed upon final booking with our team"}
              </Text>
            </View>
            <View style={pkgStyles.infoRow}>
              <Text style={pkgStyles.infoLabel}>{isAr ? "الإفطار" : "Breakfast"}</Text>
              {selectedHotel && (selectedHotel as any).breakfast ? (
                <Text style={[pkgStyles.infoVal, { color: "#4CAF50" }]}>{isAr ? "يشمل الإفطار" : "Breakfast Included"}</Text>
              ) : (
                <Text style={[pkgStyles.infoVal, { color: "#FF5252" }]}>{isAr ? "غرفة بدون إفطار" : "Room Only"}</Text>
              )}
            </View>
          </>
        )}
      </View>

      <View style={pkgStyles.priceBox}>
        {priceLoading ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <ActivityIndicator size="small" color={GOLD} />
            <Text style={pkgStyles.priceLoading}>
              {isAr ? `جاري احتساب السعر... (${loadingElapsed}ث)` : `Calculating price... (${loadingElapsed}s)`}
            </Text>
          </View>
        ) : (
          <>
            {(flightTotal ?? 0) > 0 && (
              <View style={pkgStyles.priceRow}>
                <Text style={pkgStyles.priceLbl}>✈️ {isAr ? `الطيران${isRoundTrip ? " (ذهاب وعودة)" : ""} · ${adults} ${parseInt(adults) === 1 ? "راشد" : "راشدون"}` : `Flight${isRoundTrip ? " (Round Trip)" : ""} · ${adults} ${parseInt(adults) === 1 ? "Adult" : "Adults"}`}</Text>
                <Text style={pkgStyles.priceAmt}>{priceCur} {(flightTotal ?? 0).toFixed(3)}</Text>
              </View>
            )}
            {(hotelTotal ?? 0) > 0 && (
              <View style={pkgStyles.priceRow}>
                <Text style={pkgStyles.priceLbl}>🏨 {isAr ? `الفندق (${nights} ليلة${rooms > 1 ? ` · ${rooms} غرف` : ""})` : `Hotel (${nights} nights${rooms > 1 ? ` · ${rooms} rooms` : ""})`}</Text>
                <Text style={pkgStyles.priceAmt}>{priceCur} {(hotelTotal ?? 0).toFixed(3)}</Text>
              </View>
            )}
            {hasPrice ? (
              <>
                <View style={pkgStyles.priceDivider} />
                <View style={pkgStyles.priceRow}>
                  <Text style={pkgStyles.totalLbl}>{isAr ? "الإجمالي" : "Total"}</Text>
                  <Text style={pkgStyles.totalAmt}>{priceCur} {grandTotal.toFixed(3)}</Text>
                </View>
                <View style={[pkgStyles.priceRow, { backgroundColor: "rgba(212,175,55,0.1)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, marginTop: 4 }]}>
                  <Text style={pkgStyles.depositLbl}>{isAr ? `💳 العربون (${BOOKING_RULES.packageDeposit.percent}%)` : `💳 Deposit (${BOOKING_RULES.packageDeposit.percent}%)`}</Text>
                  <Text style={pkgStyles.depositAmt}>{priceCur} {deposit}</Text>
                </View>
              </>
            ) : (
              <Text style={pkgStyles.priceLoading}>{isAr ? "تواصل معنا للحصول على سعر الباقة" : "Contact us for package pricing"}</Text>
            )}
          </>
        )}
      </View>

      <Text style={pkgStyles.note}>
        {isAr ? `ادفع عربون ${BOOKING_RULES.packageDeposit.percent}% لتأكيد حجزك، والباقي يُسدَّد عند إتمام الحجز مع فريقنا` : `Pay a ${BOOKING_RULES.packageDeposit.percent}% deposit to secure your booking. Balance due upon confirmation.`}
      </Text>
      <Text style={pkgStyles.priceVaryNote}>
        ⚠️ {isAr ? "قد تتغير الأسعار بناءً على وقت التأكيد" : "The prices may vary depending on confirmation time"}
      </Text>

      <View style={pkgStyles.btnRow}>
        <Pressable style={({ pressed }) => [pkgStyles.bookBtn, pressed && { opacity: 0.85 }]} onPress={() => { setShowModal(true); fireCheckoutStart(); }}>
          <Text style={pkgStyles.bookBtnTxt}>💳 {isAr ? `احجز بعربون ${BOOKING_RULES.packageDeposit.percent}%` : `Book — ${BOOKING_RULES.packageDeposit.percent}% Deposit`}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [pkgStyles.waBtn, pressed && { opacity: 0.8 }]}
          onPress={() => {
            fireCheckoutComplete();
            const msg = isAr
              ? `السلام عليكم، أرغب في حجز باقة:\n✈️ ${fromLabel ?? fromIATA} ${isRoundTrip ? "↔" : "→"} ${toLabel ?? toIATA} · ${tripType}\n📅 ${dep ?? ""}${ret ? " → " + ret : ""}\n👥 ${adults} ${parseInt(adults) === 1 ? "راشد" : "راشدون"}\n🏨 ${hotelParams.city}${hotelParams.stars ? " " + hotelParams.stars + "⭐" : ""} · ${nights} ليلة${rooms > 1 ? ` · ${rooms} غرف` : ""}`
              : `Hello, I'd like to book a package:\n✈️ ${fromLabel ?? fromIATA} ${isRoundTrip ? "↔" : "→"} ${toLabel ?? toIATA} · ${tripType}\n📅 ${dep ?? ""}${ret ? " → " + ret : ""}\n👥 ${adults} ${parseInt(adults) === 1 ? "Adult" : "Adults"}\n🏨 ${hotelParams.city}${hotelParams.stars ? " " + hotelParams.stars + "⭐" : ""} · ${nights} nights${rooms > 1 ? ` · ${rooms} rooms` : ""}`;
            Linking.openURL(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`);
          }}
        >
          <Text style={pkgStyles.waBtnTxt}>💬</Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [pkgStyles.anotherOptionBtn, pressed && { opacity: 0.75 }]}
        onPress={onAnotherOption ?? undefined}
      >
        <Text style={pkgStyles.anotherOptionTxt}>🔄 {isAr ? "خيار آخر (سعر أعلى)" : "Another Option (Higher Budget)"}</Text>
      </Pressable>

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={pkgStyles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
            <ScrollView style={pkgStyles.modalSheet} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
              <View style={pkgStyles.modalHeader}>
                <Text style={pkgStyles.modalTitle}>{isAr ? "بيانات الحجز" : "Booking Details"}</Text>
                <Pressable onPress={() => setShowModal(false)} hitSlop={12}><Text style={{ color: "#888", fontSize: 22 }}>✕</Text></Pressable>
              </View>

              {[
                [isAr ? "الاسم الكامل *" : "Full Name *", contactName, setContactName, isAr ? "مثال: أحمد محمد" : "e.g. Ahmed Al Kuwaiti", "words", false],
                [isAr ? "رقم الهاتف *" : "Phone Number *", contactPhone, setContactPhone, "+965 XXXX XXXX", "phone-pad", false],
              ].map(([lbl, val, setter, ph, kb, _]: any) => (
                <View key={lbl}>
                  <Text style={pkgStyles.fieldLabel}>{lbl}</Text>
                  <TextInput style={pkgStyles.field} value={val} onChangeText={setter} placeholder={ph} placeholderTextColor="#555" keyboardType={kb} autoCapitalize={kb === "words" ? "words" : "none"} />
                </View>
              ))}

              <Text style={pkgStyles.sectionTitle}>{isAr ? "بيانات جواز السفر (اختياري)" : "Passport Info (optional)"}</Text>
              {[
                [isAr ? "الاسم الأول (نفس جواز السفر)" : "First Name (as in passport)", passportFirst, setPassportFirst, "FIRST NAME"],
                [isAr ? "الاسم الأخير (نفس جواز السفر)" : "Last Name (as in passport)", passportLast, setPassportLast, "LAST NAME"],
                [isAr ? "رقم جواز السفر" : "Passport Number", passportNo, setPassportNo, "A12345678"],
              ].map(([lbl, val, setter, ph]: any) => (
                <View key={lbl}>
                  <Text style={pkgStyles.fieldLabel}>{lbl}</Text>
                  <TextInput style={[pkgStyles.field, { textAlign: "left" }]} value={val} onChangeText={setter} placeholder={ph} placeholderTextColor="#555" autoCapitalize="characters" />
                </View>
              ))}

              <Text style={pkgStyles.fieldLabel}>{isAr ? "ملاحظات إضافية" : "Additional Notes"}</Text>
              <TextInput style={[pkgStyles.field, { minHeight: 60, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} placeholder={isAr ? "أي طلبات خاصة..." : "Any special requests..."} placeholderTextColor="#555" multiline />

              {hasPrice && (
                <View style={[pkgStyles.priceBox, { marginTop: 12 }]}>
                  {rooms > 1 && (
                    <View style={[pkgStyles.priceRow, { paddingBottom: 4 }]}>
                      <Text style={pkgStyles.priceLbl}>🏨 {isAr ? "عدد الغرف" : "Rooms"}</Text>
                      <Text style={[pkgStyles.priceAmt, { color: "#FFA726", fontSize: 13 }]}>{rooms} {isAr ? "غرف" : "rooms"}</Text>
                    </View>
                  )}
                  <View style={pkgStyles.priceRow}>
                    <Text style={pkgStyles.totalLbl}>{isAr ? "الإجمالي" : "Total"}</Text>
                    <Text style={pkgStyles.totalAmt}>{priceCur} {grandTotal.toFixed(3)}</Text>
                  </View>
                  <View style={[pkgStyles.priceRow, { backgroundColor: "rgba(212,175,55,0.12)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, marginTop: 4 }]}>
                    <Text style={pkgStyles.depositLbl}>{isAr ? `💳 العربون المطلوب (${BOOKING_RULES.packageDeposit.percent}%)` : `💳 Deposit Due (${BOOKING_RULES.packageDeposit.percent}%)`}</Text>
                    <Text style={pkgStyles.depositAmt}>{priceCur} {deposit}</Text>
                  </View>
                </View>
              )}

              <Text style={pkgStyles.priceVaryNote}>
                ⚠️ {isAr ? "قد تتغير الأسعار بناءً على وقت التأكيد" : "The prices may vary depending on confirmation time"}
              </Text>

              <Pressable style={pkgStyles.tncRow} onPress={() => setShowTnC(true)} hitSlop={6}>
                <Pressable
                  style={[pkgStyles.tncCheckbox, termsAccepted && pkgStyles.tncCheckboxChecked]}
                  onPress={() => setTermsAccepted(v => !v)}
                  hitSlop={10}
                >
                  {termsAccepted && <Text style={pkgStyles.tncCheckmark}>✓</Text>}
                </Pressable>
                <Text style={pkgStyles.tncBtnTxt}>📋 {isAr ? "الشروط والأحكام" : "Terms & Conditions"}</Text>
              </Pressable>

              {submitError ? <Text style={{ color: "#FF5252", fontSize: 13, textAlign: "center", marginTop: 10 }}>{submitError}</Text> : null}

              <Pressable
                style={({ pressed }) => [
                  pkgStyles.bookBtn,
                  { marginTop: 12, backgroundColor: termsAccepted ? "#1A7F3C" : "#1B3A6B" },
                  pressed && { opacity: 0.85 },
                  (!termsAccepted || submitting) && { opacity: 0.6 },
                ]}
                onPress={handleBooking}
                disabled={submitting || !termsAccepted}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={[pkgStyles.bookBtnTxt, { color: "#fff" }]}>{isAr ? "إحجز تجربتك الآن" : "Book Your Experience Now"}</Text>}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Terms & Conditions Modal */}
      <Modal visible={showTnC} transparent animationType="fade" onRequestClose={() => setShowTnC(false)}>
        <View style={pkgStyles.modalOverlay}>
          <View style={[pkgStyles.modalSheet, { maxHeight: "85%", paddingBottom: 24 }]}>
            <View style={pkgStyles.modalHeader}>
              <Text style={pkgStyles.modalTitle}>{isAr ? "📋 الشروط والأحكام" : "📋 Terms & Conditions"}</Text>
              <Pressable onPress={() => setShowTnC(false)} hitSlop={12}><Text style={{ color: "#888", fontSize: 22 }}>✕</Text></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              {[
                {
                  title: isAr ? "١. سياسة الإلغاء والاسترداد" : "1. Cancellation & Refund Policy",
                  body: isAr
                    ? CUSTOMER_BOOKING_GUIDANCE.packageTerms.cancellation.detailed.ar
                    : CUSTOMER_BOOKING_GUIDANCE.packageTerms.cancellation.detailed.en,
                },
                {
                  title: isAr ? "٢. تغيير الأسعار" : "2. Price Variation",
                  body: isAr
                    ? "الأسعار المعروضة هي تقديرية وقد تتغير عند التأكيد بناءً على توفر مقاعد الطيران أو غرف الفندق. تحتفظ دار التميز بحق تعديل السعر النهائي وفق أسعار السوق وقت إصدار التذاكر."
                    : "Prices shown are estimates and may change upon confirmation depending on airline seat and hotel room availability. Dar AlTamaiz reserves the right to adjust the final price in line with market rates at the time of ticket issuance.",
                },
                {
                  title: isAr ? "٣. دور الشركة" : "3. Agency Role",
                  body: isAr
                    ? "تعمل رحلات دار التميز بوصفها وكيلاً سياحياً ووسيطاً بين العميل وشركات الطيران والفنادق. لا تتحمل الشركة مسؤولية أي تغييرات أو تأخيرات أو إلغاءات من جانب الناقل الجوي أو مزود خدمة الإقامة."
                    : "D.T. Tours operates as a travel agent and intermediary between the client and airlines/hotels. The company is not liable for any changes, delays, or cancellations made by the carrier or accommodation provider.",
                },
                {
                  title: isAr ? "٤. متطلبات السفر" : "4. Travel Requirements",
                  body: isAr
                    ? "العميل مسؤول مسؤولية كاملة عن توفر جواز سفر ساري المفعول لمدة لا تقل عن ٦ أشهر من تاريخ السفر، وعن الحصول على جميع التأشيرات والوثائق المطلوبة للدخول إلى الوجهة المختارة."
                    : "The client is solely responsible for holding a valid passport with at least 6 months validity from the travel date, and for obtaining all required visas and entry documents for the chosen destination.",
                },
                {
                  title: isAr ? "٥. الحجز والتأكيد" : "5. Booking Confirmation",
                  body: isAr
                    ? CUSTOMER_BOOKING_GUIDANCE.packageTerms.confirmation.detailed.ar
                    : CUSTOMER_BOOKING_GUIDANCE.packageTerms.confirmation.detailed.en,
                },
                {
                  title: isAr ? "٦. القانون المنظّم" : "6. Governing Law",
                  body: isAr
                    ? "تخضع هذه الشروط والأحكام لقوانين دولة الكويت. أي نزاع ينشأ عن هذه الاتفاقية يُحسم وفق الأنظمة واللوائح المعمول بها في دولة الكويت."
                    : "These Terms & Conditions are governed by the laws of the State of Kuwait. Any disputes arising from this agreement shall be resolved in accordance with applicable regulations in Kuwait.",
                },
              ].map((item) => (
                <View key={item.title} style={pkgStyles.tncItem}>
                  <Text style={pkgStyles.tncItemTitle}>{item.title}</Text>
                  <Text style={pkgStyles.tncItemBody}>{item.body}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable style={[pkgStyles.bookBtn, { marginTop: 12, backgroundColor: "#1A7F3C" }]} onPress={() => { setTermsAccepted(true); setShowTnC(false); }}>
              <Text style={[pkgStyles.bookBtnTxt, { color: "#fff" }]}>{isAr ? "✓ فهمت وأوافق" : "✓ I Understand & Agree"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const pkgStyles = StyleSheet.create({
  wrap: { marginTop: 10, backgroundColor: "#0A0A0A", borderRadius: 14, borderWidth: 1.5, borderColor: GOLD, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#0A1628", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(212,175,55,0.25)" },
  headerIcon: { fontSize: 18 },
  headerTxt: { color: GOLD, fontSize: 13, fontFamily: "Inter_700Bold", flex: 1 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.05)" },
  infoLabel: { color: "#888", fontSize: 12, fontFamily: "Inter_400Regular" },
  infoVal: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold", textAlign: "right", flex: 1, marginLeft: 8 },
  priceBox: { margin: 12, backgroundColor: "#0f0f0f", borderRadius: 10, borderWidth: 1, borderColor: "rgba(212,175,55,0.2)", padding: 12, gap: 6 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  priceLbl: { color: "#aaa", fontSize: 12, fontFamily: "Inter_400Regular" },
  priceAmt: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  priceDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(212,175,55,0.25)", marginVertical: 4 },
  totalLbl: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  totalAmt: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  depositLbl: { color: GOLD, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  depositAmt: { color: GOLD, fontSize: 12, fontFamily: "Inter_700Bold" },
  priceLoading: { color: "#888", fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  note: { color: "#888", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 14, paddingBottom: 10, lineHeight: 16 },
  btnRow: { flexDirection: "row", gap: 8, padding: 12, paddingTop: 0 },
  bookBtn: { flex: 1, backgroundColor: GOLD, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  bookBtnTxt: { color: "#000", fontSize: 14, fontFamily: "Inter_700Bold" },
  waBtn: { backgroundColor: "#25D366", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  waBtnTxt: { fontSize: 18 },
  anotherOptionBtn: { marginHorizontal: 12, marginBottom: 12, borderRadius: 10, borderWidth: 1, borderColor: "rgba(212,175,55,0.4)", paddingVertical: 11, alignItems: "center", backgroundColor: "rgba(212,175,55,0.07)" },
  anotherOptionTxt: { color: GOLD, fontSize: 13, fontFamily: "Inter_700Bold" },
  detailSection: { marginHorizontal: 10, marginTop: 8, borderRadius: 8, borderWidth: 1, borderColor: "rgba(212,175,55,0.15)", overflow: "hidden" },
  detailSectionTitle: { color: GOLD, fontSize: 11, fontFamily: "Inter_700Bold", backgroundColor: "rgba(212,175,55,0.08)", paddingHorizontal: 12, paddingVertical: 5, textTransform: "uppercase", letterSpacing: 0.4 },
  priceVaryNote: { color: "#E53935", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 14, paddingBottom: 8, lineHeight: 16 },
  tncBtn: { marginHorizontal: 2, marginTop: 10, marginBottom: 2, borderRadius: 8, borderWidth: 1, borderColor: "rgba(212,175,55,0.35)", paddingVertical: 9, alignItems: "center", backgroundColor: "rgba(212,175,55,0.06)" },
  tncBtnTxt: { color: GOLD, fontSize: 12, fontFamily: "Inter_700Bold" },
  tncRow: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 2, marginTop: 10, marginBottom: 2, borderRadius: 8, borderWidth: 1, borderColor: "rgba(212,175,55,0.35)", paddingVertical: 9, paddingHorizontal: 12, backgroundColor: "rgba(212,175,55,0.06)" },
  tncCheckbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: GOLD, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  tncCheckboxChecked: { backgroundColor: "#1A7F3C", borderColor: "#1A7F3C" },
  tncCheckmark: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold", lineHeight: 16 },
  tncItem: { marginBottom: 14, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.08)" },
  tncItemTitle: { color: GOLD, fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 5 },
  tncItemBody: { color: "#ccc", fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 19 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#0A0A0A", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 16, maxHeight: "90%", borderTopWidth: 1, borderTopColor: "rgba(212,175,55,0.4)" },
  hotelModalSheet: { backgroundColor: "#0A0A0A", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: "rgba(212,175,55,0.4)" },
  hotelModalHandle: { width: 40, height: 4, backgroundColor: "rgba(212,175,55,0.4)", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  hotelModalTitle: { color: "#22C55E", fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 4 },
  hotelModalStars: { color: "#D4AF37", fontSize: 14, textAlign: "center", marginBottom: 12, letterSpacing: 2 },
  hotelModalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.07)" },
  hotelModalLbl: { color: "#888", fontSize: 13, fontFamily: "Inter_400Regular" },
  hotelModalVal: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "right", flex: 1, marginLeft: 8 },
  hotelModalBtn: { marginTop: 16, backgroundColor: "#1A3A6B", borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  hotelModalBtnTxt: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  hotelModalClose: { marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", paddingVertical: 11, alignItems: "center" },
  hotelModalCloseTxt: { color: "#888", fontSize: 13, fontFamily: "Inter_400Regular" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { color: GOLD, fontSize: 17, fontFamily: "Inter_700Bold" },
  sectionTitle: { color: "#888", fontSize: 11, fontFamily: "Inter_700Bold", marginTop: 14, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  fieldLabel: { color: "#ccc", fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 5, marginTop: 12 },
  field: { backgroundColor: "#111", borderRadius: 8, borderWidth: 1, borderColor: "#333", color: "#fff", fontSize: 14, fontFamily: "Inter_400Regular", paddingHorizontal: 12, paddingVertical: 10 },
});

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called when the user taps "View in My Account" from a price lock badge. */
  onNavigateToLocks?: () => void;
  /** Opens the established in-app subscription checkout from another feature. */
  subscriptionRequest?: number;
}

// hint: Logic changed on both sides. Requires understanding intent of each change.
export function ChatbotScreen({ visible, onClose, onNavigateToLocks, subscriptionRequest = 0 }: Props) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [language, setLanguage] = useState<Language | null>(null);
  const [userName, setUserName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWhatsAppBanner, setShowWhatsAppBanner] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const lockedScreenHeightRef = useRef(0);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);

  const openInApp = useCallback((url: string) => setWebViewUrl(url), []);

  // Email summary state
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailDeclined, setEmailDeclined] = useState(false);

  const [flightSearchCount, setFlightSearchCount] = useState(0);
  const [flightWindowStart, setFlightWindowStart] = useState(0);

  const [deviceFp, setDeviceFp] = useState("");
  const [chatBlocked, setChatBlocked] = useState(false);
  const [blockUntil, setBlockUntil] = useState(0);
  const [cyclesUsedToday, setCyclesUsedToday] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [promoTier, setPromoTier] = useState<string | null>(null);
  const [maxFlightSearches, setMaxFlightSearches] = useState(MAX_FLIGHT_SEARCHES);
  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState(false);
  const [blockSecondsLeft, setBlockSecondsLeft] = useState(0);
  const [itineraryBlockSeconds, setItineraryBlockSeconds] = useState(0);
  const [itineraryMaxPerDay, setItineraryMaxPerDay] = useState(2);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [lastBookingList, setLastBookingList] = useState<Array<{ index: number; orderId: string; contactName: string; contactPhone: string; flightFrom: string; flightTo: string; dep: string; ret: string; airline: string; totalKWD: string; depositKWD: string; isPaid: boolean }>>([]);
  const [welcomeCodeInput, setWelcomeCodeInput] = useState("");
  const [welcomeCodeLoading, setWelcomeCodeLoading] = useState(false);
  const [welcomeCodeError, setWelcomeCodeError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId | null>(null);
  const [subEmail, setSubEmail] = useState("");
  const [subEmailError, setSubEmailError] = useState<string | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subPayError, setSubPayError] = useState<string | null>(null);
  // Language pre-selection on welcome screen (does not navigate — Enter button does)
  const [pendingLanguage, setPendingLanguage] = useState<Language>("ar");

  useEffect(() => {
    if (subscriptionRequest > 0) setShowSubscribeModal(true);
  }, [subscriptionRequest]);

  // ── Hotel brand autocomplete suggestions ──────────────────────────────────
  type HotelSuggestItem = { type: string; name: string; subtitle: string; enQuery?: string; isBrandOnly?: boolean };
  const [hotelSuggestions, setHotelSuggestions] = useState<HotelSuggestItem[]>([]);
  // When user taps a brand-only chip, this holds the city-brand pairs for that brand
  const [brandCityChips, setBrandCityChips] = useState<HotelSuggestItem[] | null>(null);
  const [brandCityLoading, setBrandCityLoading] = useState(false);
  const [pendingBrandLabel, setPendingBrandLabel] = useState<string>("");
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonically increasing counter. Each new suggestion fetch captures the
  // current value; the result is discarded if the counter has advanced (input
  // changed, send fired, or chip was tapped) before the fetch resolves.
  const suggestGenRef = useRef(0);
  // When set, handleSend reads this ref instead of the input state (allows
  // suggestion-tap to trigger a send without a state-update race).
  const forceSendTextRef = useRef<string | null>(null);
  // When set alongside forceSendTextRef, this English enQuery is used as the
  // actual content sent to the AI (for better [HOTEL_NAME] token accuracy)
  // while forceSendTextRef provides the Arabic display text in the chat bubble.
  const forceSendEnQueryRef = useRef<string | null>(null);

  interface ActivationResult {
    tierKey: string;
    tierLabelAr: string;
    tierLabelEn: string;
    daysLeft: number;
    flightSearchesPerDay: number;
    flightSearchesRemaining: number;
  }
  const [activationResult, setActivationResult] = useState<ActivationResult | null>(null);

  const onFlightSearchConsumed = useCallback(() => {
    const now = Date.now();
    setFlightSearchCount((c) => c + 1);
    setFlightWindowStart((ws) => (ws === 0 ? now : ws));
    // Server increments atomically in /flights endpoint — no client callback needed.
  }, []);

  useEffect(() => {
    if (flightSearchCount > 0 && flightWindowStart > 0) {
      AsyncStorage.setItem(
        FLIGHT_RATE_KEY,
        JSON.stringify({ count: flightSearchCount, windowStart: flightWindowStart })
      ).catch(() => {});
    }
  }, [flightSearchCount, flightWindowStart]);

  const scrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(600)).current;
  const glowAnim  = useRef(new Animated.Value(1)).current;
  const waveAnim  = useRef(new Animated.Value(0)).current;
  const userMsgCount = useRef(0);
  const hasCheckedSession = useRef(false);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.42, duration: 1400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 1,    duration: 1400, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [glowAnim]);

  useEffect(() => {
    const wave = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, { toValue: 1,     duration: 160, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(waveAnim, { toValue: -0.55, duration: 140, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
        Animated.timing(waveAnim, { toValue: 0.9,   duration: 140, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(waveAnim, { toValue: -0.45, duration: 130, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
        Animated.timing(waveAnim, { toValue: 0.7,   duration: 130, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(waveAnim, { toValue: -0.3,  duration: 120, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
        Animated.timing(waveAnim, { toValue: 0,     duration: 180, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.delay(900),
      ])
    );
    wave.start();
    return () => wave.stop();
  }, [waveAnim]);

  const isAr = language === "ar";
  const headerSub = isAr ? "مُساعدك الشخصي للسياحة" : "Your Personal Travel Assistant";

  const tierLabel = isAdminMode
    ? (isAr ? "أدمن" : "Admin")
    : promoTier === "platinum"
      ? (isAr ? "بلاتينيوم" : "Platinum")
      : promoTier === "plus"
        ? (isAr ? "تميز بلاس" : "Tamaiz Plus")
        : isPremium
          ? (isAr ? "تميز" : "Tamaiz")
          : (isAr ? "مجاني" : "Free");

  // Use the locked height (captured when chatbot opens) on web so that
  // viewport-resize triggered by the software keyboard doesn't change the
  // base height mid-session and cause a layout jump.
  const baseHeight =
    Platform.OS === "web" && lockedScreenHeightRef.current > 0
      ? lockedScreenHeightRef.current
      : screenHeight;

  const sheetMaxHeight =
    kbHeight > 0
      ? baseHeight - kbHeight - insets.top - 8
      : baseHeight * 0.9;
  const sheetMarginBottom =
    Platform.OS === "android" || Platform.OS === "web" ? kbHeight : 0;

  // ── Keyboard listeners (Android + Web) ──
  useEffect(() => {
    if (Platform.OS === "android") {
      const show = Keyboard.addListener("keyboardDidShow", (e) => {
        setKbHeight(e.endCoordinates.height);
      });
      const hide = Keyboard.addListener("keyboardDidHide", () => {
        setKbHeight(0);
      });
      return () => {
        show.remove();
        hide.remove();
      };
    }
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const vv = window.visualViewport;
      if (!vv) return;
      const update = () => {
        // keyboard height = space between inner viewport and visual viewport
        setKbHeight(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
      };
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
      return () => {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      };
    }
  }, []);

  // ── Session load & reset on visibility ──
  useEffect(() => {
    if (visible) {
      // Capture the viewport height before the keyboard can alter it on web.
      if (Platform.OS === "web" && typeof window !== "undefined") {
        lockedScreenHeightRef.current = window.innerHeight;
      }
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
      if (!hasCheckedSession.current) {
        hasCheckedSession.current = true;
        loadSavedSession();
      }
    } else {
      hasCheckedSession.current = false;
      slideAnim.setValue(600);
      setLanguage(null);
      setUserName("");
      setNameError(false);
      setMessages([]);
      setInput("");
      setLoading(false);
      setShowWhatsAppBanner(false);
      setKbHeight(0);
      setShowEmailPrompt(false);
      setEmailInput("");
      setEmailSent(false);
      setEmailError(null);
      setEmailDeclined(false);
      setSessionLoading(false);
      setWebViewUrl(null);
      userMsgCount.current = 0;
      setChatBlocked(false);
      setBlockUntil(0);
      setCyclesUsedToday(0);
      setIsPremium(false);
      setMaxFlightSearches(MAX_FLIGHT_SEARCHES);
      setPromoInput("");
      setPromoLoading(false);
      setPromoError(null);
      setPromoSuccess(false);
      setDeviceFp("");
      setActivationResult(null);
    }
  }, [visible]);

  // ── Auto-save whenever messages or language changes ──
  useEffect(() => {
    if (language && userName.trim() && messages.length > 0) {
      const session: SavedSession = {
        messages,
        language,
        userName: userName.trim(),
        savedAt: Date.now(),
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session)).catch(() => {});
    }
  }, [messages, language, userName]);

  // ── Load saved session ──
  const loadSavedSession = useCallback(async () => {
    // Pre-warm API server immediately so it's awake before the user enters
    fetch(`${API_BASE}/healthz`).catch(() => {});
    setSessionLoading(true);
    try {
      // Prefer hardware device ID (survives app reinstalls on Android)
      let hardwareId: string | null = null;
      try {
        if (Platform.OS === "android") {
          hardwareId = Application.getAndroidId();
        } else if (Platform.OS === "ios") {
          hardwareId = await Application.getIosIdForVendorAsync();
        }
      } catch { /* hardware ID unavailable in some environments */ }

      let fp = hardwareId ?? (await AsyncStorage.getItem(DEVICE_FP_KEY));
      if (!fp) {
        fp = `fp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      }
      await AsyncStorage.setItem(DEVICE_FP_KEY, fp);
      setDeviceFp(fp);

      try {
        const sRes = await fetch(`${API_BASE}/chat/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-device-id": fp },
          body: JSON.stringify({ fingerprint: fp }),
        });
        if (sRes.ok) {
          const sData = (await sRes.json()) as SessionState & { ok: boolean };
          if (sData.blocked && sData.blockUntil) {
            setChatBlocked(true);
            setBlockUntil(sData.blockUntil);
          } else {
            // Always clear stale block state when server says we're not blocked
            setChatBlocked(false);
            setBlockUntil(0);
          }
          if (sData.cyclesUsedToday) setCyclesUsedToday(sData.cyclesUsedToday);
          if (sData.isPremium) {
            setIsPremium(true);
            setMaxFlightSearches(sData.maxFlightSearchesPerDay);
            // Sync local flight-search counter from the live DB value so
            // re-launches don't reset to 0 and misreport quota.
            if (sData.flightSearchesToday > 0) {
              setFlightSearchCount(sData.flightSearchesToday);
            }
            // Detect admin session (server stamps premiumExpiresAt far in the future)
            if (sData.premiumExpiresAt && sData.premiumExpiresAt > Date.UTC(5001, 0)) {
              setIsAdminMode(true);
            }
            // Store the specific tier (tamaiz / plus / platinum)
            if (sData.promoTier) setPromoTier(sData.promoTier);
          }
        }
      } catch {
        // Session fetch non-fatal — app works offline
      }

      const [rawSession, rawRate] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(FLIGHT_RATE_KEY),
      ]);
      if (rawSession) {
        const session = JSON.parse(rawSession) as SavedSession;
        if (Date.now() - session.savedAt < ONE_MONTH_MS) {
          setUserName(session.userName);
          setLanguage(session.language);
          setMessages(session.messages);
          userMsgCount.current = session.messages.filter((m) => m.role === "user").length;
        } else {
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      }
      if (rawRate) {
        const rate = JSON.parse(rawRate) as { count: number; windowStart: number };
        if (Date.now() - rate.windowStart < FLIGHT_RATE_WINDOW_MS) {
          setFlightSearchCount(rate.count);
          setFlightWindowStart(rate.windowStart);
        } else {
          await AsyncStorage.removeItem(FLIGHT_RATE_KEY);
        }
      }
    } catch {
      // Ignore storage errors silently
    } finally {
      setSessionLoading(false);
    }
  }, []);

  // ── Countdown timer for block screen ──
  useEffect(() => {
    if (!chatBlocked || blockUntil <= 0) { setBlockSecondsLeft(0); return; }
    const update = () => {
      const left = Math.max(0, Math.floor((blockUntil - Date.now()) / 1000));
      setBlockSecondsLeft(left);
      if (left === 0) { setChatBlocked(false); setBlockUntil(0); }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [chatBlocked, blockUntil]);

  // ── Redeem promo code ──
  const redeemPromoCode = useCallback(async () => {
    const raw = promoInput.trim();
    if (!raw || promoLoading) return;

    // ── Admin command: create_code: <key>: <tier> ──
    if (/^create_code:/i.test(raw)) {
      // Parse: create_code: KEY: TIER
      const cmdMatch = /^create_code:\s*(\S+)(?::\s*(\S+))?/i.exec(raw);
      const parsedKey = cmdMatch?.[1] ?? "";
      const validTiers = ["tamaiz", "plus", "platinum"] as const;
      type CmdTier = typeof validTiers[number];
      const parsedTierRaw = (cmdMatch?.[2] ?? "").toLowerCase();
      const parsedTier: CmdTier = (validTiers as readonly string[]).includes(parsedTierRaw)
        ? (parsedTierRaw as CmdTier)
        : "tamaiz";
      setPromoLoading(true);
      setPromoError(null);
      try {
        const res = await fetch(`${API_BASE}/chat/admin-create-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-device-id": deviceFp },
          body: JSON.stringify({ key: parsedKey, tier: parsedTier }),
        });
        const data = (await res.json()) as { ok: boolean; code?: string; tierLabel?: string; message?: string; error?: string };
        if (data.ok && data.code) {
          setPromoInput("");
          Alert.alert(
            "✅ تم إنشاء الكود",
            `كود الاشتراك الجديد:\n\n🎫 ${data.code}\n\nباقة: ${data.tierLabel ?? parsedTier}\nصالح 30 يوم من لحظة التفعيل.\nانسخه وشاركه مع المشترك.`,
            [{ text: "حسناً", style: "default" }],
          );
        } else {
          setPromoError(data.error ?? "فشل إنشاء الكود.");
        }
      } catch {
        setPromoError("تعذر الاتصال. تحقق من الإنترنت.");
      } finally {
        setPromoLoading(false);
      }
      return;
    }

    // ── Regular promo code redeem ──
    const code = raw.toUpperCase();
    setPromoLoading(true);
    setPromoError(null);
    try {
      const res = await fetch(`${API_BASE}/chat/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceFp },
        body: JSON.stringify({ fingerprint: deviceFp, code }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        expiresAt?: number;
        maxFlightSearchesPerDay?: number;
        flightSearchesToday?: number;
        flightSearchesRemaining?: number;
      };
      if (data.ok) {
        setPromoSuccess(true);
        setChatBlocked(false);
        setBlockUntil(0);
        setIsPremium(true);
        setMaxFlightSearches(data.maxFlightSearchesPerDay ?? 15);
        // Sync local counter from live DB value
        if ((data.flightSearchesToday ?? 0) > 0) {
          setFlightSearchCount(data.flightSearchesToday!);
        }
        setPromoInput("");
      } else {
        if (data.error === "invalid_code") {
          // Might be the admin key — verify server-side (key never stored client-side)
          try {
            const authRes = await fetch(`${API_BASE}/chat/admin-verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-device-id": deviceFp },
              body: JSON.stringify({ key: raw }),
            });
            const authData = (await authRes.json()) as { ok: boolean };
            if (authData.ok) {
              setAdminToken(raw);
              setIsAdminMode(true);
              setUserName("بوحسين");
              setLanguage("ar");
              setIsPremium(true);
              const greeting: Message = { id: "admin_greeting", role: "assistant", content: `هلا طال عمرك بوحسين، أمرني.\n\n${buildAdminBuildInfo()}` };
              setMessages([greeting]);
              setChatBlocked(false);
              setBlockUntil(0);
              setPromoInput("");
              setPromoError(null);
              return;
            }
          } catch { /* network error — fall through to normal error */ }
        }
        const errMap: Record<string, string> = {
          invalid_code: isAr ? "الكود غير صحيح. تأكد وحاول مرة ثانية." : "Invalid code. Please check and try again.",
          already_used: isAr ? "هذا الكود استُخدم مسبقاً." : "This code has already been used.",
          device_locked: isAr ? "تم استخدام الكود على جهاز آخر. كل باقة لها حد أجهزة." : "Code already linked to another device.",
          expired: isAr ? "انتهت صلاحية هذا الكود." : "This code has expired.",
        };
        setPromoError(errMap[data.error ?? ""] ?? (isAr ? "حدث خطأ. حاول مرة ثانية." : "Something went wrong. Try again."));
      }
    } catch {
      setPromoError(isAr ? "تعذر الاتصال. تحقق من الإنترنت." : "Connection failed. Check your internet.");
    } finally {
      setPromoLoading(false);
    }
  }, [promoInput, promoLoading, deviceFp, isAr]);

  // ── Admin: generate a tier code from inside chat ──
  const generateAdminCode = useCallback(async (tier: "tamaiz" | "plus" | "platinum") => {
    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: "جهز لي كود" };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const res = await fetch(`${API_BASE}/chat/admin-create-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceFp },
        body: JSON.stringify({ key: adminToken, tier }),
      });
      const data = (await res.json()) as { ok: boolean; code?: string; tierLabel?: string; error?: string };
      const tierLabels: Record<string, string> = { tamaiz: "تميز", plus: "تميز بلاس", platinum: "تميز بلاتينيوم" };
      const label = data.tierLabel ?? tierLabels[tier] ?? tier;
      const botMsg: Message = {
        id: `b_${Date.now()}`,
        role: "assistant",
        content: data.ok && data.code
          ? `✅ تم إنشاء كود ${label}:\n\n${data.code}\n\nصالح 30 يوم من لحظة التفعيل.`
          : `❌ فشل إنشاء الكود: ${data.error ?? "خطأ غير معروف"}`,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const botMsg: Message = { id: `b_${Date.now()}`, role: "assistant", content: "❌ تعذر الاتصال بالخادم." };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [adminToken, deviceFp]);

  // ── Welcome screen: three-pathway activation ──
  const handleWelcomeCode = useCallback(async () => {
    if (welcomeCodeLoading) return;
    const raw = welcomeCodeInput.trim();

    // ── PATHWAY 3 — Guest: empty field → proceed as visitor ──
    if (!raw) {
      const name = userName.trim();
      if (!name) { setNameError(true); return; }
      setNameError(false);
      // Explicitly wipe any cached premium state so this guest session
      // never inherits a prior subscriber's quota
      setIsPremium(false);
      setIsAdminMode(false);
      setAdminToken("");
      setMaxFlightSearches(MAX_FLIGHT_SEARCHES);
      // Remove the stored session so a future cold launch also starts clean
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      setLanguage(pendingLanguage);
      setMessages([{ id: "greeting", role: "assistant", content: buildGreeting(pendingLanguage, name) }]);
      return;
    }

    // ── PATHWAYS 1 & 2 — fire both requests in parallel to avoid cold-server delay ──
    // Admin-verify and redeem run simultaneously; admin result takes priority.
    const code = raw.toUpperCase();
    setWelcomeCodeLoading(true);
    setWelcomeCodeError(null);

    const adminPromise = fetch(`${API_BASE}/chat/admin-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceFp },
      body: JSON.stringify({ key: raw }),
    }).then((r) => r.json() as Promise<{ ok: boolean }>).catch(() => ({ ok: false }));

    const redeemPromise = fetch(`${API_BASE}/chat/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceFp },
      body: JSON.stringify({ fingerprint: deviceFp, code }),
    });

    // Check admin result first
    const authData = await adminPromise;
    if (authData.ok) {
      setAdminToken(raw);
      setIsAdminMode(true);
      setWelcomeCodeLoading(false);
      setUserName("بوحسين");
      setLanguage("ar");
      setIsPremium(true);
      const greeting: Message = { id: "admin_greeting", role: "assistant", content: `هلا طال عمرك بوحسين، أمرني.\n\n${buildAdminBuildInfo()}` };
      setMessages([greeting]);
      setChatBlocked(false);
      setBlockUntil(0);
      setWelcomeCodeInput("");
      setWelcomeCodeError(null);
      return;
    }

    // Fall through to the already-in-flight redeem result
    try {
      const res = await redeemPromise;
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        maxFlightSearchesPerDay?: number;
        tier?: string;
        expiresAt?: number;
        flightSearchesToday?: number;
        flightSearchesRemaining?: number;
      };
      if (data.ok) {
        const maxSearches = data.maxFlightSearchesPerDay ?? 15;
        const todayUsed = data.flightSearchesToday ?? 0;
        const remaining = data.flightSearchesRemaining ?? (maxSearches - todayUsed);
        setIsPremium(true);
        setMaxFlightSearches(maxSearches);
        // Sync local counter to live DB value — prevents stale local state
        setFlightSearchCount(todayUsed);
        setWelcomeCodeInput("");

        // Compute plan details for the confirmation card
        const TIER_META: Record<string, { ar: string; en: string }> = {
          tamaiz:   { ar: "تميز",           en: "TAMAIZ" },
          plus:     { ar: "تميز بلاس",      en: "TAMAIZ Plus" },
          platinum: { ar: "تميز بلاتينيوم", en: "TAMAIZ Platinum" },
        };
        const tierKey = data.tier ?? "tamaiz";
        const meta = TIER_META[tierKey] ?? { ar: "تميز", en: "TAMAIZ" };
        const daysLeft = data.expiresAt
          ? Math.max(0, Math.ceil((data.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)))
          : 30;
        setActivationResult({
          tierKey,
          tierLabelAr: meta.ar,
          tierLabelEn: meta.en,
          daysLeft,
          flightSearchesPerDay: maxSearches,
          flightSearchesRemaining: remaining,
        });
        return;
      }

      const errMap: Record<string, string> = {
        invalid_code: "الكود غير صحيح.",
        already_used: "هذا الكود استُخدم مسبقاً.",
        device_locked: "تم استخدام الكود على جهاز آخر.",
        expired: "انتهت صلاحية هذا الكود.",
      };
      setWelcomeCodeError(errMap[data.error ?? ""] ?? "حدث خطأ. حاول مرة ثانية.");
    } catch {
      setWelcomeCodeError("تعذر الاتصال. تحقق من الإنترنت.");
    } finally {
      setWelcomeCodeLoading(false);
    }
  }, [welcomeCodeInput, welcomeCodeLoading, deviceFp, userName, pendingLanguage]);

  // ── Proceed to chat after activation confirmation ──
  const proceedToChat = useCallback(() => {
    const name = userName.trim() || "ضيف";
    setActivationResult(null);
    setLanguage(pendingLanguage);
    setMessages([{ id: "greeting", role: "assistant", content: buildGreeting(pendingLanguage, name) }]);
  }, [userName, pendingLanguage]);

  // ── Subscribe modal helpers ──
  const closeSubscribeModal = useCallback(() => {
    setShowSubscribeModal(false);
    setSelectedPlanId(null);
    setSubEmail("");
    setSubEmailError(null);
    setSubPayError(null);
  }, []);

  const handleSubscribePay = useCallback(async (planId: SubscriptionPlanId) => {
    const emailTrimmed = subEmail.trim();
    if (!emailTrimmed || !emailTrimmed.includes("@")) {
      setSubEmailError(isAr ? "أدخل بريد إلكتروني صحيح" : "Enter a valid email address");
      return;
    }
    setSubEmailError(null);
    setSubLoading(true);
    setSubPayError(null);
    try {
      const res = await fetch(`${API_BASE}/subscriptions/create-charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: planId,
          userEmail: emailTrimmed,
          userName: userName || "Guest",
          language: isAr ? "ar" : "en",
        }),
      });
      const data = await res.json() as { ok: boolean; url?: string; error?: string };
      if (!data.ok || !data.url) throw new Error(data.error ?? "No payment URL");
      closeSubscribeModal();
      Linking.openURL(data.url);
    } catch {
      setSubPayError(isAr ? "فشل في إنشاء الدفع، حاول مرة أخرى." : "Payment setup failed. Please try again.");
    } finally {
      setSubLoading(false);
    }
  }, [subEmail, isAr, userName, closeSubscribeModal]);

  // ── Logout — clear session and return to welcome screen ──
  const handleLogout = useCallback(() => {
    Alert.alert(
      isAr ? "تسجيل الخروج" : "Log Out",
      isAr
        ? "هل تريد الخروج من الجلسة الحالية؟"
        : "Exit your current session and return to the start?",
      [
        { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isAr ? "خروج" : "Log Out",
          style: "destructive",
          onPress: async () => {
            // ── Server logout FIRST: wipes premiumExpiresAt + promoCodeId from DB ──
            // Without this the device fingerprint stays premium in the DB and the
            // next /chat/session call would return isPremium:true again.
            try {
              await fetch(`${API_BASE}/chat/logout`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-device-id": deviceFp },
                body: JSON.stringify({ fingerprint: deviceFp }),
              });
            } catch { /* non-fatal — local state reset still proceeds */ }

            await Promise.all([
              AsyncStorage.removeItem(STORAGE_KEY).catch(() => {}),
              AsyncStorage.removeItem(FLIGHT_RATE_KEY).catch(() => {}),
            ]);
            setLanguage(null);
            setUserName("");
            setNameError(false);
            setMessages([]);
            setInput("");
            setLoading(false);
            setShowWhatsAppBanner(false);
            setShowEmailPrompt(false);
            setEmailInput("");
            setEmailSent(false);
            setEmailError(null);
            setEmailDeclined(false);
            userMsgCount.current = 0;
            setChatBlocked(false);
            setBlockUntil(0);
            setCyclesUsedToday(0);
            setPromoInput("");
            setPromoError(null);
            setPromoSuccess(false);
            setIsPremium(false);
            setPromoTier(null);
            setIsAdminMode(false);
            setMaxFlightSearches(MAX_FLIGHT_SEARCHES);
            setFlightSearchCount(0);
            setFlightWindowStart(0);
            setActivationResult(null);
            setWelcomeCodeInput("");
            setWelcomeCodeError(null);
          },
        },
      ]
    );
  }, [isAr, deviceFp]);

  // ── Clear chat ──
  const clearChat = useCallback(() => {
    Alert.alert(
      isAr ? "مسح المحادثة" : "Clear Chat",
      isAr
        ? "هل تريد مسح كل المحادثة وتبدأ من جديد؟"
        : "Clear the entire chat and start over?",
      [
        { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isAr ? "مسح" : "Clear",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
            setLanguage(null);
            setUserName("");
            setNameError(false);
            setMessages([]);
            setInput("");
            setLoading(false);
            setShowWhatsAppBanner(false);
            setShowEmailPrompt(false);
            setEmailInput("");
            setEmailSent(false);
            setEmailError(null);
            setEmailDeclined(false);
            userMsgCount.current = 0;
            setChatBlocked(false);
            setBlockUntil(0);
            setCyclesUsedToday(0);
            setPromoInput("");
            setPromoError(null);
            setPromoSuccess(false);
          },
        },
      ]
    );
  }, [isAr]);

  // ── Start chat ──
  const startChat = (lang: Language) => {
    const name = userName.trim();
    if (!name) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setLanguage(lang);
    const greeting: Message = {
      id: "greeting",
      role: "assistant",
      content: buildGreeting(lang, name),
    };
    setMessages([greeting]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Another Option: AI sends a higher-budget package alternative ──
  const onAnotherOption = useCallback(async () => {
    if (loading) return;
    const text = isAr
      ? "أعطني خياراً آخر للباقة بسعر أعلى — طيران أفضل وفندق أفضل مع تفاصيل السعر"
      : "Give me another package option with a higher budget — better airline and better hotel, with full pricing details";
    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: text };
    const historyForApi = [
      ...messages.filter((m) => m.id !== "greeting").map((m) => {
        let content = m.content;
        if (m.role === "assistant") {
          if (m.showHotel && m.hotelParams) {
            const { city, checkin, checkout, stars } = m.hotelParams;
            content += ` [HOTEL:${city}|${checkin}|${checkout}|${stars ?? 0}] (hotel widget shown in app)`;
          }
          if (m.flightToken) content += ` [FLIGHT:${m.flightToken}] (flight widget shown in app)`;
        }
        return { role: m.role as Role, content };
      }),
      { role: "user" as Role, content: text },
    ];
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const res = await fetch(`${API_BASE}/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceFp, "X-Device-FP": deviceFp },
        body: JSON.stringify({ messages: historyForApi, userName: userName.trim(), language: language ?? "ar", fingerprint: deviceFp }),
      });
      const data = (await res.json()) as { ok: boolean; content?: string; hotelParams?: { city: string; checkin: string; checkout: string; stars: number; breakfast?: boolean }; hotelNameParams?: { hotelName: string; hotelNames: string[]; checkin: string; checkout: string; adults: number; rooms: number } };
      const raw = data.content ?? (isAr ? "عذراً، صار خطأ." : "Sorry, an error occurred.");

      const hotelMatch = HOTEL_SIGNAL_RE.exec(raw);
      const flightMatch = FLIGHT_SIGNAL_RE.exec(raw);
      const flightToken = flightMatch ? flightMatch[1] : undefined;

      // ── Parse [MULTI_PKG] token ──
      const multiPkgMatch = MULTI_PKG_SIGNAL_RE.exec(raw);
      let multiPkgData: MultiPkgData | undefined;
      if (multiPkgMatch) {
        try { multiPkgData = JSON.parse(multiPkgMatch[1]) as MultiPkgData; } catch { /* skip */ }
      }

      let hotelParams: { city: string; checkin: string; checkout: string; stars?: number; breakfast?: boolean } | undefined;
      if (data.hotelParams) {
        const { city, checkin, checkout, stars, breakfast } = data.hotelParams;
        hotelParams = { city, checkin, checkout, stars: stars > 0 ? stars : undefined, ...(breakfast !== undefined && { breakfast }) };
      } else if (hotelMatch) {
        const [city, checkin, checkout, starsStr, bfStr] = hotelMatch[1].split("|");
        const stars = parseInt(starsStr ?? "0") || 0;
        const breakfast = bfStr?.trim().toLowerCase() === "yes" ? true : bfStr?.trim().toLowerCase() === "no" ? false : undefined;
        hotelParams = { city: city?.trim() ?? "", checkin: checkin?.trim() ?? "", checkout: checkout?.trim() ?? "", stars: stars > 0 ? stars : undefined, ...(breakfast !== undefined && { breakfast }) };
      }

      const clean = raw
        .replace(WHATSAPP_SIGNAL, "").replace(GOODBYE_SIGNAL, "")
        .replace(HOTEL_SIGNAL_RE, "").replace(HOTEL_SIGNAL, "")
        .replace(OFFERS_SIGNAL, "").replace(FLIGHT_SIGNAL_RE, "")
        .replace(ITINERARY_SIGNAL_RE, "").replace(MULTI_PKG_SIGNAL_RE, "")
        .replace(HOTEL_NAME_SIGNAL_RE, "").trimEnd();

      const botMsg: Message = {
        id: `b_${Date.now()}`, role: "assistant", content: clean,
        showHotel: !!(hotelMatch || data.hotelParams) && !multiPkgData, hotelParams,
        flightToken: multiPkgData ? undefined : flightToken,
        isPackage: !multiPkgData && !!flightToken && !!hotelParams,
        multiPkgData,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [...prev, { id: `err_${Date.now()}`, role: "assistant", content: isAr ? "تعذر الاتصال. حاول مرة ثانية." : "Connection error. Try again." }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, loading, deviceFp, language, userName, isAr]);


  // ── Hotel brand autocomplete: watch input and fetch suggestions ──────────
  useEffect(() => {
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    const q = input.trim();
    // Any input change invalidates a previously opened city quick-picker —
    // the user has moved on to a new query, so never leave a stale
    // "Which city?" row on screen.
    setBrandCityChips(null);
    setBrandCityLoading(false);
    // Advance the generation on EVERY input change — including empty, short,
    // or non-brand input — so any in-flight brand-city or suggestion fetch
    // is invalidated and cannot restore a stale picker or spinner.
    const gen = ++suggestGenRef.current;
    // Run for Arabic text (2+ chars) OR English text that could be a brand name.
    // The local endpoint is instant and returns nothing for non-matching queries,
    // so calling it for English is safe.
    const hasArabic = /[\u0600-\u06FF]/.test(q);
    const hasEnglish = /[a-zA-Z]/.test(q);
    if (!q || q.length < 2 || (!hasArabic && !hasEnglish)) {
      setHotelSuggestions([]);
      return;
    }
    const lang = hasArabic ? "ar" : "en";
    suggestDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/hotel-suggest-local?q=${encodeURIComponent(q)}&lang=${lang}`,
        );
        if (!res.ok) return;
        const data: HotelSuggestItem[] = await res.json();
        // Only apply results if this fetch is still the latest one
        if (suggestGenRef.current === gen) {
          setHotelSuggestions(Array.isArray(data) ? data.slice(0, 6) : []);
        }
      } catch {
        // Network error — silently ignore; don't restore stale suggestions
      }
    }, 150);
    return () => {
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, [input]);

  // ── Send message ──
  const handleSend = async () => {
    // Support suggestion-tap: forceSendTextRef holds the text to send instead
    // of the current input state (avoids async state-update race condition).
    const text = (forceSendTextRef.current ?? input).trim();
    // Grab and clear the English enQuery companion (set by hotel brand chip taps).
    const enQuery = forceSendEnQueryRef.current;
    forceSendTextRef.current = null;
    forceSendEnQueryRef.current = null;
    // Always clear the visible input field and any pending suggestions.
    // Also advance the generation counter so any in-flight suggestion fetch
    // that resolves after the send is discarded and cannot repopulate the strip.
    setInput("");
    suggestGenRef.current += 1;
    setHotelSuggestions([]);
    setBrandCityChips(null);
    setBrandCityLoading(false);
    if (!text || loading) return;

    // ── Admin: intercept tier code generation command ──
    if (isAdminMode && (text.includes("جهز لي كود") || text.includes("جهز كود"))) {
      Alert.alert(
        "اختر نوع الباقة",
        "حدد الباقة التي تريد إنشاء كود لها:",
        [
          { text: "تميز — 3 KWD (1 جهاز / 15 رحلة)", onPress: () => generateAdminCode("tamaiz") },
          { text: "تميز بلاس — 6 KWD (2 جهاز / 30 رحلة)", onPress: () => generateAdminCode("plus") },
          { text: "تميز بلاتينيوم — 10 KWD (4 أجهزة / 40 رحلة)", onPress: () => generateAdminCode("platinum") },
          { text: "إلغاء", style: "cancel" },
        ]
      );
      return;
    }

    // ── Admin: /* help command ──
    // Normalize asterisk-lookalike chars: many Arabic keyboards map the
    // "*" key to ٭ (U+066D Arabic five-pointed star) instead of ASCII "*",
    // and some IMEs use fullwidth/math variants (＊, ∗, ⁎). All look nearly
    // identical on screen but fail a plain "*" regex match.
    const normalizedForHelpCmd = text.trim().replace(/[٭＊∗⁎]/g, "*");
    if (isAdminMode && /^\/\s*\*+\s*$/.test(normalizedForHelpCmd)) {
      const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      const help =
        `🛠️ الأوامر المتاحة للأدمن:\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📋 إدارة الحجوزات:\n\n` +
        `• /booking\n` +
        `  عرض آخر 100 حجز مع الحالة (✅ مدفوع / ⏳ انتظار)\n\n` +
        `• /booking <رقم>\n` +
        `  عرض تفاصيل الحجز حسب رقمه في القائمة\n` +
        `  مثال: /booking 3\n\n` +
        `• /booking DAT-XXXXX\n` +
        `  عرض تفاصيل حجز محدد بالرقم المرجعي\n` +
        `  مثال: /booking DAT-MQOB8WVC\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `🎫 إنشاء أكواد الاشتراك:\n\n` +
        `• جهز لي كود\n` +
        `  فتح قائمة اختيار نوع الباقة وإنشاء كود جديد:\n` +
        `  — تميز (3 KWD · 1 جهاز · 15 رحلة/يوم)\n` +
        `  — تميز بلاس (6 KWD · 2 جهاز · 30 رحلة/يوم)\n` +
        `  — تميز بلاتينيوم (10 KWD · 4 أجهزة · 40 رحلة/يوم)\n\n` +
        `• create_code: KEY: TIER\n` +
        `  إنشاء كود عبر حقل الكود (بدون فتح الشات)\n` +
        `  TIER: tamaiz | plus | platinum\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `🗑️ حذف الأكواد:\n\n` +
        `• /delete\n` +
        `  عرض كل الأكواد مع أرقامها تمهيداً للحذف\n\n` +
        `• /delete <رقم>\n` +
        `  حذف كود حسب رقمه (يلغي جميع الأجهزة المرتبطة فوراً)\n` +
        `  مثال: /delete 2\n\n` +
        `• delete_code: KEY: CODE\n` +
        `  حذف كود مباشرة بالاسم عبر حقل الكود\n` +
        `  مثال: delete_code: KEY: TAMAIZ-XXXX\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📋 عرض الأكواد:\n\n` +
        `• جميع الاكواد\n` +
        `  عرض كل الأكواد مع الأجهزة المرتبطة والصلاحية واستخدام الطيران اليومي\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📊 التقارير والإحصائيات:\n\n` +
        `• /statistics\n` +
        `  إحصائيات عامة: عدد الزوار والمشتركين والمجانيين\n\n` +
        `• /insights\n` +
        `  تقرير اهتمامات العملاء: أكثر الوجهات طلباً ونوع الاستفسارات (7 و30 يوم)\n\n` +
        `• /devices\n` +
        `  عدد الأجهزة المسجلة لاستقبال الإشعارات (show number of registered devices)\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📲 الإشعارات الفورية:\n\n` +
        `• /push العنوان | نص الرسالة\n` +
        `  إرسال إشعار فوري لجميع الأجهزة المسجلة\n` +
        `  مثال: /push عروض حصرية | خصم 20% على جميع الباقات هذا الأسبوع\n\n` +
        `• /push ADMINKEY العنوان | نص الرسالة\n` +
        `  نفس الأمر مع إدراج مفتاح الأدمن مباشرة (أكثر أماناً على الموبايل)\n` +
        `  مثال: /push ugdugd6402182 عروض | نص الرسالة\n\n` +
        `• /push-history\n` +
        `  عرض سجل آخر الإشعارات المُرسلة مع عدد الأجهزة والحالة\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `⏰ جدولة الإشعارات:\n\n` +
        `• /push-at YYYY-MM-DD HH:MM العنوان | نص الرسالة\n` +
        `  جدولة إشعار في وقت محدد (بتوقيت الكويت)\n` +
        `  مثال: /push-at 2026-08-15 10:00 عروض العيد | لا تفوّت عروضنا الحصرية\n\n` +
        `• /push-in N العنوان | نص الرسالة\n` +
        `  جدولة إشعار بعد مدة — h=ساعات d=أيام m=دقائق\n` +
        `  مثال: /push-in 2h تذكير | موعد انتهاء العرض اقترب\n` +
        `  مثال: /push-in 1d عرض الغد | باقات جديدة وصلت\n\n` +
        `• /push-list\n` +
        `  عرض كل الإشعارات المجدولة التي لم تُرسل بعد\n\n` +
        `• /push-cancel N\n` +
        `  إلغاء إشعار مجدول حسب رقمه في القائمة\n` +
        `  مثال: /push-cancel 2\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📚 قاعدة المعرفة (تدريب البوت):\n\n` +
        `• /teach <رابط أو نص>\n` +
        `  حفظ معلومة جديدة للبوت من رابط أو نص مباشرة\n` +
        `  مثال: /teach https://example.com\n\n` +
        `• /teach list\n` +
        `  عرض كل المعلومات المحفوظة\n\n` +
        `• /teach delete <رقم>\n` +
        `  حذف معلومة محددة من القائمة\n\n` +
        `• /teach delete_all\n` +
        `  حذف كل قاعدة المعرفة\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `• /*  — عرض هذه القائمة`;
      setMessages((prev) => [...prev, { id: `b_${Date.now()}`, role: "assistant", content: help }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      return;
    }

    // ── Admin: /booking command ──
    if (isAdminMode && text.trim().toLowerCase().startsWith("/booking")) {
      const arg = text.trim().slice(8).trim(); // everything after "/booking"
      const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

      try {
        if (!arg) {
          // List all bookings
          const r = await fetch(`${API_BASE}/admin/bookings`, {
            headers: { "x-admin-key": adminToken },
          });
          const data = await r.json() as { ok: boolean; total?: number; bookings?: typeof lastBookingList; error?: string };
          if (!data.ok || !data.bookings) throw new Error(data.error ?? "Failed");
          setLastBookingList(data.bookings);
          const lines = data.bookings.map((b) =>
            `${b.index}. ${b.orderId} ${b.isPaid ? "✅" : "⏳"}\n   👤 ${b.contactName || "—"} · 📞 ${b.contactPhone || "—"}\n   ✈️ ${b.flightFrom || "—"} → ${b.flightTo || "—"} · ${b.dep || "—"}${b.ret ? " ↩ " + b.ret : ""}\n   💰 KWD ${b.totalKWD || "—"} (عربون: ${b.depositKWD || "—"})`
          );
          const content = `📋 آخر الحجوزات (${data.total}):\n\n${lines.join("\n\n")}\n\n─────────────────\nاكتب /booking <رقم أو orderId> لعرض التفاصيل الكاملة`;
          setMessages((prev) => [...prev, { id: `b_${Date.now()}`, role: "assistant", content }]);
        } else {
          // Lookup by index number or orderId
          let orderId = arg.toUpperCase();
          if (/^\d+$/.test(arg)) {
            const idx = parseInt(arg, 10) - 1;
            orderId = lastBookingList[idx]?.orderId ?? arg.toUpperCase();
          }
          if (!orderId.startsWith("DAT-")) orderId = "DAT-" + orderId;
          const r = await fetch(`${API_BASE}/admin/bookings/${encodeURIComponent(orderId)}`, {
            headers: { "x-admin-key": adminToken },
          });
          const data = await r.json() as { ok: boolean; booking?: { orderId: string; meta: Record<string, string>; isPaid: boolean; paidAt: string | null; createdAt: string }; error?: string };
          if (!data.ok || !data.booking) { throw new Error(data.error ?? "لم يُعثر على الحجز"); }
          const m = data.booking.meta;
          const tripType = m["ret"] ? "ذهاب وعودة" : "ذهاب فقط";
          const remaining = m["totalKWD"] ? (parseFloat(m["totalKWD"]) * BOOKING_RULES.packageDeposit.remainingRate).toFixed(3) : "—";
          const nights = m["checkin"] && m["checkout"]
            ? Math.max(0, Math.round((new Date(m["checkout"]).getTime() - new Date(m["checkin"]).getTime()) / 86400000))
            : 0;
          const breakfastLabel = m["breakfast"] === "yes" ? "BB (يشمل إفطار)" : m["breakfast"] === "no" ? "RO (غرفة فقط)" : "—";

          const waText =
            `📋 تفاصيل حجز: ${data.booking.orderId}\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `👤 ${m["contactName"] || "—"} · 📞 ${m["contactPhone"] || "—"}\n` +
            (m["passportFirst"] ? `🛂 ${m["passportFirst"]} ${m["passportLast"] || ""} · ${m["passportNo"] || ""}\n` : "") +
            `\n✈️ الطيران:\n` +
            `• ${m["flightFrom"] || "—"} → ${m["flightTo"] || "—"} (${tripType})\n` +
            (m["airline"] ? `• الشركة: ${m["airline"]}\n` : "") +
            `• الذهاب: ${m["dep"] || "—"}${m["flightDepTime"] ? ` — ${m["flightDepTime"]} → ${m["flightArrTime"] || ""}${m["flightDur"] ? ` (${m["flightDur"]})` : ""}` : ""}\n` +
            (m["ret"] ? `• العودة: ${m["ret"]}${m["retDepTime"] ? ` — ${m["retDepTime"]} → ${m["retArrTime"] || ""}` : ""}\n` : "") +
            `• المسافرون: ${m["adults"] || "1"}\n` +
            (m["hotelCity"] ? (
              `\n🏨 الفندق:\n` +
              `• ${m["hotelName"] || m["hotelCity"]}${m["hotelStars"] && m["hotelStars"] !== "0" ? ` ${m["hotelStars"]}⭐` : ""} — ${m["hotelCity"]}\n` +
              `• Check-in: ${m["checkin"] || "—"} | Check-out: ${m["checkout"] || "—"} (${nights} ليلة)\n` +
              `• ${breakfastLabel}\n`
            ) : "") +
            `\n💰 المبالغ:\n` +
            `• الإجمالي: KWD ${m["totalKWD"] || "—"}\n` +
            `• العربون (${BOOKING_RULES.packageDeposit.percent}%): KWD ${m["depositKWD"] || "—"}\n` +
            `• المتبقي (${BOOKING_RULES.packageDeposit.remainingPercent}%): KWD ${remaining}\n` +
            (m["notes"] ? `\n📝 ملاحظات: ${m["notes"]}\n` : "") +
            `━━━━━━━━━━━━━━━━\n` +
            `الحالة: ${data.booking.isPaid ? "✅ العربون مدفوع" : "⏳ في الانتظار"}\n` +
            `التاريخ: ${new Date(data.booking.createdAt).toLocaleString("ar-KW")}`;

          const content = waText + `\n\n💬 [إرسال عبر واتساب: /wa ${data.booking.orderId}]`;
          setMessages((prev) => [...prev, { id: `b_${Date.now()}`, role: "assistant", content }]);

          // Immediately offer WhatsApp share
          Alert.alert(
            "📋 " + data.booking.orderId,
            "عرض التفاصيل بالأسفل.\nهل تريد مشاركة هذا الحجز عبر واتساب؟",
            [
              { text: "📤 مشاركة عبر واتساب", onPress: () => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(waText)}`) },
              { text: "إلغاء", style: "cancel" },
            ]
          );
        }
      } catch (err: any) {
        setMessages((prev) => [...prev, { id: `b_${Date.now()}`, role: "assistant", content: `❌ ${err?.message ?? "تعذر جلب الحجوزات"}` }]);
      } finally {
        setLoading(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
      return;
    }

    // ── Plan inquiry: handle locally without sending to Gemini ──
    if (isPlanInquiry(text)) {
      const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

      if (isAdminMode) {
        const botMsg: Message = {
          id: `b_${Date.now()}`,
          role: "assistant",
          content: isAr
            ? "حساب مشرف مطلق - صلاحيات كاملة بدون حدود."
            : "Super Admin Account - Unlimited access, no limits.",
        };
        setMessages((prev) => [...prev, botMsg]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        return;
      }

      // ── Short-circuit: if local state says no premium, respond instantly ──
      // This prevents a stale server session from overriding a guest session.
      if (!isPremium) {
        const noSubMsg: Message = {
          id: `b_${Date.now()}`,
          role: "assistant",
          content: isAr
            ? "لا يوجد اشتراك نشط 🔒\nأنت تتصفح كزائر. يمكنك الاشتراك في باقة التميز للحصول على مزايا حصرية."
            : "No active subscription 🔒\nYou're browsing as a guest. Subscribe to the Tamaiz plan for exclusive features.",
        };
        setMessages((prev) => [...prev, noSubMsg]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        return;
      }

      setLoading(true);
      try {
        const r = await fetch(`${API_BASE}/chat/my-plan`, {
          headers: { "x-device-id": deviceFp },
        });
        const data = (await r.json()) as {
          ok: boolean;
          isPremium?: boolean;
          isAdmin?: boolean;
          tierLabel?: string;
          tierLabelEn?: string;
          daysLeft?: number;
          flightSearchesRemaining?: number;
          maxFlightSearches?: number;
          itinerariesRemaining?: number;
          maxItineraries?: number;
        };
        let content = "";
        if (!data.ok || !data.isPremium) {
          content = isAr
            ? "لا يوجد اشتراك نشط 🔒\nيمكنك الاشتراك في باقة التميز للحصول على مزايا حصرية."
            : "No active subscription 🔒\nSubscribe to the Tamaiz plan for exclusive features.";
        } else if (data.isAdmin) {
          content = isAr
            ? "حساب مشرف مطلق - صلاحيات كاملة بدون حدود."
            : "Super Admin Account - Unlimited access, no limits.";
        } else {
          const label = isAr ? (data.tierLabel ?? "تميز") : (data.tierLabelEn ?? "TAMAIZ");
          const days = data.daysLeft ?? 0;
          const flights = data.flightSearchesRemaining ?? 0;
          const flightWord = flights === 1 ? "محاولة بحث عن تذاكر طيران" : "محاولات بحث عن تذاكر طيران";
          const itinsLeft = data.itinerariesRemaining ?? 0;
          const itinsMax = data.maxItineraries ?? 10;
          content = isAr
            ? `📋 نوع الباقة: ${label}\n⏳ الأيام المتبقية: ${days} يوم\n✈️ باقي ${flights} ${flightWord}\n🗺️ باقي ${itinsLeft} خطة رحلة من أصل ${itinsMax} اليوم`
            : `📋 Your Plan: ${label}\n⏳ Days Remaining: ${days} days\n✈️ Flights Left Today: ${flights}\n🗺️ Itinerary Plans Left Today: ${itinsLeft} / ${itinsMax}`;
        }
        const botMsg: Message = { id: `b_${Date.now()}`, role: "assistant", content };
        setMessages((prev) => [...prev, botMsg]);
      } catch {
        const botMsg: Message = {
          id: `b_${Date.now()}`,
          role: "assistant",
          content: isAr ? "تعذر جلب معلومات الباقة." : "Could not fetch plan information.",
        };
        setMessages((prev) => [...prev, botMsg]);
      } finally {
        setLoading(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
      return;
    }

    userMsgCount.current += 1;

    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: text };
    // Re-inject signal context so Gemini remembers which widgets were already shown.
    // Without this, Gemini has no memory of having emitted [HOTEL]/[FLIGHT] and
    // redirects the user to the website on follow-up questions.
    const historyForApi: Array<{ role: Role; content: string }> = [
      ...messages
        .filter((m) => m.id !== "greeting")
        .map((m) => {
          if (m.role !== "assistant") return { role: m.role, content: m.content };
          let content = m.content;
          if (m.showHotel && m.hotelParams) {
            const { city, checkin, checkout, stars } = m.hotelParams;
            content += ` [HOTEL:${city}|${checkin}|${checkout}|${stars ?? 0}] (hotel widget shown in app)`;
          }
          if (m.flightToken) {
            content += ` [FLIGHT:${m.flightToken}] (flight widget shown in app)`;
          }
          return { role: m.role, content };
        }),
      // When a hotel brand chip was tapped, use the English enQuery as the
      // actual API content so Gemini gets a clean English hotel name for the
      // [HOTEL_NAME] token. The chat bubble still shows the Arabic display name.
      { role: "user", content: enQuery ? `${text} [${enQuery}]` : text },
    ];

    // ── Auto-detect language from what the user just typed ──
    const detectedLang = detectLangFromText(text);
    const effectiveLang: Language = detectedLang;
    if (detectedLang !== language) {
      setLanguage(detectedLang);
    }

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(`${API_BASE}/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceFp, "X-Device-FP": deviceFp },
        signal: controller.signal,
        body: JSON.stringify({
          messages: historyForApi,
          userName: userName.trim(),
          language: effectiveLang,
          fingerprint: deviceFp,
        }),
      });

      clearTimeout(timeoutId);

      const data = (await res.json()) as {
        ok: boolean;
        content?: string;
        error?: string;
        blocked?: boolean;
        blockUntil?: number;
        cyclesUsedToday?: number;
        sessionState?: SessionState;
        hotelParams?: { city: string; checkin: string; checkout: string; stars: number };
        hotelNameParams?: { hotelName: string; hotelNames: string[]; checkin: string; checkout: string; adults: number; rooms: number };
        itineraryBlocked?: { secondsLeft: number; max: number };
      };

      if (data.blocked) {
        setMessages((prev) => prev.slice(0, -1));
        if (data.blockUntil) { setChatBlocked(true); setBlockUntil(data.blockUntil); }
        if (data.cyclesUsedToday !== undefined) setCyclesUsedToday(data.cyclesUsedToday);
        return;
      }

      // Server enforced itinerary quota — show block banner immediately
      if (data.itineraryBlocked) {
        setItineraryBlockSeconds(data.itineraryBlocked.secondsLeft);
        setItineraryMaxPerDay(data.itineraryBlocked.max);
        setMessages((prev) => [
          ...prev,
          {
            id: `b_itinblock_${Date.now()}`,
            role: "assistant" as const,
            content: "",
            itineraryData: {
              dest: "__blocked__",
              days: 0,
              travelers: 1,
              schedule: [],
              itineraryBlockedSeconds: data.itineraryBlocked!.secondsLeft,
              itineraryBlockedMax: data.itineraryBlocked!.max,
            } as unknown as ItineraryData,
          },
        ]);
        setLoading(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        return;
      }

      // Successful response — clear any stale block state
      setChatBlocked(false);
      setBlockUntil(0);

      if (data.sessionState?.isPremium) {
        setIsPremium(true);
        setMaxFlightSearches(data.sessionState.maxFlightSearchesPerDay);
        if (data.sessionState.promoTier) setPromoTier(data.sessionState.promoTier);
      }

      const raw =
        data.content ??
        (isAr ? "عذراً، صار خطأ. حاول مرة ثانية!" : "Sorry, something went wrong. Please try again!");

      const hasEscalation = raw.includes(WHATSAPP_SIGNAL);
      const hasGoodbye = raw.includes(GOODBYE_SIGNAL);
      const hotelMatch = HOTEL_SIGNAL_RE.exec(raw);
      const hasHotel = !!(hotelMatch || data.hotelParams) || raw.includes(HOTEL_SIGNAL);
      const hasOffers = raw.includes(OFFERS_SIGNAL);
      const flightMatch = FLIGHT_SIGNAL_RE.exec(raw);
      const flightToken = flightMatch ? flightMatch[1] : undefined;

      // ── Parse [ITINERARY] token ──
      // Quota is enforced server-side; if server allowed it, just render the widget.
      const itineraryMatch = ITINERARY_SIGNAL_RE.exec(raw);
      let itineraryData: ItineraryData | undefined;
      if (itineraryMatch) {
        try {
          itineraryData = JSON.parse(itineraryMatch[1]) as ItineraryData;
        } catch { /* malformed JSON — skip */ }
      }

      // ── Parse [MULTI_PKG] token ──
      const multiPkgMatch = MULTI_PKG_SIGNAL_RE.exec(raw);
      let multiPkgData: MultiPkgData | undefined;
      if (multiPkgMatch) {
        try {
          multiPkgData = JSON.parse(multiPkgMatch[1]) as MultiPkgData;
        } catch { /* malformed JSON — skip */ }
      }

      // Prefer server-parsed hotelParams (avoids client-side regex fragility).
      // Fall back to client-side regex parse if server didn't include it.
      let hotelParams: { city: string; checkin: string; checkout: string; stars?: number; breakfast?: boolean } | undefined;
      if (data.hotelParams) {
        const { city, checkin, checkout, stars, breakfast } = data.hotelParams as {
          city: string; checkin: string; checkout: string; stars: number; breakfast?: boolean;
        };
        hotelParams = { city, checkin, checkout, stars: stars > 0 ? stars : undefined, ...(breakfast !== undefined && { breakfast }) };
      } else if (hotelMatch) {
        const [city, checkin, checkout, starsStr, bfStr] = hotelMatch[1].split("|");
        const stars = parseInt(starsStr ?? "0") || 0;
        const breakfast = bfStr?.trim().toLowerCase() === "yes" ? true : bfStr?.trim().toLowerCase() === "no" ? false : undefined;
        hotelParams = {
          city: city?.trim() ?? "",
          checkin: checkin?.trim() ?? "",
          checkout: checkout?.trim() ?? "",
          stars: stars > 0 ? stars : undefined,
          ...(breakfast !== undefined && { breakfast }),
        };
      }

      // ── Parse [HOTEL_NAME] token (server sends structured hotelNameParams) ──
      const hotelNameParams = data.hotelNameParams ?? undefined;

      const clean = raw
        .replace(WHATSAPP_SIGNAL, "")
        .replace(GOODBYE_SIGNAL, "")
        .replace(HOTEL_SIGNAL_RE, "")
        .replace(HOTEL_SIGNAL, "")
        .replace(OFFERS_SIGNAL, "")
        .replace(FLIGHT_SIGNAL_RE, "")
        .replace(ITINERARY_SIGNAL_RE, "")
        .replace(MULTI_PKG_SIGNAL_RE, "")
        .replace(HOTEL_NAME_SIGNAL_RE, "")
        .trimEnd();

      const botMsg: Message = {
        id: `b_${Date.now()}`,
        role: "assistant",
        content: clean,
        showWhatsApp: hasEscalation,
        showHotel: hasHotel && !multiPkgData && !hotelNameParams,
        hotelParams,
        hotelNameParams,
        showOffers: hasOffers,
        flightToken: multiPkgData ? undefined : flightToken,
        isPackage: !multiPkgData && !!flightToken && !!hotelParams,
        itineraryData,
        multiPkgData,
      };
      setMessages((prev) => [...prev, botMsg]);

      if (hasEscalation || userMsgCount.current >= ESCALATE_AFTER_MESSAGES) {
        setShowWhatsAppBanner(true);
      }

      if (hasGoodbye && !showEmailPrompt && !emailDeclined) {
        setShowEmailPrompt(true);
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort =
        err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: isAbort
            ? isAr
              ? "الرد يأخذ وقت أطول من المعتاد. حاول مرة ثانية 🔄"
              : "Response is taking longer than usual. Please try again 🔄"
            : isAr
              ? "ما قدرت أتصل بالخادم. تأكد من الإنترنت وحاول مرة ثانية."
              : "Couldn't reach the server. Check your internet and try again.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // ── Send email summary ──
  const sendEmailSummary = async () => {
    const email = emailInput.trim();
    if (!email) return;
    setEmailSending(true);
    setEmailError(null);
    try {
      const messagesToSend = messages
        .filter((m) => m.content?.trim())
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API_BASE}/chat/email-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceFp },
        body: JSON.stringify({
          messages: messagesToSend,
          userEmail: email,
          userName: userName.trim(),
          language: language ?? "ar",
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setEmailSent(true);
      } else {
        setEmailError(
          isAr ? "فشل إرسال الإيميل. حاول مرة ثانية." : "Failed to send. Please try again."
        );
      }
    } catch {
      setEmailError(
        isAr ? "فشل إرسال الإيميل. تأكد من الإنترنت." : "Send failed. Check your internet."
      );
    } finally {
      setEmailSending(false);
    }
  };

  const openWhatsApp = () => Linking.openURL(WHATSAPP_URL).catch(() => {});

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetMaxHeight,
              marginBottom: sheetMarginBottom,
              paddingBottom: insets.bottom,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            {/* Row 1: identity + close */}
            <View style={styles.headerRow1}>
              <View style={styles.headerLeft}>
                <View style={styles.avatarOuter}>
                  <View style={styles.avatarInner}>
                    <TamaizAvatar size={34} />
                  </View>
                </View>
                <View>
                  <Text style={styles.headerName}>{BOT_NAME}</Text>
                  <Text style={styles.headerSub}>{headerSub}</Text>
                </View>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.5 }]}
              >
                <Svg width={13} height={13} viewBox="0 0 24 24">
                  <Path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="rgba(255,255,255,0.8)"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                </Svg>
              </Pressable>
            </View>

            {/* Row 2: tier badge + action buttons (only after language chosen) */}
            {language !== null && (
              <View style={styles.headerRow2}>
                <View style={[
                  styles.tierBadge,
                  isAdminMode ? styles.tierBadgeAdmin
                    : promoTier === "platinum" ? styles.tierBadgePlatinum
                    : isPremium ? styles.tierBadgePremium
                    : styles.tierBadgeFree,
                ]}>
                  <Text style={[styles.tierBadgeText, isAdminMode && styles.tierBadgeTextAdmin]}>
                    {tierLabel}
                  </Text>
                </View>
                <View style={styles.headerActions}>
                  <Pressable
                    onPress={clearChat}
                    hitSlop={10}
                    style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={styles.clearBtnText}>
                      {isAr ? "🗑  مسح" : "🗑  Clear"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleLogout}
                    hitSlop={10}
                    style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={styles.logoutBtnText}>
                      {isAr ? "↩  خروج" : "↩  Logout"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* ── Loading session ── */}
          {sessionLoading ? (
            <View style={styles.sessionLoadingWrap}>
              <ActivityIndicator size="large" color={GOLD} />
            </View>
          ) : chatBlocked ? (
            /* ── Cooldown / Block screen ── */
            <ScrollView
              contentContainerStyle={styles.blockScreen}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.blockIcon}>⏳</Text>
              <Text style={styles.blockTitle}>
                {blockSecondsLeft > 12 * 3600
                  ? (language === "ar"
                      ? "انتهى وقتك اليومي لإستخدام خدمة D.T. Tours Ai"
                      : "Your daily D.T. Tours Ai session has ended")
                  : (language === "ar"
                      ? "انتهت رسائل هذه الجولة — عد بعد 8 ساعات لمحادثة جديدة ✨"
                      : "Cycle complete — come back in 8 hours for a fresh set of messages ✨")}
              </Text>
              <View style={styles.blockTimerBox}>
                <Text style={styles.blockTimerLabel}>
                  {language === "ar" ? "يتجدد خلال" : "Resets in"}
                </Text>
                <Text style={styles.blockTimer}>{formatCountdown(blockSecondsLeft)}</Text>
              </View>

              {/* ── Subscribe CTA ── */}
              <Pressable
                onPress={() => setShowSubscribeModal(true)}
                style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
              >
                <Text style={styles.blockSubscribeLink}>
                  ✨ {language === "ar" ? "الاشتراك في باقة التميز" : "Subscribe to Tamaiz Package"}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.blockWaBtn, pressed && { opacity: 0.8 }]}
                onPress={openWhatsApp}
              >
                <Text style={styles.blockWaBtnText}>
                  {"💬 "}
                  {language === "ar"
                    ? "للتواصل المباشر مع خدمة العملاء (90087797)"
                    : "Chat directly with Customer Care (90087797)"}
                </Text>
              </Pressable>
              <View style={styles.blockPromoWrap}>
                <Text style={styles.blockPromoLabel}>
                  {language === "ar"
                    ? "إذا كان لديك كود اشتراك التميز، يرجى إدخاله هنا لتفعيل باقة المحادثات غير المحدودة مع مستشار دار التميز تورز السياحي."
                    : "Have a TAMAIZ subscription code? Enter it below to activate unlimited conversations."}
                </Text>
                {promoSuccess ? (
                  <Text style={styles.blockPromoSuccess}>
                    {language === "ar"
                      ? "✅ تم تفعيل باقة التميز! استمتع بمحادثات غير محدودة."
                      : "✅ TAMAIZ Premium activated! Enjoy unlimited conversations."}
                  </Text>
                ) : (
                  <>
                    <TextInput
                      style={styles.blockPromoInput}
                      value={promoInput}
                      onChangeText={(t) => { setPromoInput(t); setPromoError(null); }}
                      placeholder="TAMAIZ-XXXXXXXX"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {promoError !== null && (
                      <Text style={styles.blockPromoError}>{promoError}</Text>
                    )}
                    <Pressable
                      style={({ pressed }) => [
                        styles.blockPromoBtn,
                        (!promoInput.trim() || promoLoading) && styles.blockPromoBtnDisabled,
                        pressed && !!promoInput.trim() && { opacity: 0.8 },
                      ]}
                      onPress={redeemPromoCode}
                      disabled={!promoInput.trim() || promoLoading}
                    >
                      {promoLoading ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Text style={styles.blockPromoBtnText}>
                          {language === "ar" ? "تفعيل الكود" : "Activate Code"}
                        </Text>
                      )}
                    </Pressable>
                  </>
                )}
              </View>
            </ScrollView>
          ) : language === null ? (
            activationResult ? (
              /* ── Activation Success Confirmation Card ── */
              <ScrollView
                contentContainerStyle={styles.activationCardWrap}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Gold checkmark badge */}
                <View style={styles.activationBadge}>
                  <Text style={styles.activationBadgeText}>✓</Text>
                </View>

                <Text style={styles.activationTitle}>تم تفعيل الباقة بنجاح</Text>
                <Text style={styles.activationTitleSub}>Subscription Activated Successfully</Text>

                {/* Details table */}
                <View style={styles.activationTable}>
                  {/* Tier row */}
                  <View style={styles.activationRow}>
                    <View style={styles.activationCell}>
                      <Text style={styles.activationCellLabel}>الباقة</Text>
                      <Text style={styles.activationCellLabelSub}>Package</Text>
                    </View>
                    <View style={styles.activationCellValue}>
                      <Text style={styles.activationValueAr}>{activationResult.tierLabelAr}</Text>
                      <Text style={styles.activationValueEn}>{activationResult.tierLabelEn}</Text>
                    </View>
                  </View>

                  <View style={styles.activationDivider} />

                  {/* Days remaining row */}
                  <View style={styles.activationRow}>
                    <View style={styles.activationCell}>
                      <Text style={styles.activationCellLabel}>الصلاحية</Text>
                      <Text style={styles.activationCellLabelSub}>Validity</Text>
                    </View>
                    <View style={styles.activationCellValue}>
                      <Text style={styles.activationValueAr}>{activationResult.daysLeft} يوماً</Text>
                      <Text style={styles.activationValueEn}>{activationResult.daysLeft} days remaining</Text>
                    </View>
                  </View>

                  <View style={styles.activationDivider} />

                  {/* Flight quota row */}
                  <View style={styles.activationRow}>
                    <View style={styles.activationCell}>
                      <Text style={styles.activationCellLabel}>رصيد اليوم</Text>
                      <Text style={styles.activationCellLabelSub}>Remaining Today</Text>
                    </View>
                    <View style={styles.activationCellValue}>
                      <Text style={styles.activationValueAr}>{activationResult.flightSearchesRemaining} بحث</Text>
                      <Text style={styles.activationValueEn}>of {activationResult.flightSearchesPerDay}/day</Text>
                    </View>
                  </View>
                </View>

                {/* Proceed button */}
                <Pressable
                  style={({ pressed }) => [styles.activationProceedBtn, pressed && { opacity: 0.85 }]}
                  onPress={proceedToChat}
                >
                  <Text style={styles.activationProceedText}>متابعة / Proceed to Chat</Text>
                  <Text style={styles.activationProceedArrow}> ←</Text>
                </Pressable>
              </ScrollView>
            ) : (
            /* ── Language & Name picker ── */
            <ScrollView
              contentContainerStyle={styles.langPicker}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.avatarCluster}>
                <View style={styles.avatarHalo} />
                <View style={styles.avatarOuterLg}>
                  <View style={styles.avatarInnerLg}>
                    <Image
                      source={ROBOT_IMAGE}
                      style={{ width: 130, height: 130 }}
                      resizeMode="contain"
                    />
                  </View>
                </View>
                <View style={styles.avatarBadge}>
                  <Text style={styles.avatarBadgeText}>AI</Text>
                </View>
              </View>
              <View style={styles.brandRow}>
                <Text style={styles.brandTextAr}>تميز</Text>
                <Text style={styles.brandDot}> · </Text>
                <Text style={styles.brandTextEn}>TAMAIZ</Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                <Animated.View style={{
                  transform: [{
                    rotate: waveAnim.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: ["-45deg", "0deg", "45deg"],
                    }),
                  }],
                }}>
                  <Text style={styles.langTitle}>{" 👋"}</Text>
                </Animated.View>
                <Text style={styles.langTitle}>{"مرحباً بكم"}</Text>
              </View>
              <Text style={styles.langTitleSub}>Welcome to D.T. Tours</Text>

              <View style={styles.nameFieldWrap}>
                <Text style={styles.nameLabel}>( الاسم / Name )</Text>
                <TextInput
                  style={[styles.nameInput, nameError && styles.nameInputError]}
                  value={userName}
                  onChangeText={(t) => {
                    setUserName(t);
                    if (t.trim()) setNameError(false);
                  }}
                  placeholder="أدخل اسمك / Enter your name"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  returnKeyType="done"
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={40}
                />
                {nameError && (
                  <Text style={styles.nameError}>✱ الاسم مطلوب · Name is required</Text>
                )}
              </View>

              <Text style={styles.langPrompt}>اختر لغتك / Choose your language</Text>
              <View style={styles.langBtnRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.langBtn,
                    pendingLanguage === "ar" && styles.langBtnSelected,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setPendingLanguage("ar")}
                >
                  <Text style={styles.langBtnText}>عربي 🇰🇼</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.langBtn,
                    pendingLanguage === "en" && styles.langBtnSelected,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setPendingLanguage("en")}
                >
                  <Text style={styles.langBtnText}>English 🇬🇧</Text>
                </Pressable>
              </View>

              {/* ── Subscribe plain-text link with glow pulse ── */}
              <Pressable
                style={({ pressed }) => [{ opacity: pressed ? 0.55 : 1, alignSelf: "center" }]}
                onPress={() => setShowSubscribeModal(true)}
              >
                <Animated.Text style={[styles.langSubscribeLink, { opacity: glowAnim }]}>
                  اشترك في باقات التميز / Subscribe to Tamaiz Packages
                </Animated.Text>
              </Pressable>

              {/* ── Code input + Enter button — side-by-side row ── */}
              <View style={styles.langCodeWrap}>
                <View style={styles.langCodeInputBox}>
                  <TextInput
                    style={styles.langCodeInput}
                    value={welcomeCodeInput}
                    onChangeText={(t) => { setWelcomeCodeInput(t); setWelcomeCodeError(null); }}
                    placeholder={"كود الاشتراك / Activation Code"}
                    placeholderTextColor="rgba(255,255,255,0.30)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleWelcomeCode}
                  />
                  <Text style={styles.langGuestHint}>
                    {"او دخول كزائر / or continue as guest"}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.langCodeBtn, pressed && { opacity: 0.8 }, welcomeCodeLoading && { opacity: 0.6 }]}
                  onPress={handleWelcomeCode}
                  disabled={welcomeCodeLoading}
                >
                  {welcomeCodeLoading ? (
                    <Text style={styles.langCodeBtnText}>…</Text>
                  ) : welcomeCodeInput.trim() ? (
                    <Text style={styles.langCodeBtnText}>تفعيل</Text>
                  ) : (
                    <>
                      <Text style={styles.langCodeBtnText}>دخول</Text>
                      <Text style={[styles.langCodeBtnText, { fontSize: 10, opacity: 0.75 }]}>Enter</Text>
                    </>
                  )}
                </Pressable>
              </View>
              {welcomeCodeError && (
                <Text style={styles.langCodeError}>{welcomeCodeError}</Text>
              )}
            </ScrollView>
            )
          ) : (
            /* ── Chat view ── */
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 60 : 0}
            >
              <ScrollView
                ref={scrollRef}
                style={styles.messages}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() =>
                  scrollRef.current?.scrollToEnd({ animated: true })
                }
              >
                {messages.map((msg) => (
                  <View
                    key={msg.id}
                    style={[
                      styles.msgRow,
                      msg.role === "user" ? styles.msgRowUser : styles.msgRowBot,
                    ]}
                  >
                    {msg.role === "assistant" && (
                      <View style={styles.botAvatarWrap}>
                        <TamaizAvatar size={26} />
                      </View>
                    )}
                    <View style={{ maxWidth: "78%" }}>
                      <View
                        style={[
                          styles.bubble,
                          msg.role === "user" ? styles.bubbleUser : styles.bubbleBot,
                        ]}
                      >
                        <Text
                          style={[
                            styles.bubbleText,
                            msg.role === "user"
                              ? styles.bubbleTextUser
                              : styles.bubbleTextBot,
                            isAr && { textAlign: "right", writingDirection: "rtl" },
                          ]}
                        >
                          {msg.content}
                        </Text>
                      </View>
                      {msg.flightToken && !msg.isPackage && (
                        <FlightInlineSearch
                          token={msg.flightToken}
                          apiBase={API_BASE}
                          isAr={isAr}
                          openInApp={openInApp}
                          searchCount={flightSearchCount}
                          onSearchConsumed={onFlightSearchConsumed}
                          resetAt={
                            flightWindowStart > 0
                              ? flightWindowStart + FLIGHT_RATE_WINDOW_MS
                              : 0
                          }
                          maxSearches={maxFlightSearches}
                          deviceId={deviceFp}
                        />
                      )}
                      {msg.showHotel && !msg.isPackage && (
                        <HotelInlineSearch
                          apiBase={API_BASE}
                          isAr={isAr}
                          params={msg.hotelParams}
                          openInApp={openInApp}
                        />
                      )}
                      {msg.isPackage && msg.flightToken && msg.hotelParams && (
                        <PackageBookingSection
                          flightToken={msg.flightToken}
                          hotelParams={msg.hotelParams}
                          apiBase={API_BASE}
                          isAr={isAr}
                          openInApp={openInApp}
                          deviceId={deviceFp}
                          onAnotherOption={onAnotherOption}
                        />
                      )}
                      {msg.showOffers && (
                        <OffersDisplay
                          apiBase={API_BASE}
                          isAr={isAr}
                          openInApp={openInApp}
                        />
                      )}
                      {msg.itineraryData && (msg.itineraryData as any).dest === "__blocked__" ? (
                        <ItineraryBlockBanner
                          secondsLeft={(msg.itineraryData as any).itineraryBlockedSeconds ?? itineraryBlockSeconds}
                          max={(msg.itineraryData as any).itineraryBlockedMax ?? itineraryMaxPerDay}
                          isAr={isAr}
                          onSubscribe={() => setShowSubscribeModal(true)}
                        />
                      ) : msg.itineraryData ? (
                        <ItineraryWidget data={msg.itineraryData} isAr={isAr} />
                      ) : null}
                      {msg.multiPkgData && (
                        <MultiPkgWidget
                          data={msg.multiPkgData}
                          isAr={isAr}
                          apiBase={API_BASE}
                          openInApp={openInApp}
                          deviceId={deviceFp}
                          onAnotherOption={onAnotherOption}
                        />
                      )}
                      {msg.hotelNameParams && (
                        <HotelNameWidget
                          params={msg.hotelNameParams}
                          apiBase={API_BASE}
                          isAr={isAr}
                          openInApp={openInApp}
                          onNavigateToLocks={onNavigateToLocks}
                        />
                      )}
                      {msg.showWhatsApp && (
                        <Pressable
                          style={({ pressed }) => [
                            styles.inlineCta,
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={openWhatsApp}
                        >
                          <Text style={styles.inlineCtaText}>
                            {isAr
                              ? "💬 تواصل معنا على واتساب"
                              : "💬 Chat with us on WhatsApp"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}

                {loading && (
                  <View style={[styles.msgRow, styles.msgRowBot]}>
                    <View style={styles.botAvatarWrap}>
                      <TamaizAvatar size={26} />
                    </View>
                    <TypingDots />
                  </View>
                )}

                {/* ── Email summary prompt ── */}
                {showEmailPrompt && !emailDeclined && (
                  <View style={styles.emailPromptCard}>
                    {emailSent ? (
                      <Text style={styles.emailSentText}>
                        {isAr
                          ? "✅ تم إرسال الملخص على إيميلك بنجاح!"
                          : "✅ Summary sent to your email!"}
                      </Text>
                    ) : (
                      <>
                        <Text style={styles.emailPromptTitle}>
                          {isAr
                            ? "📧 هل تريد ملخص المحادثة؟"
                            : "📧 Want a chat summary?"}
                        </Text>
                        <Text style={styles.emailPromptSub}>
                          {isAr
                            ? "نرسله على إيميلك مباشرة من info@dt-tour.com"
                            : "We'll send it to your email from info@dt-tour.com"}
                        </Text>

                        <TextInput
                          style={styles.emailInput}
                          value={emailInput}
                          onChangeText={setEmailInput}
                          placeholder={isAr ? "بريدك الإلكتروني" : "Your email address"}
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          maxLength={100}
                        />

                        {emailError && (
                          <Text style={styles.emailErrorText}>{emailError}</Text>
                        )}

                        <View style={styles.emailBtnRow}>
                          <Pressable
                            style={({ pressed }) => [
                              styles.emailSendBtn,
                              (!emailInput.trim() || emailSending) && styles.emailSendBtnDisabled,
                              pressed && emailInput.trim() && { opacity: 0.8 },
                            ]}
                            onPress={sendEmailSummary}
                            disabled={!emailInput.trim() || emailSending}
                          >
                            {emailSending ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={styles.emailSendBtnText}>
                                {isAr ? "إرسال" : "Send"}
                              </Text>
                            )}
                          </Pressable>
                          <Pressable
                            style={({ pressed }) => [
                              styles.emailDeclineBtn,
                              pressed && { opacity: 0.7 },
                            ]}
                            onPress={() => setEmailDeclined(true)}
                          >
                            <Text style={styles.emailDeclineBtnText}>
                              {isAr ? "لا شكراً" : "No thanks"}
                            </Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                )}
              </ScrollView>

              {showWhatsAppBanner && (
                <View style={styles.waBannerWrap}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.waBanner,
                      pressed && { opacity: 0.75 },
                    ]}
                    onPress={openWhatsApp}
                  >
                    <WhatsAppIcon size={15} color="#25D366" />
                    <Text style={styles.waBannerText}>
                      {isAr
                        ? "تحدث مع فريق خدمة العملاء مباشرة على واتساب"
                        : "Connect directly with our team on WhatsApp"}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* ── Hotel brand autocomplete suggestions ── */}
              {hotelSuggestions.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={styles.suggestRow}
                  contentContainerStyle={styles.suggestContent}
                >
                  {hotelSuggestions.map((s, i) => (
                    <Pressable
                      key={i}
                      style={({ pressed }) => [
                        styles.suggestChip,
                        pressed && styles.suggestChipPressed,
                      ]}
                      onPress={async () => {
                        if (s.isBrandOnly) {
                          // Fetch city-brand pairs for this brand and show a city picker row
                          setPendingBrandLabel(s.name);
                          setHotelSuggestions([]);
                          // Capture the generation so this fetch is discarded if the
                          // user sends a message, taps another chip, or types a new
                          // query before it resolves — otherwise a late response
                          // would re-open a stale "Which city?" row after the send.
                          const myGen = ++suggestGenRef.current;
                          setBrandCityLoading(true);
                          // Fallback: if the city list comes back empty or the fetch
                          // fails, don't leave the user at a dead end — send the brand
                          // name as a normal search so something visible happens.
                          const fallbackToBrandSearch = () => {
                            if (suggestGenRef.current !== myGen) return;
                            setBrandCityChips(null);
                            setBrandCityLoading(false);
                            forceSendTextRef.current = s.name;
                            forceSendEnQueryRef.current = s.enQuery ?? null;
                            handleSend();
                          };
                          try {
                            const res = await fetch(
                              `${API_BASE}/hotel-suggest-local?q=${encodeURIComponent(s.name)}&lang=${isAr ? "ar" : "en"}`,
                            );
                            if (suggestGenRef.current !== myGen) return;
                            if (!res.ok) {
                              fallbackToBrandSearch();
                              return;
                            }
                            const data: HotelSuggestItem[] = await res.json();
                            // Keep only city-brand pairs (non-brand-only)
                            const cityPairs = (Array.isArray(data) ? data : []).filter((d) => !d.isBrandOnly);
                            if (suggestGenRef.current !== myGen) return;
                            if (cityPairs.length > 0) {
                              setBrandCityChips(cityPairs);
                              setBrandCityLoading(false);
                            } else {
                              fallbackToBrandSearch();
                            }
                          } catch {
                            fallbackToBrandSearch();
                          }
                        } else {
                          forceSendTextRef.current = s.name;
                          // Store the English hotel query so the AI gets a clean name
                          // for the [HOTEL_NAME] token, while the chat shows Arabic.
                          forceSendEnQueryRef.current = s.enQuery ?? null;
                          setHotelSuggestions([]);
                          setBrandCityChips(null);
                          handleSend();
                        }
                      }}
                    >
                      <Text style={styles.suggestChipLabel}>🏨 {s.name}</Text>
                      {!!s.subtitle && (
                        <Text style={styles.suggestChipSub}>{s.subtitle}</Text>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {/* ── City picker loading hint (while brand city list is fetching) ── */}
              {brandCityLoading && !brandCityChips && (
                <View style={[styles.cityPickerHeader, { justifyContent: "flex-start", gap: 8, paddingBottom: 6 }]}>
                  <ActivityIndicator size="small" color={GOLD} />
                  <Text style={styles.cityPickerLabel}>
                    {isAr
                      ? `${pendingBrandLabel} — جاري تحميل المدن…`
                      : `${pendingBrandLabel} — Loading cities…`}
                  </Text>
                </View>
              )}

              {/* ── City quick-picker (appears after tapping a brand-only chip) ── */}
              {brandCityChips && brandCityChips.length > 0 && (
                <View>
                  <View style={styles.cityPickerHeader}>
                    <Text style={styles.cityPickerLabel}>
                      {isAr ? `${pendingBrandLabel} — أي مدينة؟` : `${pendingBrandLabel} — Which city?`}
                    </Text>
                    <Pressable
                      onPress={() => setBrandCityChips(null)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.cityPickerClose}>✕</Text>
                    </Pressable>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    style={styles.suggestRow}
                    contentContainerStyle={styles.suggestContent}
                  >
                    {brandCityChips.map((s, i) => (
                      <Pressable
                        key={i}
                        style={({ pressed }) => [
                          styles.suggestChip,
                          styles.cityChip,
                          pressed && styles.suggestChipPressed,
                        ]}
                        onPress={() => {
                          forceSendTextRef.current = s.name;
                          forceSendEnQueryRef.current = s.enQuery ?? null;
                          setBrandCityChips(null);
                          handleSend();
                        }}
                      >
                        <Text style={styles.suggestChipLabel}>📍 {s.name}</Text>
                        {!!s.subtitle && (
                          <Text style={styles.suggestChipSub}>{s.subtitle}</Text>
                        )}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* ── Input bar ── */}
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.inputBox, isAr && { textAlign: "right" }]}
                  value={input}
                  onChangeText={setInput}
                  placeholder={isAr ? "اكتب رسالتك..." : "Type your message..."}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  multiline
                  maxLength={500}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  blurOnSubmit={false}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.sendBtn,
                    (!input.trim() || loading) && styles.sendBtnDisabled,
                    pressed && input.trim() && { opacity: 0.8 },
                  ]}
                  onPress={handleSend}
                  disabled={!input.trim() || loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={{ alignItems: "center" }}>
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: 13,
                          fontFamily: "Inter_700Bold",
                          lineHeight: 16,
                        }}
                      >
                        إرسال
                      </Text>
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.65)",
                          fontSize: 9.5,
                          fontFamily: "Inter_400Regular",
                          lineHeight: 13,
                          letterSpacing: 0.3,
                        }}
                      >
                        Send
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          )}
        </Animated.View>

        {/* ── Subscription overlay — absolute inside styles.overlay so it has a sized parent ── */}
        {showSubscribeModal && (
          <View style={StyleSheet.absoluteFillObject}>
            {/* Backdrop — behind the card; tap outside card → dismiss */}
            <Pressable
              style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.82)" }]}
              onPress={closeSubscribeModal}
            />
            {/* Centering container — box-none so backdrop taps pass through */}
            <KeyboardAvoidingView
              style={[StyleSheet.absoluteFillObject, { justifyContent: "center", paddingHorizontal: 20 }]}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              pointerEvents="box-none"
            >
              <View style={[styles.subModalCard, { maxHeight: screenHeight * 0.88 }]}>
                <Pressable style={styles.subModalClose} onPress={closeSubscribeModal}>
                  <Text style={styles.subModalCloseText}>✕</Text>
                </Pressable>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.subModalScroll}
                  keyboardShouldPersistTaps="handled"
                >
                {/* header */}
                <View style={{ alignItems: "center", gap: 8, marginBottom: 18 }}>
                  <View style={styles.subModalAvatarOuter}>
                    <View style={styles.subModalAvatarInner}>
                      <TamaizAvatar size={56} />
                    </View>
                  </View>
                  <View style={styles.subModalBrandRow}>
                    <Text style={styles.subModalBrandAr}>تميز</Text>
                    <Text style={styles.subModalBrandDot}> · </Text>
                    <Text style={styles.subModalBrandEn}>TAMAIZ</Text>
                  </View>
                  <Text style={styles.subModalSubtitle}>اختر باقتك وابدأ رحلتك الذكية</Text>
                </View>

                {/* plan cards */}
                {SUBSCRIPTION_PLANS.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  return (
                  <View
                    key={plan.id}
                    style={[
                      styles.subModalPlan,
                      plan.badge === "⭐ الأفضل" && styles.subModalPlanBest,
                      plan.platinum && styles.subModalPlanPlatinum,
                      isSelected && styles.subModalPlanSelected,
                    ]}
                  >
                    {plan.badge && (
                      <View style={[styles.subModalBestBadge, plan.platinum && styles.subModalPlatinumBadge]}>
                        <Text style={[styles.subModalBestBadgeText, plan.platinum && { color: "#000" }]}>
                          {plan.badge}
                        </Text>
                      </View>
                    )}
                    <View style={styles.subModalPlanRow}>
                      <View>
                        <Text style={[styles.subModalPlanNameAr, plan.platinum && { color: "#E5D4FF" }]}>
                          {plan.arLabel}
                        </Text>
                        <Text style={styles.subModalPlanNameEn}>{plan.enLabel}</Text>
                      </View>
                      <View style={styles.subModalPlanPriceWrap}>
                        <Text style={[styles.subModalPlanPrice, plan.platinum && { color: "#C9B8FF" }]}>
                          {plan.price}
                        </Text>
                        <Text style={styles.subModalPlanPriceCurrency}> KWD/شهر</Text>
                      </View>
                    </View>
                    <View style={[styles.subModalPlanDivider, plan.platinum && { backgroundColor: "rgba(200,180,255,0.15)" }]} />
                    <View style={styles.subModalPlanFeatures}>
                      {[
                        `${plan.searches} بحث طيران يومياً ✈️`,
                        plan.id === "tamaiz" ? "10 خطط رحلة يومياً 🗺️" : plan.id === "plus" ? "20 خطة رحلة يومياً 🗺️" : "30 خطة رحلة يومياً 🗺️",
                        plan.devices === 1 ? "جهاز واحد مرتبط 📱" : `حتى ${plan.devices} أجهزة مرتبطة 📱`,
                        "محادثات AI غير محدودة 24/7 💬",
                        "كود تفعيل فوري 🔑",
                      ].map((feat) => (
                        <View key={feat} style={styles.subModalFeatureRow}>
                          <Text style={[styles.subModalFeatureCheck, plan.platinum && { color: "#A78BFA" }]}>✓</Text>
                          <Text style={[styles.subModalPlanFeature, plan.platinum && { color: "rgba(220,210,255,0.85)" }]}>
                            {feat}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <Pressable
                      style={({ pressed }) => [
                        styles.subModalSelectBtn,
                        isSelected && styles.subModalSelectBtnActive,
                        plan.platinum && !isSelected && styles.subModalSelectBtnPlatinum,
                        pressed && { opacity: 0.75 },
                      ]}
                      onPress={() => setSelectedPlanId(isSelected ? null : plan.id)}
                    >
                      <Text style={[styles.subModalSelectBtnText, isSelected && { color: "#25D366" }]}>
                        {isSelected
                          ? (isAr ? "✓ تم الاختيار" : "✓ Selected")
                          : (isAr ? `اختر — ${plan.price} KWD` : `Select — ${plan.price} KWD`)}
                      </Text>
                    </Pressable>
                  </View>
                  );
                })}

                <Text style={styles.subModalBillingNote}>
                  💳 دفع آمن مباشر — لا تجديد تلقائي
                </Text>

                <View style={styles.subModalDivider} />

                {/* ── Checkout section — appears when a plan is selected ── */}
                {selectedPlanId ? (
                  <View style={styles.subModalCheckout}>
                    <Text style={styles.subModalCheckoutLabel}>
                      {isAr ? "📧 بريدك الإلكتروني لاستلام الكود" : "📧 Email to receive your activation code"}
                    </Text>
                    <TextInput
                      style={[styles.subModalEmailInput, !!subEmailError && styles.subModalEmailInputError]}
                      value={subEmail}
                      onChangeText={(t) => { setSubEmail(t); setSubEmailError(null); }}
                      placeholder={isAr ? "أدخل بريدك الإلكتروني" : "Enter your email address"}
                      placeholderTextColor="rgba(255,255,255,0.30)"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {subEmailError && <Text style={styles.subModalEmailError}>{subEmailError}</Text>}
                    {subPayError  && <Text style={styles.subModalPayError}>{subPayError}</Text>}
                    <Pressable
                      style={({ pressed }) => [
                        styles.subModalPayBtn,
                        subLoading && { opacity: 0.65 },
                        pressed && !subLoading && { opacity: 0.85 },
                      ]}
                      onPress={() => handleSubscribePay(selectedPlanId)}
                      disabled={subLoading}
                    >
                      {subLoading ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Text style={styles.subModalPayBtnText}>
                          {(() => {
                            const pl = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlanId);
                            return isAr
                              ? `💳 ادفع ${pl?.price ?? ""} KWD — باقة ${pl?.arLabel ?? ""}`
                              : `💳 Pay ${pl?.price ?? ""} KWD — ${pl?.enLabel ?? ""}`;
                          })()}
                        </Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, alignSelf: "center", marginTop: 4 }]}
                      onPress={() => {
                        closeSubscribeModal();
                        const msg = encodeURIComponent("السلام عليكم، أرغب في الاشتراك في إحدى باقات دار التميز تورز.");
                        Linking.openURL(`https://wa.me/${WA_NUMBER}?text=${msg}`);
                      }}
                    >
                      <Text style={styles.subModalWaFallback}>
                        {isAr ? "أو تواصل معنا عبر واتساب 💬" : "or contact us on WhatsApp 💬"}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ alignItems: "center", paddingBottom: 8 }}>
                    <Text style={styles.subModalCtaSub}>
                      {isAr ? "↑ اختر الباقة المناسبة لك للمتابعة" : "↑ Select a plan above to continue"}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
        )}
      </View>

      {webViewUrl && (
        <InAppBrowserModal url={webViewUrl} onClose={() => setWebViewUrl(null)} />
      )}

    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: NAVY_BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
    borderTopWidth: 1.5,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: "rgba(212,175,55,0.3)",
  },

  /* ── Header ── */
  header: {
    flexDirection: "column",
    backgroundColor: "#060E1E",
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,175,55,0.18)",
    gap: 10,
  },
  headerRow1: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerRow2: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    flex: 1,
    minWidth: 0,
  },
  headerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarOuter: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: "#4A8FE7",
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A1628",
  },
  avatarInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
    backgroundColor: "#111",
  },
  headerName: {
    color: GOLD,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  headerSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10.5,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  tierBadgeFree: {
    borderColor: "rgba(255,255,255,0.20)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  tierBadgePremium: {
    borderColor: "rgba(212,175,55,0.55)",
    backgroundColor: "rgba(212,175,55,0.12)",
  },
  tierBadgePlatinum: {
    borderColor: "rgba(220,220,255,0.65)",
    backgroundColor: "rgba(180,180,230,0.14)",
  },
  tierBadgeAdmin: {
    borderColor: "#D4AF37",
    backgroundColor: "#D4AF37",
  },
  tierBadgeText: {
    color: "rgba(212,175,55,0.90)",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  tierBadgeTextAdmin: {
    color: "#000",
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.50)",
    backgroundColor: "rgba(212,175,55,0.09)",
  },
  logoutBtnText: {
    color: "#D4AF37",
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.35)",
    backgroundColor: "rgba(255,80,80,0.07)",
  },
  clearBtnText: {
    color: "rgba(255,120,120,0.85)",
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },

  /* ── Session loading ── */
  sessionLoadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Welcome / Lang picker ── */
  langPicker: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 14,
    flexGrow: 1,
  },
  avatarCluster: {
    width: 176,
    height: 176,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarHalo: {
    position: "absolute",
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.22)",
    backgroundColor: "transparent",
  },
  avatarOuterLg: {
    width: 156,
    height: 156,
    borderRadius: 78,
    borderWidth: 3,
    borderColor: "#4A8FE7",
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A1628",
  },
  avatarInnerLg: {
    width: 138,
    height: 138,
    borderRadius: 69,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    backgroundColor: "#0d1f3c",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: NAVY,
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadgeText: {
    color: GOLD,
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: -2,
  },
  brandTextAr: {
    color: GOLD,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0,
    paddingHorizontal: 4,
  },
  brandTextEn: {
    color: GOLD,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 3,
  },
  brandDot: {
    color: "rgba(212,175,55,0.5)",
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0,
  },
  langTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  langTitleSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  nameFieldWrap: {
    width: "100%",
    gap: 6,
  },
  nameLabel: {
    color: GOLD,
    fontSize: 12.5,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: 0.4,
  },
  nameInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderWidth: 1.5,
    borderColor: "rgba(0,31,91,0.9)",
    textAlign: "center",
  },
  nameInputError: {
    borderColor: "#FF6B6B",
    backgroundColor: "rgba(255,107,107,0.06)",
  },
  nameError: {
    color: "#FF8080",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  langPrompt: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  langBtnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  langBtn: {
    flex: 1,
    backgroundColor: NAVY,
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  langBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  /* ── Chat messages ── */
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: 14,
    gap: 12,
    paddingBottom: 8,
  },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowBot: { justifyContent: "flex-start" },
  botAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: GOLD,
    overflow: "hidden",
    flexShrink: 0,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  bubbleUser: {
    backgroundColor: NAVY,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: "#0D1C35",
    borderBottomLeftRadius: 4,
    borderWidth: 0.5,
    borderColor: "rgba(0,31,91,0.6)",
  },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: "#FFFFFF", fontFamily: "Inter_700Bold" },
  bubbleTextBot: { color: "#FFFFFF", fontFamily: "Inter_400Regular" },

  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D1C35",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 5,
    borderWidth: 0.5,
    borderColor: "rgba(0,31,91,0.5)",
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: NAVY,
  },

  flightCta: {
    marginTop: 8,
    backgroundColor: "#0A1628",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "stretch",
    borderWidth: 1.5,
    borderColor: "#D4AF37",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  flightCtaText: {
    color: "#D4AF37",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: 0,
  },
  inlineCta: {
    marginTop: 8,
    backgroundColor: "#25D366",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  inlineCtaText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },

  waBannerWrap: {
    alignItems: "center",
    backgroundColor: NAVY_BG,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  waBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    gap: 6,
    backgroundColor: "rgba(37,211,102,0.12)",
    borderWidth: 1,
    borderColor: "#25D366",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  waBannerText: {
    color: "#25D366",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },

  /* ── Email summary card ── */
  emailPromptCard: {
    backgroundColor: "#0D1C35",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.25)",
    padding: 14,
    gap: 10,
    marginTop: 6,
  },
  emailPromptTitle: {
    color: GOLD,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  emailPromptSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  emailInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: "rgba(0,31,91,0.8)",
    textAlign: "center",
  },
  emailErrorText: {
    color: "#FF8080",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  emailSentText: {
    color: "#4CAF50",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    paddingVertical: 4,
  },
  emailBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  emailSendBtn: {
    flex: 1,
    backgroundColor: NAVY,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: GOLD,
  },
  emailSendBtnDisabled: {
    opacity: 0.4,
  },
  emailSendBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  emailDeclineBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  emailDeclineBtnText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },

  /* ── Hotel brand autocomplete suggestion strip ── */
  suggestRow: {
    backgroundColor: "#060E1E",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,31,91,0.5)",
    maxHeight: 46,
  },
  suggestContent: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  suggestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(212,175,55,0.1)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.4)",
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  suggestChipPressed: {
    backgroundColor: "rgba(212,175,55,0.25)",
  },
  suggestChipLabel: {
    color: GOLD,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  suggestChipSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },

  /* ── City quick-picker (brand → city expansion row) ── */
  cityPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#060E1E",
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 2,
    borderTopWidth: 1,
    borderTopColor: "rgba(212,175,55,0.25)",
  },
  cityPickerLabel: {
    color: GOLD,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  cityPickerClose: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    paddingLeft: 8,
  },
  cityChip: {
    borderColor: "rgba(212,175,55,0.6)",
    backgroundColor: "rgba(212,175,55,0.06)",
  },

  /* ── Input bar ── */
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,31,91,0.7)",
    backgroundColor: "#060E1E",
  },
  inputBox: {
    flex: 1,
    backgroundColor: "#0D1C35",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "rgba(0,31,91,0.8)",
  },
  sendBtn: {
    backgroundColor: NAVY,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
    flexShrink: 0,
    minWidth: 52,
  },
  sendBtnDisabled: {
    backgroundColor: "#0e1e3a",
    opacity: 0.55,
  },

  /* ── Block / Cooldown screen ── */
  blockScreen: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 40,
    gap: 20,
  },
  blockIcon: {
    fontSize: 52,
    textAlign: "center",
  },
  blockTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 24,
    letterSpacing: 0,
  },
  blockTimerBox: {
    alignItems: "center",
    backgroundColor: "rgba(212,175,55,0.1)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    paddingHorizontal: 28,
    paddingVertical: 14,
    gap: 4,
  },
  blockTimerLabel: {
    color: GOLD,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
  },
  blockTimer: {
    color: GOLD,
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    letterSpacing: 3,
    textAlign: "center",
  },
  blockWaBtn: {
    backgroundColor: "#25D366",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
    width: "100%",
    alignItems: "center",
  },
  blockWaBtnText: {
    color: "#000",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: 0,
  },
  blockPromoWrap: {
    width: "100%",
    gap: 10,
    marginTop: 6,
  },
  blockPromoLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
    letterSpacing: 0,
  },
  blockPromoInput: {
    backgroundColor: "#0D1C35",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.4)",
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlign: "center",
    letterSpacing: 2,
  },
  blockPromoBtn: {
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  blockPromoBtnDisabled: {
    opacity: 0.4,
  },
  blockPromoBtnText: {
    color: "#000",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0,
  },
  blockPromoError: {
    color: "#FF6B6B",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    letterSpacing: 0,
  },
  blockPromoSuccess: {
    color: "#4CAF50",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: 0,
  },
  blockSubscribeLink: {
    color: GOLD,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: 0,
    textDecorationLine: "underline",
  },

  // ── Welcome screen extra ──
  langDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  langDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  langDividerText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0,
  },
  langSubscribeLink: {
    color: "#4A8FE7",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    textAlign: "center",
    letterSpacing: 0,
    textShadowColor: "rgba(74,143,231,0.85)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  langBtnSelected: {
    borderColor: "rgba(255,255,255,0.45)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  langCodeWrap: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    marginTop: 4,
  },
  langCodeInputBox: {
    flex: 1,
    height: 54,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.25)",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  langCodeInput: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    padding: 0,
    textAlign: "center",
    letterSpacing: 0,
  },
  langCodeBtn: {
    width: 58,
    height: 54,
    backgroundColor: "rgba(212,175,55,0.09)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.50)",
    alignItems: "center",
    justifyContent: "center",
  },
  langCodeBtnText: {
    color: "#D4AF37",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0,
  },
  langCodeError: {
    color: "#FF6B6B",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    letterSpacing: 0,
    marginTop: -4,
  },
  langGuestHint: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    letterSpacing: 0,
    marginTop: 2,
  },

  // ── Premium subscription modal ──
  subModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  subModalCard: {
    backgroundColor: "#0D1C35",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    paddingHorizontal: 24,
    paddingTop: 46,
    paddingBottom: 0,
    maxHeight: "88%",
    alignSelf: "stretch",
  },
  subModalScroll: {
    flexGrow: 1,
    gap: 10,
    paddingBottom: 48,
  },
  subModalClose: {
    position: "absolute",
    top: 12,
    right: 14,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 17,
    zIndex: 10,
  },
  subModalCloseText: {
    color: "rgba(255,255,255,0.70)",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  subModalAvatarWrap: {
    alignItems: "center",
    marginTop: 8,
  },
  subModalAvatarOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: GOLD,
    padding: 3,
  },
  subModalAvatarInner: {
    flex: 1,
    borderRadius: 33,
    overflow: "hidden",
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  subModalBrandRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 0,
  },
  subModalBrandAr: {
    color: GOLD,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0,
  },
  subModalBrandDot: {
    color: "rgba(212,175,55,0.55)",
    fontSize: 17,
    fontFamily: "Inter_400Regular",
  },
  subModalBrandEn: {
    color: "rgba(212,175,55,0.85)",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
  },
  subModalSubtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    letterSpacing: 0,
    marginTop: -4,
  },
  subModalPlan: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 14,
    gap: 10,
  },
  subModalPlanBest: {
    borderColor: GOLD,
    backgroundColor: "rgba(212,175,55,0.07)",
  },
  subModalBestBadge: {
    alignSelf: "flex-end",
    backgroundColor: GOLD,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: -4,
  },
  subModalBestBadgeText: {
    color: "#000",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0,
  },
  subModalPlanRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subModalPlanNameAr: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0,
  },
  subModalPlanNameEn: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.5,
    marginTop: 1,
  },
  subModalPlanPriceWrap: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  subModalPlanPrice: {
    color: GOLD,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0,
  },
  subModalPlanPriceCurrency: {
    color: "rgba(212,175,55,0.75)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0,
  },
  subModalPlanPlatinum: {
    borderColor: "rgba(167,139,250,0.55)",
    backgroundColor: "rgba(109,40,217,0.10)",
  },
  subModalPlatinumBadge: {
    backgroundColor: "#7C3AED",
  },
  subModalPlanDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(212,175,55,0.18)",
    marginVertical: 2,
  },
  subModalPlanFeatures: {
    gap: 6,
  },
  subModalFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  subModalFeatureCheck: {
    color: GOLD,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    lineHeight: 18,
  },
  subModalPlanFeature: {
    flex: 1,
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0,
  },
  subModalBillingNote: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    letterSpacing: 0,
    marginTop: -4,
  },
  subModalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(212,175,55,0.22)",
  },
  subModalCta: {
    backgroundColor: "#25D366",
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 22,
    alignSelf: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    shadowColor: "#25D366",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.30,
    shadowRadius: 8,
    elevation: 4,
  },
  subModalCtaText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: 0,
  },
  subModalCtaSub: {
    color: "rgba(180,180,200,0.65)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    letterSpacing: 0,
    marginTop: 6,
  },
  subModalPlanSelected: {
    borderColor: "#25D366",
    borderWidth: 2,
    backgroundColor: "rgba(37,211,102,0.06)",
  },
  subModalSelectBtn: {
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    alignItems: "center",
  },
  subModalSelectBtnActive: {
    backgroundColor: "rgba(37,211,102,0.10)",
    borderColor: "#25D366",
  },
  subModalSelectBtnPlatinum: {
    borderColor: "rgba(167,139,250,0.5)",
  },
  subModalSelectBtnText: {
    color: "#D4AF37",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  subModalCheckout: {
    gap: 10,
    paddingBottom: 8,
  },
  subModalCheckoutLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  subModalEmailInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "left",
  },
  subModalEmailInputError: {
    borderColor: "#f44336",
  },
  subModalEmailError: {
    color: "#f44336",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  subModalPayError: {
    color: "#ff7043",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  subModalPayBtn: {
    backgroundColor: "rgba(212,175,55,0.10)",
    borderWidth: 1,
    borderColor: "#D4AF37",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  subModalPayBtnText: {
    color: "#D4AF37",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  subModalWaFallback: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingBottom: 4,
  },

  // ── Activation success confirmation card ──
  activationCardWrap: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 40,
    gap: 18,
  },
  activationBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 12,
  },
  activationBadgeText: {
    color: "#FFFFFF",
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    lineHeight: 38,
  },
  activationTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: 0,
  },
  activationTitleSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    letterSpacing: 0,
    marginTop: -10,
  },
  activationTable: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.28)",
    overflow: "hidden",
  },
  activationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  activationDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(212,175,55,0.18)",
    marginHorizontal: 18,
  },
  activationCell: {
    flex: 1,
    gap: 2,
  },
  activationCellLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0,
    textAlign: "left",
  },
  activationCellLabelSub: {
    color: "rgba(255,255,255,0.28)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0,
    textAlign: "left",
  },
  activationCellValue: {
    alignItems: "flex-end",
    gap: 2,
  },
  activationValueAr: {
    color: GOLD,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0,
    textAlign: "right",
  },
  activationValueEn: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0,
    textAlign: "right",
  },
  activationProceedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: "100%",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  activationProceedText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0,
  },
  activationProceedArrow: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
});
