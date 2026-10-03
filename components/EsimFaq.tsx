import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppLanguage } from "@/localization/provider";

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
    {
      question: "How much high-speed data do unlimited plans include?",
      answer: "Airalo's default fair-use policy provides 3 GB of high-speed data per 24 hours, then reduces the speed to 1 Mbps until the next reset. Data stays connected. Some packages have different limits: the supplier terms shown for your selected plan take priority. Actual speeds depend on the network. At 1 Mbps, messaging, email and maps generally remain usable, while streaming and large downloads are slower.",
    },
    {
      question: "When does my high-speed allowance reset?",
      answer: "Under Airalo's default unlimited-plan policy, the allowance resets every 24 hours from eSIM activation, not at midnight. For example, activation at 10 am means the next reset is at 10 am the following day. Check your package terms for any different reset rules.",
    },
    {
      question: "Do fixed-data plans include this daily allowance?",
      answer: "No. A fixed-data package such as 5 GB for 7 days includes 5 GB in total during those 7 days, not 5 GB every day. Do not apply the unlimited-plan daily allowance to a fixed-data plan; check its own package terms.",
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
    {
      question: "كم تبلغ البيانات عالية السرعة في الباقات غير المحدودة؟",
      answer: "تمنح سياسة الاستخدام العادل الافتراضية لدى Airalo مقدار 3 GB من البيانات عالية السرعة كل 24 ساعة، ثم تنخفض السرعة إلى 1 Mbps حتى موعد التجديد التالي مع استمرار الاتصال. قد تختلف الحدود في بعض الباقات؛ تسري شروط المورّد المعروضة للباقة التي تختارها. تعتمد السرعة الفعلية على الشبكة. عادةً تبقى الرسائل والبريد والخرائط قابلة للاستخدام بسرعة 1 Mbps، بينما تصبح مشاهدة الفيديو والتنزيلات الكبيرة أبطأ.",
    },
    {
      question: "متى تتجدد كمية البيانات عالية السرعة؟",
      answer: "وفق سياسة Airalo الافتراضية للباقات غير المحدودة، تتجدد الكمية كل 24 ساعة من وقت تفعيل الشريحة، وليس عند منتصف الليل. مثلاً، إذا فُعّلت الساعة 10 صباحاً يكون التجديد التالي الساعة 10 صباحاً في اليوم التالي. راجع شروط باقتك لأي قواعد تجديد مختلفة.",
    },
    {
      question: "هل تشمل الباقات ذات البيانات المحددة هذه الكمية اليومية؟",
      answer: "لا. باقة مثل 5 GB لمدة 7 أيام تشمل 5 GB إجمالاً خلال الأيام السبعة، وليس 5 GB كل يوم. لا تطبّق الكمية اليومية للباقات غير المحدودة على باقة بيانات محددة؛ راجع شروط الباقة نفسها.",
    },
  ],
  tr: [
    { question: "eSIM'i ne zaman satın almalıyım?", answer: "Seyahatten önce satın alabilirsiniz. Ödeme yapmadan önce kapsanan ülkeleri, veri miktarını, geçerlilik süresini ve cihaz uyumluluğunu kontrol edin." },
    { question: "eSIM'imi ne zaman kurmalıyım?", answer: "Güvenilir bir Wi-Fi bağlantınız varken kurun ve satın alma sonrası verilen talimatları izleyin. Etkinleştirme ve geçerlilik pakete göre değişebilir; açmadan önce talimatları kontrol edin." },
    { question: "eSIM'imi tekrar kullanabilir miyim?", answer: "Paket etkin olduğu sürece eSIM'i cihazınızda tutun. Tekrar kullanım sağlayıcıya ve pakete bağlıdır; eSIM'i silmeyin veya süresi dolmuş bir eSIM'e yeni paket eklenebileceğini varsaymayın." },
    { question: "Paket yenileme nedir?", answer: "Yenileme, uygun bir eSIM'e daha fazla veri veya süre ekler. Bu ödeme sayfasında şu anda yenileme sunulmuyor; paketiniz bittiğinde yeni bir paket seçin." },
    { question: "Sınırsız paketler ne kadar yüksek hızlı veri içerir?", answer: "Airalo'nun varsayılan adil kullanım politikası her 24 saatte 3 GB yüksek hızlı veri sağlar; ardından bir sonraki yenilenmeye kadar hız 1 Mbps olur. Veri bağlantısı devam eder. Bazı paketlerin limitleri farklıdır; seçtiğiniz pakette gösterilen sağlayıcı koşulları geçerlidir. Gerçek hız şebekeye bağlıdır. 1 Mbps ile mesajlaşma, e-posta ve haritalar genellikle kullanılabilir; video izleme ve büyük indirmeler yavaşlar." },
    { question: "Yüksek hızlı veri hakkım ne zaman yenilenir?", answer: "Airalo'nun varsayılan sınırsız paket politikasında veri hakkı gece yarısında değil, eSIM etkinleştirildikten sonra her 24 saatte bir yenilenir. Örneğin saat 10.00'da etkinleştirme yaparsanız bir sonraki yenilenme ertesi gün 10.00'dadır. Farklı yenilenme kuralları için paket koşullarınızı kontrol edin." },
    { question: "Sabit veri paketleri bu günlük hakkı içerir mi?", answer: "Hayır. 7 gün için 5 GB gibi bir sabit veri paketi, yedi gün boyunca toplam 5 GB içerir; her gün 5 GB değil. Sınırsız paketlerin günlük hakkını sabit veri paketlerine uygulamayın; paketin kendi koşullarını kontrol edin." },
  ],
};

export function EsimFaq({ lang }: { lang: "en" | "ar" }) {
  const { locale } = useAppLanguage();
  const displayLanguage = locale === "tr" ? "tr" : lang;
  const [open, setOpen] = useState<number | null>(null);
  const rtl = displayLanguage === "ar";
  return <View style={styles.section}>
    <Text style={[styles.title, rtl && styles.rtl]}>{displayLanguage === "tr" ? "Sıkça sorulan sorular" : rtl ? "الأسئلة الشائعة" : "Frequently asked questions"}</Text>
    {questions[displayLanguage].map(({ question, answer }, index) => (
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