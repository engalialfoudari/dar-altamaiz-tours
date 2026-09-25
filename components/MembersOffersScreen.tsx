import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  Platform,
  Share,
} from "react-native";
import type { ImageSourcePropType } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { requestClerkToken } from "@/lib/clerkTokenCoordinator";
import { useAuth } from "@clerk/expo";
import { HotelPortalIcon } from "@/components/HotelPortalIcon";
import colors from "@/constants/colors";
import { buildHotelDealUrl } from "@/lib/hotelPortal";
import { useAccountRequestGuard } from "@/hooks/useAccountRequestGuard";

const C = {
  ...colors.light,
  navy: "#003580",
  blueLight: "#B9D8FA",
  canvasAlt: "#F2F2F2",
};

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || "https://tours-dar-tamaiz--engalialfoudari.replit.app/api").replace(/\/$/, "");

const OFFER_IMAGE_FALLBACKS: Array<[string, ImageSourcePropType]> = [
  ["kuwait", require("../assets/images/bg-06.jpg")],
  ["dubai", require("../assets/images/destinations/dubai.jpg")],
  ["istanbul", require("../assets/images/destinations/istanbul.jpg")],
  ["london", require("../assets/images/destinations/london.jpg")],
  ["paris", require("../assets/images/destinations/paris.jpg")],
  ["rome", require("../assets/images/destinations/rome.jpg")],
  ["bali", require("../assets/images/destinations/bali.jpg")],
  ["maldives", require("../assets/images/destinations/maldives.jpg")],
  ["tokyo", require("../assets/images/destinations/tokyo.jpg")],
  ["sarajevo", require("../assets/images/destinations/sarajevo.jpg")],
  ["almaty", require("../assets/images/destinations/almaty.jpg")],
];
const DEFAULT_OFFER_IMAGE = require("../assets/images/bg-05.jpg");

export interface MemberOffer {
  id: number;
  code: string;
  discountPct: number;
  maxUsesTotal: number | null;
  usesCount: number;
  startsAt: string | null;
  endsAt: string | null;
  destinationCountry: string | null;
  destinationRegion: string | null;
  destinationCity: string | null;
  targetHotelId: string | null;
  targetHotelName: string | null;
  imageUrl: string | null;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  state: "upcoming" | "active" | "expired" | "sold_out" | "depleted" | "revoked";
  available: boolean;
}

function fallbackOfferImage(offer: MemberOffer): ImageSourcePropType {
  const destination = [
    offer.targetHotelName,
    offer.destinationCity,
    offer.destinationRegion,
    offer.destinationCountry,
  ].filter(Boolean).join(" ").toLocaleLowerCase();
  return OFFER_IMAGE_FALLBACKS.find(([keyword]) => destination.includes(keyword))?.[1]
    ?? DEFAULT_OFFER_IMAGE;
}

interface MemberOffersLoad {
  controller: AbortController;
  requestTimeoutId?: ReturnType<typeof setTimeout>;
  authTimeoutId?: ReturnType<typeof setTimeout>;
  cancelAuthWait?: () => void;
}

export function useCountdown(expiryStr: string | null | undefined, lang: "en" | "ar") {
  const [timeLeft, setTimeLeft] = useState("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!expiryStr) {
      setTimeLeft("");
      setIsExpired(false);
      return;
    }

    const target = new Date(expiryStr).getTime();
    if (isNaN(target)) {
      setTimeLeft("");
      setIsExpired(false);
      return;
    }

    const update = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft(lang === "ar" ? "منتهي" : "Expired");
        return;
      }

      setIsExpired(false);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diff / 1000 / 60) % 60);
      const secs = Math.floor((diff / 1000) % 60);

      const dStr = days > 0 ? (lang === "ar" ? `${days}ي ` : `${days}d `) : "";
      const hStr = lang === "ar" ? `${hours}س ` : `${hours}h `;
      const mStr = lang === "ar" ? `${mins}د ` : `${mins}m `;
      const sStr = lang === "ar" ? `${secs}ث` : `${secs}s`;

      setTimeLeft(`${dStr}${hStr}${mStr}${sStr}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiryStr, lang]);

  return { timeLeft, isExpired };
}

function OfferCard({
  offer,
  lang,
  onOpenPortal,
}: {
  offer: MemberOffer;
  lang: "en" | "ar";
  onOpenPortal: (url: string) => void;
}) {
  const rtl = lang === "ar";
  const { timeLeft, isExpired: timeIsExpired } = useCountdown(offer.endsAt, lang);
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);

  const title = rtl ? offer.titleAr : offer.titleEn;
  const description = rtl ? (offer.descriptionAr || "") : (offer.descriptionEn || "");
  
  const locationParts = [offer.targetHotelName, offer.destinationCity, offer.destinationCountry].filter(Boolean);
  const displayScope = locationParts.length > 0 ? locationParts.join(" • ") : (rtl ? "عالمياً" : "Worldwide");

  const remainingUses = offer.maxUsesTotal !== null ? Math.max(0, offer.maxUsesTotal - offer.usesCount) : null;
  const isSoldOut = offer.state === 'sold_out' || offer.state === 'depleted' || (remainingUses !== null && remainingUses <= 0);
  const isExpired = offer.state === 'expired' || timeIsExpired;
  const isUpcoming = offer.state === 'upcoming';
  const isActionable = offer.available;

  const handleCopy = async () => {
    if (!isActionable) return;
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(offer.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
      await Share.share({
        message: offer.code,
        title: rtl ? "كود العرض" : "Offer code",
      });
    } catch {
      // The code remains visible in the button if sharing is dismissed or unavailable.
    }
  };

  const handleUse = () => {
    if (!isActionable) return;
    const url = buildHotelDealUrl(API_BASE, __DEV__, lang, {
      scope: displayScope,
      city: offer.destinationCity || undefined,
      destinationCountry: offer.destinationCountry || undefined,
      destinationRegion: offer.destinationRegion || undefined,
      targetHotel: offer.targetHotelName || undefined,
      targetHotelId: offer.targetHotelId || undefined,
    });
    onOpenPortal(url);
  };
  
  let stateLabel = "";
  if (isUpcoming) stateLabel = rtl ? "قريباً" : "Upcoming";
  else if (isSoldOut) stateLabel = rtl ? "نفدت الكمية" : "Sold Out";
  else if (isExpired) stateLabel = rtl ? "منتهي" : "Expired";
  else if (offer.state === 'revoked') stateLabel = rtl ? "غير متاح" : "Unavailable";
  else stateLabel = timeLeft;
  
  const imageSource: ImageSourcePropType = imageError || !offer.imageUrl
    ? fallbackOfferImage(offer)
    : { uri: offer.imageUrl };

  return (
    <View style={[styles.card, !isActionable && styles.cardDisabled]}>
      <View style={styles.imageContainer}>
        <Image
          source={imageSource}
          style={styles.cardImage}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
        <View style={styles.cardOverlay}>
          <View style={styles.badgeRow}>
            <View style={[styles.percentageBadge, rtl && { flexDirection: "row-reverse" }]}>
              <Text style={styles.percentageText}>{offer.discountPct}%</Text>
              <Text style={styles.percentageOffText}>{rtl ? "خصم" : "OFF"}</Text>
            </View>
          </View>
        </View>
      </View>
      
      <View style={styles.cardBody}>
        <View style={styles.titleRow}>
          <Text style={[styles.titleText, rtl && styles.rtlText]} numberOfLines={2}>
            {title}
          </Text>
        </View>
        {description ? (
          <Text style={[styles.descText, rtl && styles.rtlText]} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
        
        <View style={[styles.metaContainer, rtl && { flexDirection: "row-reverse" }]}>
          <View style={[styles.metaItem, rtl && { flexDirection: "row-reverse" }, { flexShrink: 1 }]}>
            <HotelPortalIcon name="location" size={14} color={C.mutedOnLight} />
            <Text style={[styles.metaText, rtl && styles.rtlText]} numberOfLines={1} ellipsizeMode="tail">
              {displayScope}
            </Text>
          </View>

          {remainingUses !== null && (
            <View style={[styles.metaItem, rtl && { flexDirection: "row-reverse" }]}>
              <HotelPortalIcon name="user" size={14} color={C.mutedOnLight} />
              <Text style={styles.metaText}>
                {rtl 
                  ? (isSoldOut ? "نفدت الكمية" : `باقي ${remainingUses}`)
                  : (isSoldOut ? "Sold Out" : `${remainingUses} left`)}
              </Text>
            </View>
          )}
          {offer.endsAt !== null && (
            <View style={[styles.metaItem, rtl && { flexDirection: "row-reverse" }]} accessibilityLiveRegion="polite">
              <HotelPortalIcon name="time" size={14} color={isExpired ? C.destructive : C.mutedOnLight} />
              <Text style={[styles.metaText, isExpired && { color: C.destructive }]}>
                {stateLabel}
              </Text>
            </View>
          )}
          {offer.endsAt === null && (isUpcoming || offer.state === 'revoked') && (
            <View style={[styles.metaItem, rtl && { flexDirection: "row-reverse" }]}>
              <HotelPortalIcon name="time" size={14} color={C.mutedOnLight} />
              <Text style={styles.metaText}>
                {stateLabel}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        <View style={[styles.actionsRow, rtl && { flexDirection: "row-reverse" }]}>
          <Pressable 
            style={({ pressed }) => [
              styles.copyBtn, 
              pressed && !copied && { opacity: 0.8 },
              copied && styles.copyBtnSuccess,
              !isActionable && styles.btnDisabled
            ]}
            onPress={handleCopy}
            disabled={!isActionable}
            accessibilityRole="button"
            accessibilityLabel={rtl ? `نسخ الكود ${offer.code}` : `Copy code ${offer.code}`}
          >
            <Text
              style={styles.copyCodeText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {copied ? (rtl ? "تم النسخ" : "Copied") : offer.code}
            </Text>
            <HotelPortalIcon name={copied ? "check" : "refresh"} size={14} color="#16803C" />
          </Pressable>

          <Pressable 
            style={({ pressed }) => [
              styles.useBtn, 
              pressed && { opacity: 0.85 },
              !isActionable && styles.btnDisabled
            ]}
            onPress={handleUse}
            disabled={!isActionable}
            accessibilityRole="button"
            accessibilityLabel={rtl ? "استخدام العرض" : "Use Offer"}
          >
            <Text style={[styles.useBtnText, !isActionable && { color: C.mutedOnLight }]}>
              {rtl ? "استخدام" : "Use Offer"}
            </Text>
            <HotelPortalIcon name={rtl ? "arrow-back" : "arrow-forward"} size={14} color={!isActionable ? C.mutedOnLight : "#FFF"} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function MembersOffersScreen({
  lang,
  onClose,
  onOpenHotelPortalUrl,
}: {
  lang: "en" | "ar";
  onClose: () => void;
  onOpenHotelPortalUrl: (url: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const rtl = lang === "ar";
  const { getToken, isSignedIn, isLoaded, sessionId, userId } = useAuth();
  const {
    accountKey,
    getAccountGeneration,
    isCurrentRequest,
  } = useAccountRequestGuard({ isLoaded, isSignedIn, sessionId, userId });
  
  const [offers, setOffers] = useState<MemberOffer[]>([]);
  const [status, setStatus] = useState<"loading" | "signed-out" | "error" | "success">("loading");
  const activeLoadRef = useRef<MemberOffersLoad | null>(null);

  const cancelActiveLoad = useCallback(() => {
    const activeLoad = activeLoadRef.current;
    if (!activeLoad) return;
    activeLoad.controller.abort();
    activeLoad.cancelAuthWait?.();
    if (activeLoad.requestTimeoutId) clearTimeout(activeLoad.requestTimeoutId);
    if (activeLoad.authTimeoutId) clearTimeout(activeLoad.authTimeoutId);
    activeLoadRef.current = null;
  }, []);

  const loadOffers = useCallback(async () => {
    const usesWebSessionCookie = Platform.OS === "web";
    if (!usesWebSessionCookie && !isLoaded) return;

    if (activeLoadRef.current) return;
    
    if (!usesWebSessionCookie && !isSignedIn) {
      setStatus("signed-out");
      return;
    }

    const generation = getAccountGeneration();
    let currentLoad: MemberOffersLoad | null = null;
    try {
      setStatus("loading");
      currentLoad = {
        controller: new AbortController(),
      };
      const activeLoad = currentLoad;
      activeLoadRef.current = activeLoad;
      activeLoad.requestTimeoutId = setTimeout(() => activeLoad.controller.abort(), 15_000);
      const headers: Record<string, string> = {};

      if (Platform.OS !== "web") {
        const token = await Promise.race([
          requestClerkToken({ sessionId, getToken }),
          new Promise<null>((_, reject) => {
            activeLoad.cancelAuthWait = () => reject(new Error("Authentication cancelled"));
            activeLoad.authTimeoutId = setTimeout(() => reject(new Error("Authentication timed out")), 15_000);
          }),
        ]).finally(() => {
          activeLoad.cancelAuthWait = undefined;
          if (activeLoad.authTimeoutId) {
            clearTimeout(activeLoad.authTimeoutId);
            activeLoad.authTimeoutId = undefined;
          }
        });
        if (!isCurrentRequest(generation) || activeLoadRef.current !== activeLoad) return;
        if (!token) {
          if (activeLoad.requestTimeoutId) clearTimeout(activeLoad.requestTimeoutId);
          activeLoadRef.current = null;
          setStatus("signed-out");
          return;
        }
        headers.Authorization = `Bearer ${token}`;
      }

      let res: Response;
      try {
        res = await fetch(`${API_BASE}/member-offers`, {
          headers,
          credentials: Platform.OS === "web" ? "include" : undefined,
          signal: activeLoad.controller.signal,
        });
      } finally {
        if (activeLoad.requestTimeoutId) {
          clearTimeout(activeLoad.requestTimeoutId);
          activeLoad.requestTimeoutId = undefined;
        }
      }
      if (!isCurrentRequest(generation) || activeLoadRef.current !== activeLoad) return;
      
      if (res.status === 401) {
        setStatus("signed-out");
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to fetch");
      }
      
      const data = await res.json();
      if (!isCurrentRequest(generation) || activeLoadRef.current !== activeLoad) return;
      if (Array.isArray(data?.offers)) {
        setOffers(data.offers);
        setStatus("success");
      } else if (Array.isArray(data)) {
        setOffers(data);
        setStatus("success");
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      if (!isCurrentRequest(generation) || !currentLoad || activeLoadRef.current !== currentLoad) return;
      console.warn("Error fetching member offers:", err);
      setStatus("error");
    } finally {
      if (currentLoad && activeLoadRef.current === currentLoad) {
        if (currentLoad.requestTimeoutId) clearTimeout(currentLoad.requestTimeoutId);
        if (currentLoad.authTimeoutId) clearTimeout(currentLoad.authTimeoutId);
        activeLoadRef.current = null;
      }
    }
  }, [
    getAccountGeneration,
    getToken,
    isCurrentRequest,
    isSignedIn,
    isLoaded,
    sessionId,
    userId,
  ]);
  const loadOffersRef = useRef(loadOffers);
  loadOffersRef.current = loadOffers;
  const loadEffectKey = Platform.OS === "web"
    ? `web-session-cookie:${accountKey ?? "clerk-loading"}`
    : accountKey;

  useEffect(() => {
    cancelActiveLoad();
    setOffers([]);
    void loadOffersRef.current();
  }, [cancelActiveLoad, loadEffectKey]);

  useEffect(() => {
    return () => {
      cancelActiveLoad();
    };
  }, [cancelActiveLoad]);

  return (
    <View testID="members-offers-screen" style={[styles.root, { paddingTop: Math.max(insets.top, 20) }]}>
      <View style={[styles.headerRow, rtl && { flexDirection: "row-reverse" }]}>
        <Pressable
          testID="members-offers-back"
          onPress={onClose}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={rtl ? "العودة" : "Back"}
        >
          <HotelPortalIcon name={rtl ? "arrow-forward" : "arrow-back"} size={24} color={C.navy} />
        </Pressable>
        <Text style={styles.headerTitle}>{rtl ? "عروض الأعضاء" : "Members Offers"}</Text>
        <View style={{ width: 48 }} />
      </View>

      {status === "loading" && (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
      )}

      {status === "signed-out" && (
        <View style={styles.centerBox}>
          <View style={[styles.emptyIcon, styles.signedOutIcon]}>
            <HotelPortalIcon name="user" size={28} color="#FFFFFF" />
          </View>
          <Text style={[styles.emptyTitle, rtl && styles.rtlText]}>
            {rtl ? "قم بتسجيل الدخول لرؤية العروض" : "Sign in to see offers"}
          </Text>
          <Text style={[styles.emptyMessage, rtl && styles.rtlText]}>
            {rtl 
              ? "عروض حصرية وامتيازات إضافية بانتظارك" 
              : "Exclusive deals and extra privileges await you."}
          </Text>
        </View>
      )}

      {status === "error" && (
        <View style={styles.centerBox}>
          <View style={[styles.emptyIcon, { backgroundColor: C.destructive }]}>
            <HotelPortalIcon name="close" size={28} color="#FFFFFF" />
          </View>
          <Text style={[styles.emptyTitle, rtl && styles.rtlText]}>
            {rtl ? "حدث خطأ" : "Something went wrong"}
          </Text>
          <Pressable style={styles.retryBtn} onPress={loadOffers}>
            <Text style={styles.retryBtnText}>{rtl ? "إعادة المحاولة" : "Try Again"}</Text>
          </Pressable>
        </View>
      )}

      {status === "success" && (
        <FlatList
          data={offers}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={[styles.centerBox, styles.emptyCenterBox]}>
              <View style={styles.emptyIcon}>
                <HotelPortalIcon name="tag" size={28} color="#FFFFFF" />
              </View>
              <Text style={[styles.emptyTitle, rtl && styles.rtlText]}>
                {rtl ? "لا توجد عروض متاحة" : "No offers available"}
              </Text>
              <Text style={[styles.emptyMessage, rtl && styles.rtlText]}>
                {rtl 
                  ? "تحقق لاحقاً للحصول على المزيد من العروض الحصرية." 
                  : "Check back later for more exclusive deals."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <OfferCard offer={item} lang={lang} onOpenPortal={onOpenHotelPortalUrl} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.canvasAlt },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  iconBtn: { padding: 12 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: C.navy },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    marginTop: -40,
  },
  emptyCenterBox: {
    marginTop: 0,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  signedOutIcon: {
    backgroundColor: C.navy,
  },
  emptyTitle: {
    color: C.navy,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyMessage: {
    color: C.mutedOnLight,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: C.navy,
    borderRadius: 24,
  },
  retryBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 20,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0A192F",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F0F4F8",
    marginBottom: 4,
  },
  cardDisabled: {
    opacity: 0.65,
  },
  imageContainer: {
    width: "100%",
    height: 120,
    backgroundColor: "#F4F6FA",
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardOverlay: {
    position: "absolute",
    top: 12,
    right: 12,
    left: 12,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  percentageBadge: {
    backgroundColor: "rgba(0, 53, 128, 0.95)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  percentageText: { color: "#FFF", fontSize: 15, fontWeight: "900" },
  percentageOffText: { color: "#E3E8F2", fontSize: 10, fontWeight: "800", marginTop: 2 },
  cardBody: {
    padding: 14,
  },
  titleRow: {
    marginBottom: 4,
  },
  titleText: {
    color: C.navy,
    fontSize: 16,
    fontWeight: "800",
  },
  descText: {
    color: C.mutedOnLight,
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  metaContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    color: C.mutedOnLight,
    fontSize: 13,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F4F8",
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  copyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F6FA",
    borderWidth: 1,
    borderColor: "#E3E8F2",
    borderRadius: 10,
    paddingVertical: 8,
    gap: 6,
  },
  copyBtnSuccess: {
    backgroundColor: "#F0FDF4",
    borderColor: "#16803C",
  },
  copyCodeText: {
    color: "#16803C",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  useBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.navy,
    borderRadius: 10,
    paddingVertical: 8,
    gap: 6,
  },
  useBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
  },
  useBtnDisabled: {
    backgroundColor: "#F4F6FA",
    borderColor: "#F4F6FA",
  },
  btnDisabled: {
    backgroundColor: "#F4F6FA",
    borderColor: "#E3E8F2",
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
