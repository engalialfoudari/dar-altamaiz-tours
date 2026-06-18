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

const GOLD = "#D4AF37";
const BLACK = "#000000";
const NAVY_BG = "#0A1628";
const NAVY = "#001F5B";
const WHATSAPP_URL = "https://wa.me/96590087797";
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ??
  "https://d7b44d10-cfb5-4168-8f9f-8b2a418e4057-00-3rf50yqp3upmp.sisko.replit.dev/api";

const WHATSAPP_SIGNAL = "[WHATSAPP]";
const GOODBYE_SIGNAL = "[GOODBYE]";
const HOTEL_SIGNAL = "[HOTEL]";
const HOTEL_SIGNAL_RE = /\[HOTEL:([^\]]+)\]/;
// token format: City|checkin|checkout|stars
const OFFERS_SIGNAL = "[OFFERS]";
const FLIGHT_SIGNAL_RE = /\[FLIGHT:([^\]]+)\]/;
const ESCALATE_AFTER_MESSAGES = 8;
const STORAGE_KEY = "dtours_chat_v1";
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const BOT_NAME = "D.T. Tours Ai";

const DT_BASE = "https://dt-tours.com";

const FLIGHT_CARRIER_NAMES: Record<string, string> = {
  KU: "Kuwait Airways", J9: "Jazeera Airways", FZ: "flydubai",
  G9: "Air Arabia", EK: "Emirates", EY: "Etihad Airways",
  QR: "Qatar Airways", GF: "Gulf Air", WY: "Oman Air",
  SV: "Saudia", XY: "flynas", TK: "Turkish Airlines",
  PC: "Pegasus", W6: "Wizz Air", AI: "Air India",
  IX: "Air India Express", "6E": "IndiGo", PK: "PIA",
  UL: "SriLankan Airlines", BG: "Biman Bangladesh",
};

function parseFlightCards(html: string, from: string, to: string, depDate: string, searchId: string): ScrapedFlight[] {
  const results: ScrapedFlight[] = [];
  const bookUrl = `${DT_BASE}/index.php/flight/search/${searchId}`;
  const boundary = 'class="rowresult r-r-i';
  const positions: number[] = [];
  let i = 0;
  while ((i = html.indexOf(boundary, i)) !== -1) { positions.push(i); i += boundary.length; }
  if (positions.length === 0) return results;
  for (let n = 0; n < positions.length; n++) {
    const card = html.slice(positions[n], n + 1 < positions.length ? positions[n + 1] : html.length);
    const codeM = card.match(/data-code="([A-Z0-9]{2})"/);
    const code = codeM?.[1] ?? "";
    const nameM = card.match(/<span class="a-n"[^>]*>\s*([^<]+)<\/span>/);
    const carrier = nameM?.[1]?.trim() ?? (FLIGHT_CARRIER_NAMES[code] ?? code);
    const depM = card.match(/fltime dep_dt[^"]*"[^>]*>(\d{1,2}:\d{2})</);
    const arrM = card.match(/arr_dt[^"]*"[^>]*>(\d{1,2}:\d{2})</);
    const dep_ = depM?.[1] ?? "";
    const arr_ = arrM?.[1] ?? "";
    const priceM = card.match(/data-price="([\d.]+)"/);
    const price = priceM ? parseFloat(priceM[1]).toFixed(2) : "";
    const durM = card.match(/class="[^"]*(?:total_dur|durtime)[^"]*"[^>]*>([^<]+)</);
    const duration = durM ? durM[1].trim() : "";
    const isNonStop = /non[\s-]?stop|0\s*stop/i.test(card);
    const stopsM = card.match(/(\d+)\s*(?:stop|layover)/i);
    const stops = isNonStop ? 0 : stopsM ? parseInt(stopsM[1], 10) : 0;
    if ((dep_ || arr_) && (price || carrier)) {
      results.push({ carrier: carrier || "Airline", departure: dep_, arrival: arr_,
        depDate, origin: from, destination: to, stops, duration, price, currency: "KWD", bookUrl });
    }
  }
  return results;
}

type Language = "ar" | "en";
type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
  showWhatsApp?: boolean;
  flightToken?: string;
  showHotel?: boolean;
  showOffers?: boolean;
  hotelParams?: { city: string; checkin: string; checkout: string; stars?: number };
}

interface SavedSession {
  messages: Message[];
  language: Language;
  userName: string;
  savedAt: number;
}

const ROBOT_IMAGE = require("../assets/images/tamaiz-robot.png");

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
    return `السلام عليكم ورحمة الله وبركاته، حياكم الله 👋\nمعاكم ${BOT_NAME} مُساعدكم الشخصي في دار التميز تورز.\nشلون أقدر اساعدكم اليوم يا ${name}؟`;
  }
  return `Assalamu Alaikum, welcome! 👋\nI'm ${BOT_NAME}, your personal travel assistant at Dar AlTamaiz Tours.\nHow can I help you today, ${name}?`;
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

interface ScrapedFlight {
  carrier: string;
  departure: string;   // HH:MM
  arrival: string;     // HH:MM
  depDate: string;     // YYYY-MM-DD
  origin: string;
  destination: string;
  stops: number;
  duration: string;
  price: string;
  currency: string;
  bookUrl: string;
}

interface HotelOptionData {
  name: string;
  stars: number;
  location: string;
  price: string;
  currency: string;
  nights?: number;
  bookUrl: string;
}

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
      ar: "جاري البحث عن أفضل سعر لك... ✈️",
      en: "Searching the best price for you... ✈️",
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

function FlightInlineSearch({
  token,
  apiBase,
  isAr,
  openInApp,
}: {
  token: string;
  apiBase: string;
  isAr: boolean;
  openInApp: (url: string) => void;
}) {
  const parts = token.split("|");
  const [fromId, fromLabel, toId, toLabel, dep, ret, adultsStr] = parts;
  const adults = parseInt(adultsStr ?? "1") || 1;

  // "loading"  — spinner, fetch in progress
  // "waiting"  — 20 s passed, still fetching; show tap-to-open button
  // "done"     — inline results available
  // "fallback" — fetch completed, no inline results; auto-open with results URL
  const [status, setStatus] = React.useState<"loading" | "waiting" | "done" | "fallback">("loading");
  const [flights, setFlights] = React.useState<ScrapedFlight[]>([]);
  const [elapsed, setElapsed] = React.useState(0);
  const hasFetched = useRef(false);
  // dt-tours.com results URL returned by the scraper (or homepage as last resort)
  const fallbackUrlRef = useRef<string>("https://dt-tours.com");

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    // After 20 s switch to "waiting" UI but keep the fetch alive so the server
    // can return the real dt-tours.com results-page URL before we open anything.
    const waitingTid = setTimeout(() => {
      setStatus((s) => s === "loading" ? "waiting" : s);
    }, 20_000);

    void (async () => {
      try {
        // No client-side abort — let the server respond (up to 75 s).
        // The server now returns early once it has the searchId, so we get the
        // correct results-page URL rather than having to fall back to homepage.
        const res = await fetch(`${apiBase}/flight-scrape`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: fromId, to: toId,
            fromLabel: fromLabel ?? fromId,
            toLabel: toLabel ?? toId,
            depDate: dep, retDate: ret || undefined,
            adults,
          }),
        });
        clearTimeout(waitingTid);
        const data = await res.json() as { ok: boolean; flights?: ScrapedFlight[]; fallbackUrl?: string };
        if (data.fallbackUrl) fallbackUrlRef.current = data.fallbackUrl;
        if (data.ok && data.flights && data.flights.length > 0) {
          setFlights(data.flights.slice(0, 5));
          setStatus("done");
          return;
        }
      } catch { /* network error — fall back to dt-tours.com homepage */ }
      setStatus("fallback");
    })();

    return () => clearTimeout(waitingTid);
  }, []);

  const openFlightSearch = () => {
    openInApp(fallbackUrlRef.current);
  };

  // Auto-open the in-app browser once the correct dt-tours.com results URL is
  // available (status "fallback" = fetch completed, fallbackUrlRef updated).
  // We do NOT auto-open at "waiting" because we don't have the results URL yet.
  useEffect(() => {
    if (status === "fallback") {
      openFlightSearch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (status === "loading") {
    return <SearchLoadingCard isAr={isAr} elapsed={elapsed} label="flight" />;
  }

  // Still searching — give the user something to tap while we wait for the URL
  if (status === "waiting") {
    return (
      <View style={styles.flightWaiting}>
        <Text style={styles.flightWaitingText}>
          {isAr
            ? `✈️ جاري البحث… (${elapsed}ث)`
            : `✈️ Searching flights… (${elapsed}s)`}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.flightCtaSmall, pressed && { opacity: 0.7 }]}
          onPress={openFlightSearch}
        >
          <Text style={styles.flightCtaSmallText}>
            {isAr ? "فتح dt-tours.com الآن" : "Open dt-tours.com now"}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (status === "fallback") {
    return (
      <Pressable
        style={({ pressed }) => [styles.flightCta, pressed && { opacity: 0.8 }]}
        onPress={openFlightSearch}
      >
        <Text style={styles.flightCtaText}>
          {isAr ? "✈️ عرض نتائج الرحلات على dt-tours.com" : "✈️ View Flight Results on dt-tours.com"}
        </Text>
      </Pressable>
    );
  }

  const fmtDate = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(isAr ? "ar-KW" : "en-GB", { day: "numeric", month: "short" });
  };

  return (
    <View style={flightStyles.resultsWrap}>
      <Text style={flightStyles.resultsHeader}>
        {isAr ? `✈️ ${fromLabel} ← ${toLabel}` : `✈️ ${fromLabel} → ${toLabel}`}
      </Text>
      {flights.map((f, idx) => (
        <View key={idx} style={flightStyles.flightRow}>
          {/* Airline + stops */}
          <View style={flightStyles.flightLeft}>
            <Text style={flightStyles.flightCarrier} numberOfLines={2}>{f.carrier || "—"}</Text>
            {f.stops > 0 ? (
              <Text style={flightStyles.flightStops}>
                {isAr ? `${f.stops} توقف` : `${f.stops} stop${f.stops > 1 ? "s" : ""}`}
              </Text>
            ) : (
              <Text style={flightStyles.flightDirect}>{isAr ? "مباشر" : "Direct"}</Text>
            )}
          </View>
          {/* Times + date */}
          <View style={[flightStyles.flightMid, { flexDirection: "column", alignItems: "center", gap: 2 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={flightStyles.flightTime}>{f.departure || "—"}</Text>
              <Text style={flightStyles.flightArrow}>→</Text>
              <Text style={flightStyles.flightTime}>{f.arrival || "—"}</Text>
            </View>
            {(f.depDate || dep) ? (
              <Text style={flightStyles.flightDateLabel}>
                {fmtDate(f.depDate || dep)}{f.duration ? `  ·  ${f.duration}` : ""}
              </Text>
            ) : null}
          </View>
          {/* Price */}
          <View style={flightStyles.flightRight}>
            <Text style={flightStyles.flightPrice}>
              {f.currency} {f.price}
            </Text>
          </View>
        </View>
      ))}

      {/* Booking guidance */}
      <View style={flightStyles.bookingInfo}>
        <Text style={flightStyles.bookingInfoText}>
          {isAr
            ? "للحجز: تطبيقنا، موقعنا dt-tours.com، أو تواصل مع خدمة العملاء 💬"
            : "To book: our mobile app, dt-tours.com, or contact our customer service 💬"}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [flightStyles.moreBtn, pressed && { opacity: 0.8 }]}
        onPress={openFlightSearch}
      >
        <Text style={flightStyles.moreBtnText}>
          {isAr ? "عرض المزيد على الموقع →" : "View more on website →"}
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
          ? `🏨 فنادق${starsLabel} في ${params?.city ?? ""} (رخيص → غالي)`
          : `🏨 Hotels${starsLabel} in ${params?.city ?? ""} (cheap → expensive)`}
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
          style={({ pressed }) => [flightStyles.flightRow, pressed && { opacity: 0.85 }]}
          onPress={() => openInApp(h.bookUrl || "https://dt-tours.com")}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={flightStyles.flightCarrier} numberOfLines={2}>{h.name}</Text>
            <Text style={flightStyles.flightStops}>
              {"★".repeat(Math.min(h.stars, 5))} {h.location}
            </Text>
          </View>
          <View style={flightStyles.flightRight}>
            <Text style={flightStyles.flightPrice}>{h.currency} {h.price}</Text>
            <Text style={flightStyles.flightBook}>{isAr ? "احجز" : "Book"}</Text>
          </View>
        </Pressable>
      ))}
      <Pressable
        style={({ pressed }) => [flightStyles.moreBtn, pressed && { opacity: 0.8 }]}
        onPress={openWebsite}
      >
        <Text style={flightStyles.moreBtnText}>
          {isAr ? "عرض جميع الفنادق على الموقع →" : "View all hotels on website →"}
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
            <Text style={flightStyles.flightBook}>{isAr ? "تفاصيل →" : "Details →"}</Text>
          )}
        </Pressable>
      ))}
      <Pressable
        style={({ pressed }) => [flightStyles.moreBtn, pressed && { opacity: 0.8 }]}
        onPress={() => openInApp("https://dt-tours.com/index.php/tours/search")}
      >
        <Text style={flightStyles.moreBtnText}>
          {isAr ? "عرض جميع العروض →" : "View all offers →"}
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
        {/* Header bar */}
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
  flightRow: {
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
  flightLeft: {
    width: 50,
    gap: 2,
  },
  flightCarrier: {
    color: "#FFFFFF",
    fontSize: 12,
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
  flightMid: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  flightTime: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  flightArrow: {
    color: "rgba(212,175,55,0.6)",
    fontSize: 12,
  },
  flightRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  flightPrice: {
    color: GOLD,
    fontSize: 13,
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

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ChatbotScreen({ visible, onClose }: Props) {
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

  const scrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(600)).current;
  const userMsgCount = useRef(0);
  const hasCheckedSession = useRef(false);

  const isAr = language === "ar";
  const headerSub = isAr ? "مُساعدك الشخصي للسياحة" : "Your Personal Travel Assistant";

  const sheetMaxHeight =
    kbHeight > 0
      ? screenHeight - kbHeight - insets.top - 8
      : screenHeight * 0.9;
  const sheetMarginBottom = Platform.OS === "android" ? kbHeight : 0;

  // ── Keyboard listeners (Android) ──
  useEffect(() => {
    if (Platform.OS !== "android") return;
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
  }, []);

  // ── Session load & reset on visibility ──
  useEffect(() => {
    if (visible) {
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
    setSessionLoading(true);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const session = JSON.parse(raw) as SavedSession;
        if (Date.now() - session.savedAt < ONE_MONTH_MS) {
          setUserName(session.userName);
          setLanguage(session.language);
          setMessages(session.messages);
          userMsgCount.current = session.messages.filter((m) => m.role === "user").length;
        } else {
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      // Ignore storage errors silently
    } finally {
      setSessionLoading(false);
    }
  }, []);

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

  // ── Send message ──
  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    userMsgCount.current += 1;

    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: text };
    const historyForApi: Array<{ role: Role; content: string }> = [
      ...messages
        .filter((m) => m.id !== "greeting")
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(`${API_BASE}/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: historyForApi,
          userName: userName.trim(),
          language: language ?? "ar",
        }),
      });

      clearTimeout(timeoutId);

      const data = (await res.json()) as {
        ok: boolean;
        content?: string;
        error?: string;
      };
      const raw =
        data.content ??
        (isAr ? "عذراً، صار خطأ. حاول مرة ثانية!" : "Sorry, something went wrong. Please try again!");

      const hasEscalation = raw.includes(WHATSAPP_SIGNAL);
      const hasGoodbye = raw.includes(GOODBYE_SIGNAL);
      const hotelMatch = HOTEL_SIGNAL_RE.exec(raw);
      const hasHotel = !!hotelMatch || raw.includes(HOTEL_SIGNAL);
      const hasOffers = raw.includes(OFFERS_SIGNAL);
      const flightMatch = FLIGHT_SIGNAL_RE.exec(raw);
      const flightToken = flightMatch ? flightMatch[1] : undefined;

      let hotelParams: { city: string; checkin: string; checkout: string; stars?: number } | undefined;
      if (hotelMatch) {
        const [city, checkin, checkout, starsStr] = hotelMatch[1].split("|");
        const stars = parseInt(starsStr ?? "0") || 0;
        hotelParams = {
          city: city?.trim() ?? "",
          checkin: checkin?.trim() ?? "",
          checkout: checkout?.trim() ?? "",
          stars: stars > 0 ? stars : undefined,
        };
      }

      const clean = raw
        .replace(WHATSAPP_SIGNAL, "")
        .replace(GOODBYE_SIGNAL, "")
        .replace(HOTEL_SIGNAL_RE, "")
        .replace(HOTEL_SIGNAL, "")
        .replace(OFFERS_SIGNAL, "")
        .replace(FLIGHT_SIGNAL_RE, "")
        .trimEnd();

      const botMsg: Message = {
        id: `b_${Date.now()}`,
        role: "assistant",
        content: clean,
        showWhatsApp: hasEscalation,
        flightToken,
        showHotel: hasHotel,
        hotelParams,
        showOffers: hasOffers,
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
        headers: { "Content-Type": "application/json" },
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

  if (!visible) return null;

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
            <View style={styles.headerRight}>
              {language !== null && (
                <Pressable
                  onPress={clearChat}
                  hitSlop={10}
                  style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.clearBtnText}>
                    {isAr ? "مسح" : "Clear"}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
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
          </View>

          {/* ── Loading session ── */}
          {sessionLoading ? (
            <View style={styles.sessionLoadingWrap}>
              <ActivityIndicator size="large" color={GOLD} />
            </View>
          ) : language === null ? (
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
                    <TamaizAvatar size={76} />
                  </View>
                </View>
                <View style={styles.avatarBadge}>
                  <Text style={styles.avatarBadgeText}>AI</Text>
                </View>
              </View>
              <Text style={styles.avatarBrand}>تميز · TAMAIZ</Text>

              <Text style={styles.langTitle}>مرحباً بكم 👋</Text>
              <Text style={styles.langTitleSub}>Welcome to Dar AlTamaiz Tours</Text>

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
                  style={({ pressed }) => [styles.langBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => startChat("ar")}
                >
                  <Text style={styles.langBtnText}>عربي 🇰🇼</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.langBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => startChat("en")}
                >
                  <Text style={styles.langBtnText}>English 🇬🇧</Text>
                </Pressable>
              </View>
            </ScrollView>
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
                      {msg.flightToken && (
                        <FlightInlineSearch
                          token={msg.flightToken}
                          apiBase={API_BASE}
                          isAr={isAr}
                          openInApp={openInApp}
                        />
                      )}
                      {msg.showHotel && !msg.flightToken && (
                        <HotelInlineSearch
                          apiBase={API_BASE}
                          isAr={isAr}
                          params={msg.hotelParams}
                          openInApp={openInApp}
                        />
                      )}
                      {msg.showOffers && (
                        <OffersDisplay
                          apiBase={API_BASE}
                          isAr={isAr}
                          openInApp={openInApp}
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
                <Pressable
                  style={({ pressed }) => [
                    styles.waBanner,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={openWhatsApp}
                >
                  <Text style={styles.waBannerText}>
                    {isAr
                      ? "💬 تحدث مع فريق خدمة العملاء مباشرة على واتساب"
                      : "💬 Connect directly with our team on WhatsApp"}
                  </Text>
                </Pressable>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#060E1E",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,31,91,0.8)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  avatarOuter: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: GOLD,
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
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  clearBtnText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  closeBtn: {
    padding: 6,
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
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  avatarHalo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.18)",
    backgroundColor: "transparent",
  },
  avatarOuterLg: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2.5,
    borderColor: GOLD,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A1628",
  },
  avatarInnerLg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
    backgroundColor: "#111",
  },
  avatarBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: NAVY,
    borderWidth: 1.5,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadgeText: {
    color: GOLD,
    fontSize: 8,
    fontFamily: "Inter_700Bold",
  },
  avatarBrand: {
    color: GOLD,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: -6,
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
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  langBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
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
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: "#D4AF37",
    flexDirection: "row",
    alignItems: "center",
  },
  flightCtaText: {
    color: "#D4AF37",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  flightWaiting: {
    marginTop: 8,
    backgroundColor: "#0A1628",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#444",
    gap: 8,
  },
  flightWaitingText: {
    color: "#aaa",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  flightCtaSmall: {
    backgroundColor: "transparent",
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#D4AF37",
    alignSelf: "flex-start",
  },
  flightCtaSmallText: {
    color: "#D4AF37",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
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

  waBanner: {
    backgroundColor: "#1A3A2A",
    borderTopWidth: 1,
    borderColor: "#25D366",
    paddingVertical: 11,
    paddingHorizontal: 16,
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
});
