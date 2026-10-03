import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EsimIcon, type EsimIconName } from "./EsimIcon";
import { getEsimRegionImage } from "./EsimRegionImages";
import { EsimCoverageSheet } from "./EsimCoverageSheet";
import { EsimFaq } from "./EsimFaq";
import EsimVerificationProgress from "./EsimVerificationProgress";
import EsimPaymentSuccess from "./EsimPaymentSuccess";
import {
  getGetEsimCatalogQueryKey,
  getGetEsimCatalogDestinationQueryKey,
  useGetEsimCatalog,
  useGetEsimCatalogDestination,
  type EsimCatalogDestination,
  type EsimDestination,
  type EsimPackage,
} from "@workspace/api-client-react";
import { bundledEsimCatalog, getBundledEsimDestination } from "@workspace/api-client-react/esim-static";
import { esimDestinationTitle } from "./esimDisplayPolicy";

type Language = "en" | "ar";
type Category = "popular" | "local" | "regional" | "global";
type DataFilter = "all" | "unlimited" | "fixed";

/** Parent passes authenticated, fulfilled supplier orders here; never infer ownership from catalog data. */
export type EsimOwnedOrder = {
  paymentConfirmedAt?: string | null;
  id: string;
  destinationTitle: string;
  packageTitle: string;
  status: string;
  purchasedAt?: string | null;
  activationInstructions?: string | null;
};

type Props = {
  lang: Language;
  onClose: () => void;
  selectedSlug: string | null;
  initialSelectedPackageId?: string | null;
  initialShowOrders?: boolean;
  paymentReturnSeq?: number;
  paymentReturnRecovery?: boolean;
  paymentStatusOrderId?: string | null;
  paymentStatusMessage?: string | null;
  verificationActive?: boolean;
  verificationNextCheckAt?: number | null;
  paymentReturnNotice?: string | null;
  paymentSuccess?: { noticeKey: string; confirmedAt: string; completed: boolean; review: boolean } | null;
  onSelectDestination: (slug: string | null) => void;
  /** Opens the customer-details step; guest checkout is supported. */
  onBuy?: (item: EsimPackage, destination: EsimDestination) => void;
  onCheckoutInputChange?: () => void;
  ownedOrders?: EsimOwnedOrder[];
  ownedOrdersStatus?: "loading" | "error" | "ready" | "unavailable";
  onRetryOwnedOrders?: () => void;
  selectedOwnedOrderId?: string | null;
  onSelectOwnedOrder?: (id: string | null) => void;
  ownedOrderDetail?: EsimOwnedOrder | null;
  ownedDetailStatus?: "loading" | "error" | "ready";
  onRetryOwnedDetail?: () => void;
  onDownloadOwnedOrder?: (id: string) => void;
  downloadPending?: boolean;
  downloadError?: string | null;
  checkoutPending?: boolean;
  checkoutError?: string | null;
  checkoutNotice?: string | null;
  signedIn?: boolean;
  onRecoverGuest?: () => void;
};

const C = {
  navy: "#003580", navyMid: "#003580", raised: "#FFFFFF",
  gold: "#006CE4", goldLight: "#003580", goldWash: "#EAF3FF",
  canvas: "#F3F5F7", surface: "#FFFFFF", ink: "#202A36",
  muted: "#687583", border: "#D8DFE7",
};

const POPULAR_CODES = ["SA", "AE", "TR", "GB", "EG", "US", "FR", "IT", "DE", "QA", "BH", "OM"];
const copy = {
  en: {
    title: "Travel eSIM", eyebrow: "STAY CONNECTED", intro: "Connection for wherever you go.",
    search: "Where do you need an eSIM?", clear: "Clear search",
    tabs: { popular: "Popular", local: "Local", regional: "Regional", global: "Global" },
    tabHelp: { popular: "A selection of destinations to get you started.", local: "Browse country eSIMs.", regional: "Coverage across a region.", global: "Browse worldwide eSIMs." },
    destinations: "Destinations", from: "From", packages: "Choose your package",
    plans: (n: number) => `${n} ${n === 1 ? "package" : "packages"}`,
    days: (n: number) => `${n} ${n === 1 ? "day" : "days"}`,
    data: "Data", unlimited: "Unlimited", fixed: "Fixed data", all: "All",
    coverage: "Coverage", network: "Networks", compatibility: "Device compatibility",
    compatibilityText: "Check that your device supports eSIM and is carrier-unlocked before buying. Check your device settings or ask your carrier; compatibility cannot be confirmed here.",
    networkMissing: "Network details not provided for this package.",
    coverageMissing: "Coverage details not provided for this package.",
    selectToView: "Select a package to see its coverage and network details.",
    buy: "Buy now", select: "Select a package", unavailable: "Price unavailable",
    availabilityChecking: "Checking the latest plan details…",
    availabilityUnconfirmed: "Catalog listings aren't a booking guarantee. We'll confirm your eSIM after you order.",
    availabilityUnavailable: "We couldn't refresh this plan. Try again when the current plan details are available.",
    outOfStock: "This eSIM is currently out of stock.",
    promo: "Promo code (optional)", checkoutWorking: "Preparing secure checkout…",
    paymentMethod: "Payment method", feeFree: "No payment fee", feeApplies: "No payment fee",
    checkoutPending: "Checkout is not available yet", checkoutHint: "Purchasing will be available when secure checkout is connected.",
    myEsims: "My eSIMs", store: "Browse", ordersUnavailable: "Your eSIM orders aren't available here yet.",
    ordersHint: "Sign in from Profile to view purchased eSIMs and activation instructions.",
    ordersEmpty: "No purchased eSIMs to show", ordersEmptyHint: "Your completed eSIM orders will appear here.",
    orderStatus: "Status", activation: "Activation instructions", retry: "Try again", back: "Back",
    errorTitle: "Coverage is unavailable", errorText: "We couldn't load the eSIM catalog. Check your connection and try again.",
    detailError: "We couldn't load packages for this destination.",
    emptyTitle: "No destinations yet", emptyText: "Coverage will appear here when it becomes available.",
    noResults: "No matching destinations", noResultsText: "Try another destination or country code.",
    noPackages: "No packages available", noPackagesText: "There are currently no packages listed for this destination.",
    noFilter: "No packages in this category", noFilterText: "Try another data type to see available packages.",
  },
  ar: {
    title: "شرائح eSIM للسفر", eyebrow: "ابقَ على اتصال", intro: "اتصال يرافقك أينما سافرت.",
    search: "أين تحتاج إلى شريحة eSIM؟", clear: "مسح البحث",
    tabs: { popular: "الأكثر شيوعاً", local: "محلية", regional: "إقليمية", global: "عالمية" },
    tabHelp: { popular: "مجموعة من الوجهات لتبدأ البحث.", local: "تصفح شرائح الدول.", regional: "تغطية عبر منطقة كاملة.", global: "تصفح الشرائح العالمية." },
    destinations: "الوجهات", from: "ابتداءً من", packages: "اختر باقتك",
    plans: (n: number) => `${n} باقات`,
    days: (n: number) => `${n} ${n === 1 ? "يوم" : "أيام"}`,
    data: "البيانات", unlimited: "غير محدودة", fixed: "بيانات محددة", all: "الكل",
    coverage: "التغطية", network: "الشبكات", compatibility: "توافق الجهاز",
    compatibilityText: "تحقق من دعم جهازك لشريحة eSIM وأنه غير مقفل على شبكة معينة قبل الشراء. راجع إعدادات الجهاز أو شركة الاتصالات؛ لا يمكن تأكيد التوافق هنا.",
    networkMissing: "لم تُقدَّم تفاصيل الشبكة لهذه الباقة.",
    coverageMissing: "لم تُقدَّم تفاصيل التغطية لهذه الباقة.",
    selectToView: "اختر باقة لعرض التغطية والشبكات.",
    buy: "اشترِ الآن", select: "اختر باقة", unavailable: "السعر غير متاح",
    availabilityChecking: "جارٍ التحقق من أحدث تفاصيل الباقة…",
    availabilityUnconfirmed: "عرض الباقة لا يضمن الحجز. سنؤكد توفر الشريحة بعد إرسال طلبك.",
    availabilityUnavailable: "تعذر تحديث هذه الباقة. حاول مجدداً عند توفر أحدث التفاصيل.",
    outOfStock: "هذه الشريحة غير متوفرة حالياً.",
    promo: "رمز الخصم (اختياري)", checkoutWorking: "جارٍ تجهيز الدفع الآمن…",
    paymentMethod: "طريقة الدفع", feeFree: "بدون رسوم دفع", feeApplies: "بدون رسوم دفع",
    checkoutPending: "الدفع غير متاح حالياً", checkoutHint: "سيتوفر الشراء عند ربط الدفع الآمن.",
    myEsims: "شرائحي", store: "تصفح", ordersUnavailable: "طلبات شرائحك غير متاحة هنا بعد.",
    ordersHint: "سجل الدخول من الملف الشخصي لعرض شرائحك المشتراة وتعليمات التفعيل.",
    ordersEmpty: "لا توجد شرائح مشتراة لعرضها", ordersEmptyHint: "ستظهر طلبات شرائح eSIM المكتملة هنا.",
    orderStatus: "الحالة", activation: "تعليمات التفعيل", retry: "إعادة المحاولة", back: "رجوع",
    errorTitle: "التغطية غير متاحة", errorText: "تعذر تحميل دليل شرائح eSIM. تحقق من اتصالك وحاول مجدداً.",
    detailError: "تعذر تحميل باقات هذه الوجهة.",
    emptyTitle: "لا توجد وجهات حالياً", emptyText: "ستظهر التغطية هنا عند توفرها.",
    noResults: "لا توجد وجهات مطابقة", noResultsText: "جرّب البحث باسم وجهة أخرى أو رمز البلد.",
    noPackages: "لا توجد باقات متاحة", noPackagesText: "لا توجد باقات مدرجة لهذه الوجهة حالياً.",
    noFilter: "لا توجد باقات بهذا النوع", noFilterText: "جرّب نوع بيانات آخر لعرض الباقات المتاحة.",
  },
};

function price(value: number | null) {
  return value === null || !Number.isFinite(value) ? null : `${value.toFixed(3)} KWD`;
}

function DestinationVisual({ item }: { item: EsimCatalogDestination }) {
  const [failed, setFailed] = useState(false);
  const local = item.category === "local" && /^[A-Z]{2}$/i.test(item.countryCode);
  const regionImage = item.category !== "local" ? getEsimRegionImage(item.slug) : undefined;
  return <View pointerEvents="none" style={[styles.destinationImage, local && !failed ? styles.flagFrame : styles.imageFallback]}>
    {local && !failed
      ? <Image source={{ uri: `https://flagcdn.com/w320/${item.countryCode.toLowerCase()}.png` }} onError={() => setFailed(true)} resizeMode="stretch" style={styles.flagImage} accessibilityLabel={`${item.title} flag`} />
      : regionImage
        ? <Image testID={`esim-region-icon-${item.slug}`} source={regionImage} resizeMode="contain" style={styles.regionImage} accessibilityLabel={`${item.title} map`} />
        : <EsimIcon name={item.category === "global" ? "globe" : "compass"} size={28} color={C.gold} />}
  </View>;
}

function Message({ icon, title, description, action, onAction, rtl }: {
  icon: EsimIconName;
  title: string; description: string; action?: string; onAction?: () => void; rtl: boolean;
}) {
  return <View style={styles.message}>
    <View style={styles.messageIcon}><EsimIcon name={icon} size={26} color={C.gold} /></View>
    <Text style={[styles.messageTitle, rtl && styles.rtl]}>{title}</Text>
    <Text style={[styles.messageBody, rtl && styles.rtl]}>{description}</Text>
    {action && onAction && <Pressable testID="esim-retry" accessibilityRole="button" accessibilityLabel={action} onPress={onAction} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}><Text style={styles.retryText}>{action}</Text></Pressable>}
  </View>;
}

function LoadingCards() {
  return <View style={styles.loading} accessibilityLabel="Loading" pointerEvents="none">
    {[0, 1, 2, 3].map((index) => <View key={index} style={styles.skeletonCard}><View style={styles.skeletonImage} /><View style={styles.skeletonLines}><View style={styles.skeletonLine} /><View style={[styles.skeletonLine, { width: "48%" }]} /></View></View>)}
  </View>;
}

function Chip({ label, active, onPress, id }: { label: string; active: boolean; onPress: () => void; id: string }) {
  return <Pressable testID={id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>;
}

type PackageRow = { type: "heading"; days: number; key: string } | { type: "package"; item: EsimPackage; key: string };

export function EsimCatalogScreen({
  lang, onClose, selectedSlug, initialSelectedPackageId, initialShowOrders = false, paymentReturnSeq, paymentReturnRecovery = false,
  onSelectDestination, onBuy, signedIn = false, onRecoverGuest,
  ownedOrders, ownedOrdersStatus = "unavailable", onRetryOwnedOrders,
  selectedOwnedOrderId, onSelectOwnedOrder, ownedOrderDetail, ownedDetailStatus, onRetryOwnedDetail,
  onDownloadOwnedOrder, downloadPending, downloadError,
  checkoutPending = false, checkoutError, checkoutNotice, paymentStatusOrderId, paymentStatusMessage,
  verificationActive = false, verificationNextCheckAt = null,
  paymentReturnNotice,
  paymentSuccess,
}: Props) {
  const insets = useSafeAreaInsets();
  const rtl = lang === "ar";
  const t = copy[lang];
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("popular");
  const [filter, setFilter] = useState<DataFilter>("all");
  const [selection, setSelection] = useState<{ slug: string; id: string } | null>(() =>
    selectedSlug && initialSelectedPackageId ? { slug: selectedSlug, id: initialSelectedPackageId } : null
  );
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [showOrders, setShowOrders] = useState(initialShowOrders);
  const [dismissedSuccessKey, setDismissedSuccessKey] = useState<string | null>(null);
  const successDeadline = useRef<{ key: string; expiresAt: number } | null>(null);
  const successKey = paymentSuccess?.noticeKey ?? null;
  const showPaymentSuccess = !!successKey && successKey !== dismissedSuccessKey;
  useEffect(() => {
    if (!showPaymentSuccess || !successKey) return;
    if (successDeadline.current?.key !== successKey) {
      successDeadline.current = { key: successKey, expiresAt: Date.now() + 8_000 };
    }
    const timer = setTimeout(
      () => setDismissedSuccessKey(successKey),
      Math.max(0, successDeadline.current.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [successKey, showPaymentSuccess]);
  useEffect(() => {
    if (paymentReturnSeq) setShowOrders(true);
  }, [paymentReturnSeq]);
  const catalog = useGetEsimCatalog({
    query: {
      queryKey: getGetEsimCatalogQueryKey(),
      initialData: bundledEsimCatalog,
      initialDataUpdatedAt: 0,
    },
  });
  const detail = useGetEsimCatalogDestination(selectedSlug ?? "", {
    query: {
      enabled: Boolean(selectedSlug),
      queryKey: getGetEsimCatalogDestinationQueryKey(selectedSlug ?? ""),
      initialData: selectedSlug ? getBundledEsimDestination(selectedSlug) : undefined,
      initialDataUpdatedAt: 0,
      staleTime: 30_000,
      refetchOnMount: "always",
      refetchOnWindowFocus: "always",
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
    },
  });
  const destination = detail.data?.destination;
  const selected = selection?.slug === selectedSlug
    ? destination?.packages.find((item) => item.id === selection.id)
    : undefined;
  const term = search.trim().toLocaleLowerCase();
  const destinations = useMemo(() => {
    const all = catalog.data?.destinations ?? [];
    if (term) return all.filter((item) => [item.title, esimDestinationTitle(item.title, lang, item.countryCode), item.countryCode, item.slug].some((field) => field.toLocaleLowerCase().includes(term)));
    if (category === "popular") {
      // Curated shortcuts, not a claimed supplier popularity metric. Fall back to catalog order if none match.
      const curated = POPULAR_CODES.flatMap((code) => all.filter((item) => item.category === "local" && item.countryCode.toUpperCase() === code));
      return curated.length ? curated : all.slice(0, 12);
    }
    return all.filter((item) => item.category === category);
  }, [catalog.data?.destinations, term, category, lang]);
  const rows = useMemo<PackageRow[]>(() => {
    const items = (destination?.packages ?? []).filter((item) => filter === "all" || (filter === "unlimited" ? item.isUnlimited : !item.isUnlimited));
    const sorted = [...items].sort((a, b) => a.validityDays - b.validityDays || (a.priceKwd ?? Infinity) - (b.priceKwd ?? Infinity));
    const result: PackageRow[] = [];
    let previous = -1;
    for (const item of sorted) {
      if (item.validityDays !== previous) {
        previous = item.validityDays;
        result.push({ type: "heading", days: previous, key: `days-${previous}` });
      }
      result.push({ type: "package", item, key: `package-${item.id}` });
    }
    return result;
  }, [destination?.packages, filter]);
  const liveAvailabilityConfirmed = detail.isSuccess
    && detail.isFetchedAfterMount
    && !detail.isFetching
    && !detail.isStale;
  const buyEnabled = !!selected
    && liveAvailabilityConfirmed
    && selected.isInStock !== false
    && price(selected.priceKwd) !== null
    && !!onBuy
    && !checkoutPending;
  const availabilityHint = selected
    ? liveAvailabilityConfirmed
      ? selected.isInStock === false ? t.outOfStock : t.availabilityUnconfirmed
      : detail.isError || detail.isRefetchError ? t.availabilityUnavailable : t.availabilityChecking
    : null;

  const goBack = () => {
    setDismissedSuccessKey(successKey);
    if (showOrders && selectedOwnedOrderId) onSelectOwnedOrder?.(null);
    else if (showOrders) setShowOrders(false);
    else if (selectedSlug) onSelectDestination(null);
    else onClose();
  };
  const chooseDestination = useCallback((slug: string) => {
    setDismissedSuccessKey(successKey);
    setFilter("all");
    setSelection(null);
    setCoverageOpen(false);
    onSelectDestination(slug);
  }, [onSelectDestination, successKey]);
  const renderDestination = useCallback(({ item }: { item: EsimCatalogDestination }) => (
    <Pressable
      testID={`esim-destination-${item.slug}`} accessibilityRole="button"
      accessibilityLabel={`${esimDestinationTitle(item.title, lang, item.countryCode)}, ${t.plans(item.packageCount)}${price(item.minPriceKwd) ? `, ${t.from} ${price(item.minPriceKwd)}` : ""}`}
      onPress={() => chooseDestination(item.slug)}
      style={({ pressed }) => [styles.destinationCard, rtl && styles.reverse, pressed && styles.pressed]}
    >
      <DestinationVisual item={item} />
      <View style={[styles.destinationInfo, rtl && styles.alignEnd]}>
        <Text style={[styles.destinationTitle, rtl && styles.rtl]} numberOfLines={1}>{esimDestinationTitle(item.title, lang, item.countryCode)}</Text>
        <Text style={[styles.destinationMeta, rtl && styles.rtl]}>{t.plans(item.packageCount)}</Text>
      </View>
      {price(item.minPriceKwd) && <View style={rtl && styles.alignEnd}><Text style={styles.fromLabel}>{t.from}</Text><Text style={styles.destinationPrice}>{price(item.minPriceKwd)}</Text></View>}
      <EsimIcon name={rtl ? "chevron-back" : "chevron-forward"} size={17} color={C.gold} />
    </Pressable>
  ), [chooseDestination, rtl, t]);
  const renderPackage = useCallback(({ item: row }: { item: PackageRow }) => {
    if (row.type === "heading") return <Text style={[styles.groupTitle, rtl && styles.rtl]}>{t.days(row.days)}</Text>;
    const item = row.item;
    const active = selection?.slug === selectedSlug && selection.id === item.id;
    return <Pressable
      testID={`esim-package-${item.id}`} accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.isUnlimited ? t.unlimited : item.data}, ${t.days(item.validityDays)}, ${price(item.priceKwd) ?? t.unavailable}${item.isUnlimited || item.hasFairUsagePolicy ? `, ${lang === "ar" ? "قد تُطبّق سياسة الاستخدام العادل أو تخفيض السرعة" : "Fair-use or speed limits may apply"}${item.fairUsagePolicy ? `: ${item.fairUsagePolicy}` : ""}` : ""}`}
      accessibilityState={{ selected: active }}
      onPress={() => setSelection({ slug: selectedSlug ?? "", id: item.id })}
      style={({ pressed }) => [styles.packageCard, active && styles.packageCardSelected, pressed && styles.pressed]}
    >
      <View style={[styles.packageTop, rtl && styles.reverse]}>
        <View style={[styles.packageIcon, rtl && styles.iconRtl]}><EsimIcon name="cellular" size={21} color={C.gold} /></View>
        <View style={[styles.packageHead, rtl && styles.alignEnd]}>
          <Text style={[styles.packageTitle, rtl && styles.rtl]} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.packageMeta}>{item.isUnlimited ? t.unlimited : (item.data || t.fixed)} · {t.days(item.validityDays)}</Text>
          {(item.isUnlimited || item.hasFairUsagePolicy) && <Text style={[styles.packageMeta, rtl && styles.rtl]}>
            {lang === "ar" ? "قد تُطبّق سياسة الاستخدام العادل أو تخفيض السرعة." : "Fair-use or speed limits may apply."}
            {item.fairUsagePolicy ? ` ${item.fairUsagePolicy}` : ""}
          </Text>}
        </View>
        <View style={rtl && styles.alignEnd}>
          <Text style={styles.packagePrice}>{price(item.priceKwd) ?? t.unavailable}</Text>
          {active && <EsimIcon name="check" size={19} color={C.gold} />}
        </View>
      </View>
    </Pressable>;
  }, [rtl, t, selection, selectedSlug, lang]);

  // A normal browser already positions the viewport below its own chrome.
  // Only an installed, edge-to-edge web app needs an extra status-bar reserve.
  const standaloneWeb = Platform.OS === "web" && typeof window !== "undefined"
    && (window.matchMedia?.("(display-mode: standalone)").matches === true
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
  const topInset = Platform.OS === "web"
    ? standaloneWeb ? Math.max(insets.top, 59) : 0
    : insets.top;

  return <View style={[styles.root, { paddingTop: topInset }]}>
    {(showOrders || selectedSlug) && <View style={[styles.header, rtl && styles.reverse]}>
      <Pressable onPress={goBack} hitSlop={8} testID="esim-back" accessibilityRole="button" accessibilityLabel={t.back} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <EsimIcon name={rtl ? "arrow-forward" : "arrow-back"} size={23} color={C.gold} />
      </Pressable>
      <Text style={[styles.headerTitle, rtl && styles.rtl]} numberOfLines={1}>{showOrders ? t.myEsims : selectedSlug ? esimDestinationTitle(destination?.title ?? t.title, lang, destination?.countryCode) : t.title}</Text>
      <View style={styles.headerSpacer} />
    </View>}

    {verificationActive && <EsimVerificationProgress lang={lang} nextCheckAt={verificationNextCheckAt} />}
    {showPaymentSuccess && paymentSuccess && <EsimPaymentSuccess lang={lang} signedIn={signedIn} {...paymentSuccess} />}
    {!!paymentReturnNotice && <Text testID="esim-payment-return-notice" accessibilityRole="text" style={[styles.infoBody, { marginHorizontal: 16, marginVertical: 8 }, rtl && styles.rtl]}>{paymentReturnNotice}</Text>}
    {showOrders ? (
      selectedOwnedOrderId ? (
        ownedDetailStatus === "loading" ? <View><LoadingCards />{paymentStatusOrderId === selectedOwnedOrderId && !!paymentStatusMessage
          && <Text testID="esim-payment-status-message" style={[styles.infoBody, rtl && styles.rtl]}>{paymentStatusMessage}</Text>}</View> :
        ownedDetailStatus === "error" ? <Message icon="cloud-off" title={t.errorTitle} description={paymentStatusOrderId === selectedOwnedOrderId && paymentStatusMessage
          ? `${t.ordersUnavailable} ${paymentStatusMessage}` : t.ordersUnavailable} action={t.retry} onAction={onRetryOwnedDetail} rtl={rtl} /> :
        ownedOrderDetail ? <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 26 }}><View style={styles.orderDetail}>
          <Text style={[styles.detailTitle, rtl && styles.rtl]}>{esimDestinationTitle(ownedOrderDetail.destinationTitle, lang)}</Text>
          <Text style={[styles.operator, rtl && styles.rtl]}>{ownedOrderDetail.packageTitle}</Text>
          <Text style={[styles.infoBody, rtl && styles.rtl]}>{t.orderStatus}: {ownedOrderDetail.status === "pending_review" ? (lang === "ar" ? "قيد المراجعة" : "Needs review") : ownedOrderDetail.status}</Text>
          {paymentStatusOrderId === ownedOrderDetail.id && ownedOrderDetail.status !== "completed" && paymentStatusMessage
            && <Text testID="esim-payment-status-message" style={[styles.infoBody, rtl && styles.rtl]}>{paymentStatusMessage}</Text>}
          {ownedOrderDetail.status === "pending_review" && <Text style={[styles.infoBody, rtl && styles.rtl]}>{lang === "ar" ? "نراجع هذا الطلب. لا تدفع مرة أخرى. تواصل مع الدعم إذا كنت تحتاج إلى بديل أو استرداد." : "We're reviewing this order. Do not pay again. Contact support if you need an alternative or refund."}</Text>}
           {!!ownedOrderDetail.activationInstructions && <View style={styles.activationBox}>
            <Text style={[styles.infoTitle, rtl && styles.rtl]}>{t.activation}</Text>
            <Text style={[styles.infoBody, rtl && styles.rtl]} selectable>{ownedOrderDetail.activationInstructions}</Text>
          </View>}
            {ownedOrderDetail.status === "completed" && <Pressable testID="esim-download" accessibilityRole="button" accessibilityLabel={lang === "ar" ? "تنزيل شريحة eSIM" : "Download eSIM"} disabled={!onDownloadOwnedOrder || downloadPending} onPress={() => onDownloadOwnedOrder?.(ownedOrderDetail.id)} style={[styles.downloadButton, (!onDownloadOwnedOrder || downloadPending) && styles.buyDisabled]}><EsimIcon name="download" size={19} color="#FFFFFF" /><Text style={styles.downloadText}>{downloadPending ? (lang === "ar" ? "جارٍ التحميل…" : "Preparing download…") : (lang === "ar" ? "تنزيل شريحة eSIM" : "Download eSIM")}</Text></Pressable>}
           {!!downloadError && <Text accessibilityRole="alert" style={styles.checkoutError}>{downloadError}</Text>}
          </View></ScrollView> : <Message icon="receipt" title={t.ordersUnavailable} description={t.ordersHint} rtl={rtl} />
      ) :
      ownedOrdersStatus === "loading" ? <LoadingCards /> :
       ownedOrdersStatus === "error" ? <Message icon="cloud-off" title={t.errorTitle} description={t.ordersUnavailable} action={onRetryOwnedOrders ? t.retry : undefined} onAction={onRetryOwnedOrders} rtl={rtl} /> :
        ownedOrdersStatus !== "ready" ? <>{!!checkoutNotice && <Text testID="esim-guest-payment-status" accessibilityLiveRegion="polite" style={[styles.checkoutNotice, rtl && styles.rtl]}>{checkoutNotice}</Text>}<Message icon="receipt" title={t.ordersUnavailable} description={onRecoverGuest ? (paymentReturnRecovery
          ? (lang === "ar" ? "إذا دفعت كزائر، استعد الطلب باستخدام بريد الشراء. لا يمكن تفعيل الشريحة برقم الطلب وحده؛ لا تبدأ الدفع مرة أخرى." : "If you paid as a guest, recover the order with your purchase email. An order ID alone cannot activate an eSIM; do not pay again.")
          : (lang === "ar" ? "إذا اشتريت كزائر، استعد الشريحة باستخدام بريد الشراء. أو سجّل الدخول لعرض شرائح حسابك." : "Bought as a guest? Recover your eSIM with your purchase email, or sign in to view account orders."))
          : t.ordersHint} action={onRecoverGuest ? (lang === "ar" ? "استعادة شريحتي" : "Recover my eSIM") : undefined} onAction={onRecoverGuest} rtl={rtl} /></> :
      <FlatList
        data={ownedOrders ?? []} keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 36 }]}
         ListEmptyComponent={<Message icon="receipt" title={t.ordersEmpty} description={t.ordersEmptyHint} rtl={rtl} />}
        renderItem={({ item }) => <Pressable onPress={() => onSelectOwnedOrder?.(item.id)} disabled={!onSelectOwnedOrder} testID={`esim-order-${item.id}`} accessibilityRole="button" style={({ pressed }) => [styles.orderCard, pressed && styles.pressed]}>
          <View style={[styles.packageTop, rtl && styles.reverse]}>
             <View style={styles.packageIcon}><EsimIcon name="credit-card" size={21} color={C.gold} /></View>
            <View style={[styles.packageHead, rtl && styles.alignEnd]}>
              <Text style={[styles.packageTitle, rtl && styles.rtl]}>{esimDestinationTitle(item.destinationTitle, lang)}</Text>
              <Text style={[styles.operator, rtl && styles.rtl]}>{item.packageTitle}</Text>
            </View>
          </View>
          <View style={styles.divider} />
           <Text style={[styles.destinationMeta, rtl && styles.rtl]}>{t.orderStatus}: {item.status === "pending_review" ? (lang === "ar" ? "قيد المراجعة" : "Needs review") : item.status}</Text>
           {paymentStatusOrderId === item.id && item.status !== "completed" && paymentStatusMessage
             && <Text testID={`esim-payment-status-${item.id}`} style={[styles.destinationMeta, rtl && styles.rtl]}>{paymentStatusMessage}</Text>}
          {!!item.purchasedAt && <Text style={[styles.destinationMeta, rtl && styles.rtl]}>{item.purchasedAt}</Text>}
          {!!item.activationInstructions && <View style={styles.activationBox}>
            <Text style={[styles.infoTitle, rtl && styles.rtl]}>{t.activation}</Text>
            <Text style={[styles.infoBody, rtl && styles.rtl]} selectable>{item.activationInstructions}</Text>
          </View>}
           {!!onSelectOwnedOrder && <EsimIcon name={rtl ? "chevron-back" : "chevron-forward"} size={18} color={C.gold} />}
        </Pressable>}
      />
    ) : selectedSlug ? (
       detail.isPending && !detail.data ? <LoadingCards /> : detail.isError && !detail.data ? <Message icon="cloud-off" title={t.errorTitle} description={t.detailError} action={t.retry} onAction={() => void detail.refetch()} rtl={rtl} /> :
      <>
        <FlatList
          data={rows} keyExtractor={(item) => item.key} renderItem={renderPackage}
          initialNumToRender={12} maxToRenderPerBatch={12} windowSize={7}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, { paddingBottom: 24 }]}
          ListHeaderComponent={<View>
              <View style={styles.detailBanner}><EsimIcon name={destination?.category === "local" ? "location" : "globe"} size={38} color="#FFFFFF" /><View style={styles.bannerLines}><View style={styles.bannerLine} /><View style={[styles.bannerLine, { width: 54 }]} /></View></View>
            <View style={[styles.detailIntro, rtl && styles.alignEnd]}>
              <Text style={styles.eyebrow}>{destination?.countryCode.toUpperCase()}</Text>
              <Text style={[styles.detailTitle, rtl && styles.rtl]}>{esimDestinationTitle(destination?.title ?? "", lang, destination?.countryCode)}</Text>
              <Text style={[styles.detailSub, rtl && styles.rtl]}>{t.plans(destination?.packages.length ?? 0)}</Text>
            </View>
            <View style={styles.infoCard}>
               <View style={[styles.infoHeading, rtl && styles.reverse]}><EsimIcon name="cellular" size={19} color={C.gold} /><Text style={styles.infoTitle}>{t.compatibility}</Text></View>
              <Text style={[styles.infoBody, rtl && styles.rtl]}>{t.compatibilityText}</Text>
              <View style={styles.divider} />
              <Text style={[styles.infoTitle, rtl && styles.rtl]}>{t.coverage}</Text>
              {selected
                ? <Pressable testID="esim-coverage-link" accessibilityRole="button" accessibilityLabel={rtl ? "عرض الدول والشبكات المشمولة" : "View covered countries and networks"} onPress={() => setCoverageOpen(true)} style={styles.coverageLinkButton}>
                    <Text style={[styles.coverageLink, rtl && styles.rtl]}>{rtl ? "عرض الدول والشبكات المشمولة" : "View covered countries & networks"}</Text>
                  </Pressable>
                : <Text style={[styles.infoBody, rtl && styles.rtl]}>{t.selectToView}</Text>}
            </View>
            <Text style={[styles.sectionLabel, rtl && styles.rtl]}>{t.packages}</Text>
            <View style={[styles.filterRow, rtl && styles.reverse]}>
              <Chip id="esim-filter-all" label={t.all} active={filter === "all"} onPress={() => { setFilter("all"); setSelection(null); setCoverageOpen(false); }} />
              <Chip id="esim-filter-unlimited" label={t.unlimited} active={filter === "unlimited"} onPress={() => { setFilter("unlimited"); setSelection(null); setCoverageOpen(false); }} />
              <Chip id="esim-filter-fixed" label={t.fixed} active={filter === "fixed"} onPress={() => { setFilter("fixed"); setSelection(null); setCoverageOpen(false); }} />
            </View>
          </View>}
           ListEmptyComponent={<Message icon="cellular" title={destination?.packages.length ? t.noFilter : t.noPackages} description={destination?.packages.length ? t.noFilterText : t.noPackagesText} rtl={rtl} />}
            ListFooterComponent={<EsimFaq lang={lang} />}
        />
        <View style={[styles.buyBar, { paddingBottom: Math.max(insets.bottom, Platform.OS === "web" ? 34 : 12) }]}>
          <View style={[styles.buySummary, rtl && styles.reverse]}>
            <Text style={styles.buySummaryLabel}>{selected ? selected.title : t.select}</Text>
            <Text style={styles.buySummaryPrice}>{selected ? price(selected.priceKwd) ?? t.unavailable : ""}</Text>
          </View>
          <Pressable
            testID="esim-buy-now" accessibilityRole="button" accessibilityLabel={t.buy} accessibilityHint={availabilityHint ?? undefined}
            accessibilityState={{ disabled: !buyEnabled }}
            disabled={!buyEnabled}
            onPress={() => { if (buyEnabled && selected && destination) onBuy?.(selected, destination); }}
            style={({ pressed }) => [styles.buyButton, !buyEnabled && styles.buyDisabled, pressed && styles.pressed]}
            ><Text style={styles.buyText}>{checkoutPending ? t.checkoutWorking : t.buy}</Text><EsimIcon name={rtl ? "arrow-back" : "arrow-forward"} size={19} color="#FFFFFF" /></Pressable>
          {!!availabilityHint && <Text style={styles.buyHint}>{availabilityHint}</Text>}
          {!!checkoutError && <Text accessibilityRole="alert" style={styles.checkoutError}>{checkoutError}</Text>}
          {!!checkoutNotice && <Text style={styles.checkoutNotice}>{checkoutNotice}</Text>}
          {!onBuy && <Text style={styles.buyHint}>{t.checkoutPending} · {t.checkoutHint}</Text>}
        </View>
         {selected && destination && <EsimCoverageSheet visible={coverageOpen} onClose={() => setCoverageOpen(false)} lang={lang} destination={destination} plan={selected} bottomInset={insets.bottom} />}
      </>
    ) : (
      <>
        <View style={[styles.intro, rtl && styles.alignEnd]}>
          <Pressable
            onPress={goBack}
            hitSlop={8}
            testID="esim-back"
            accessibilityRole="button"
            accessibilityLabel={t.back}
            style={({ pressed }) => [styles.introBack, rtl && styles.introBackRtl, pressed && styles.pressed]}
          >
            <EsimIcon name={rtl ? "arrow-forward" : "arrow-back"} size={21} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.introEyebrow}>{t.eyebrow}</Text>
          <Text style={[styles.introTitle, rtl && styles.rtl]}>{t.intro}</Text>
          <View style={[styles.searchBox, rtl && styles.reverse]}>
             <EsimIcon name="search" size={21} color={C.muted} />
            <TextInput testID="esim-search" value={search} onChangeText={setSearch} placeholder={t.search} placeholderTextColor={C.muted} autoCorrect={false} returnKeyType="search" accessibilityLabel={t.search} style={[styles.searchInput, rtl && styles.rtl]} />
             {!!search.length && <Pressable testID="esim-clear-search" accessibilityRole="button" accessibilityLabel={t.clear} onPress={() => setSearch("")} hitSlop={8}><EsimIcon name="close-circle" size={20} color={C.muted} /></Pressable>}
          </View>
        </View>
        <View style={styles.browseNav}>
          <View style={[styles.browseRow, rtl && styles.reverse]}>
            <Text style={styles.browseLabel}>{t.destinations}</Text>
             {signedIn && <Pressable testID="esim-my-esims" onPress={() => setShowOrders(true)} accessibilityRole="button" style={({ pressed }) => [styles.myEsims, pressed && styles.pressed]}>
                <EsimIcon name="albums" size={17} color={C.gold} /><Text style={styles.myEsimsText}>{t.myEsims}</Text>
             </Pressable>}
             {!signedIn && onRecoverGuest && <Pressable testID="esim-recover-guest" onPress={onRecoverGuest} accessibilityRole="button" style={({ pressed }) => [styles.myEsims, pressed && styles.pressed]}>
               <EsimIcon name="receipt" size={17} color={C.gold} /><Text style={styles.myEsimsText}>{lang === "ar" ? "استعادة شريحتي" : "Recover my eSIM"}</Text>
             </Pressable>}
          </View>
          <View style={[styles.categories, rtl && styles.reverse]}>
            {(["popular", "local", "regional", "global"] as Category[]).map((key) => <Pressable key={key} testID={`esim-category-${key}`} accessibilityRole="button" accessibilityState={{ selected: category === key }} onPress={() => setCategory(key)} style={[styles.category, category === key && styles.categoryActive]}><Text style={[styles.categoryText, category === key && styles.categoryTextActive]} numberOfLines={1} adjustsFontSizeToFit>{t.tabs[key]}</Text></Pressable>)}
          </View>
        </View>
        {catalog.isPending && !catalog.data ? <LoadingCards /> : catalog.isError && !catalog.data ?
           <Message icon="cloud-off" title={t.errorTitle} description={t.errorText} action={t.retry} onAction={() => void catalog.refetch()} rtl={rtl} /> :
          <FlatList
            data={destinations} keyExtractor={(item) => item.slug} renderItem={renderDestination}
            initialNumToRender={12} maxToRenderPerBatch={12} windowSize={7}
            scrollEnabled={destinations.length > 0} showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 28 }]}
            ListHeaderComponent={destinations.length ? <View style={[styles.listHeading, rtl && styles.alignEnd]}><Text style={[styles.listHelp, rtl && styles.rtl]}>{term ? t.destinations : t.tabHelp[category]}</Text><Text style={styles.count}>{destinations.length}</Text></View> : null}
             ListEmptyComponent={<Message icon="globe" title={term ? t.noResults : t.emptyTitle} description={term ? t.noResultsText : t.emptyText} rtl={rtl} />}
          />}
      </>
    )}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.canvas },
  reverse: { flexDirection: "row-reverse" },
  alignEnd: { alignItems: "flex-end" },
  rtl: { textAlign: "right", writingDirection: "rtl" },
  pressed: { opacity: 0.72 },
   header: { minHeight: 62, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  backButton: { width: 48, height: 48, justifyContent: "center", alignItems: "center", borderRadius: 24 },
   headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: C.ink },
  headerSpacer: { width: 48 },
   intro: { backgroundColor: C.navyMid, paddingHorizontal: 22, paddingTop: 23, paddingBottom: 26, borderBottomWidth: 1, borderBottomColor: C.border },
  introBack: { position: "absolute", top: 12, right: 14, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)", zIndex: 1 },
  introBackRtl: { right: undefined, left: 14 },
  introEyebrow: { color: "#D5E8FF", fontSize: 11, letterSpacing: 1.2, fontWeight: "800" },
   introTitle: { color: "#FFFFFF", fontSize: 24, lineHeight: 32, fontWeight: "800", marginTop: 8, marginBottom: 21 },
   searchBox: { width: "100%", backgroundColor: C.raised, borderColor: C.border, borderWidth: 1, borderRadius: 13, minHeight: 50, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, gap: 11 },
  searchInput: { flex: 1, minHeight: 48, fontSize: 15, color: C.ink, paddingVertical: 0 },
  browseNav: { backgroundColor: C.canvas, paddingHorizontal: 16, paddingTop: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  browseRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
   browseLabel: { color: C.ink, fontSize: 17, fontWeight: "800" },
   myEsims: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 7, paddingHorizontal: 11, backgroundColor: C.goldWash, borderWidth: 1, borderColor: C.gold, borderRadius: 20 },
   myEsimsText: { color: C.goldLight, fontSize: 12, fontWeight: "800" },
  categories: { flexDirection: "row", gap: 3 },
  category: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  categoryActive: { borderBottomColor: C.gold },
  categoryText: { color: C.muted, fontSize: 13, fontWeight: "700" },
   categoryTextActive: { color: C.goldLight, fontWeight: "800" },
  list: { paddingHorizontal: 16, paddingTop: 17, gap: 10 },
  listHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2, paddingBottom: 8, gap: 10 },
  listHelp: { flex: 1, fontSize: 13, lineHeight: 19, color: C.muted },
  count: { color: C.gold, fontSize: 13, fontWeight: "800" },
   sectionLabel: { fontSize: 18, fontWeight: "800", color: C.ink, marginTop: 24, marginBottom: 13 },
  destinationCard: { flexDirection: "row", alignItems: "center", padding: 10, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, gap: 10, minHeight: 80 },
  destinationImage: { width: 58, height: 58, borderRadius: 10, backgroundColor: C.canvas },
  flagFrame: { backgroundColor: "transparent", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  flagImage: { width: 52, height: 32, borderRadius: 2 },
  regionImage: { width: 48, height: 44 },
   imageFallback: { alignItems: "center", justifyContent: "center", backgroundColor: C.goldWash },
  destinationInfo: { flex: 1, gap: 4 },
  destinationTitle: { color: C.ink, fontSize: 15, fontWeight: "800" },
  destinationMeta: { color: C.muted, fontSize: 12, fontWeight: "600", marginTop: 3 },
  fromLabel: { color: C.muted, fontSize: 10 },
   destinationPrice: { color: C.goldLight, fontSize: 13, fontWeight: "800", marginTop: 3 },
  detailImage: { width: "100%", height: 145, borderRadius: 16, backgroundColor: C.border },
  detailBanner: { height: 92, backgroundColor: C.navy, borderRadius: 12, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", overflow: "hidden" },
  bannerLines: { gap: 9, opacity: 0.5 },
  bannerLine: { width: 92, height: 2, backgroundColor: C.gold, borderRadius: 2 },
  detailIntro: { paddingTop: 16, paddingBottom: 14 },
   eyebrow: { color: C.gold, fontSize: 11, letterSpacing: 1.1, fontWeight: "800" },
   detailTitle: { fontSize: 26, fontWeight: "800", color: C.ink, marginTop: 4 },
  detailSub: { color: C.muted, fontSize: 13, marginTop: 4 },
  infoCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 },
  infoHeading: { flexDirection: "row", gap: 9, alignItems: "center" },
   infoTitle: { color: C.ink, fontSize: 14, fontWeight: "800" },
  infoBody: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 7 },
  coverageLinkButton: { alignSelf: "flex-start", paddingVertical: 8, marginTop: 3 },
  coverageLink: { color: C.gold, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
  networkTitle: { marginTop: 12 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 15 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  chip: { borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingVertical: 9, paddingHorizontal: 14 },
   chipActive: { backgroundColor: C.gold, borderColor: C.gold },
   chipText: { color: C.ink, fontSize: 12, fontWeight: "700" },
   chipTextActive: { color: "#FFFFFF" },
   groupTitle: { color: C.goldLight, fontSize: 15, fontWeight: "800", marginTop: 17, marginBottom: 2 },
  packageCard: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14 },
   packageCardSelected: { borderColor: C.gold, borderWidth: 2, padding: 13, backgroundColor: C.raised },
  packageTop: { flexDirection: "row", alignItems: "center" },
   packageIcon: { width: 41, height: 41, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: C.goldWash, marginRight: 11 },
  iconRtl: { marginRight: 0, marginLeft: 11 },
  packageHead: { flex: 1 },
   packageTitle: { fontSize: 14, fontWeight: "800", color: C.ink },
  packageMeta: { marginTop: 5, color: C.muted, fontSize: 12 },
   packagePrice: { color: C.goldLight, fontSize: 13, fontWeight: "800" },
  check: { marginTop: 5, alignSelf: "flex-end" },
  orderCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 },
   orderDetail: { backgroundColor: C.surface, borderRadius: 16, margin: 16, padding: 18, borderWidth: 1, borderColor: C.border },
  orderChevron: { alignSelf: "flex-end" },
  downloadButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, minHeight: 48, borderRadius: 12, marginTop: 20, backgroundColor: "#2369AD" },
  downloadText: { color: C.ink, fontWeight: "800", fontSize: 14 },
   activationBox: { marginTop: 14, padding: 13, borderRadius: 11, backgroundColor: C.goldWash, borderWidth: 1, borderColor: C.border },
  operator: { marginTop: 4, color: C.muted, fontSize: 12 },
  buyBar: { backgroundColor: C.surface, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
   promoInput: { minHeight: 43, borderWidth: 1, borderColor: C.border, backgroundColor: C.raised, borderRadius: 10, paddingHorizontal: 12, color: C.ink, fontSize: 13, marginBottom: 10 },
   paymentHeading: { color: C.ink, fontSize: 12, fontWeight: "800", marginBottom: 8 },
  paymentMethods: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 7, marginBottom: 12 },
   paymentOption: { width: "48%", minHeight: 54, borderWidth: 1, borderColor: C.border, backgroundColor: C.raised, borderRadius: 10, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 5 },
   paymentOptionSelected: { borderColor: C.gold, backgroundColor: C.goldWash },
  paymentCopy: { flex: 1 },
   paymentName: { color: C.ink, fontSize: 11, fontWeight: "800" },
   paymentFee: { color: C.muted, fontSize: 10, marginTop: 2 },
   checkoutError: { color: "#A42D31", fontSize: 12, marginTop: 8, textAlign: "center" },
   checkoutNotice: { color: C.goldLight, fontSize: 12, marginTop: 8, textAlign: "center" },
  buySummary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 },
  buySummaryLabel: { color: C.muted, fontSize: 12, flex: 1 },
   buySummaryPrice: { color: C.goldLight, fontSize: 16, fontWeight: "800" },
  buyButton: { backgroundColor: C.gold, borderRadius: 8, minHeight: 48, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  buyDisabled: { opacity: 0.48 },
  buyText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  buyHint: { color: C.muted, fontSize: 11, textAlign: "center", marginTop: 7 },
  loading: { padding: 16, gap: 12 },
  skeletonCard: { height: 80, borderRadius: 16, backgroundColor: C.surface, flexDirection: "row", padding: 10, gap: 13, alignItems: "center" },
  skeletonImage: { width: 58, height: 58, borderRadius: 11, backgroundColor: C.border },
  skeletonLines: { flex: 1, gap: 12 },
  skeletonLine: { height: 11, width: "80%", borderRadius: 6, backgroundColor: C.border },
  message: { alignItems: "center", justifyContent: "center", paddingHorizontal: 30, paddingVertical: 52 },
   messageIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.goldWash, alignItems: "center", justifyContent: "center", marginBottom: 17 },
   messageTitle: { fontSize: 18, fontWeight: "800", color: C.ink, textAlign: "center" },
  messageBody: { fontSize: 14, lineHeight: 21, color: C.muted, textAlign: "center", marginTop: 8 },
   retry: { backgroundColor: C.gold, borderRadius: 11, paddingVertical: 12, paddingHorizontal: 24, marginTop: 20, minHeight: 44 },
   retryText: { color: C.navy, fontWeight: "800", fontSize: 14 },
});
