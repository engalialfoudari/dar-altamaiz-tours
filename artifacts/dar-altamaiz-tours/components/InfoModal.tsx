import React from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";

const { navy } = colors.light;
const gold = "#C9A84C";
const white = "#FFFFFF";
const whiteDim = "rgba(255,255,255,0.82)";
const divider = "rgba(201,168,76,0.25)";
const WHATSAPP_URL = "https://wa.me/96590087797";

function CloseIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6l12 12"
        stroke={white}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function WhatsAppIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.418A9.954 9.954 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm-1.2 5.5c-.16-.36-.33-.37-.49-.376l-.418-.006c-.145 0-.38.054-.58.27-.198.216-.757.74-.757 1.804s.775 2.094.883 2.239c.108.145 1.5 2.385 3.69 3.248 1.826.72 2.19.578 2.586.542.395-.036 1.277-.522 1.457-1.026.18-.504.18-.936.126-1.026-.054-.09-.198-.144-.414-.252-.216-.108-1.277-.631-1.475-.703-.197-.072-.341-.108-.485.108-.144.216-.558.703-.684.847-.126.144-.252.162-.468.054-.216-.108-.91-.335-1.732-1.07-.64-.571-1.072-1.277-1.198-1.493-.126-.216-.013-.333.095-.44.097-.097.216-.252.324-.378.108-.126.144-.216.216-.36.072-.145.036-.271-.018-.379-.054-.108-.48-1.17-.666-1.603z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

interface Section {
  headingAr: string;
  bodyAr: string;
  headingEn: string;
  bodyEn: string;
}

const SECTIONS: Section[] = [
  {
    headingAr: "رحلات الطيران",
    bodyAr:
      "للحصول على نتائج أدق وأسرع لرحلات الطيران، يُفضل كتابة رمز المطار الدولي المكون من ثلاثة أحرف (مثال: للكويت اكتب KWI، لدبي اكتب DXB، للندن اكتب LHR).",
    headingEn: "Flights",
    bodyEn:
      "For more accurate and faster flight results, it is highly recommended to enter the official three-letter airport IATA code (e.g., KWI for Kuwait, DXB for Dubai, LHR for London).",
  },
  {
    headingAr: "حجوزات الفنادق",
    bodyAr:
      "يمكنك كتابة اسم الفندق مباشرة إذا كنت تحفظه، أو اكتفِ بكتابة اسم المدينة ثم استخدم خانة التصفية (الفلتر) بالداخل لتضييق النتائج والوصول إلى فندقك المفضل بسهولة.",
    headingEn: "Hotels",
    bodyEn:
      "You can type the exact hotel name directly if known, or simply enter the city name and utilize the internal search filters to narrow down and find your preferred accommodation easily.",
  },
  {
    headingAr: "لغة البحث",
    bodyAr:
      "لضمان مطابقة الأسعار الحية والحصول على نتائج دقيقة بنسبة مئة بالمئة، نوصي دائماً بكتابة أسماء المدن والمطارات والفنادق باللغة الإنجليزية.",
    headingEn: "Search Language",
    bodyEn:
      "To ensure real-time live price matching and 100% precise results, we always recommend typing cities, airports, and hotel names in English.",
  },
  {
    headingAr: "صلاحية جواز السفر",
    bodyAr:
      "يرجى التأكد من أن صلاحية جواز سفرك لا تقل عن 6 أشهر من تاريخ السفر المخطط له، وذلك لتفادي أي عوائق أو قيود أثناء إنهاء إجراءات المطار.",
    headingEn: "Passport Validity",
    bodyEn:
      "Please ensure that your passport validity is not less than 6 months from your planned travel date to avoid any issues or restrictions during airport check-in.",
  },
  {
    headingAr: "مرونة التواريخ",
    bodyAr:
      "إذا كانت تواريخ سفرك مرنة وغير ثابتة، يفضل تجربة البحث قبل أو بعد التاريخ المحدد بيومين، حيث تتوفر غالباً أسعار طيران وفنادق أفضل في منتصف الأسبوع.",
    headingEn: "Flexible Dates",
    bodyEn:
      "If your travel dates are flexible, try searching 2 days before or after your selected date. Better flight and hotel rates are often available during mid-week departures.",
  },
  {
    headingAr: "الدعم الفني والاستفسارات",
    bodyAr:
      "إذا واجهتك أي صعوبة أثناء استخدام التطبيق أو كان لديك أي استفسار إضافي، يمكنك التواصل مباشرة مع فريق دعم دار التميز للسفريات عبر الواتساب بالضغط على الزر أدناه.",
    headingEn: "Technical Support and Inquiries",
    bodyEn:
      "If you encounter any difficulties while using the application or have any further inquiries, you can directly connect with the Dar AlTamaiz Tours support team via WhatsApp by clicking the button below.",
  },
];

interface InfoModalProps {
  visible: boolean;
  onClose: () => void;
}

export function InfoModal({ visible, onClose }: InfoModalProps) {
  const insets = useSafeAreaInsets();

  const openWhatsApp = () => {
    Linking.openURL(WHATSAPP_URL).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header bar */}
        <View style={styles.modalHeader}>
          <View style={styles.headerSide} />
          <Text style={styles.modalTitle}>دليل البحث</Text>
          <Pressable
            style={({ pressed }) => [
              styles.closeBtn,
              pressed && styles.closeBtnPressed,
            ]}
            onPress={onClose}
            hitSlop={12}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <CloseIcon />
          </Pressable>
        </View>

        <View style={styles.titleDivider} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Arabic block */}
          <Text style={styles.mainTitleAr}>دليل إرشادات البحث والمساعدة</Text>

          {SECTIONS.map((s, i) => (
            <View key={`ar-${i}`} style={styles.section}>
              <Text style={styles.headingAr}>{s.headingAr}</Text>
              <Text style={styles.bodyAr}>{s.bodyAr}</Text>
            </View>
          ))}

          {/* Divider between languages */}
          <View style={styles.langDivider} />

          {/* English block */}
          <Text style={styles.mainTitleEn}>Search Guidelines and Support</Text>

          {SECTIONS.map((s, i) => (
            <View key={`en-${i}`} style={styles.section}>
              <Text style={styles.headingEn}>{s.headingEn}</Text>
              <Text style={styles.bodyEn}>{s.bodyEn}</Text>
            </View>
          ))}

          {/* WhatsApp CTA */}
          <Pressable
            style={({ pressed }) => [
              styles.waBtn,
              pressed && styles.waBtnPressed,
            ]}
            onPress={openWhatsApp}
            accessibilityLabel="Contact us on WhatsApp"
            accessibilityRole="button"
          >
            <WhatsAppIcon />
            <Text style={styles.waBtnText}>
              تواصل معنا عبر الواتساب{"  |  "}Contact Us on WhatsApp
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSide: {
    width: 40,
  },
  modalTitle: {
    flex: 1,
    color: gold,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  closeBtnPressed: {
    backgroundColor: "rgba(201,168,76,0.18)",
  },
  titleDivider: {
    height: 1,
    backgroundColor: divider,
    marginHorizontal: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  mainTitleAr: {
    color: gold,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
    writingDirection: "rtl",
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  mainTitleEn: {
    color: gold,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "left",
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  section: {
    marginBottom: 20,
  },
  headingAr: {
    color: gold,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
    writingDirection: "rtl",
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  bodyAr: {
    color: whiteDim,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
    writingDirection: "rtl",
    lineHeight: 22,
  },
  headingEn: {
    color: gold,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "left",
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  bodyEn: {
    color: whiteDim,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "left",
    lineHeight: 22,
  },
  langDivider: {
    height: 1,
    backgroundColor: divider,
    marginVertical: 28,
  },
  waBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#25D366",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  waBtnPressed: {
    opacity: 0.82,
  },
  waBtnText: {
    color: white,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
    flexShrink: 1,
    textAlign: "center",
  },
});
