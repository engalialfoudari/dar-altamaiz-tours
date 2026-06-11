import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

export const TICKER_HEIGHT = 56;
const SCROLL_SPEED_PX_PER_SEC = 28; // slow, majestic pace
const API_BASE = (process.env["EXPO_PUBLIC_API_BASE"] ?? "").replace(/\/$/, "");
const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

const MESSAGES: Array<{ ar: string; en: string }> = [
  {
    ar: "💎 استمتع بمميزات الاسترداد النقدي الفوري (Cashback) عند إتمام حجزك القادم عبر التطبيق. [سعر صرف الدولار الحالي: {USD_KWD} د.ك]",
    en: "💎 Enjoy instant cashback rewards on your next booking through the app. [Current USD rate: {USD_KWD} KWD]",
  },
  {
    ar: "🧳 تذكير: يرجى التأكد من صلاحية جواز السفر لمدة لا تقل عن 6 أشهر قبل موعد رحلتك القادمة",
    en: "🧳 Reminder: Ensure your passport is valid for at least 6 months before your upcoming departure",
  },
  {
    ar: "⛅ تمنياتنا لك برحلة سعيدة.. درجة الحرارة الحالية في لندن الآن: {LONDON_TEMP}",
    en: "⛅ Wishing you a wonderful journey.. Current temperature in London right now: {LONDON_TEMP}",
  },
  {
    ar: "✈️ اختصر وقتك وجهدك.. صمم باقة عطلتك المتكاملة من طيران وفنادق بلمسة واحدة وبأعلى درجات السهولة",
    en: "✈️ Save time and effort.. Customize your complete holiday package with flights and hotels in just one tap",
  },
  {
    ar: "🔒 احجز بطمأنينة وأمان.. جميع معاملاتك وحجوزاتك عبر منصتنا محمية بأعلى معايير الأمان العالمية",
    en: "🔒 Book with confidence.. All your transactions and bookings are fully secured with top global standards",
  },
  {
    ar: "👥 تخطيط لسفرة جماعية؟ تواصل معنا الآن لتنسيق أجمل الرحلات والقروبات السياحية المتكاملة لخدمتكم",
    en: "👥 Planning a group trip? Connect with us now to coordinate the finest integrated curated tours for you",
  },
  {
    ar: "⚖️ تأكد من مراجعة الأوزان المسموحة على تذكرتك قبل التوجه للمطار لتجنب أي رسوم إضافية",
    en: "⚖️ Check the baggage weight allowance on your ticket before heading to the airport to avoid extra fees",
  },
  {
    ar: "🧳 سافر مع رفيق دربك الموثوق.. دار التميز نضع خبرتنا الطويلة منذ عام 2008 بين يديك لضمان عطلة تفوق توقعاتك",
    en: "🧳 Travel with your trusted partner.. Dar AlTamaiz puts over a decade of travel expertise at your service",
  },
  {
    ar: "🔄 مرونة تامة في التخطيط.. يمكنك متابعة تفاصيل حجزك وإدارته بسهولة تامة وبأعلى درجات الراحة عبر منصتنا",
    en: "🔄 Full flexibility in planning.. Track and manage your booking details seamlessly through our platform",
  },
  {
    ar: "🗺️ العالم ينتظرك لاستكشافه.. خطط لرحلتك القادمة بتميز ودع مستشاري السفر لدينا يرسمون لك تفاصيلها الفاخرة",
    en: "🗺️ The world awaits.. Plan your next journey with excellence and let our experts curate every luxury detail",
  },
  {
    ar: "💳 تذكر تفعيل بطاقاتك المصرفية للاستخدام الدولي وتأكَّد من الحصول على تأمين السفر لرحلة آمنة",
    en: "💳 Activate your bank cards for international use, and ensure you have travel insurance for a secure trip",
  },
  {
    ar: "📲 حجوزاتك تحت السيطرة.. تابع حالة رحلتك الجوية واستلم تذاكرك وبطاقات صعود الطائرة فوراً وبكل سهولة",
    en: "📲 Your bookings under control.. Track your flight status and receive your tickets and boarding passes instantly",
  },
  {
    ar: "⏰ يُنصح بالوصول إلى المطار قبل 4 ساعات من موعد الرحلات الدولية لضمان إنهاء إجراءات سفرك براحة تامة",
    en: "⏰ Arrive at the airport 4 hours before international flights to ensure a smooth and comfortable check-in",
  },
  {
    ar: "✨ الرفاهية تكمن في التفاصيل.. نحن هنا لنهتم بكل جزئية في رحلتك لمنحك تجربة سفر ملكية تفخر بها",
    en: "✨ Luxury is in the details.. We are here to take care of every aspect of your trip for a royal experience",
  },
  {
    ar: "📞 أينما كنت حول العالم.. فريق دعم دار التميز معك على مدار الساعة طوال رحلتك لتقديم المساعدة الفورية",
    en: "📞 Wherever you are in the world.. Dar AlTamaiz support team is with you 24/7 to provide instant assistance",
  },
];

const SEPARATOR = "          ✦          ";
const ND = Platform.OS !== "web";

interface TickerResponse {
  ok: boolean;
  usdKwd?: string;
  londonTemp?: string;
}

async function loadLiveData(): Promise<{ usdKwd: string; londonTemp: string } | null> {
  if (!API_BASE) return null;
  try {
    const r = await fetch(`${API_BASE}/ticker-data`);
    const d = (await r.json()) as TickerResponse;
    if (d.ok) return { usdKwd: d.usdKwd ?? "0.307", londonTemp: d.londonTemp ?? "18°C" };
  } catch {
    /* network unavailable — caller keeps previous values */
  }
  return null;
}

function buildLines(usdKwd: string, londonTemp: string) {
  const ar = MESSAGES.map((m) =>
    m.ar.replace("{USD_KWD}", usdKwd).replace("{LONDON_TEMP}", londonTemp),
  ).join(SEPARATOR);
  const en = MESSAGES.map((m) =>
    m.en.replace("{USD_KWD}", usdKwd).replace("{LONDON_TEMP}", londonTemp),
  ).join(SEPARATOR);
  return { ar, en };
}

function useMarqueeAnim(speed: number) {
  const translateX = useRef(new Animated.Value(0)).current;
  const widthRef = useRef(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const start = (width: number) => {
    if (!width) return;
    animRef.current?.stop();
    translateX.setValue(0);
    animRef.current = Animated.loop(
      Animated.timing(translateX, {
        toValue: -width,
        duration: (width / speed) * 1000,
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
  const [londonTemp, setLondonTemp] = useState("–°C");

  const arAnim = useMarqueeAnim(SCROLL_SPEED_PX_PER_SEC);
  const enAnim = useMarqueeAnim(SCROLL_SPEED_PX_PER_SEC);

  // Initial fetch + 30-min background refresh loop (non-blocking)
  useEffect(() => {
    const refresh = () => {
      loadLiveData()
        .then((d) => {
          if (d) {
            setUsdKwd(d.usdKwd);
            setLondonTemp(d.londonTemp);
          }
        })
        .catch(() => {});
    };
    refresh();
    const id = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const { ar, en } = useMemo(
    () => buildLines(usdKwd, londonTemp),
    [usdKwd, londonTemp],
  );

  return (
    <View style={styles.banner}>
      {/* ── Row 1: Arabic ── */}
      <View style={styles.row}>
        <Animated.View
          style={[styles.track, { transform: [{ translateX: arAnim.translateX }] }]}
        >
          <Text
            style={styles.textAr}
            numberOfLines={1}
            onLayout={(e) => arAnim.onLayout(e.nativeEvent.layout.width)}
          >
            {ar}
          </Text>
          <Text style={styles.textAr} numberOfLines={1}>
            {ar}
          </Text>
        </Animated.View>
      </View>

      {/* ── Row 2: English ── */}
      <View style={styles.row}>
        <Animated.View
          style={[styles.track, { transform: [{ translateX: enAnim.translateX }] }]}
        >
          <Text
            style={styles.textEn}
            numberOfLines={1}
            onLayout={(e) => enAnim.onLayout(e.nativeEvent.layout.width)}
          >
            {en}
          </Text>
          <Text style={styles.textEn} numberOfLines={1}>
            {en}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: "100%",
    height: TICKER_HEIGHT,
    backgroundColor: "#0C1E3E", // deep royal blue
    overflow: "hidden",
    justifyContent: "center",
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.18)",
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
  textAr: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.1,
    paddingHorizontal: 14,
    includeFontPadding: false,
  },
  textEn: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.15,
    paddingHorizontal: 14,
    includeFontPadding: false,
  },
});
