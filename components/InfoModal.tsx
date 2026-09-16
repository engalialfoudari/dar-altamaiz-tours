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
import { t } from "@/constants/i18n";

const { navy } = colors.light;
const gold = "#C9A84C";
const white = "#FFFFFF";
const whiteDim = "rgba(255,255,255,0.82)";
const whiteDimAr = "rgba(255,255,255,0.88)";
const divider = "rgba(201,168,76,0.25)";
const WHATSAPP_URL = "https://wa.me/96590087797";

const ar = t("ar").infoModal;
const en = t("en").infoModal;

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
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.418A9.954 9.954 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm-1.2 5.5c-.16-.36-.33-.37-.49-.376l-.418-.006c-.145 0-.38.054-.58.27-.198.216-.757.74-.757 1.804s.775 2.094.883 2.239c.108.145 1.5 2.385 3.69 3.248 1.826.72 2.19.578 2.586.542.395-.036 1.277-.522 1.457-1.026.18-.504.18-.936.126-1.026-.054-.09-.198-.144-.414-.252-.216-.108-1.277-.631-1.475-.703-.197-.072-.341-.108-.485.108-.144.216-.558.703-.684.847-.126.144-.252.162-.468.054-.216-.108-.91-.335-1.732-1.07-.64-.571-1.072-1.277-1.198-1.493-.126-.216-.013-.333.095-.44.097-.097.216-.252.324-.378.108-.126.144-.216.216-.36.072-.145.036-.271-.018-.379-.054-.108-.48-1.17-.666-1.603z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

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
        {/* Header bar — bilingual title */}
        <View style={styles.modalHeader}>
          <View style={styles.headerSide} />
          <View style={styles.titleBlock}>
            <Text style={styles.modalTitleAr}>{ar.title}</Text>
            <Text style={styles.modalTitleEn}>{en.title}</Text>
          </View>
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
          {/* Main title — Arabic first, English below */}
          <Text style={styles.mainTitleAr}>{ar.mainTitle}</Text>
          <Text style={styles.mainTitleEn}>{en.mainTitle}</Text>

          {ar.sections.map((arSection, i) => {
            const enSection = en.sections[i];
            return (
              <View key={i} style={styles.section}>
                {/* Arabic heading + body */}
                <Text style={styles.headingAr}>{arSection.heading}</Text>
                <Text style={styles.bodyAr}>{arSection.body}</Text>

                {/* Subtle separator between Arabic and English */}
                <View style={styles.langDivider} />

                {/* English heading + body */}
                <Text style={styles.headingEn}>{enSection.heading}</Text>
                <Text style={styles.bodyEn}>{enSection.body}</Text>
              </View>
            );
          })}

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
            <View>
              <Text style={styles.waBtnText}>{ar.whatsapp}</Text>
              <Text style={[styles.waBtnText, { fontSize: 10, opacity: 0.85 }]}>{en.whatsapp}</Text>
            </View>
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
    paddingVertical: 10,
  },
  headerSide: {
    width: 40,
  },
  titleBlock: {
    flex: 1,
    alignItems: "center",
  },
  modalTitleAr: {
    color: gold,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    letterSpacing: 0.3,
    writingDirection: "rtl",
  },
  modalTitleEn: {
    color: "rgba(201,168,76,0.65)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    letterSpacing: 0.3,
    marginTop: 1,
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
    paddingTop: 20,
  },
  mainTitleAr: {
    color: gold,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
    letterSpacing: 0.3,
    textAlign: "right",
    writingDirection: "rtl",
  },
  mainTitleEn: {
    color: "rgba(201,168,76,0.65)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 20,
    letterSpacing: 0.2,
    textAlign: "left",
  },
  section: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: divider,
    borderRadius: 10,
    padding: 14,
  },
  headingAr: {
    color: gold,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 5,
    letterSpacing: 0.2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  bodyAr: {
    color: whiteDimAr,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    textAlign: "right",
    writingDirection: "rtl",
  },
  langDivider: {
    height: 1,
    backgroundColor: divider,
    marginVertical: 10,
  },
  headingEn: {
    color: "rgba(201,168,76,0.75)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
    letterSpacing: 0.2,
    textAlign: "left",
  },
  bodyEn: {
    color: whiteDim,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    textAlign: "left",
  },
  waBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    gap: 7,
    backgroundColor: "rgba(37,211,102,0.10)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#25D366",
    paddingVertical: 8,
    paddingHorizontal: 18,
    marginTop: 8,
    marginBottom: 8,
  },
  waBtnPressed: {
    backgroundColor: "rgba(37,211,102,0.20)",
  },
  waBtnText: {
    color: "#25D366",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
    textAlign: "center",
  },
});
