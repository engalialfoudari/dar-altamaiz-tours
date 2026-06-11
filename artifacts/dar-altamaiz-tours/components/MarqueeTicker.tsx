import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

export const TICKER_HEIGHT = 28;
const SCROLL_SPEED_PX_PER_SEC = 46;
const API_BASE = (process.env["EXPO_PUBLIC_API_BASE"] ?? "").replace(/\/$/, "");

const FALLBACK_USD_KWD = "0.307";
const FALLBACK_LONDON_TEMP = "18°C";

function buildTickerText(usdKwd: string, londonTemp: string): string {
  const items = [
    `💎 استمتع بمميزات الاسترداد النقدي الفوري (Cashback) عند إتمام حجزك القادم عبر التطبيق. [سعر صرف الدولار: ${usdKwd} د.ك]  ║  Enjoy instant cashback rewards on your next booking through the app. [Current USD rate: ${usdKwd} KWD]`,
    `🧳 تذكير: يرجى التأكد من صلاحية جواز السفر لمدة لا تقل عن 6 أشهر قبل موعد رحلتك القادمة  ║  Reminder: Please ensure your passport is valid for at least 6 months before your upcoming departure`,
    `⛅ تمنياتنا لك برحلة سعيدة.. درجة الحرارة الحالية في لندن: ${londonTemp}  ║  Wishing you a wonderful journey.. Current temperature in London: ${londonTemp}`,
    `✈️ اختصر وقتك وجهدك.. صمم باقة عطلتك المتكاملة من طيران وفنادق بلمسة واحدة وبأعلى درجات السهولة  ║  Save time and effort.. Customize your complete holiday package with flights and hotels in just a single tap`,
    `🔒 احجز بطمأنينة وأمان.. جميع معاملاتك وحجوزاتك عبر منصتنا محمية بأعلى معايير الأمان العالمية  ║  Book with confidence and peace of mind.. All your transactions are fully secured with top global standards`,
    `👥 تخطيط لسفرة جماعية؟ تواصل معنا الآن لتنسيق أجمل الرحلات والقروبات السياحية المتكاملة  ║  Planning a group trip? Connect with us now to coordinate the finest integrated curated tours for you`,
    `⚖️ تأكد من مراجعة الأوزان المسموحة على تذكرتك قبل التوجه للمطار لتجنب أي رسوم إضافية  ║  Check the baggage weight allowance on your ticket before heading to the airport to avoid extra fees`,
    `🧳 سافر مع رفيق دربك الموثوق.. دار التميز نضع خبرتنا منذ عام 2008 بين يديك لضمان عطلة تفوق توقعاتك  ║  Travel with your trusted partner.. Dar AlTamaiz puts over a decade of travel expertise at your service`,
    `🔄 مرونة تامة في التخطيط.. يمكنك متابعة تفاصيل حجزك وإدارته بسهولة تامة عبر منصتنا  ║  Full flexibility in planning.. Track and manage your booking details seamlessly through our platform`,
    `🗺️ العالم ينتظرك لاستكشافه.. خطط لرحلتك القادمة بتميز ودع مستشاري السفر لدينا يرسمون تفاصيلها الفاخرة  ║  The world is waiting to be explored.. Let our travel experts curate every luxury detail for you`,
    `💳 تذكر تفعيل بطاقاتك المصرفية للاستخدام الدولي وتأكَّد من الحصول على تأمين السفر لرحلة آمنة  ║  Activate your bank cards for international use, and ensure you have travel insurance for a secure trip`,
    `📲 حجوزاتك تحت السيطرة.. تابع حالة رحلتك الجوية واستلم تذاكرك وبطاقات صعود الطائرة فوراً  ║  Your bookings under control.. Track your flight status and receive tickets and boarding passes instantly`,
    `⏰ يُنصح بالوصول إلى المطار قبل 4 ساعات من موعد الرحلات الدولية لضمان إنهاء إجراءات سفرك براحة  ║  Arrive at the airport 4 hours before international flights to ensure a smooth and comfortable check-in`,
    `✨ الرفاهية تكمن في التفاصيل.. نحن هنا لنهتم بكل جزئية في رحلتك لمنحك تجربة سفر ملكية تفخر بها  ║  Luxury is in the details.. We are here to take care of every aspect of your trip for a royal travel experience`,
    `📞 أينما كنت حول العالم.. فريق دعم دار التميز معك على مدار الساعة طوال رحلتك لتقديم المساعدة الفورية  ║  Wherever you are in the world.. Dar AlTamaiz support team is with you 24/7 throughout your journey`,
  ];
  return items.join("          ✦          ");
}

interface TickerApiResponse {
  ok: boolean;
  usdKwd?: string;
  londonTemp?: string;
}

export function MarqueeTicker() {
  const [usdKwd, setUsdKwd] = useState(FALLBACK_USD_KWD);
  const [londonTemp, setLondonTemp] = useState(FALLBACK_LONDON_TEMP);

  const translateX = useRef(new Animated.Value(0)).current;
  const singleWidth = useRef(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!API_BASE) return;
    fetch(`${API_BASE}/ticker-data`)
      .then((r) => r.json() as Promise<TickerApiResponse>)
      .then((data) => {
        if (data.ok) {
          if (data.usdKwd) setUsdKwd(data.usdKwd);
          if (data.londonTemp) setLondonTemp(data.londonTemp);
        }
      })
      .catch(() => {});
  }, []);

  const tickerText = useMemo(
    () => buildTickerText(usdKwd, londonTemp),
    [usdKwd, londonTemp],
  );

  const startAnimation = (width: number) => {
    if (!width) return;
    animRef.current?.stop();
    translateX.setValue(0);
    const duration = (width / SCROLL_SPEED_PX_PER_SEC) * 1000;
    animRef.current = Animated.loop(
      Animated.timing(translateX, {
        toValue: -width,
        duration,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    animRef.current.start();
  };

  useEffect(() => {
    if (singleWidth.current > 0) startAnimation(singleWidth.current);
  }, [tickerText]);

  useEffect(() => {
    return () => animRef.current?.stop();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.track,
          { transform: [{ translateX }] },
        ]}
      >
        <Text
          style={styles.text}
          numberOfLines={1}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && w !== singleWidth.current) {
              singleWidth.current = w;
              startAnimation(w);
            }
          }}
        >
          {tickerText}
        </Text>
        <Text style={styles.text} numberOfLines={1}>
          {tickerText}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: TICKER_HEIGHT,
    backgroundColor: "rgba(2, 8, 20, 0.97)",
    overflow: "hidden",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(201,168,76,0.4)",
  },
  track: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    height: TICKER_HEIGHT,
  },
  text: {
    color: "#C9A84C",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
    paddingHorizontal: 16,
    includeFontPadding: false,
  },
});
