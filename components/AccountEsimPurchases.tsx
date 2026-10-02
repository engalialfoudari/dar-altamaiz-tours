import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { EsimOrderSummary } from "@workspace/api-client-react";
import { EsimIcon } from "./EsimIcon";
import { HotelPortalIcon } from "./HotelPortalIcon";
import { esimDestinationTitle } from "./esimDisplayPolicy";

type Props = {
  apiBase: string;
  accountKey: string | null;
  request: (url: string, init?: RequestInit) => Promise<Response>;
  language: "en" | "ar";
  refreshVersion?: number;
  onOpenOrders?: (orderId?: string) => void;
};
type LoadState = {
  accountKey: string | null;
  status: "loading" | "ready" | "error";
  orders: EsimOrderSummary[];
};

const labels = {
  en: {
    title: "My eSIMs", subtitle: "Your travel connections and order history",
    viewAll: "View all", refresh: "Refresh eSIM orders",
    loading: "Loading your eSIMs…", error: "We couldn’t load your eSIMs.",
    retry: "Try again", empty: "No eSIM orders yet",
    emptyBody: "eSIMs bought with this account will appear here. Guest purchases remain available through your purchase email.",
    details: "View details", install: "Installation & download",
    reference: "Order", fallback: "Travel eSIM",
    statuses: {
      completed: "Ready to install", fulfillment_pending: "Preparing eSIM",
      pending_review: "Needs review", payment_pending: "Awaiting payment", payment_failed: "Payment failed",
    },
  },
  ar: {
    title: "شرائحي الإلكترونية", subtitle: "شرائح السفر وسجل طلباتك",
    viewAll: "عرض الكل", refresh: "تحديث طلبات الشرائح",
    loading: "جارٍ تحميل شرائحك…", error: "تعذّر تحميل شرائحك الإلكترونية.",
    retry: "حاول مرة أخرى", empty: "لا توجد طلبات شرائح بعد",
    emptyBody: "ستظهر هنا الشرائح التي اشتريتها بهذا الحساب. مشتريات الزوار متاحة عبر بريد الشراء.",
    details: "عرض التفاصيل", install: "التثبيت والتنزيل",
    reference: "الطلب", fallback: "شريحة سفر",
    statuses: {
      completed: "جاهزة للتثبيت", fulfillment_pending: "جارٍ تجهيز الشريحة",
      pending_review: "قيد المراجعة", payment_pending: "بانتظار الدفع", payment_failed: "فشل الدفع",
    },
  },
};

function productText(product: EsimOrderSummary["product"], field: string): string {
  const value = product[field];
  return typeof value === "string" ? value : "";
}

export function AccountEsimPurchases({
  apiBase, accountKey, request, language, refreshVersion = 0, onOpenOrders,
}: Props) {
  const t = labels[language];
  const rtl = language === "ar";
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<LoadState>({ accountKey, status: "loading", orders: [] });
  const currentKey = useRef(accountKey);
  currentKey.current = accountKey;

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const current = () => !disposed && !controller.signal.aborted && currentKey.current === accountKey;
    setState({ accountKey, status: "loading", orders: [] });
    void (async () => {
      try {
        const response = await request(`${apiBase}/esim/orders`, { signal: controller.signal });
        if (!response.ok) throw new Error("eSIM order request failed");
        const data = await response.json();
        if (!Array.isArray(data.orders) || !data.orders.every((order: EsimOrderSummary) =>
          order && typeof order.orderId === "string" && order.status in t.statuses
          && typeof order.amountKwd === "number" && Number.isFinite(order.amountKwd)
          && typeof order.createdAt === "string" && order.product && typeof order.product === "object"
        )) throw new Error("Invalid eSIM order response");
        if (current()) setState({ accountKey, status: "ready", orders: data.orders });
      } catch {
        if (current()) setState({ accountKey, status: "error", orders: [] });
      }
    })();
    return () => { disposed = true; controller.abort(); };
  }, [accountKey, apiBase, request, refreshVersion, reload, t.statuses]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") setReload((value) => value + 1);
    });
    const onFocus = () => setReload((value) => value + 1);
    const browserWindow = Platform.OS === "web" && typeof window !== "undefined"
      && typeof window.addEventListener === "function" ? window : null;
    browserWindow?.addEventListener("focus", onFocus);
    return () => {
      subscription.remove();
      browserWindow?.removeEventListener("focus", onFocus);
    };
  }, []);

  // Never display a previous account's rows during a session switch.
  const display = state.accountKey === accountKey ? state : { status: "loading", orders: [] };
  const align = rtl && styles.rtl;
  return (
    <View style={styles.section} testID="account-esim-purchases">
      <View style={[styles.heading, rtl && styles.reverse]}>
        <View style={styles.icon}><EsimIcon name="credit-card" size={21} color="#0F766E" /></View>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, align]}>{t.title}</Text>
          <Text style={[styles.muted, align]}>{t.subtitle}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t.refresh}
          onPress={() => setReload((value) => value + 1)} style={styles.refresh}
          testID="account-esim-refresh">
          <HotelPortalIcon name="refresh" size={18} color="#0F766E" />
        </Pressable>
      </View>
      {display.status === "loading" && <View style={styles.message}>
        <ActivityIndicator color="#0F766E" /><Text style={[styles.muted, align]}>{t.loading}</Text>
      </View>}
      {display.status === "error" && <View style={styles.message}>
        <Text accessibilityRole="alert" style={[styles.muted, align]}>{t.error}</Text>
        <Pressable accessibilityRole="button" onPress={() => setReload((value) => value + 1)} style={styles.action}>
          <Text style={styles.actionText}>{t.retry}</Text>
        </Pressable>
      </View>}
      {display.status === "ready" && display.orders.length === 0 && <View style={styles.message}>
        <Text style={[styles.emptyTitle, align]}>{t.empty}</Text>
        <Text style={[styles.muted, align]}>{t.emptyBody}</Text>
      </View>}
      {display.status === "ready" && display.orders.map((order) => {
        const ready = order.status === "completed";
        const failed = order.status === "payment_failed";
        const date = new Date(order.createdAt);
        const destination = esimDestinationTitle(productText(order.product, "destination") || productText(order.product, "slug") || t.fallback);
        return <View key={order.orderId} style={styles.order} testID={`account-esim-order-${order.orderId}`}>
          <View style={[styles.orderTop, rtl && styles.reverse]}>
            <View style={styles.headingCopy}>
              <Text style={[styles.orderTitle, align]}>{destination}</Text>
              {!!productText(order.product, "title") && <Text style={[styles.muted, align]}>{productText(order.product, "title")}</Text>}
            </View>
            <View style={[styles.badge, ready && styles.readyBadge, failed && styles.failedBadge]}>
              <Text style={[styles.badgeText, ready && styles.readyText, failed && styles.failedText]}>{t.statuses[order.status]}</Text>
            </View>
          </View>
          <View style={[styles.orderMeta, rtl && styles.reverse]}>
            <Text style={styles.price}>{`KWD ${order.amountKwd.toFixed(3)}`}</Text>
            {Number.isFinite(date.getTime()) && <Text style={styles.muted}>
              {date.toLocaleDateString(rtl ? "ar-KW" : "en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </Text>}
          </View>
          <Text style={[styles.reference, align]}>{t.reference}: {order.orderId}</Text>
          {!!onOpenOrders && <Pressable accessibilityRole="button" onPress={() => onOpenOrders(order.orderId)}
            style={styles.action} testID={`account-esim-details-${order.orderId}`}>
            <Text style={styles.actionText}>{ready ? t.install : t.details}</Text>
            <HotelPortalIcon name={rtl ? "chevron-back" : "chevron-forward"} size={16} color="#0F766E" />
          </Pressable>}
        </View>;
      })}
      {!!onOpenOrders && <Pressable onPress={() => onOpenOrders()} accessibilityRole="button"
        testID="account-esim-entry" style={styles.allOrders}>
        <Text style={styles.actionText}>{t.viewAll}</Text>
        <HotelPortalIcon name={rtl ? "chevron-back" : "chevron-forward"} size={16} color="#0F766E" />
      </Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: 16, marginTop: 16, marginBottom: 16, padding: 16, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E2E8E7" },
  heading: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  icon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#E6F4F1" },
  headingCopy: { flex: 1, minWidth: 0 },
  title: { color: "#1F2937", fontSize: 16, fontWeight: "800", marginBottom: 4 },
  muted: { color: "#64748B", fontSize: 12, lineHeight: 19, flexShrink: 1 },
  refresh: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  message: { paddingVertical: 18, gap: 10 },
  emptyTitle: { color: "#374151", fontSize: 14, fontWeight: "700" },
  order: { borderTopWidth: 1, borderTopColor: "#E8EEEC", paddingVertical: 16, gap: 10 },
  orderTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, flexWrap: "wrap" },
  orderTitle: { color: "#1F2937", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: "#F1F5F9" },
  badgeText: { color: "#475569", fontSize: 11, fontWeight: "700" },
  readyBadge: { backgroundColor: "#E6F4F1" }, readyText: { color: "#0F766E" },
  failedBadge: { backgroundColor: "#FEF2F2" }, failedText: { color: "#B91C1C" },
  orderMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  price: { color: "#374151", fontSize: 13, fontWeight: "700", writingDirection: "ltr" },
  reference: { color: "#64748B", fontSize: 11, lineHeight: 17 },
  action: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, minHeight: 44, paddingHorizontal: 12, backgroundColor: "#F0F8F6" },
  actionText: { color: "#0F766E", fontSize: 13, fontWeight: "700" },
  allOrders: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, borderTopWidth: 1, borderTopColor: "#E8EEEC" },
  reverse: { flexDirection: "row-reverse" },
  rtl: { textAlign: "right", writingDirection: "rtl" },
});