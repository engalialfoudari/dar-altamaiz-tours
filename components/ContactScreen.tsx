import React, { useCallback, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HotelPortalIcon, type HotelPortalIconName } from "@/components/HotelPortalIcon";
import { AboutModal } from "@/components/AboutModal";
import { FaqModal } from "@/components/FaqModal";
import {
  LegalDocumentModal,
  type LegalDocumentType,
} from "@/components/LegalDocumentModal";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

type Language = "en" | "ar";

interface ContactScreenProps {
  lang: Language;
  onStartRequest: () => void;
  onBack: () => void;
}

type ContactItemProps = {
  icon: HotelPortalIconName;
  label: string;
  value: string;
  onPress: () => void;
  isRtl: boolean;
  testID: string;
};

type ContactActionProps = {
  icon: HotelPortalIconName;
  label: string;
  onPress: () => void;
  testID: string;
};

const hotelPortal = {
  navy: "#003580",
  gold: "#FEBB02",
  ink: "#1E293B",
  muted: "#64748B",
  border: "#D9E0E8",
  canvas: "#F2F2F2",
  card: "#FFFFFF",
};
const { navy, gold } = hotelPortal;

const businessAddress = "State of Kuwait - Hawally - AlRihab Mall, first floor, office 32";
const mapsSearchUrl = "https://maps.app.goo.gl/yA7TuQJhJqKWXZZ6A?g_st=ac";

function ContactItem({
  icon,
  label,
  value,
  onPress,
  isRtl,
  testID,
}: ContactItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.contactItem,
        isRtl && styles.contactItemRtl,
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <View style={[styles.contactIcon, isRtl && styles.contactIconRtl]}>
        <HotelPortalIcon name={icon} size={21} color={navy} />
      </View>
      <View style={styles.contactCopy}>
        <Text style={[styles.contactLabel, isRtl && styles.rtlText]}>{label}</Text>
        <Text
          style={[
            styles.contactValue,
            isRtl && styles.rtlText,
            (icon === "phone" || icon === "chat" || icon === "mail") &&
              styles.ltrValue,
          ]}
        >
          {value}
        </Text>
      </View>
      <HotelPortalIcon name={isRtl ? "chevron-back" : "chevron-forward"} size={18} color={hotelPortal.muted} />
    </Pressable>
  );
}

function ContactAction({ icon, label, onPress, testID }: ContactActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
      testID={testID}
    >
      {icon === "whatsapp" ? (
        <WhatsAppIcon size={24} color={navy} />
      ) : (
        <HotelPortalIcon name={icon} size={23} color={navy} />
      )}
    </Pressable>
  );
}

export function ContactScreen({ lang, onStartRequest, onBack }: ContactScreenProps) {
  const insets = useSafeAreaInsets();
  const [aboutVisible, setAboutVisible] = useState(false);
  const [faqVisible, setFaqVisible] = useState(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocumentType | null>(null);
  const isRtl = lang === "ar";
  const copy =
    lang === "ar"
      ? {
          eyebrow: "دار التميز تورز",
          title: "تواصل معنا",
          intro: "فريقنا جاهز لمساعدتك في تخطيط رحلتك القادمة.",
          details: "معلومات التواصل",
          address: "العنوان",
          phone: "الهاتف",
          whatsapp: "واتساب",
          email: "البريد الإلكتروني",
          requestTitle: "هل تخطط لرحلة خاصة؟",
          requestBody:
            "أخبرنا بما تحلم به، وسيتولى مستشارو السفر لدينا إعداد عرض يناسب مجموعتك وميزانيتك.",
          requestAction: "ابدأ طلباً خاصاً",
          requestHint: "نرد خلال ثلاثة أيام عمل",
          faqTitle: "الأسئلة الشائعة",
          faqBody: "إجابات عن الحجوزات والدفع والإلغاء والتراخيص.",
          faqAction: "عرض الأسئلة",
          aboutTitle: "عن DT Tours",
          aboutBody: "الشركة والتراخيص والشروط والخصوصية.",
          aboutAction: "عرض معلومات التطبيق",
          legalTitle: "السياسات والشروط",
          privacyTitle: "سياسة الخصوصية",
          privacyBody: "كيف نجمع معلوماتك ونستخدمها ونحفظها ونشاركها.",
          termsTitle: "الشروط وأحكام الحجز",
          termsBody: "شروط الحجز والدفع والإلغاء والاسترداد ووثائق السفر.",
           mapTitle: "زوروا مكتبنا",
           mapBody: "مجمع الرحاب، حولي، دولة الكويت",
           mapAction: "فتح في خرائط Google",
          footer: "دار التميز تورز",
        }
      : {
          eyebrow: "DAR ALTAMAIZ TOURS",
          title: "Let's plan your next journey",
          intro: "Our travel consultants are here to make every detail effortless.",
          details: "Contact details",
          address: "Visit our office",
          phone: "Call us",
          whatsapp: "WhatsApp us",
          email: "Email us",
          requestTitle: "Planning something special?",
          requestBody:
            "Tell us what you have in mind and our travel consultants will craft an offer around your group and budget.",
          requestAction: "Start a special request",
          requestHint: "We reply within 3 business days",
          faqTitle: "Frequently asked questions",
          faqBody: "Answers about bookings, payments, cancellations, and licensing.",
          faqAction: "View FAQs",
          aboutTitle: "About DT Tours",
          aboutBody: "Company, licensing, terms, and privacy information.",
          aboutAction: "View About",
          legalTitle: "Policies and conditions",
          privacyTitle: "Privacy Policy",
          privacyBody: "How we collect, use, retain, and share your information.",
          termsTitle: "Terms & Booking Conditions",
          termsBody: "Booking, payment, cancellation, refund, and travel-document terms.",
           mapTitle: "Visit our office",
           mapBody: "AlRihab Mall, Hawally, Kuwait",
           mapAction: "Open in Google Maps",
          footer: "Dar AlTamaiz Tours",
        };

  const openLink = useCallback(
    async (url: string) => {
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert(
          isRtl ? "تعذر فتح الرابط" : "Unable to open link",
          isRtl
            ? "يرجى المحاولة مرة أخرى أو التواصل معنا مباشرة."
            : "Please try again or contact us directly.",
        );
      }
    },
    [isRtl],
  );

  const topInset = Math.max(insets.top, Platform.OS === "web" ? 67 : 0);
  const bottomInset = Math.max(insets.bottom, Platform.OS === "web" ? 34 : 0);
  const address = isRtl
    ? "دولة الكويت - حولي - مجمع الرحاب، الطابق الأول، مكتب 32"
    : businessAddress;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + 22, paddingBottom: bottomInset + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, isRtl && styles.rtlAlign]}>
          <View style={styles.contactHeader}>
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={isRtl ? "العودة إلى الصفحة الرئيسية" : "Back to home"}
              testID="contact-back-home"
              style={[styles.contactBackButton, isRtl && styles.contactBackButtonRtl]}
            >
              <HotelPortalIcon name={isRtl ? "arrow-forward" : "arrow-back"} size={19} color={navy} />
              <Text style={styles.contactBackText}>{isRtl ? "الرئيسية" : "Back"}</Text>
            </Pressable>
            <View style={styles.contactLogoViewport}>
              <Image
                source={require("../assets/images/dt-tours-logo-transparent.png")}
                style={styles.contactLogoTransparent}
                resizeMode="contain"
                accessibilityLabel="Dar AlTamaiz Tours"
              />
            </View>
          </View>
          <Text
            style={[styles.title, isRtl && styles.rtlText]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {copy.title}
          </Text>
          <Text style={[styles.intro, isRtl && styles.rtlText]}>{copy.intro}</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, isRtl && styles.rtlText]}>{copy.details}</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.contactCard}>
          <ContactItem
            icon="location"
            label={copy.address}
            value={address}
            onPress={() => void openLink(mapsSearchUrl)}
            isRtl={isRtl}
            testID="contact-open-maps"
          />
          <View style={styles.divider} />
          <View style={[styles.iconActions, isRtl && styles.iconActionsRtl]}>
            <ContactAction icon="phone" label={copy.phone} onPress={() => void openLink("tel:+96522204125")} testID="contact-call" />
            <ContactAction icon="whatsapp" label={copy.whatsapp} onPress={() => void openLink("https://wa.me/96590087797")} testID="contact-whatsapp" />
            <ContactAction icon="mail" label={copy.email} onPress={() => void openLink("mailto:info@dt-tour.com")} testID="contact-email" />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.mapAction}
          onPress={() => void openLink(mapsSearchUrl)}
          style={({ pressed }) => [styles.mapCard, isRtl && styles.mapCardRtl, pressed && styles.pressed]}
          testID="contact-open-google-maps"
        >
          <View style={[styles.mapIcon, isRtl && styles.mapIconRtl]}>
            <HotelPortalIcon name="location" size={23} color="#FFFFFF" />
          </View>
          <View style={styles.mapCopy}>
            <Text style={[styles.mapTitle, isRtl && styles.rtlText]}>{copy.mapTitle}</Text>
            <Text style={[styles.mapBody, isRtl && styles.rtlText]}>{copy.mapBody}</Text>
          </View>
          <View style={[styles.mapAction, isRtl && styles.mapActionRtl]}>
            <Text style={styles.mapActionText}>{copy.mapAction}</Text>
            <HotelPortalIcon name={isRtl ? "arrow-back" : "arrow-forward"} size={15} color="#FFFFFF" />
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.faqAction}
          onPress={() => setFaqVisible(true)}
          style={({ pressed }) => [styles.faqButton, isRtl && styles.faqButtonRtl, pressed && styles.pressed]}
          testID="contact-open-faq"
        >
          <View style={[styles.faqIcon, isRtl && styles.faqIconRtl]}>
            <HotelPortalIcon name="lightbulb" size={23} color={navy} />
          </View>
          <View style={styles.faqCopy}>
            <Text style={[styles.faqTitle, isRtl && styles.rtlText]}>{copy.faqTitle}</Text>
            <Text style={[styles.faqBody, isRtl && styles.rtlText]}>{copy.faqBody}</Text>
          </View>
          <HotelPortalIcon name={isRtl ? "chevron-back" : "chevron-forward"} size={19} color={navy} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.aboutAction}
          onPress={() => setAboutVisible(true)}
          style={({ pressed }) => [styles.faqButton, isRtl && styles.faqButtonRtl, pressed && styles.pressed]}
          testID="contact-open-about"
        >
          <View style={[styles.faqIcon, isRtl && styles.faqIconRtl]}>
            <HotelPortalIcon name="building" size={22} color={navy} />
          </View>
          <View style={styles.faqCopy}>
            <Text style={[styles.faqTitle, isRtl && styles.rtlText]}>{copy.aboutTitle}</Text>
            <Text style={[styles.faqBody, isRtl && styles.rtlText]}>{copy.aboutBody}</Text>
          </View>
          <HotelPortalIcon name={isRtl ? "chevron-back" : "chevron-forward"} size={19} color={navy} />
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, isRtl && styles.rtlText]}>{copy.legalTitle}</Text>
          <View style={styles.sectionLine} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.privacyTitle}
          onPress={() => setLegalDocument("privacy")}
          style={({ pressed }) => [styles.faqButton, isRtl && styles.faqButtonRtl, pressed && styles.pressed]}
          testID="contact-open-privacy"
        >
          <View style={[styles.faqIcon, isRtl && styles.faqIconRtl]}>
            <HotelPortalIcon name="user" size={23} color={navy} />
          </View>
          <View style={styles.faqCopy}>
            <Text style={[styles.faqTitle, isRtl && styles.rtlText]}>{copy.privacyTitle}</Text>
            <Text style={[styles.faqBody, isRtl && styles.rtlText]}>{copy.privacyBody}</Text>
          </View>
          <HotelPortalIcon name={isRtl ? "chevron-back" : "chevron-forward"} size={19} color={navy} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.termsTitle}
          onPress={() => setLegalDocument("terms")}
          style={({ pressed }) => [styles.faqButton, isRtl && styles.faqButtonRtl, pressed && styles.pressed]}
          testID="contact-open-terms"
        >
          <View style={[styles.faqIcon, isRtl && styles.faqIconRtl]}>
            <HotelPortalIcon name="briefcase" size={23} color={navy} />
          </View>
          <View style={styles.faqCopy}>
            <Text style={[styles.faqTitle, isRtl && styles.rtlText]}>{copy.termsTitle}</Text>
            <Text style={[styles.faqBody, isRtl && styles.rtlText]}>{copy.termsBody}</Text>
          </View>
          <HotelPortalIcon name={isRtl ? "chevron-back" : "chevron-forward"} size={19} color={navy} />
        </Pressable>

        <View style={[styles.requestCard, isRtl && styles.requestCardRtl]}>
          <View style={[styles.requestIcon, isRtl && styles.requestIconRtl]}>
            <HotelPortalIcon name="sparkles" size={25} color={navy} />
          </View>
          <View style={styles.requestCopy}>
            <Text style={[styles.requestTitle, isRtl && styles.rtlText]}>{copy.requestTitle}</Text>
            <Text style={[styles.requestBody, isRtl && styles.rtlText]}>{copy.requestBody}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.requestAction}
              onPress={onStartRequest}
              style={({ pressed }) => [styles.requestButton, pressed && styles.pressed]}
              testID="contact-start-request"
            >
              <Text style={styles.requestButtonText}>{copy.requestAction}</Text>
              <HotelPortalIcon name={isRtl ? "arrow-back" : "arrow-forward"} size={17} color="#FFFFFF" />
            </Pressable>
            <View style={[styles.hintRow, isRtl && styles.hintRowRtl]}>
              <HotelPortalIcon name="time" size={14} color={hotelPortal.muted} />
              <Text style={[styles.requestHint, isRtl && styles.rtlText]}>{copy.requestHint}</Text>
            </View>
          </View>
        </View>

        <View style={styles.contactIata}>
          <Image
            source={require("../assets/images/iata-logo.png")}
            style={styles.contactIataLogo}
            resizeMode="contain"
            accessibilityLabel="IATA logo"
          />
          <Text style={styles.contactIataText}>IATA 42228745</Text>
        </View>
        <Text style={[styles.footer, isRtl && styles.footerRtl]}>
          {isRtl
            ? "© 2026 شركة ماكس للسياحة والسفر. جميع الحقوق محفوظة."
            : "© 2026 Max Travel & Tourism Co. All rights reserved."}
        </Text>
      </ScrollView>
      <AboutModal
        visible={aboutVisible}
        lang={lang}
        onClose={() => setAboutVisible(false)}
      />
      <FaqModal
        visible={faqVisible}
        lang={lang}
        onClose={() => setFaqVisible(false)}
      />
      <LegalDocumentModal
        document={legalDocument}
        lang={lang}
        onClose={() => setLegalDocument(null)}
      />
    </View>
  );
}

export default ContactScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: hotelPortal.canvas,
  },
  content: {
    paddingHorizontal: 16,
  },
  hero: {
    paddingHorizontal: 8,
    marginBottom: 28,
  },
  contactHeader: {
    width: "100%",
    height: 90,
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 17,
  },
  // The source is a transparent square with the mark centered inside it.
  // Crop only the transparent canvas so the logo keeps its existing size.
  contactLogoViewport: { position: "absolute", top: 0, width: 196, height: 42, overflow: "hidden" },
  contactLogoTransparent: { position: "absolute", left: 0, top: -81, width: 196, height: 196 },
  contactBackButton: {
    position: "absolute",
    left: 0,
    bottom: 0,
    minHeight: 38,
    paddingHorizontal: 10,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: hotelPortal.border,
    zIndex: 1,
  },
  contactBackButtonRtl: { left: undefined, right: 0, flexDirection: "row-reverse" },
  contactBackText: { color: navy, fontSize: 13, fontWeight: "800" },
  rtlAlign: {
    alignItems: "flex-end",
  },
  goldRule: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: gold,
    marginBottom: 14,
  },
  goldRuleRtl: {
    alignSelf: "flex-end",
  },
  eyebrow: {
    color: navy,
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 1.7,
    marginBottom: 8,
  },
  title: {
    color: hotelPortal.ink,
    fontFamily: "Inter_700Bold",
    fontSize: 27,
    lineHeight: 35,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  intro: {
    color: hotelPortal.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 340,
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 11,
  },
  sectionTitle: {
    color: navy,
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 0.3,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: hotelPortal.border,
  },
  contactCard: {
    backgroundColor: hotelPortal.card,
    borderColor: hotelPortal.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    overflow: "hidden",
  },
  iconActions: {
    alignItems: "center",
    flexDirection: "row",
     gap: 24,
    justifyContent: "center",
    minHeight: 76,
    paddingHorizontal: 18,
  },
  iconActionsRtl: {
    flexDirection: "row-reverse",
  },
  iconAction: {
    alignItems: "center",
    backgroundColor: "#EAF2FF",
    borderColor: "#C8DCF8",
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  contactItem: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 75,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  contactItemRtl: {
    flexDirection: "row-reverse",
  },
  contactIcon: {
    alignItems: "center",
    backgroundColor: "#EAF2FF",
    borderRadius: 10,
    height: 40,
    justifyContent: "center",
    marginRight: 12,
    width: 40,
  },
  contactIconRtl: {
    marginLeft: 12,
    marginRight: 0,
  },
  contactCopy: {
    flex: 1,
    minWidth: 0,
  },
  contactLabel: {
    color: hotelPortal.muted,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    marginBottom: 3,
  },
  contactValue: {
    color: hotelPortal.ink,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
  },
  ltrValue: {
    textAlign: "left",
    writingDirection: "ltr",
  },
  divider: {
    backgroundColor: hotelPortal.border,
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },
  mapCard: {
    alignItems: "center",
    backgroundColor: navy,
    borderColor: navy,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 16,
    minHeight: 86,
    padding: 13,
  },
  mapCardRtl: {
    flexDirection: "row-reverse",
  },
  mapIcon: {
    alignItems: "center",
    backgroundColor: "#0B448C",
    borderRadius: 10,
    height: 46,
    justifyContent: "center",
    marginRight: 11,
    width: 46,
  },
  mapIconRtl: {
    marginLeft: 11,
    marginRight: 0,
  },
  mapCopy: {
    flex: 1,
    minWidth: 0,
  },
  mapTitle: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    marginBottom: 3,
  },
  mapBody: {
    color: "#D8E5F7",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  mapAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginLeft: 8,
  },
  mapActionRtl: {
    flexDirection: "row-reverse",
    marginLeft: 0,
    marginRight: 8,
  },
  mapActionText: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    maxWidth: 72,
    textAlign: "right",
  },
  faqButton: {
    alignItems: "center",
    backgroundColor: hotelPortal.card,
    borderColor: hotelPortal.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 16,
    minHeight: 78,
    padding: 13,
  },
  faqButtonRtl: {
    flexDirection: "row-reverse",
  },
  faqIcon: {
    alignItems: "center",
    backgroundColor: "#EAF2FF",
    borderRadius: 10,
    height: 44,
    justifyContent: "center",
    marginRight: 12,
    width: 44,
  },
  faqIconRtl: {
    marginLeft: 12,
    marginRight: 0,
  },
  faqCopy: {
    flex: 1,
    minWidth: 0,
  },
  faqTitle: {
    color: hotelPortal.ink,
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 3,
  },
  faqBody: {
    color: hotelPortal.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  requestCard: {
    backgroundColor: hotelPortal.card,
    borderColor: hotelPortal.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    padding: 16,
  },
  requestCardRtl: {
    flexDirection: "row-reverse",
  },
  requestIcon: {
    alignItems: "center",
    backgroundColor: "#EAF2FF",
    borderRadius: 10,
    height: 44,
    justifyContent: "center",
    marginRight: 13,
    width: 44,
  },
  requestIconRtl: {
    marginLeft: 13,
    marginRight: 0,
  },
  requestCopy: {
    flex: 1,
    minWidth: 0,
  },
  requestTitle: {
    color: hotelPortal.ink,
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    lineHeight: 23,
    marginBottom: 5,
  },
  requestBody: {
    color: hotelPortal.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  requestButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: navy,
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    minHeight: 43,
    paddingHorizontal: 14,
  },
  requestButtonText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  hintRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    marginTop: 12,
  },
  hintRowRtl: {
    flexDirection: "row-reverse",
    alignSelf: "flex-end",
  },
  requestHint: {
    color: hotelPortal.muted,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  footer: {
    color: hotelPortal.muted,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: 9,
    opacity: 0.75,
    textAlign: "center",
  },
  footerRtl: {
    writingDirection: "rtl",
  },
  contactIata: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 27,
  },
  contactIataLogo: {
    height: 32,
    width: 32,
  },
  contactIataText: {
    color: hotelPortal.ink,
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  backHomeButton: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 7,
    marginTop: 16,
    minHeight: 42,
    paddingHorizontal: 14,
  },
  backHomeButtonRtl: {
    flexDirection: "row-reverse",
  },
  backHomeText: {
    color: navy,
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  pressed: {
    opacity: 0.72,
  },
});