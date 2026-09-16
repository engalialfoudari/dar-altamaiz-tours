import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";
import { HotelPortalIcon, type HotelPortalIconName } from "@/components/HotelPortalIcon";

export type PackagesScreenLang = "en" | "ar";

export interface PackagesScreenProps {
  lang: PackagesScreenLang;
  onOpenPackage: (url: string) => void;
  onBack: () => void;
}

interface TourPackage {
  id: string;
  title: string;
  url: string;
  image: string | null;
  priceKwd: number | null;
  nights: number | null;
}

type SortOption = "recommended" | "price" | "nights";

const C = {
  ...colors.light,
  portalNavy: "#003580",
  portalNavyDark: "#00264F",
  portalInk: "#1E293B",
  portalMuted: "#64748B",
  portalBorder: "#D9E0E8",
  portalCanvas: "#F2F2F2",
};
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ??
  "https://tours-dar-tamaiz--engalialfoudari.replit.app/api";

const COPY = {
  en: {
    eyebrow: "CURATED ESCAPES",
    title: "Travel packages",
    subtitle: "Live offers, thoughtfully selected for your next journey.",
    all: "Recommended",
    price: "Lowest price",
    nights: "Shortest stay",
    from: "From",
    perPerson: "per person",
    nightsLabel: "nights",
    nightLabel: "night",
    viewPackage: "View package",
    loading: "Finding the latest journeys...",
    errorTitle: "Unable to load packages",
    errorBody: "Please check your connection and try again.",
    retry: "Try again",
    emptyTitle: "New journeys are on the way",
    emptyBody: "Our latest package collection will appear here soon.",
    imageUnavailable: "Package image unavailable",
  },
  ar: {
    eyebrow: "رحلات مختارة بعناية",
    title: "باقات السفر",
    subtitle: "عروض مباشرة مختارة بعناية لرحلتك القادمة.",
    all: "المقترحة",
    price: "الأقل سعراً",
    nights: "الأقصر إقامة",
    from: "يبدأ من",
    perPerson: "للشخص",
    nightsLabel: "ليالٍ",
    nightLabel: "ليلة",
    viewPackage: "عرض الباقة",
    loading: "نعثر على أحدث الرحلات...",
    errorTitle: "تعذر تحميل الباقات",
    errorBody: "تحقق من اتصالك ثم حاول مرة أخرى.",
    retry: "حاول مجدداً",
    emptyTitle: "رحلات جديدة قريباً",
    emptyBody: "ستظهر هنا أحدث مجموعات الباقات قريباً.",
    imageUnavailable: "صورة الباقة غير متاحة",
  },
} as const;

function normaliseTours(payload: unknown): TourPackage[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { tours?: unknown }).tours)) {
    return [];
  }

  return (payload as { tours: unknown[] }).tours.reduce<TourPackage[]>((result, item) => {
    if (!item || typeof item !== "object") return result;
    const tour = item as Record<string, unknown>;
    if (typeof tour.id !== "string" || typeof tour.title !== "string" || typeof tour.url !== "string") return result;
    result.push({
      id: tour.id,
      title: tour.title,
      url: tour.url,
      image: typeof tour.image === "string" ? tour.image : null,
      priceKwd: typeof tour.priceKwd === "number" && Number.isFinite(tour.priceKwd) ? tour.priceKwd : null,
      nights: typeof tour.nights === "number" && Number.isFinite(tour.nights) ? tour.nights : null,
    });
    return result;
  }, []);
}

function PackageCard({
  item,
  lang,
  onOpenPackage,
}: {
  item: TourPackage;
  lang: PackagesScreenLang;
  onOpenPackage: (url: string) => void;
}) {
  const s = COPY[lang];
  const rtl = lang === "ar";
  const nightsText = item.nights === null || item.nights <= 0
    ? null
    : `${item.nights} ${item.nights === 1 ? s.nightLabel : s.nightsLabel}`;

  return (
    <View style={styles.card}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" accessibilityLabel={item.title} />
      ) : (
        <View style={styles.imageFallback}>
          <HotelPortalIcon name="airplane" size={31} color="#FFFFFF" />
        </View>
      )}
      <View style={[styles.cardBody, rtl && styles.cardBodyRtl]}>
        <Text style={[styles.packageTitle, rtl && styles.rtlText]} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={[styles.detailsRow, rtl && styles.detailsRowRtl]}>
          {nightsText ? (
            <View style={[styles.meta, rtl && styles.metaRtl]}>
              <HotelPortalIcon name="moon" size={15} color={C.portalNavy} />
              <Text style={[styles.metaText, rtl && styles.rtlText]}>{nightsText}</Text>
            </View>
          ) : (
            <View />
          )}
          {item.priceKwd !== null && (
            <View style={[styles.priceBlock, rtl && styles.priceBlockRtl]}>
              <Text style={[styles.pricePrefix, rtl && styles.rtlText]}>{s.from}</Text>
              <Text style={styles.price}>KWD {item.priceKwd.toFixed(1)}</Text>
              <Text style={[styles.perPerson, rtl && styles.rtlText]}>{s.perPerson}</Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={() => onOpenPackage(item.url)}
          accessibilityRole="link"
          accessibilityLabel={`${s.viewPackage}: ${item.title}`}
          testID={`package-open-${item.id}`}
          style={({ pressed }) => [styles.openButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.openButtonText}>{s.viewPackage}</Text>
          <HotelPortalIcon name={rtl ? "arrow-back" : "arrow-forward"} size={17} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

export function PackagesScreen({ lang, onOpenPackage, onBack }: PackagesScreenProps) {
  const insets = useSafeAreaInsets();
  const rtl = lang === "ar";
  const s = COPY[lang];
  const [tours, setTours] = useState<TourPackage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [sort, setSort] = useState<SortOption>("recommended");

  const loadTours = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(false);
    try {
      const response = await fetch(`${API_BASE}/tours`);
      if (!response.ok) throw new Error(`Tours request failed (${response.status})`);
      setTours(normaliseTours(await response.json()));
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadTours();
  }, [loadTours]);

  const sortedTours = useMemo(() => {
    if (sort === "recommended") return tours;
    return [...tours].sort((a, b) => {
      const aValue = sort === "price" ? a.priceKwd : a.nights;
      const bValue = sort === "price" ? b.priceKwd : b.nights;
      return (aValue ?? Number.POSITIVE_INFINITY) - (bValue ?? Number.POSITIVE_INFINITY);
    });
  }, [sort, tours]);

  const webTopInset = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const contentPaddingBottom = insets.bottom + (Platform.OS === "web" ? 34 : 0) + 28;
  const sortOptions: Array<{ value: SortOption; label: string; icon: HotelPortalIconName }> = [
    { value: "recommended", label: s.all, icon: "sparkles" },
    { value: "price", label: s.price, icon: "tag" },
    { value: "nights", label: s.nights, icon: "moon" },
  ];

  return (
    <View style={styles.root}>
      <FlatList
        data={sortedTours}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PackageCard item={item} lang={lang} onOpenPackage={onOpenPackage} />}
        contentContainerStyle={[styles.content, { paddingTop: webTopInset + 18, paddingBottom: contentPaddingBottom }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={sortedTours.length > 0}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadTours(true)} tintColor={C.portalNavy} />}
        ListHeaderComponent={
          <View>
            <View style={[styles.header, rtl && styles.headerRtl]}>
              <Pressable
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel={rtl ? "العودة إلى الصفحة الرئيسية" : "Back to home"}
                testID="packages-back-home"
                style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              >
                <HotelPortalIcon name={rtl ? "arrow-forward" : "arrow-back"} size={19} color={C.portalNavy} />
              </Pressable>
              <View style={[styles.headerCopy, rtl && styles.headerCopyRtl]}>
                <Text style={[styles.eyebrow, rtl && styles.rtlText]}>{s.eyebrow}</Text>
                <Text
                  style={[styles.title, rtl && styles.rtlText]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  {s.title}
                </Text>
                <Text style={[styles.subtitle, rtl && styles.rtlText]}>{s.subtitle}</Text>
              </View>
            </View>
            {!isLoading && !error && tours.length > 0 && (
              <View style={[styles.filterRow, rtl && styles.filterRowRtl]}>
                {sortOptions.map((option) => {
                  const selected = sort === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setSort(option.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={option.label}
                      testID={`packages-sort-${option.value}`}
                      style={({ pressed }) => [styles.filter, selected && styles.filterSelected, pressed && styles.buttonPressed]}
                    >
                      <HotelPortalIcon name={option.icon} size={15} color={selected ? "#FFFFFF" : C.portalMuted} />
                      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.state}>
            {isLoading ? (
              <>
                <ActivityIndicator size="large" color={C.portalNavy} />
                <Text style={[styles.stateTitle, rtl && styles.rtlText]}>{s.loading}</Text>
              </>
            ) : error ? (
              <>
                <View style={styles.stateIcon}>
                  <HotelPortalIcon name="cloud-off" size={30} color={C.destructive} />
                </View>
                <Text style={[styles.stateTitle, rtl && styles.rtlText]}>{s.errorTitle}</Text>
                <Text style={[styles.stateBody, rtl && styles.rtlText]}>{s.errorBody}</Text>
                <Pressable onPress={() => void loadTours()} style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]} testID="packages-retry">
                  <HotelPortalIcon name="refresh" size={18} color="#FFFFFF" />
                  <Text style={styles.retryText}>{s.retry}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.stateIcon}>
                  <HotelPortalIcon name="map" size={31} color={C.portalNavy} />
                </View>
                <Text style={[styles.stateTitle, rtl && styles.rtlText]}>{s.emptyTitle}</Text>
                <Text style={[styles.stateBody, rtl && styles.rtlText]}>{s.emptyBody}</Text>
              </>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.portalCanvas },
  content: { paddingHorizontal: 16, flexGrow: 1 },
  header: { flexDirection: "row", gap: 13, alignItems: "flex-start", marginBottom: 22 },
  headerRtl: { flexDirection: "row-reverse" },
  backButton: { width: 45, height: 45, borderRadius: 23, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: C.portalBorder, alignItems: "center", justifyContent: "center", marginTop: 2 },
  headerCopy: { flex: 1, minWidth: 0 },
  headerCopyRtl: { alignItems: "flex-end" },
  eyebrow: { color: C.portalNavy, fontSize: 11, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase" },
  title: { color: C.portalInk, fontSize: 27, fontWeight: "800", marginTop: 3, letterSpacing: -0.5 },
  subtitle: { color: C.portalMuted, fontSize: 14, lineHeight: 20, marginTop: 4, maxWidth: 310 },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  filterRowRtl: { flexDirection: "row-reverse" },
  filter: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 8, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: C.portalBorder },
  filterSelected: { backgroundColor: C.portalNavy, borderColor: C.portalNavy },
  filterText: { color: C.portalMuted, fontSize: 12, fontWeight: "700" },
  filterTextSelected: { color: "#FFFFFF" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: C.portalBorder, overflow: "hidden", marginBottom: 16, shadowColor: C.portalNavyDark, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  image: { width: "100%", height: 178, backgroundColor: C.portalNavy },
  imageFallback: { height: 178, backgroundColor: C.portalNavy, alignItems: "center", justifyContent: "center" },
  cardBody: { padding: 16 },
  cardBodyRtl: { alignItems: "flex-end" },
  packageTitle: { color: C.portalInk, fontSize: 18, lineHeight: 24, fontWeight: "800", minHeight: 48 },
  detailsRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", width: "100%", marginTop: 14 },
  detailsRowRtl: { flexDirection: "row-reverse" },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, paddingBottom: 3 },
  metaRtl: { flexDirection: "row-reverse" },
  metaText: { color: C.portalMuted, fontSize: 13, fontWeight: "700" },
  priceBlock: { alignItems: "flex-end" },
  priceBlockRtl: { alignItems: "flex-start" },
  pricePrefix: { color: C.portalMuted, fontSize: 11, fontWeight: "600" },
  price: { color: C.portalNavy, fontSize: 21, fontWeight: "800", marginTop: 1 },
  perPerson: { color: C.portalMuted, fontSize: 10, marginTop: 1 },
  openButton: { marginTop: 17, minHeight: 46, backgroundColor: C.portalNavy, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16 },
  openButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  buttonPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  state: { flex: 1, minHeight: 280, alignItems: "center", justifyContent: "center", paddingHorizontal: 30, paddingBottom: 32 },
  stateIcon: { width: 66, height: 66, borderRadius: 33, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.portalBorder, marginBottom: 15 },
  stateTitle: { color: C.portalInk, fontSize: 18, fontWeight: "800", textAlign: "center", marginTop: 16 },
  stateBody: { color: C.portalMuted, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 7 },
  retryButton: { marginTop: 20, backgroundColor: C.portalNavy, borderRadius: 8, minHeight: 44, paddingHorizontal: 17, flexDirection: "row", alignItems: "center", gap: 7 },
  retryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});