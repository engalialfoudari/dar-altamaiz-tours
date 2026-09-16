import React, { useState } from "react";
import Constants from "expo-constants";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HotelPortalIcon } from "@/components/HotelPortalIcon";

type Language = "en" | "ar";

type AboutSection = {
  title: string;
  paragraphs: string[];
};

const palette = {
  navy: "#003580",
  navySoft: "#EAF2FF",
  ink: "#1E293B",
  muted: "#64748B",
  border: "#D9E0E8",
  canvas: "#F2F2F2",
  card: "#FFFFFF",
  success: "#147A4B",
};

const LINKS = {
  website: "https://dt-tours.com",
  company: "https://dt-tours.com/general/cms/1",
  electronicTransactions:
    "https://kdipa.gov.kw/wp-content/uploads/2022/08/%D9%82%D8%A7%D9%86%D9%88%D9%86-%D8%A7%D9%84%D9%85%D8%B9%D8%A7%D9%85%D9%84%D8%A7%D8%AA-%D8%A7%D9%84%D8%A7%D9%84%D9%83%D8%AA%D8%B1%D9%88%D9%86%D9%8A%D8%A9-20-%D9%84%D8%B3%D9%86%D8%A9-2014-%D9%85%D8%AA%D8%B1%D8%AC%D9%85-%D8%A8%D8%A7%D9%84%D9%84%D8%BA%D8%A9-%D8%A7%D9%84%D8%A7%D9%86%D8%AC%D9%84%D9%8A%D8%B2%D9%8A%D8%A9.pdf",
  consumerProtection: "https://www.wipo.int/wipolex/en/legislation/details/19925",
  dataPrivacy:
    "https://www.citra.gov.kw/sites/en/LegalReferences/Resolution-No-42-On-Data-Privacy-Protection-Regulation.pdf",
};

const SECTIONS: Record<Language, AboutSection[]> = {
  en: [
    {
      title: "Company information",
      paragraphs: [
        "Dar AlTamaiz Tours is a Kuwaiti travel company established in 2008, specializing in tailored travel programs for individuals, families, and groups.",
        "In September 2024, Dar AlTamaiz Tours expanded its operations through the acquisition of Max Travel. Aviation services and airline ticket issuance are processed under Max Travel's aviation licenses and IATA accreditation, while tours, packages, and concierge services are operated under Dar AlTamaiz Tours.",
        "Core services include flight and hotel reservations, customized travel packages, transfers and car rentals, cruises, luxury train journeys, and concierge travel support.",
        "Head office: Hawally, Tunis Street, Al Rahab Complex, first floor, office 32, State of Kuwait.",
      ],
    },
    {
      title: "Licensing and accredited operators",
      paragraphs: [
        "Max Travel & Tourism Co. — DGCA License No. 2021/20304.",
        "Max Travel & Tourism Co. — IATA Code 42228745.",
        "Dar AlTamaiz Tours — Commercial License No. 7517/2024.",
        "This app and website are digital service channels for these licensed entities. The operator responsible for a service is identified by the nature of that service: Max Travel for aviation and ticket issuance; Dar AlTamaiz Tours for tours, travel packages, and concierge services.",
      ],
    },
    {
      title: "Terms and booking conditions",
      paragraphs: [
        "Search results, availability, schedules, room details, and prices may change until the airline, hotel, or other supplier confirms the booking. A payment attempt or request submission alone is not a booking confirmation.",
        "Customers must review passenger names, dates, routes, room and meal details, baggage, cancellation rules, final price, currency, and payment terms before confirming.",
        "Cancellation, amendment, no-show, and refund rights depend on the selected fare or rate and the supplier's rules. Any mandatory consumer rights under Kuwait law remain unaffected.",
        "Airlines, hotels, payment providers, transport companies, and other suppliers deliver their respective services under their own applicable terms. DT Tours remains available to assist with the booking and support process.",
      ],
    },
    {
      title: "Privacy and data processing",
      paragraphs: [
        "We process information that you provide—such as contact, passenger, booking, payment-reference, and optional passport details—to answer requests, arrange travel services, administer bookings, provide support, prevent misuse, and meet applicable legal obligations.",
        "Information may be shared only as reasonably necessary with the responsible licensed operator and relevant service providers, including airlines, hotels, booking systems, payment providers, and communications providers.",
        "Do not submit information that is not needed for your request. Passport fields are optional where marked. Reasonable safeguards are used, but no internet transmission can be guaranteed completely secure.",
        "For questions about access, correction, or handling of your personal information, contact info@dt-tour.com. Requests are handled subject to identity verification, applicable law, and lawful record-keeping requirements.",
      ],
    },
    {
      title: "Kuwait legal framework",
      paragraphs: [
        "The digital service is intended to operate within the applicable Kuwait framework, including Law No. 20 of 2014 concerning Electronic Transactions, Law No. 39 of 2014 concerning Consumer Protection, and CITRA Resolution No. 42 of 2021 concerning Data Privacy Protection.",
        "Kuwait Decree-Law No. 10 of 2026 regulates the digital-commerce sector. Its requirements and implementing regulations apply according to their legally effective dates.",
        "Applicable Ministry of Commerce and Industry, DGCA, IATA, commercial, advertising, payment, cybersecurity, and supplier requirements also apply according to the service provided.",
        "These disclosures are a plain-language summary for customer transparency and do not replace booking-specific supplier terms or mandatory rights under Kuwait law.",
      ],
    },
  ],
  ar: [
    {
      title: "معلومات الشركة",
      paragraphs: [
        "دار التميز تورز شركة سفر كويتية تأسست عام 2008، ومتخصصة في إعداد برامج سفر مخصصة للأفراد والعائلات والمجموعات.",
        "في سبتمبر 2024 توسعت أعمال دار التميز تورز من خلال الاستحواذ على ماكس ترافل. تتم خدمات الطيران وإصدار تذاكر السفر بموجب تراخيص واعتماد IATA الخاص بماكس ترافل، بينما تُدار الرحلات السياحية والباقات وخدمات الكونسيرج من خلال دار التميز تورز.",
        "تشمل الخدمات الأساسية حجوزات الطيران والفنادق، والباقات المخصصة، والنقل وتأجير السيارات، والرحلات البحرية والقطارات الفاخرة، وخدمات دعم السفر والكونسيرج.",
        "المكتب الرئيسي: حولي، شارع تونس، مجمع الرحاب، الطابق الأول، مكتب 32، دولة الكويت.",
      ],
    },
    {
      title: "التراخيص والجهات المعتمدة",
      paragraphs: [
        "شركة ماكس للسياحة والسفر — ترخيص الإدارة العامة للطيران المدني رقم 2021/20304.",
        "شركة ماكس للسياحة والسفر — رمز IATA رقم 42228745.",
        "دار التميز تورز — الترخيص التجاري رقم 7517/2024.",
        "يعمل التطبيق والموقع كقناتين رقميتين لهذه الجهات المرخصة. تُحدد الجهة المسؤولة حسب طبيعة الخدمة: ماكس ترافل لخدمات الطيران وإصدار التذاكر، ودار التميز تورز للرحلات السياحية والباقات وخدمات الكونسيرج.",
      ],
    },
    {
      title: "الشروط وأحكام الحجز",
      paragraphs: [
        "قد تتغير نتائج البحث والتوفر والمواعيد وتفاصيل الغرف والأسعار إلى أن تؤكد شركة الطيران أو الفندق أو المورد الحجز. لا تُعد محاولة الدفع أو إرسال الطلب وحدهما تأكيداً للحجز.",
        "يجب على العميل مراجعة أسماء المسافرين والتواريخ وخط السير وتفاصيل الغرفة والوجبات والأمتعة وسياسة الإلغاء والسعر النهائي والعملة وشروط الدفع قبل التأكيد.",
        "تعتمد حقوق الإلغاء والتعديل وعدم الحضور والاسترداد على السعر المختار وشروط المورد، مع بقاء حقوق المستهلك الإلزامية المقررة في القانون الكويتي دون مساس.",
        "تقدم شركات الطيران والفنادق ومزودو الدفع والنقل وغيرهم خدماتهم وفق شروطهم المطبقة، وتبقى DT Tours متاحة للمساعدة في إجراءات الحجز والدعم.",
      ],
    },
    {
      title: "الخصوصية ومعالجة البيانات",
      paragraphs: [
        "نعالج المعلومات التي تقدمها، مثل بيانات التواصل والمسافر والحجز ومرجع الدفع وبيانات جواز السفر الاختيارية، للرد على الطلبات وترتيب خدمات السفر وإدارة الحجوزات وتقديم الدعم ومنع إساءة الاستخدام والوفاء بالالتزامات القانونية.",
        "قد تتم مشاركة المعلومات بالقدر اللازم فقط مع الجهة المرخصة المسؤولة ومزودي الخدمة المعنيين، بما في ذلك شركات الطيران والفنادق وأنظمة الحجز ومزودو الدفع والاتصالات.",
        "لا ترسل معلومات غير ضرورية لطلبك. تكون حقول جواز السفر اختيارية حيثما تم توضيح ذلك. تُستخدم وسائل حماية معقولة، لكن لا يمكن ضمان الأمان الكامل لأي نقل عبر الإنترنت.",
        "للاستفسار عن الوصول إلى معلوماتك الشخصية أو تصحيحها أو طريقة التعامل معها، تواصل عبر info@dt-tour.com. تُعالج الطلبات بعد التحقق من الهوية ووفق القانون ومتطلبات الاحتفاظ النظامية.",
      ],
    },
    {
      title: "الإطار القانوني في دولة الكويت",
      paragraphs: [
        "تهدف الخدمة الرقمية إلى العمل ضمن الإطار الكويتي المطبق، بما في ذلك القانون رقم 20 لسنة 2014 بشأن المعاملات الإلكترونية، والقانون رقم 39 لسنة 2014 بشأن حماية المستهلك، وقرار هيئة الاتصالات وتقنية المعلومات رقم 42 لسنة 2021 بشأن حماية خصوصية البيانات.",
        "ينظم المرسوم بقانون رقم 10 لسنة 2026 قطاع التجارة الرقمية في الكويت، وتطبق متطلباته ولائحته التنفيذية وفق تواريخ نفاذها القانونية.",
        "تطبق كذلك متطلبات وزارة التجارة والصناعة والإدارة العامة للطيران المدني وIATA والمتطلبات التجارية والإعلانية ومتطلبات الدفع والأمن السيبراني وشروط الموردين بحسب الخدمة.",
        "تمثل هذه الإفصاحات ملخصاً مبسطاً للشفافية مع العملاء، ولا تستبدل شروط المورد الخاصة بكل حجز أو الحقوق الإلزامية بموجب القانون الكويتي.",
      ],
    },
  ],
};

export function AboutModal({
  visible,
  lang,
  onClose,
}: {
  visible: boolean;
  lang: Language;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isRtl = lang === "ar";
  const [expanded, setExpanded] = useState(0);
  const version = Constants.expoConfig?.version ?? "1.0.1";
  const copy = isRtl
    ? {
        title: "عن DT Tours",
        version: `الإصدار ${version}`,
        current: "أنت تستخدم أحدث نسخة متاحة",
        sources: "المصادر والمعلومات الرسمية",
        website: "زيارة موقع DT Tours",
        company: "عرض صفحة معلومات الشركة",
        laws: "مراجع قانونية",
        close: "إغلاق صفحة عن التطبيق",
        rights: "© 2026 شركة ماكس للسياحة والسفر. جميع الحقوق محفوظة.",
      }
    : {
        title: "About DT Tours",
        version: `Version ${version}`,
        current: "You are using the latest available version",
        sources: "Sources and official information",
        website: "Visit the DT Tours website",
        company: "View the company information page",
        laws: "Legal references",
        close: "Close About",
        rights: "© 2026 Max Travel & Tourism Co. All rights reserved.",
      };

  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        isRtl ? "تعذر فتح الرابط" : "Unable to open link",
        isRtl ? "يرجى المحاولة مرة أخرى." : "Please try again.",
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }, isRtl && styles.rowRtl]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.close}
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            testID="about-close"
          >
            <HotelPortalIcon name="close" size={21} color={palette.navy} />
          </Pressable>
          <Text style={[styles.headerTitle, isRtl && styles.rtlText]}>{copy.title}</Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 18) + 20 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandCard}>
            <Image
              source={require("../assets/images/app-icon-new.png")}
              style={styles.appIcon}
              accessibilityLabel="DT Tours"
            />
            <Text style={styles.version}>{copy.version}</Text>
            <View style={[styles.currentRow, isRtl && styles.rowRtl]}>
              <Text style={[styles.currentText, isRtl && styles.rtlText]}>{copy.current}</Text>
              <HotelPortalIcon name="check" size={16} color={palette.success} />
            </View>
          </View>

          <View style={styles.sectionList}>
            {SECTIONS[lang].map((section, index) => {
              const isExpanded = expanded === index;
              return (
                <View key={section.title} style={styles.section}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isExpanded }}
                    onPress={() => setExpanded(isExpanded ? -1 : index)}
                    style={({ pressed }) => [
                      styles.sectionButton,
                      isRtl && styles.rowRtl,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.sectionTitle, isRtl && styles.rtlText]}>{section.title}</Text>
                    <HotelPortalIcon
                      name={isExpanded ? "minus" : "plus"}
                      size={18}
                      color={palette.navy}
                    />
                  </Pressable>
                  {isExpanded ? (
                    <View style={styles.sectionBody}>
                      {section.paragraphs.map((paragraph) => (
                        <Text key={paragraph} style={[styles.paragraph, isRtl && styles.rtlText]}>
                          {paragraph}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          <Text style={[styles.sourcesTitle, isRtl && styles.rtlText]}>{copy.sources}</Text>
          <Pressable
            onPress={() => void openLink(LINKS.website)}
            style={({ pressed }) => [styles.linkRow, isRtl && styles.rowRtl, pressed && styles.pressed]}
          >
            <Text style={[styles.linkText, isRtl && styles.rtlText]}>{copy.website}</Text>
            <HotelPortalIcon name={isRtl ? "chevron-back" : "chevron-forward"} size={17} color={palette.navy} />
          </Pressable>
          <Pressable
            onPress={() => void openLink(LINKS.company)}
            style={({ pressed }) => [styles.linkRow, isRtl && styles.rowRtl, pressed && styles.pressed]}
          >
            <Text style={[styles.linkText, isRtl && styles.rtlText]}>{copy.company}</Text>
            <HotelPortalIcon name={isRtl ? "chevron-back" : "chevron-forward"} size={17} color={palette.navy} />
          </Pressable>

          <Text style={[styles.sourcesTitle, isRtl && styles.rtlText]}>{copy.laws}</Text>
          {[
            ["Electronic Transactions Law 20/2014", LINKS.electronicTransactions],
            ["Consumer Protection Law 39/2014", LINKS.consumerProtection],
            ["CITRA Data Privacy Resolution 42/2021", LINKS.dataPrivacy],
          ].map(([label, url]) => (
            <Pressable
              key={url}
              onPress={() => void openLink(url)}
              style={({ pressed }) => [styles.legalLink, isRtl && styles.rowRtl, pressed && styles.pressed]}
            >
              <Text style={[styles.legalLinkText, isRtl && styles.rtlText]}>{label}</Text>
              <HotelPortalIcon name={isRtl ? "chevron-back" : "chevron-forward"} size={16} color={palette.navy} />
            </Pressable>
          ))}

          <View style={styles.iataCard}>
            <Image
              source={require("../assets/images/iata-logo.png")}
              style={styles.iataLogo}
              resizeMode="contain"
              accessibilityLabel="IATA logo"
            />
            <View style={styles.iataCopy}>
              <Text style={styles.iataLabel}>IATA ACCREDITED</Text>
              <Text style={styles.iataNumber}>42228745</Text>
            </View>
          </View>
          <Text style={styles.rights}>{copy.rights}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: palette.canvas, flex: 1 },
  header: {
    alignItems: "center",
    backgroundColor: palette.card,
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: palette.navySoft,
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerTitle: {
    color: palette.ink,
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 19,
    textAlign: "center",
  },
  content: { padding: 16 },
  brandCard: {
    alignItems: "center",
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
  },
  appIcon: { borderRadius: 18, height: 76, width: 76 },
  version: {
    color: palette.ink,
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    marginTop: 12,
  },
  currentRow: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 4 },
  currentText: { color: palette.muted, fontFamily: "Inter_400Regular", fontSize: 12 },
  sectionList: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    overflow: "hidden",
  },
  section: { borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionButton: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 58,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    color: palette.ink,
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  sectionBody: { backgroundColor: "#F8FAFC", padding: 15, paddingTop: 4 },
  paragraph: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  sourcesTitle: {
    color: palette.ink,
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    marginBottom: 8,
    marginTop: 20,
  },
  linkRow: {
    alignItems: "center",
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 8,
    minHeight: 49,
    paddingHorizontal: 13,
  },
  linkText: {
    color: palette.navy,
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  legalLink: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 42,
    paddingHorizontal: 8,
  },
  legalLinkText: {
    color: palette.navy,
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  iataCard: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  iataLogo: { height: 48, width: 48 },
  iataCopy: { alignItems: "flex-start" },
  iataLabel: {
    color: palette.muted,
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 0.8,
  },
  iataNumber: { color: palette.ink, fontFamily: "Inter_700Bold", fontSize: 17 },
  rights: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 13,
    textAlign: "center",
  },
  rowRtl: { flexDirection: "row-reverse" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  pressed: { opacity: 0.72 },
});