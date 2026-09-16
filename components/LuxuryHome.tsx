import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";

import colors from "@/constants/colors";
import { buildHotelDestinationUrl, buildHotelDealUrl } from "@/lib/hotelPortal";

// Match the active dt-tour.com/hotels portal palette without changing the
// appearance of unrelated mobile screens.
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

export type HomeLang = "en" | "ar";

export interface TourPackage {
  id: string;
  title: string;
  url: string;
  image: string | null;
  priceKwd: number | null;
  nights: number | null;
}

export interface TrendingDestination {
  city: string;
  country: string;
  cityAr: string;
  countryAr: string;
  imageUrl: string;
  query: string;
  code: string;
  hotelName?: string;
  fromPriceKwd?: number;
  stayNights?: number;
}

export interface HotelDeal {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  targetHotel: string;
  scope: string;
  country: string;
  city: string;
  expiryDate: string;
}

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ??
  "https://tours-dar-tamaiz--engalialfoudari.replit.app/api";

const STR = {
  en: {
    brand: "Dar AlTamaiz Tours",
    tagline: "Luxury travel, curated for you",
    flights: "Flights",
    flightsSub: "Best fares worldwide",
    hotels: "Hotels",
    hotelsSub: "Live luxury rates",
    ai: "AI Package Builder",
    aiSub: "Your trip, designed by AI",
    where: "Where to Go?",
    whereSub: "Inspiring destinations",
    offers: "Latest Offers & Trips",
    trending: "Seasonal Picks",
    seasonalPrice: "5 nights · 4★",
    from: "From",
    exploreDeal: "Explore Deal",
    nights: "nights",
    book: "Book",
    login: "Log In",
    guest: "Continue as Guest",
    since: "Your Trusted Travel Partner Since 2008",
  },
  ar: {
    brand: "دار التميز تورز",
    tagline: "سفر فاخر مصمم خصيصاً لك",
    flights: "تذاكر الطيران",
    flightsSub: "أفضل الأسعار عالمياً",
    hotels: "الفنادق",
    hotelsSub: "أسعار فاخرة مباشرة",
    ai: "مصمم الباقات بالذكاء الاصطناعي",
    aiSub: "رحلتك بتصميم الذكاء الاصطناعي",
    where: "أين تذهب؟",
    whereSub: "وجهات ملهمة",
    offers: "أحدث العروض والرحلات",
    trending: "اختيارات الموسم",
    seasonalPrice: "٥ ليالٍ · ٤ نجوم",
    from: "ابتداءً من",
    exploreDeal: "اكتشف العرض",
    nights: "ليالٍ",
    book: "احجز",
    login: "تسجيل دخول",
    since: "شريكك الموثوق في السفر منذ 2008",
  },
};

type IconName = "airplane" | "bed" | "sparkles" | "compass" | "pricetag" | "shield-check" | "headset" | "user";

function VectorIcon({ name, size = 24, color = "#000" }: { name: IconName; size?: number; color?: string }) {
  switch (name) {
    case "airplane":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1 .5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.6L3 8l6 5.5-3 3-3-1-2 1 2 4 4 2 1-2-1-3 3-3 5.5 6 1.2-.7c.4-.2.7-.6.6-1.1Z" />
        </Svg>
      );
    case "bed":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" />
        </Svg>
      );
    case "sparkles":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
          <Path d="M5 3v4M3 5h4" />
        </Svg>
      );
    case "compass":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="10" />
          <Path d="m16.24 7.76-2.124 6.371a2 2 0 0 1-1.275 1.275l-6.371 2.124 2.124-6.371a2 2 0 0 1 1.275-1.275l6.371-2.124Z" />
          <Path d="m14 10-4 4" />
        </Svg>
      );
    case "pricetag":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 .586 1.414l9 9a2 2 0 0 0 2.828 0l8-8a2 2 0 0 0 0-2.828l-9-9A2 2 0 0 0 12 2Z" />
          <Circle cx="7" cy="7" r="1.5" fill={color} stroke="none" />
        </Svg>
      );
    case "shield-check":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <Path d="m9 12 2 2 4-4" />
        </Svg>
      );
    case "headset":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <Path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
          <Path d="M21 12v4a5 5 0 0 1-10 0v-2" />
        </Svg>
      );
    case "user":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="8" r="3.5" />
          <Path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </Svg>
      );
    default:
      return null;
  }
}

interface NavCardProps {
  icon: IconName;
  title: string;
  sub: string;
  onPress: () => void;
  width: number;
  rtl: boolean;
  testID?: string;
}

function NavCard({ icon, title, sub, onPress, width, rtl, testID }: NavCardProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.navCard,
        rtl && styles.navCardRtl,
        { width },
        pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
      ]}
    >
      <View style={styles.navIconWrap}>
        <VectorIcon name={icon} size={22} color={C.navyLight} />
      </View>
      <Text style={[styles.navTitle, rtl && styles.navTitleRtl]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.navSub, rtl && styles.navSubRtl]} numberOfLines={1}>
        {sub}
      </Text>
    </Pressable>
  );
}

function TourCard({ tour, lang, onOpen }: { tour: TourPackage; lang: HomeLang; onOpen: (url: string) => void }) {
  const s = STR[lang];
  const rtl = lang === "ar";
  return (
    <View style={styles.tourCard}>
      {tour.image ? (
        <Image source={{ uri: tour.image }} style={styles.tourImg} resizeMode="cover" />
      ) : (
        <View style={[styles.tourImg, styles.tourImgFallback]}>
          <VectorIcon name="airplane" size={32} color={C.navyLight} />
        </View>
      )}
      <View style={styles.tourBody}>
        <Text style={[styles.tourTitle, rtl && styles.rtlText]} numberOfLines={2}>
          {tour.title}
        </Text>
        <View style={styles.tourMetaRow} testID={`offer-meta-${tour.id}`}>
          {tour.nights !== null ? (
            <Text style={[styles.tourNights, rtl && styles.rtlText]}>
              {tour.nights} {s.nights}
            </Text>
          ) : <View />}
          {tour.priceKwd !== null && (
            <View style={styles.tourPriceChip}>
              <Text style={styles.tourPriceText}>KWD {tour.priceKwd.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={() => onOpen(tour.url)}
          style={({ pressed }) => [styles.tourBookBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="link"
          accessibilityLabel={`${s.book} ${tour.title}`}
          testID={`offer-book-${tour.id}`}
        >
          <Text style={styles.tourBookText}>{s.book}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function LuxuryHome({
  lang,
  onChangeLang,
  onFlights,
  onHotels,
  onAIBuilder,
  onWhereToGo,
  onTravelStore,
  onOpenUrl,
  onOpenHotelPortalUrl,
  onExplore,
  onMembersOffers,
  isOffline,
}: {
  lang: HomeLang;
  onChangeLang: (l: HomeLang) => void;
  onFlights: () => void;
  onHotels: () => void;
  onAIBuilder: () => void;
  onWhereToGo: () => void;
  onTravelStore?: () => void;
  onOpenUrl: (url: string) => void;
  onOpenHotelPortalUrl?: (url: string) => void;
  onExplore: () => void;
  onMembersOffers?: () => void;
  isOffline: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const s = STR[lang];
  const rtl = lang === "ar";
  const [tours, setTours] = useState<TourPackage[]>([]);
  const [destinations, setDestinations] = useState<TrendingDestination[]>([]);
  const [loadingDestinations, setLoadingDestinations] = useState(true);
  const [deals, setDeals] = useState<HotelDeal[]>([]);
  const fade = useRef(new Animated.Value(0)).current;
  const nd = Platform.OS !== "web";

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: nd }).start();
  }, [fade, nd]);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/tours`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && Array.isArray(d?.tours)) setTours(d.tours);
      })
      .catch(() => {});

    fetch(`${API_BASE}/trending-destinations`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && Array.isArray(d?.destinations)) {
          setDestinations(d.destinations);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoadingDestinations(false);
      });

    fetch(`${API_BASE}/hotel-deals?active=true`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && Array.isArray(d?.deals)) {
          setDeals(d.deals);
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  const toggleLang = (l: HomeLang) => {
    onChangeLang(l);
    AsyncStorage.setItem("home_lang", l).catch(() => {});
  };

  // Keep the native safe area intact. On web, reduce only vertical whitespace
  // so the hero is about 15% shorter without shrinking the logo or controls.
  const headerTopPadding = Platform.OS === "web"
    ? Math.round((Math.max(insets.top, 67) + 12) * 0.36)
    : Math.round(((insets.top || 20) + 10) * 0.95);
  const navCardWidth = (width - 32 - 16) / 2;

  return (
    <View style={styles.root}>
      {/* Travel-dashboard hero */}
      <View style={[styles.header, { paddingTop: headerTopPadding }]}>
        <View style={styles.headerRow}>
          <View style={styles.logoFrame}>
            <Image
              source={require("../assets/images/dt-tours-logo-transparent.png")}
              style={styles.logo}
              resizeMode="contain"
              tintColor="#FFFFFF"
            />
          </View>
          <View style={styles.headerActions}>
              <View style={styles.langPill}>
              {(["en", "ar"] as HomeLang[]).map((l) => (
                <Pressable
                  key={l}
                  onPress={() => toggleLang(l)}
                  style={[styles.langBtn, lang === l && styles.langBtnActive]}
                  testID={`lang-${l}`}
                  accessibilityRole="button"
                  accessibilityLabel={l === "en" ? "English" : "Arabic"}
                >
                  <Text style={[styles.langText, lang === l && styles.langTextActive]}>
                    {l === "en" ? "EN" : "عربي"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
        <View style={[styles.heroCopy, rtl && styles.rtlHero]}>
          <Text style={[styles.brand, rtl && styles.rtlText]}>{s.brand}</Text>
          <Text style={[styles.tagline, rtl && styles.rtlText]}>{s.tagline}</Text>
          <View style={[styles.accentHairline, rtl && { alignSelf: "flex-end" }]} />
        </View>
        <View style={[styles.heroStatRow, rtl && styles.rtlHeroStatRow]}>
          <View style={[styles.heroStat, rtl && { flexDirection: "row-reverse" }]}>
            <VectorIcon name="shield-check" size={16} color={C.blueLight} />
            <Text style={[styles.heroStatText, rtl && styles.rtlText]}>{lang === "ar" ? "حجز موثوق" : "Trusted booking"}</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={[styles.heroStat, rtl && { flexDirection: "row-reverse" }]}>
            <VectorIcon name="headset" size={16} color={C.blueLight} />
            <Text style={[styles.heroStatText, rtl && styles.rtlText]}>{lang === "ar" ? "دعم شخصي" : "Personal support"}</Text>
          </View>
        </View>
      </View>

      <Animated.View style={{ flex: 1, opacity: fade }}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.sectionIntro, rtl && { alignItems: "flex-end" }]}>
            <Text style={[styles.sectionEyebrow, rtl && styles.rtlText]}>
              {lang === "ar" ? "ابدأ التخطيط" : "START PLANNING"}
            </Text>
            <Text style={[styles.sectionHeading, rtl && styles.rtlText]}>
              {lang === "ar" ? "رحلتك القادمة تبدأ هنا" : "Your next trip starts here"}
            </Text>
          </View>

          {/* Primary travel actions */}
          <View style={styles.grid}>
            <NavCard icon="airplane" title={s.flights} sub={s.flightsSub} onPress={onFlights} testID="nav-flights" width={navCardWidth} rtl={rtl} />
            <NavCard icon="bed" title={s.hotels} sub={s.hotelsSub} onPress={onHotels} testID="nav-hotels" width={navCardWidth} rtl={rtl} />
            <NavCard icon="sparkles" title={s.ai} sub={s.aiSub} onPress={onAIBuilder} testID="nav-ai" width={navCardWidth} rtl={rtl} />
            <NavCard icon="compass" title={s.where} sub={s.whereSub} onPress={onWhereToGo} testID="nav-where" width={navCardWidth} rtl={rtl} />
            <NavCard icon="pricetag" title={lang === "ar" ? "خدمة تجهيز المسافر" : "Traveler Preparation Service"} sub={lang === "ar" ? "مستلزمات السفر المختارة لك" : "Travel essentials selected for you"} onPress={() => onTravelStore?.()} testID="nav-store" width={navCardWidth} rtl={rtl} />
            <NavCard icon="user" title={lang === "ar" ? "عروض الأعضاء" : "Members Offers"} sub={lang === "ar" ? "امتيازات فندقية حصرية" : "Exclusive hotel privileges"} onPress={() => onMembersOffers?.()} testID="nav-members-offers" width={navCardWidth} rtl={rtl} />
          </View>

          {/* Trending Destinations */}
          {(destinations.length > 0 || loadingDestinations) && (
            <View style={styles.trendingSection}>
              <View style={[styles.sectionTitleRow, rtl && { flexDirection: "row-reverse" }]}>
                <VectorIcon name="compass" size={18} color={C.navyLight} />
                <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{s.trending}</Text>
              </View>
              {loadingDestinations ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingScroll}>
                  {[1, 2, 3].map((i) => (
                    <View key={i} style={[styles.trendingCard, styles.skeletonCard]} />
                  ))}
                </ScrollView>
              ) : (
                <FlatList
                  horizontal
                  data={destinations}
                  keyExtractor={(d) => d.code}
                  renderItem={({ item }) => (
                    <Pressable
                      style={({ pressed }) => [styles.trendingCard, pressed && { opacity: 0.9 }]}
                      onPress={() => {
                        const url = buildHotelDestinationUrl(API_BASE, __DEV__, lang, item.city);
                        onOpenHotelPortalUrl?.(url);
                      }}
                      testID={`trending-${item.code}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${rtl ? item.cityAr : item.city}, ${rtl ? item.countryAr : item.country}`}
                    >
                      <Image source={{ uri: item.imageUrl }} style={styles.trendingImg} resizeMode="cover" />
                      <View style={styles.trendingOverlay}>
                        <Text style={[styles.trendingCity, rtl && styles.rtlText]} numberOfLines={1}>
                          {rtl ? item.cityAr : item.city}
                        </Text>
                        <Text style={[styles.trendingCountry, rtl && styles.rtlText]} numberOfLines={1}>
                          {rtl ? item.countryAr : item.country}
                        </Text>
                        {item.hotelName && item.fromPriceKwd ? (
                          <>
                            <Text style={[styles.trendingHotel, rtl && styles.rtlText]} numberOfLines={1}>
                              {item.hotelName}
                            </Text>
                            <View style={[styles.trendingPriceRow, rtl && { flexDirection: "row-reverse" }]}>
                              <Text style={styles.trendingStay}>{s.seasonalPrice}</Text>
                              <Text style={styles.trendingPrice}>{s.from} {item.fromPriceKwd} KWD</Text>
                            </View>
                          </>
                        ) : null}
                      </View>
                    </Pressable>
                  )}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.trendingScroll}
                  inverted={false}
                />
              )}
            </View>
          )}

          {/* Hotel Deals */}
          {deals.length > 0 && (
            <View style={styles.dealsSection}>
              {deals.map((deal) => (
                <Pressable
                  key={deal.id}
                  style={({ pressed }) => [styles.dealBanner, pressed && { opacity: 0.96, transform: [{ scale: 0.98 }] }]}
                  onPress={() => {
                    const url = buildHotelDealUrl(API_BASE, __DEV__, lang, deal);
                    onOpenHotelPortalUrl?.(url);
                  }}
                  testID={`deal-${deal.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.exploreDeal} ${deal.title}`}
                >
                  <Image source={{ uri: deal.imageUrl }} style={styles.dealImg} resizeMode="cover" />
                  <View style={[styles.dealContent, rtl && { alignItems: "flex-end" }]}>
                    <Text style={[styles.dealTitle, rtl && styles.rtlText]} numberOfLines={2}>
                      {deal.title}
                    </Text>
                    <Text style={[styles.dealSubtitle, rtl && styles.rtlText]} numberOfLines={1}>
                      {deal.subtitle}
                    </Text>
                    <View style={[styles.dealBtn, rtl && { flexDirection: "row-reverse" }]}>
                      <Text style={styles.dealBtnText}>{s.exploreDeal}</Text>
                      <VectorIcon name="pricetag" size={14} color="#FFF" />
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* Tours slider */}
          {tours.length > 0 && (
            <View style={styles.offersSection}>
              <View style={[styles.offersTitleRow, rtl && { flexDirection: "row-reverse" }]}>
                <VectorIcon name="pricetag" size={18} color={C.navyLight} />
                <Text style={[styles.offersTitle, rtl && styles.rtlText]}>{s.offers}</Text>
              </View>
              <FlatList
                horizontal
                data={tours}
                keyExtractor={(t) => t.id}
                renderItem={({ item }) => <TourCard tour={item} lang={lang} onOpen={onOpenUrl} />}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}
                inverted={false}
              />
            </View>
          )}

          {/* Keep the trust statement at the end of the home content. */}
          {lang === "en" && (
            <View style={[styles.authArea, { width: Math.min(width - 40, 420), alignSelf: "center" }]}>
              <Text style={styles.since}>{s.since}</Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.canvasAlt },
  header: {
    backgroundColor: C.navy,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "web" ? 8 : 13,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: C.navy,
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    zIndex: 10,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  // The source has transparent padding around the horizontal mark. This frame
  // trims only the empty canvas while leaving every letter fully visible.
  logoFrame: { width: 196, height: 42, overflow: "hidden", position: "relative" },
  logo: {
    position: "absolute",
    width: 204,
    height: 204,
    left: -7,
    top: -84,
  },
  langPill: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 24,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  langBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  langBtnActive: { backgroundColor: C.blue },
  langText: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "700" },
  langTextActive: { color: C.navy, fontWeight: "800" },
  headerActions: { alignItems: "flex-end", gap: 6 },
  heroCopy: { marginTop: Platform.OS === "web" ? 6 : 10 },
  rtlHero: { alignItems: "flex-end" },
  brand: { color: "#FFFFFF", fontSize: 21.25, fontWeight: "900", letterSpacing: 0.3 },
  tagline: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 3, fontWeight: "500" },
  accentHairline: { height: 3, backgroundColor: C.blueLight, width: 42, borderRadius: 2, marginTop: 9 },
  rtlText: { textAlign: "right", writingDirection: "rtl" },

  heroStatRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: Platform.OS === "web" ? 5 : 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 5 : 7,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  rtlHeroStatRow: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  heroStat: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroStatText: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },
  heroStatDivider: { width: 1, height: 14, backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: 12 },

  scroll: { flex: 1 },
  sectionIntro: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 6 },
  sectionEyebrow: { color: C.navyLight, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  sectionHeading: { color: C.navy, fontSize: 22, fontWeight: "900", marginTop: 6 },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 16,
  },
  navCard: {
    backgroundColor: C.canvas,
    borderRadius: 20,
    padding: 16,
    minHeight: 140,
    shadowColor: C.navy,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
    justifyContent: "center",
  },
  navCardRtl: { alignItems: "flex-end" },
  navIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(46,117,200,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  navTitle: { color: C.navy, fontSize: 16, fontWeight: "800", lineHeight: 22 },
  navSub: { color: C.mutedOnLight, fontSize: 12, marginTop: 4, fontWeight: "500" },
  navTitleRtl: { alignSelf: "stretch", textAlign: "right", writingDirection: "rtl" },
  navSubRtl: { alignSelf: "stretch", textAlign: "right", writingDirection: "rtl" },

  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { color: C.navy, fontSize: 18, fontWeight: "800" },

  trendingSection: { marginTop: 32 },
  trendingScroll: { paddingHorizontal: 16, gap: 12 },
  trendingCard: {
    width: 176,
    height: 184,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: C.canvasAlt,
  },
  skeletonCard: { backgroundColor: "rgba(46,117,200,0.08)" },
  trendingImg: { width: "100%", height: "100%" },
  trendingOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    paddingTop: 24,
    // A linear gradient is typically better but standard View + backgroundColor works as a simple overlay
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  trendingCity: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  trendingCountry: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" },
  trendingHotel: { color: "rgba(255,255,255,0.9)", fontSize: 10, fontWeight: "600", marginTop: 3 },
  trendingPriceRow: { marginTop: 7, gap: 3 },
  trendingStay: { color: "rgba(255,255,255,0.82)", fontSize: 9, fontWeight: "600" },
  trendingPrice: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },

  dealsSection: { marginTop: 32, paddingHorizontal: 16, gap: 16 },
  dealBanner: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: C.navy,
    shadowColor: C.navy,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dealImg: { width: "100%", height: 160, opacity: 0.8 },
  dealContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "rgba(0,53,128,0.7)", // matching navy
  },
  dealTitle: { color: "#FFF", fontSize: 18, fontWeight: "900", marginBottom: 4 },
  dealSubtitle: { color: C.blueLight, fontSize: 13, fontWeight: "600", marginBottom: 12 },
  dealBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  dealBtnText: { color: "#FFF", fontSize: 13, fontWeight: "700" },

  offersSection: { marginTop: 32 },
  offersTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  offersTitle: { color: C.navy, fontSize: 18, fontWeight: "800" },

  tourCard: {
    width: 240,
    backgroundColor: C.canvas,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    overflow: "hidden",
    shadowColor: C.navy,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  tourImg: { width: "100%", height: 130, backgroundColor: C.canvasAlt },
  tourImgFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(46,117,200,0.08)" },
  tourBody: { padding: 16 },
  tourTitle: { color: C.navy, fontSize: 15, fontWeight: "700", lineHeight: 20, minHeight: 40 },
  tourMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  tourNights: { color: C.mutedOnLight, fontSize: 13, fontWeight: "600" },
  tourPriceChip: {
    backgroundColor: C.navy,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tourPriceText: { color: C.blueLight, fontSize: 13, fontWeight: "800" },
  tourBookBtn: {
    width: "100%",
    marginTop: 16,
    backgroundColor: "rgba(46,117,200,0.15)",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  tourBookText: { color: C.navyLight, fontSize: 14, fontWeight: "800" },

  authArea: { marginTop: 24, alignItems: "center", paddingHorizontal: 20 },
  since: { marginTop: 24, color: C.mutedForeground, fontSize: 12 },
});
