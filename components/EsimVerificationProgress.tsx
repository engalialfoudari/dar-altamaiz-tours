import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

/** Counts down to an actual read-only status check, never to a promised completion. */
export default function EsimVerificationProgress({ lang, nextCheckAt }: {
  lang: "ar" | "en";
  nextCheckAt: number | null;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [nextCheckAt]);
  const seconds = nextCheckAt === null ? 0 : Math.max(0, Math.ceil((nextCheckAt - now) / 1_000));
  const counter = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const rtl = lang === "ar";
  return <View testID="esim-verification-progress" style={styles.box}>
    <ActivityIndicator color="#006CE4" />
    <Text style={[styles.title, rtl && styles.rtl]} accessibilityRole="header">
      {rtl ? "يرجى الانتظار وعدم إغلاق هذه الصفحة" : "Please wait—do not close this page"}
    </Text>
    <Text style={[styles.body, rtl && styles.rtl]}>
      {rtl ? "نتحقق من الدفع ونجهز شريحتك. لا تدفع مرة أخرى. هذا العداد للفحص التالي وليس موعداً مضموناً للاكتمال."
        : "We are verifying payment and preparing your eSIM. Do not pay again. The countdown is to the next check, not a guaranteed completion time."}
    </Text>
    <Text testID="esim-verification-countdown" style={[styles.counter, rtl && styles.rtl]}>
      {seconds > 0 ? rtl ? `الفحص التالي خلال ${counter}` : `Next status check in ${counter}`
        : rtl ? "جارٍ التحقق من الحالة الآن…" : "Checking status now…"}
    </Text>
  </View>;
}

const styles = StyleSheet.create({
  box: { marginHorizontal: 16, marginVertical: 8, padding: 14, borderRadius: 12, backgroundColor: "#EAF3FF", borderWidth: 1, borderColor: "#DBE7F5", gap: 8 },
  title: { color: "#172033", fontSize: 15, fontWeight: "700", textAlign: "center" },
  body: { color: "#34445A", fontSize: 12, lineHeight: 19, textAlign: "center" },
  counter: { color: "#006CE4", fontSize: 14, fontWeight: "600", textAlign: "center", fontVariant: ["tabular-nums"] },
  rtl: { writingDirection: "rtl" },
});