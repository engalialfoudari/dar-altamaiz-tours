import React, { useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";
import type { HomeLang } from "@/components/LuxuryHome";
import { HotelPortalIcon, type HotelPortalIconName } from "@/components/HotelPortalIcon";
import { LoadingCountdown } from "@/components/LoadingCountdown";

const C = {
  ...colors.light,
  navy: "#003580",
  navyMid: "#003580",
  navyLight: "#0B448C",
  blue: "#2E75C8",
  blueLight: "#B9D8FA",
  blueDark: "#0B448C",
  canvas: "#F2F2F2",
  canvasAlt: "#F2F2F2",
  textOnLight: "#1E293B",
  mutedOnLight: "#64748B",
  mutedForeground: "#64748B",
  borderOnLight: "#E2E8F0",
};

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ??
  "https://tours-dar-tamaiz--engalialfoudari.replit.app/api";

const STR = {
  en: {
    title: "Where to Go?",
    subtitle: "Top luxury destinations, curated by Tamaiz AI",
    seasonLabel: "When would you like to travel?",
    anySeason: "Any season",
    spring: "Spring",
    summer: "Summer",
    autumn: "Autumn",
    winter: "Winter",
    otherDestination: "Other destination",
    otherDestinationAlt: "Type your preferred destination",
    otherTitle: "Your destination",
    otherPrompt: "Where would you like to go?",
    otherSubtitle: "Tell us your preferred destination and we’ll create a guide for you.",
    otherPlaceholder: "e.g. Kyoto, Zanzibar, New York",
    exploreDestination: "Explore destination",
    loading: "Curating your luxury guide…",
    nightsLbl: "Recommended stay",
    nights: "nights",
    seasonsLbl: "Best seasons",
    tipLbl: "Luxury tip",
    cta: "Create AI Package for this Destination",
    back: "Destinations",
    error: "Couldn't load the guide. Please try again.",
    retry: "Retry",
  },
  ar: {
    title: "أين تذهب؟",
    subtitle: "أفخم الوجهات العالمية بعناية تميز الذكي",
    seasonLabel: "متى تودّ السفر؟",
    anySeason: "أي موسم",
    spring: "الربيع",
    summer: "الصيف",
    autumn: "الخريف",
    winter: "الشتاء",
    otherDestination: "وجهة أخرى",
    otherDestinationAlt: "اكتب وجهتك المفضلة",
    otherTitle: "وجهتك",
    otherPrompt: "إلى أين تودّ السفر؟",
    otherSubtitle: "اكتب وجهتك المفضلة وسنُعدّ لك دليلاً خاصاً بها.",
    otherPlaceholder: "مثال: كيوتو، زنجبار، نيويورك",
    exploreDestination: "استكشف الوجهة",
    loading: "جارٍ إعداد دليلك الفاخر…",
    nightsLbl: "مدة الإقامة المقترحة",
    nights: "ليالٍ",
    seasonsLbl: "أفضل المواسم",
    tipLbl: "نصيحة فاخرة",
    cta: "صمّم باقة ذكية لهذه الوجهة",
    back: "الوجهات",
    error: "تعذّر تحميل الدليل. حاول مرة أخرى.",
    retry: "إعادة المحاولة",
  },
};

const DESTINATIONS: Array<{ en: string; ar: string; image: ImageSourcePropType }> = [
  { en: "Paris", ar: "باريس", image: require("../assets/images/destinations/paris.jpg") },
  { en: "London", ar: "لندن", image: require("../assets/images/destinations/london.jpg") },
  { en: "Istanbul", ar: "إسطنبول", image: require("../assets/images/destinations/istanbul.jpg") },
  { en: "Dubai", ar: "دبي", image: require("../assets/images/destinations/dubai.jpg") },
  { en: "Maldives", ar: "المالديف", image: require("../assets/images/destinations/maldives.jpg") },
  { en: "Switzerland", ar: "سويسرا", image: require("../assets/images/destinations/switzerland.jpg") },
  { en: "Santorini", ar: "سانتوريني", image: require("../assets/images/destinations/santorini.jpg") },
  { en: "Bali", ar: "بالي", image: require("../assets/images/destinations/bali.jpg") },
  { en: "Tokyo", ar: "طوكيو", image: require("../assets/images/destinations/tokyo.jpg") },
  { en: "Rome", ar: "روما", image: require("../assets/images/destinations/rome.jpg") },
  { en: "Almaty", ar: "ألماتي", image: require("../assets/images/destinations/almaty.jpg") },
  { en: "Sarajevo", ar: "سراييفو", image: require("../assets/images/destinations/sarajevo.jpg") },
];

type SeasonKey = "any" | "spring" | "summer" | "autumn" | "winter";

const SEASONS: Array<{ key: SeasonKey; en: keyof typeof STR.en; ar: keyof typeof STR.ar }> = [
  { key: "any", en: "anySeason", ar: "anySeason" },
  { key: "spring", en: "spring", ar: "spring" },
  { key: "summer", en: "summer", ar: "summer" },
  { key: "autumn", en: "autumn", ar: "autumn" },
  { key: "winter", en: "winter", ar: "winter" },
];

const GUIDE_ICONS = [
  "location",
  "compass",
  "briefcase",
  "map",
  "tag",
] as const;

interface Guide {
  destination: string;
  tagline: string;
  spots: Array<{ name: string; description: string; icon: string }>;
  recommendedNights: number;
  bestSeasons: string;
  luxuryTip: string;
}

export function WhereToGoScreen({
  visible,
  lang,
  onClose,
  onCreatePackage,
}: {
  visible: boolean;
  lang: HomeLang;
  onClose: () => void;
  onCreatePackage: (destination: string, nights: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const s = STR[lang];
  const rtl = lang === "ar";
  const [selected, setSelected] = useState<string | null>(null);
  const [season, setSeason] = useState<SeasonKey>("any");
  const [customMode, setCustomMode] = useState(false);
  const [customDestination, setCustomDestination] = useState("");
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const reqRef = React.useRef(0);

  // Fresh state every time the modal opens; late responses from a previous
  // session are ignored via the request counter.
  React.useEffect(() => {
    if (visible) {
      reqRef.current++;
      setSelected(null);
      setSeason("any");
      setCustomMode(false);
      setCustomDestination("");
      setGuide(null);
      setError(false);
      setLoading(false);
    }
  }, [visible]);

  const loadGuide = (destination: string) => {
    const reqId = ++reqRef.current;
    setSelected(destination);
    setGuide(null);
    setError(false);
    setLoading(true);
    fetch(`${API_BASE}/destination-guide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination, lang, season: season === "any" ? undefined : season }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((d) => {
        if (reqRef.current === reqId) setGuide(d);
      })
      .catch(() => {
        if (reqRef.current === reqId) setError(true);
      })
      .finally(() => {
        if (reqRef.current === reqId) setLoading(false);
      });
  };

  const reset = () => {
    setSelected(null);
    setCustomMode(false);
    setCustomDestination("");
    setGuide(null);
    setError(false);
    setLoading(false);
  };

  const openCustomDestination = () => {
    reqRef.current++;
    setSelected(null);
    setGuide(null);
    setError(false);
    setLoading(false);
    setCustomDestination("");
    setCustomMode(true);
  };

  const submitCustomDestination = () => {
    const destination = customDestination.trim();
    if (destination.length >= 2) loadGuide(destination);
  };

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Navy header */}
        <View style={[styles.header, { paddingTop: topPad + 16 }]}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={selected || customMode ? reset : onClose}
              hitSlop={10}
              style={styles.backBtn}
              testID="wtg-back"
            >
              <HotelPortalIcon name={selected || customMode ? "arrow-back" : "close"} size={22} color="#FFFFFF" />
            </Pressable>
            <Text style={[styles.headerTitle, rtl && styles.rtlText]}>{selected ?? (customMode ? s.otherTitle : s.title)}</Text>
            <View style={{ width: 36 }} />
          </View>
          {!selected && !customMode && <Text style={[styles.headerSub, rtl && styles.rtlText]}>{s.subtitle}</Text>}
          <View style={styles.accentHairline} />
        </View>

        {!selected && !customMode ? (
          <ScrollView contentContainerStyle={[styles.destinationScroll, { paddingBottom: insets.bottom + 30 }]}>
            <View style={styles.seasonSection}>
              <Text style={[styles.seasonLabel, rtl && styles.rtlText]}>{s.seasonLabel}</Text>
              <View style={[styles.seasonOptions, rtl && { flexDirection: "row-reverse" }]}>
                {SEASONS.map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => setSeason(item.key)}
                    style={[styles.seasonChip, season === item.key && styles.seasonChipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: season === item.key }}
                  >
                    <Text style={[styles.seasonChipText, season === item.key && styles.seasonChipTextActive]}>
                      {s[lang === "ar" ? item.ar : item.en]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.grid}>
              {DESTINATIONS.map((d) => (
                <Pressable
                  key={d.en}
                  onPress={() => loadGuide(d.en)}
                  style={({ pressed }) => [styles.destCard, pressed && { transform: [{ scale: 0.96 }] }]}
                  testID={`dest-${d.en}`}
                >
                  <Image source={d.image} style={styles.destImage} accessibilityLabel={`${d.en} destination`} />
                  <Text style={styles.destName}>{lang === "ar" ? d.ar : d.en}</Text>
                  <Text style={styles.destNameAlt}>{lang === "ar" ? d.en : d.ar}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={openCustomDestination}
                style={({ pressed }) => [
                  styles.otherCard,
                  rtl && { flexDirection: "row-reverse" },
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
                testID="dest-other"
              >
                <View style={styles.otherIconWrap}>
                  <HotelPortalIcon name="search" size={22} color={C.blueDark} />
                </View>
                <View style={styles.otherCopy}>
                  <Text style={[styles.otherName, rtl && styles.rtlText]}>{s.otherDestination}</Text>
                  <Text style={[styles.otherNameAlt, rtl && styles.rtlText]}>{s.otherDestinationAlt}</Text>
                </View>
                <HotelPortalIcon name={rtl ? "arrow-back" : "arrow-forward"} size={19} color={C.blueDark} />
              </Pressable>
            </View>
          </ScrollView>
        ) : !selected ? (
          <ScrollView contentContainerStyle={[styles.customScroll, { paddingBottom: insets.bottom + 30 }]}>
            <View style={styles.customForm}>
              <View style={styles.customIconWrap}>
                <HotelPortalIcon name="search" size={26} color={C.blueDark} />
              </View>
              <Text style={[styles.customPrompt, rtl && styles.rtlText]}>{s.otherPrompt}</Text>
              <Text style={[styles.customSubtitle, rtl && styles.rtlText]}>{s.otherSubtitle}</Text>
              <TextInput
                style={[styles.customInput, rtl && styles.rtlInput]}
                value={customDestination}
                onChangeText={setCustomDestination}
                placeholder={s.otherPlaceholder}
                placeholderTextColor={C.mutedOnLight}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={submitCustomDestination}
                testID="wtg-custom-destination"
              />
              <Pressable
                style={[styles.customSubmit, customDestination.trim().length < 2 && styles.customSubmitDisabled]}
                onPress={submitCustomDestination}
                disabled={customDestination.trim().length < 2}
                testID="wtg-custom-submit"
              >
                <Text style={styles.customSubmitText}>{s.exploreDestination}</Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30 }}>
            {loading && (
              <View style={styles.loadingWrap}>
                <LoadingCountdown
                  message={s.loading}
                  color={C.navy}
                  mutedColor={C.mutedOnLight}
                  rtl={rtl}
                />
              </View>
            )}
            {error && (
              <View style={styles.loadingWrap}>
                <Text style={styles.errorText}>{s.error}</Text>
                <Pressable style={styles.retryBtn} onPress={() => loadGuide(selected)}>
                  <Text style={styles.retryText}>{s.retry}</Text>
                </Pressable>
              </View>
            )}
            {guide && (
              <>
                <Text style={[styles.tagline, rtl && styles.rtlText]}>{guide.tagline}</Text>

                <View style={styles.metaRow}>
                  <View style={styles.metaCard}>
                    <HotelPortalIcon name="moon" size={16} color={C.gold} />
                    <Text style={styles.metaLabel}>{s.nightsLbl}</Text>
                    <Text style={styles.metaValue}>
                      {guide.recommendedNights} {s.nights}
                    </Text>
                  </View>
                  <View style={styles.metaCard}>
                    <HotelPortalIcon name="compass" size={16} color={C.gold} />
                    <Text style={styles.metaLabel}>{s.seasonsLbl}</Text>
                    <Text style={styles.metaValue}>{guide.bestSeasons}</Text>
                  </View>
                </View>

                {guide.spots?.map((spot, i) => (
                  <View key={i} style={[styles.spotCard, rtl && { flexDirection: "row-reverse" }]}>
                    <View style={styles.spotIconWrap}>
                      <HotelPortalIcon name={GUIDE_ICONS[i % GUIDE_ICONS.length]} size={20} color={C.cyanLight} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.spotName, rtl && styles.rtlText]}>{spot.name}</Text>
                      <Text style={[styles.spotDesc, rtl && styles.rtlText]}>{spot.description}</Text>
                    </View>
                  </View>
                ))}

                {!!guide.luxuryTip && (
                  <View style={styles.tipCard}>
                    <Text style={[styles.tipLabel, rtl && styles.rtlText]}>{s.tipLbl}</Text>
                    <Text style={[styles.tipText, rtl && styles.rtlText]}>{guide.luxuryTip}</Text>
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.88 }]}
                  onPress={() => onCreatePackage(guide.destination || selected, guide.recommendedNights || 5)}
                  testID="wtg-create-package"
                >
                  <HotelPortalIcon name="sparkles" size={16} color={C.blueDark} />
                  <Text style={styles.ctaText}>{s.cta}</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.canvas },
  header: {
    backgroundColor: C.navy,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.navyLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", flex: 1, textAlign: "center" },
  headerSub: { color: C.cyanLight, fontSize: 12.5, marginTop: 8, textAlign: "center" },
  accentHairline: { height: 2, backgroundColor: C.blueLight, width: 56, borderRadius: 2, marginTop: 12, alignSelf: "center" },
  rtlText: { writingDirection: "rtl" },

  destinationScroll: { paddingTop: 14 },
  seasonSection: { paddingHorizontal: 16, marginBottom: 2 },
  seasonLabel: { color: C.textOnLight, fontSize: 14, fontWeight: "800", marginBottom: 9 },
  seasonOptions: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  seasonChip: {
    borderWidth: 1,
    borderColor: "rgba(46,117,200,0.35)",
    backgroundColor: C.canvasAlt,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  seasonChipActive: { backgroundColor: C.navy, borderColor: C.navy },
  seasonChipText: { color: C.mutedOnLight, fontSize: 12, fontWeight: "700" },
  seasonChipTextActive: { color: "#FFFFFF" },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 12,
    justifyContent: "space-between",
  },
  destCard: {
    width: "48%",
    backgroundColor: C.canvasAlt,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(46,117,200,0.35)",
    alignItems: "center",
    paddingVertical: 20,
  },
  destImage: { width: 58, height: 58, borderRadius: 14, marginBottom: 10, backgroundColor: "rgba(46,117,200,0.13)" },
  destName: { color: C.textOnLight, fontSize: 15, fontWeight: "800" },
  destNameAlt: { color: C.mutedOnLight, fontSize: 11.5, marginTop: 2 },
  otherCard: {
    width: "100%",
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(46,117,200,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(46,117,200,0.45)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  otherIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(46,117,200,0.13)",
    alignItems: "center",
    justifyContent: "center",
  },
  otherCopy: { flex: 1 },
  otherName: { color: C.textOnLight, fontSize: 14, fontWeight: "800" },
  otherNameAlt: { color: C.mutedOnLight, fontSize: 11.5, marginTop: 3 },

  loadingWrap: { alignItems: "center", paddingVertical: 60, gap: 14 },
  loadingText: { color: C.mutedOnLight, fontSize: 14, fontWeight: "600" },
  errorText: { color: C.textOnLight, fontSize: 14, fontWeight: "600" },
  retryBtn: {
    backgroundColor: C.navy,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  retryText: { color: C.gold, fontWeight: "800" },

  tagline: { color: C.textOnLight, fontSize: 16.5, fontWeight: "800", lineHeight: 23, marginBottom: 14 },
  metaRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  metaCard: {
    flex: 1,
    backgroundColor: C.canvasAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderOnLight,
    padding: 12,
    gap: 4,
  },
  metaLabel: { color: C.mutedOnLight, fontSize: 11, fontWeight: "700" },
  metaValue: { color: C.textOnLight, fontSize: 13, fontWeight: "800" },

  spotCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)",
    padding: 14,
    marginBottom: 10,
    alignItems: "center",
  },
  spotIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(155,220,255,0.13)", alignItems: "center", justifyContent: "center" },
  spotName: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  spotDesc: { color: C.cyanLight, fontSize: 12, marginTop: 3, lineHeight: 17 },

  tipCard: {
    backgroundColor: "rgba(212,175,55,0.1)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.45)",
    borderRadius: 14,
    padding: 14,
    marginTop: 6,
  },
  tipLabel: { color: C.goldDark, fontSize: 12.5, fontWeight: "800", marginBottom: 4 },
  tipText: { color: C.textOnLight, fontSize: 13, lineHeight: 19 },

  ctaBtn: {
    marginTop: 18,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: C.blue,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { color: C.blueDark, fontSize: 14, fontWeight: "700", textAlign: "center", flexShrink: 1 },

  customScroll: { flexGrow: 1, padding: 18 },
  customForm: { alignItems: "center", paddingTop: 44 },
  customIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(46,117,200,0.13)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  customPrompt: { color: C.textOnLight, fontSize: 21, fontWeight: "800", textAlign: "center" },
  customSubtitle: {
    color: C.mutedOnLight,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
    marginTop: 8,
  },
  customInput: {
    width: "100%",
    backgroundColor: C.canvasAlt,
    borderWidth: 1,
    borderColor: "rgba(46,117,200,0.4)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: C.textOnLight,
    fontSize: 15,
    marginTop: 22,
  },
  rtlInput: { textAlign: "right", writingDirection: "rtl" },
  customSubmit: {
    width: "100%",
    alignItems: "center",
    backgroundColor: C.navy,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 12,
  },
  customSubmitDisabled: { opacity: 0.4 },
  customSubmitText: { color: C.blueLight, fontSize: 14.5, fontWeight: "800" },
});
