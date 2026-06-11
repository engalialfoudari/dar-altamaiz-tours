import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

export const TICKER_HEIGHT = 64;
const API_BASE = (process.env["EXPO_PUBLIC_API_BASE"] ?? "").replace(/\/$/, "");
const REFRESH_MS = 30 * 60 * 1000;
const FADE_MS = 350;
const HOLD_MS = 3000;
const LIVE_GREEN = "#00FF00";

type Segment = { text: string; live?: boolean };
type Lang = "ar" | "en";

const MESSAGES: Array<{ ar: string; en: string }> = [
  {
    ar: "استمتع بمميزات الاسترداد النقدي الفوري عند إتمام حجزك القادم عبر التطبيق. سعر صرف الدولار الحالي: {USD_KWD} د.ك",
    en: "Enjoy instant cashback rewards on your next booking through the app. Current USD rate: {USD_KWD} KWD",
  },
  {
    ar: "تذكير يرجى التأكد من صلاحية جواز السفر لمدة لا تقل عن 6 أشهر قبل موعد رحلتك القادمة",
    en: "Reminder Please ensure your passport is valid for at least 6 months before your upcoming departure",
  },
  {
    ar: "تمنياتنا لك برحلة سعيدة درجة الحرارة الحالية في لندن الآن هي: {LONDON_TEMP}",
    en: "Wishing you a wonderful journey Current temperature in London is: {LONDON_TEMP}",
  },
  {
    ar: "اختصر وقتك وجهدك صمم باقة عطلتك المتكاملة من طيران وفنادق بلمسة واحدة وبأعلى درجات السهولة",
    en: "Save time and effort Customize your complete holiday package with flights and hotels in just a single tap",
  },
  {
    ar: "احجز بطمأنينة وأمان جميع معاملاتك وحجوزاتك عبر منصتنا محمية ومؤكدة بأعلى معايير الأمان العالمية",
    en: "Book with confidence and peace of mind All your transactions and bookings are fully secured with top global standards",
  },
  {
    ar: "تخطط لسفرة جماعية تواصل معنا الآن لتنسيق أجمل الرحلات والقروبات السياحية المتكاملة لخدمتكم",
    en: "Planning a group trip Connect with us now to coordinate the finest integrated curated tours for you",
  },
  {
    ar: "نصيحة سفر تأكد من مراجعة الأوزان المسموحة على تذكرتك قبل التوجه للمطار لتجنب أي رسوم إضافية",
    en: "Travel Tip Be sure to check the baggage weight allowance on your ticket before heading to the airport to avoid extra fees",
  },
  {
    ar: "سافر مع رفيق دربك الموثوق دار التميز نضع خبرتنا الطويلة منذ عام 2008 بين يديك لضمان عطلة تفوق توقعاتك",
    en: "Travel with your trusted partner Dar AlTamaiz puts over a decade of travel expertise at your service to guarantee a perfect holiday",
  },
  {
    ar: "مرونة تامة في التخطيط يمكنك متابعة تفاصيل حجزك وإدارته بسهولة تامة وبأعلى درجات الراحة عبر منصتنا",
    en: "Full flexibility in planning Track and manage your booking details seamlessly with ultimate comfort through our platform",
  },
  {
    ar: "العالم ينتظرك لاستكشافه خطط لرحلتك القادمة بتميز ودع مستشاري السفر لدينا يرسمون لك تفاصيلها الفاخرة",
    en: "The world is waiting to be explored Plan your next journey with excellence and let our travel experts curate every luxury detail for you",
  },
  {
    ar: "نصيحة ذكية تذكر تفعيل بطاقاتك المصرفية للاستخدام الدولي وتأكد من الحصول على تأمين السفر لرحلة آمنة",
    en: "Smart Tip Remember to activate your bank cards for international use and ensure you have travel insurance for a secure trip",
  },
  {
    ar: "حجوزاتك تحت السيطرة تابع حالة رحلتك الجوية واستلم تذاكرك وبطاقات صعود الطائرة فورا وبكل سهولة",
    en: "Your bookings under control Track your flight status and receive your tickets and boarding passes instantly and with ease",
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
    const isUsd = ui !== -1 && (ti === -1 || ui < ti);
    const idx = isUsd ? ui : ti;
    if (idx > 0) result.push({ text: remaining.slice(0, idx) });
    result.push({ text: isUsd ? usdKwd : londonTemp, live: true });
    remaining = remaining.slice(idx + (isUsd ? 9 : 13));
  }
  return result;
}

interface StepState {
  msgIdx: number;
  lang: Lang;
}

export function MarqueeTicker() {
  const [usdKwd, setUsdKwd] = useState("0.307");
  const [londonTemp, setLondonTemp] = useState("—°C");
  const [step, setStep] = useState<StepState>({ msgIdx: 0, lang: "ar" });
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!API_BASE) return;
    const refresh = () => {
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

  useEffect(() => {
    opacity.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.delay(HOLD_MS),
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.in(Easing.ease),
        useNativeDriver: Platform.OS !== "web",
      }),
    ]);
    anim.start(({ finished }) => {
      if (!finished) return;
      setStep((prev) => {
        if (prev.lang === "ar") {
          return { msgIdx: prev.msgIdx, lang: "en" };
        }
        return { msgIdx: (prev.msgIdx + 1) % MESSAGES.length, lang: "ar" };
      });
    });
    return () => anim.stop();
  }, [step.msgIdx, step.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const segments = useMemo(() => {
    const msg = MESSAGES[step.msgIdx];
    const template = step.lang === "ar" ? msg.ar : msg.en;
    return parseSegments(template, usdKwd, londonTemp);
  }, [step, usdKwd, londonTemp]);

  return (
    <View style={styles.banner}>
      <Animated.View style={[styles.content, { opacity }]}>
        <Text style={styles.text} numberOfLines={2}>
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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: "100%",
    height: TICKER_HEIGHT,
    backgroundColor: "#0A192F",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.15)",
  },
  content: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    fontWeight: "bold",
    textAlign: "center",
    includeFontPadding: false,
    lineHeight: 19,
  },
  live: {
    color: LIVE_GREEN,
    fontFamily: "Inter_700Bold",
    fontWeight: "bold",
    fontSize: 13,
  },
});
