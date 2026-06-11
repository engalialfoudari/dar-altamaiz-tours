import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

export const TICKER_HEIGHT = 56;
const SCROLL_SPEED = 28; // px/s — slow, majestic
const API_BASE = (process.env["EXPO_PUBLIC_API_BASE"] ?? "").replace(/\/$/, "");
const REFRESH_MS = 30 * 60 * 1000;
const SEPARATOR = "               —               ";
const ND = Platform.OS !== "web";
const LIVE_GREEN = "#00E676";

type Segment = { text: string; live?: boolean };

const MESSAGES: Array<{ ar: string; en: string }> = [
  {
    ar: "استمتع بمميزات الاسترداد النقدي الفوري عند إتمام حجزك القادم عبر التطبيق. سعر صرف الدولار الحالي: {USD_KWD} د.ك",
    en: "Enjoy instant cashback rewards on your next booking through the app. Current USD rate: {USD_KWD} KWD",
  },
  {
    ar: "تذكير: يرجى التأكد من صلاحية جواز السفر لمدة لا تقل عن 6 أشهر قبل موعد رحلتك القادمة",
    en: "Reminder: Ensure your passport is valid for at least 6 months before your upcoming departure",
  },
  {
    ar: "تمنياتنا لك برحلة سعيدة.. درجة الحرارة الحالية في لندن الآن: {LONDON_TEMP}",
    en: "Wishing you a wonderful journey.. Current temperature in London right now: {LONDON_TEMP}",
  },
  {
    ar: "اختصر وقتك وجهدك.. صمم باقة عطلتك المتكاملة من طيران وفنادق بلمسة واحدة وبأعلى درجات السهولة",
    en: "Save time and effort.. Customize your complete holiday package with flights and hotels in just one tap",
  },
  {
    ar: "احجز بطمأنينة وأمان.. جميع معاملاتك وحجوزاتك عبر منصتنا محمية بأعلى معايير الأمان العالمية",
    en: "Book with confidence.. All your transactions and bookings are fully secured with top global standards",
  },
  {
    ar: "تخطيط لسفرة جماعية؟ تواصل معنا الآن لتنسيق أجمل الرحلات والقروبات السياحية المتكاملة لخدمتكم",
    en: "Planning a group trip? Connect with us now to coordinate the finest integrated curated tours for you",
  },
  {
    ar: "تأكد من مراجعة الأوزان المسموحة على تذكرتك قبل التوجه للمطار لتجنب أي رسوم إضافية غير ضرورية",
    en: "Check the baggage weight allowance on your ticket before heading to the airport to avoid extra fees",
  },
  {
    ar: "سافر مع رفيق دربك الموثوق.. دار التميز نضع خبرتنا الطويلة منذ عام 2008 بين يديك لضمان عطلة تفوق توقعاتك",
    en: "Travel with your trusted partner.. Dar AlTamaiz puts over a decade of travel expertise at your service",
  },
  {
    ar: "مرونة تامة في التخطيط.. يمكنك متابعة تفاصيل حجزك وإدارته بسهولة تامة وبأعلى درجات الراحة عبر منصتنا",
    en: "Full flexibility in planning.. Track and manage your booking details seamlessly through our platform",
  },
  {
    ar: "العالم ينتظرك لاستكشافه.. خطط لرحلتك القادمة بتميز ودع مستشاري السفر لدينا يرسمون لك تفاصيلها الفاخرة",
    en: "The world awaits.. Plan your next journey with excellence and let our experts curate every luxury detail",
  },
  {
    ar: "تذكر تفعيل بطاقاتك المصرفية للاستخدام الدولي وتأكَّد من الحصول على تأمين السفر لرحلة آمنة",
    en: "Activate your bank cards for international use, and ensure you have travel insurance for a secure trip",
  },
  {
    ar: "حجوزاتك تحت السيطرة.. تابع حالة رحلتك الجوية واستلم تذاكرك وبطاقات صعود الطائرة فوراً وبكل سهولة",
    en: "Your bookings under control.. Track your flight status and receive your tickets and boarding passes instantly",
  },
  {
    ar: "يُنصح بالوصول إلى المطار قبل 4 ساعات من موعد الرحلات الدولية لضمان إنهاء إجراءات سفرك براحة تامة",
    en: "Arrive at the airport 4 hours before international flights to ensure a smooth and comfortable check-in",
  },
  {
    ar: "الرفاهية تكمن في التفاصيل.. نحن هنا لنهتم بكل جزئية في رحلتك لمنحك تجربة سفر ملكية تفخر بها",
    en: "Luxury is in the details.. We are here to take care of every aspect of your trip for a royal experience",
  },
  {
    ar: "أينما كنت حول العالم.. فريق دعم دار التميز معك على مدار الساعة طوال رحلتك لتقديم المساعدة الفورية",
    en: "Wherever you are in the world.. Dar AlTamaiz support team is with you 24/7 to provide instant assistance",
  },
];

// "{USD_KWD}".length === 9, "{LONDON_TEMP}".length === 13
function parseSegments(
  template: string,
  usdKwd: string,
  londonTemp: string,
): Segment[] {
  const result: Segment[] = [];
  let remaining = template;
  while (remaining.length > 0) {
    const ui = remaining.indexOf("{USD_KWD}");
    const ti = remaining.indexOf("{LONDON_TEMP}");
    if (ui === -1 && ti === -1) {
      result.push({ text: remaining });
      break;
    }
    const isUsd =
      ui !== -1 && (ti === -1 || ui < ti);
    const idx = isUsd ? ui : ti;
    if (idx > 0) result.push({ text: remaining.slice(0, idx) });
    result.push({ text: isUsd ? usdKwd : londonTemp, live: true });
    remaining = remaining.slice(idx + (isUsd ? 9 : 13));
  }
  return result;
}

function buildRowSegments(
  lang: "ar" | "en",
  usdKwd: string,
  londonTemp: string,
): Segment[] {
  const out: Segment[] = [];
  MESSAGES.forEach((msg, i) => {
    out.push(...parseSegments(lang === "ar" ? msg.ar : msg.en, usdKwd, londonTemp));
    if (i < MESSAGES.length - 1) out.push({ text: SEPARATOR });
  });
  return out;
}

interface SegTextProps {
  segments: Segment[];
  onLayout?: (e: LayoutChangeEvent) => void;
}
function SegText({ segments, onLayout }: SegTextProps) {
  return (
    <Text style={styles.text} onLayout={onLayout}>
      {segments.map((seg, i) =>
        seg.live ? (
          <Text key={i} style={styles.live}>
            {seg.text}
          </Text>
        ) : (
          seg.text
        ),
      )}
    </Text>
  );
}

function useMarqueeAnim(direction: "ltr" | "rtl") {
  const fromVal = direction === "ltr" ? -1 : 0; // will be updated in start()
  const translateX = useRef(new Animated.Value(fromVal)).current;
  const widthRef = useRef(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const start = (width: number) => {
    if (!width) return;
    animRef.current?.stop();
    const from = direction === "ltr" ? -width : 0;
    const to = direction === "ltr" ? 0 : -width;
    translateX.setValue(from);
    animRef.current = Animated.loop(
      Animated.timing(translateX, {
        toValue: to,
        duration: (width / SCROLL_SPEED) * 1000,
        easing: Easing.linear,
        useNativeDriver: ND,
      }),
    );
    animRef.current.start();
  };

  const onLayout = (w: number) => {
    if (w > 0 && w !== widthRef.current) {
      widthRef.current = w;
      start(w);
    }
  };

  useEffect(() => () => animRef.current?.stop(), []);

  return { translateX, onLayout };
}

export function MarqueeTicker() {
  const [usdKwd, setUsdKwd] = useState("0.307");
  const [londonTemp, setLondonTemp] = useState("—°C");

  const arAnim = useMarqueeAnim("ltr"); // Arabic: left → right
  const enAnim = useMarqueeAnim("rtl"); // English: right → left

  useEffect(() => {
    const refresh = () => {
      if (!API_BASE) return;
      fetch(`${API_BASE}/ticker-data`)
        .then((r) => r.json() as Promise<{ ok: boolean; usdKwd?: string; londonTemp?: string }>)
        .then((d) => {
          if (d.ok) {
            setUsdKwd(d.usdKwd ?? "0.307");
            setLondonTemp(d.londonTemp ?? "—°C");
          }
        })
        .catch(() => {});
    };
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const arSegs = useMemo(
    () => buildRowSegments("ar", usdKwd, londonTemp),
    [usdKwd, londonTemp],
  );
  const enSegs = useMemo(
    () => buildRowSegments("en", usdKwd, londonTemp),
    [usdKwd, londonTemp],
  );

  return (
    <View style={styles.banner}>
      {/* TOP ROW — Arabic, scrolls LEFT → RIGHT */}
      <View style={styles.row}>
        <Animated.View
          style={[styles.track, { transform: [{ translateX: arAnim.translateX }] }]}
        >
          <SegText
            segments={arSegs}
            onLayout={(e) => arAnim.onLayout(e.nativeEvent.layout.width)}
          />
          <SegText segments={arSegs} />
        </Animated.View>
      </View>

      {/* BOTTOM ROW — English, scrolls RIGHT → LEFT */}
      <View style={styles.row}>
        <Animated.View
          style={[styles.track, { transform: [{ translateX: enAnim.translateX }] }]}
        >
          <SegText
            segments={enSegs}
            onLayout={(e) => enAnim.onLayout(e.nativeEvent.layout.width)}
          />
          <SegText segments={enSegs} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: "100%",
    height: TICKER_HEIGHT,
    backgroundColor: "#0C1E3E",
    overflow: "hidden",
    justifyContent: "center",
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.20)",
  },
  row: {
    height: 22,
    overflow: "hidden",
  },
  track: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    height: 22,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.1,
    paddingHorizontal: 12,
    includeFontPadding: false,
    flexShrink: 0,
  },
  live: {
    color: LIVE_GREEN,
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
});
