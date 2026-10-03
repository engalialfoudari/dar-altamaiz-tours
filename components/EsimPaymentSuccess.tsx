import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { EsimIcon } from "./EsimIcon";

export default function EsimPaymentSuccess({ lang, signedIn, confirmedAt, completed, review }: {
  lang: "ar" | "en"; signedIn: boolean; confirmedAt: string; completed: boolean; review: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);
  const rtl = lang === "ar";
  const delayed = now - Date.parse(confirmedAt) >= 10 * 60_000;
  const message = review
    ? rtl ? "تم تأكيد الدفع، لكن الطلب يحتاج إلى مراجعة. تواصل مع فريق الشرائح بشأن الطلب نفسه، ولا تدفع مرة أخرى."
      : "Payment is confirmed, but your order needs review. Contact the eSIM team about this same order; do not pay again."
    : completed
      ? rtl ? `شريحتك جاهزة.${signedIn ? " ستجدها في حسابك." : ""} تحقق من بريدك الإلكتروني للحصول على القسيمة وبيانات الشريحة.`
        : `Your eSIM is ready.${signedIn ? " You can find it in your account." : ""} Check your email for your voucher and eSIM details.`
      : delayed
        ? rtl ? "يستغرق تجهيز شريحتك وقتاً أطول من المتوقع. سنرسلها إلى بريدك عند جاهزيتها. تواصل معنا إذا احتجت إلى مساعدة؛ لا تدفع مرة أخرى."
          : "Your eSIM is taking longer than expected to prepare. We will email it when ready. Contact us if you need help; do not pay again."
        : rtl
          ? signedIn ? "ستجد شريحة eSIM في حسابك قريباً بمجرد تجهيزها، وستصلك أيضاً عبر البريد الإلكتروني خلال أقل من عشر دقائق. يمكنك إغلاق هذه الصفحة بأمان."
            : "ستصلك شريحة eSIM عبر البريد الإلكتروني خلال أقل من عشر دقائق. يمكنك إغلاق هذه الصفحة بأمان."
          : signedIn ? "Your eSIM will appear in your account shortly once prepared, and will also arrive by email in less than ten minutes. You can safely close this page."
            : "Your eSIM will be delivered by email in less than ten minutes. You can safely close this page.";
  return <View testID="esim-payment-success" style={styles.box}>
    <View style={styles.heading}><EsimIcon name="check" size={24} color="#15803D" />
      <Text style={[styles.title, rtl && styles.rtl]}>{rtl ? "تم الدفع بنجاح" : "Payment successful"}</Text></View>
    <Text style={[styles.body, rtl && styles.rtl]}>{message}</Text>
    <Text style={[styles.caption, rtl && styles.rtl]}>{rtl
      ? "ستصلك الفاتورة في رسالة مستقلة، ثم القسيمة وبيانات الشريحة في رسالة ثانية عند جاهزيتها."
      : "Your invoice arrives in a separate email, followed by a second email with your voucher and eSIM details once ready."}</Text>
  </View>;
}

const styles = StyleSheet.create({
  box: { marginHorizontal: 16, marginVertical: 8, padding: 16, backgroundColor: "#F0FDF4", borderColor: "#BBF7D0", borderWidth: 1, borderRadius: 12, gap: 10 },
  heading: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  title: { fontSize: 20, fontWeight: "700", color: "#15803D", textAlign: "center" },
  body: { fontSize: 14, lineHeight: 22, color: "#172033", textAlign: "center" },
  caption: { fontSize: 12, lineHeight: 19, color: "#546174", textAlign: "center" },
  rtl: { writingDirection: "rtl" },
});