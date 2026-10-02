import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const questions = {
  en: [
    {
      question: "When should I buy an eSIM?",
      answer: "You can buy before your trip. Check the destinations covered, data allowance, validity and device compatibility before paying.",
    },
    {
      question: "When should I install my eSIM?",
      answer: "Install it while you have reliable Wi-Fi and follow the instructions provided after purchase. Activation and validity can differ by package, so check those instructions before switching it on.",
    },
    {
      question: "Can I reuse my eSIM?",
      answer: "Keep your eSIM installed while its package is active. Reuse depends on the provider and package; do not delete it or assume a new package can be added to an expired eSIM.",
    },
    {
      question: "What are renewals?",
      answer: "A renewal adds more data or time to an eligible eSIM. Renewals are not offered in this checkout at present; choose a new package when yours ends.",
    },
  ],
  ar: [
    {
      question: "متى أشتري شريحة eSIM؟",
      answer: "يمكنك شراؤها قبل السفر. تحقق من الدول المشمولة وكمية البيانات ومدة الصلاحية وتوافق الجهاز قبل الدفع.",
    },
    {
      question: "متى أثبّت شريحة eSIM؟",
      answer: "ثبّتها عند توفر اتصال Wi-Fi موثوق، واتبع التعليمات التي تصلك بعد الشراء. قد يختلف بدء التفعيل والصلاحية حسب الباقة، لذا راجع التعليمات قبل تشغيلها.",
    },
    {
      question: "هل يمكنني إعادة استخدام شريحة eSIM؟",
      answer: "أبقِ الشريحة مثبتة ما دامت الباقة فعالة. تعتمد إعادة الاستخدام على مزود الخدمة والباقة؛ لا تحذف الشريحة أو تفترض إمكانية إضافة باقة جديدة إلى شريحة منتهية.",
    },
    {
      question: "ما المقصود بتجديد الباقة؟",
      answer: "التجديد يضيف بيانات أو مدة إلى شريحة مؤهلة. التجديد غير متاح حالياً في صفحة الدفع هذه؛ اختر باقة جديدة عند انتهاء باقتك.",
    },
  ],
};

export function EsimFaq({ lang }: { lang: "en" | "ar" }) {
  const [open, setOpen] = useState<number | null>(null);
  const rtl = lang === "ar";
  return <View style={styles.section}>
    <Text style={[styles.title, rtl && styles.rtl]}>{rtl ? "الأسئلة الشائعة" : "Frequently asked questions"}</Text>
    {questions[lang].map(({ question, answer }, index) => (
      <View key={index} style={styles.card}>
        <Pressable
          testID={`esim-faq-${index}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: open === index }}
          accessibilityLabel={question}
          onPress={() => setOpen(open === index ? null : index)}
          style={[styles.row, rtl && styles.reverse]}
        >
          <Text style={[styles.question, rtl && styles.rtl]}>{question}</Text>
          <Text style={styles.chevron}>{open === index ? "−" : "⌄"}</Text>
        </Pressable>
        {open === index && <Text style={[styles.answer, rtl && styles.rtl]}>{answer}</Text>}
      </View>
    ))}
  </View>;
}

const styles = StyleSheet.create({
  section: { marginTop: 22, marginBottom: 16, gap: 10 },
  title: { color: "#202A36", fontSize: 18, fontWeight: "800", marginBottom: 3 },
  card: { borderRadius: 12, borderWidth: 1, borderColor: "#D8DFE7", backgroundColor: "#FFFFFF", overflow: "hidden" },
  row: { minHeight: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10 },
  reverse: { flexDirection: "row-reverse" },
  question: { flex: 1, color: "#202A36", fontSize: 14, fontWeight: "700" },
  chevron: { color: "#003580", fontSize: 22, lineHeight: 26 },
  answer: { color: "#687583", fontSize: 13, lineHeight: 20, paddingHorizontal: 16, paddingBottom: 16 },
  rtl: { textAlign: "right", writingDirection: "rtl" },
});