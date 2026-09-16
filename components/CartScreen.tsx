import React, { useEffect, useState } from "react";
import { Alert, View, Text, StyleSheet, Pressable, FlatList, Image, TextInput, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCart, CartItem } from "@/lib/cartContext";
import colors from "@/constants/colors";
import { HotelPortalIcon } from "@/components/HotelPortalIcon";
import { STORE_PAYMENT_APP_RETURN_URL, isTrustedHotelPaymentHost, parseStorePaymentReturnUrl } from "@/lib/hotelPortal";
import { getPushRegistrationIdentity, registerPushToken } from "@/utils/pushTokenLink";
import { KuwaitAreaPicker } from "@/components/KuwaitAreaPicker";
import { DeliveryLocationPicker, DeliveryLocation } from "@/components/DeliveryLocationPicker";
import { PaymentMethodLogo, StorePaymentMethod } from "@/components/PaymentMethodLogo";
import { StoreTermsModal } from "@/components/StoreTermsModal";

const C = {
  ...colors.light,
  navy: "#003580",
  canvasAlt: "#F2F2F2",
};

interface CartScreenProps {
  onClose: () => void;
  lang: "en" | "ar";
}

export function CartScreen({ onClose, lang }: CartScreenProps) {
  const insets = useSafeAreaInsets();
  const { items, removeFromCart, updateQuantity, clearCart, stockByProductId, catalog } = useCart();
  const rtl = lang === "ar";
  const [ordering, setOrdering] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"knet" | "cc" | "apple-pay" | "samsung-pay">("knet");
  const [quote, setQuote] = useState<{ subtotalKwd: number; feeKwd: number; deliveryKwd?: number; chargeKwd: number } | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<"standard" | "express">("standard");
  const [address, setAddress] = useState({ area: "", block: "", street: "", houseApt: "", mobile: "" });
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocation | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "address" | "payment">("cart");

  const apiBase = (process.env.EXPO_PUBLIC_API_BASE || "https://tours-dar-tamaiz--engalialfoudari.replit.app/api").replace(/\/$/, "");
  const methodLabel = {
    knet: rtl ? "كي نت" : "KNET",
    cc: rtl ? "بطاقة ائتمان" : "Credit card",
    "apple-pay": "Apple Pay",
    "samsung-pay": "Samsung Pay",
  } as const;
  const deliveryAddress = `${address.area}, Block ${address.block}, Street ${address.street}, House/Apt ${address.houseApt}, Mobile ${address.mobile}, Kuwait`;
  const addressValid = Object.values(address).every(value => value.trim().length > 0) && deliveryLocation !== null;
  const hasStockConflict = __DEV__ && items.some(item => stockByProductId[item.productId] !== undefined && item.quantity > stockByProductId[item.productId]);
  useEffect(() => {
    if (!__DEV__ || items.length === 0) return;
    let cancelled = false;
    (async () => {
      const key = "DT_TOURS_ABANDONED_CART_ID";
      let cartId = await AsyncStorage.getItem(key);
      if (!cartId) {
        cartId = `dt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        await AsyncStorage.setItem(key, cartId);
      }
      if (cancelled) return;
      await registerPushToken().catch(() => {});
      const identity = await getPushRegistrationIdentity().catch(() => ({ deviceId: cartId, expoPushToken: null }));
      const payload = {
        cartId, deviceId: identity.deviceId, expoPushToken: identity.expoPushToken,
        items: items.map(({ productId, quantity }) => ({ productId, quantity })),
        deliveryAddress, deliveryLocation,
      };
      const abandonedResponse = await fetch(`${apiBase}/store/abandoned-cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": identity.deviceId },
        body: JSON.stringify(payload),
      }).catch(() => null);
      if (abandonedResponse?.ok) return;
      // Compatibility with the currently deployed Phase 3 cart route.
      await fetch(`${apiBase}/store/cart`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-device-id": identity.deviceId },
        body: JSON.stringify(payload),
      }).catch(() => {});
    })();
    return () => { cancelled = true; };
  }, [apiBase, items]);
  useEffect(() => {
    if (items.length === 0) {
      setQuote(null);
      return;
    }
    if (__DEV__ && checkoutStep === "payment" && (!addressValid || hasStockConflict)) {
      setQuote(null);
      return;
    }
    const controller = new AbortController();
    fetch(`${apiBase}/store/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethod,
        items: items.map(({ productId, quantity }) => ({ productId, quantity })),
        ...( __DEV__ && checkoutStep === "payment" ? { deliveryMethod, deliveryAddress, address, deliveryLocation } : {}),
      }),
      signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json();
      if (response.ok && data?.ok) {
        setQuote({
          subtotalKwd: Number(data.subtotalKwd),
          feeKwd: Number(data.feeKwd),
          deliveryKwd: Number(data.deliveryKwd ?? 0),
          chargeKwd: Number(data.chargeKwd),
        });
      }
    }).catch(() => {});
    return () => controller.abort();
  }, [apiBase, items, paymentMethod, deliveryMethod, address, addressValid, hasStockConflict, checkoutStep]);

  const cartProducts = items.map(item => {
    const p = catalog.find(cat => cat.id === item.productId);
    return { item, product: p };
  }).filter(p => p.product) as { item: CartItem, product: typeof catalog[0] }[];

  const handleCheckout = async () => {
    if (items.length === 0 || ordering || !quote) return;
    if (__DEV__ && !termsAccepted) {
      Alert.alert(
        rtl ? "الموافقة مطلوبة" : "Acceptance required",
        rtl ? "يرجى قراءة شروط وأحكام خدمة تجهيز المسافر والموافقة عليها قبل الدفع." : "Read and accept the Travel Prep Service Terms & Conditions before paying.",
      );
      return;
    }
    if (__DEV__ && (!addressValid || hasStockConflict)) {
      Alert.alert(
        rtl ? "يرجى إكمال البيانات" : "Please complete your details",
        hasStockConflict ? (rtl ? `عذراً، الكمية المتاحة في المخزون هي ${stockByProductId[items.find(item => stockByProductId[item.productId] !== undefined && item.quantity > stockByProductId[item.productId])!.productId]} قطع فقط. يرجى تعديل الاختيار.` : "One or more quantities exceed available stock.") : (rtl ? "يرجى إدخال عنوان التوصيل ورقم الهاتف." : "Enter all Kuwait delivery fields and mobile number."),
      );
      return;
    }
    setOrdering(true);
    try {
      const response = await fetch(`${apiBase}/store/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          items: items.map(({ productId, quantity }) => ({ productId, quantity })),
          ...( __DEV__ ? { deliveryMethod, deliveryAddress, address, deliveryLocation, termsAccepted } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok || typeof data.url !== "string" || typeof data.orderId !== "string") {
        throw new Error(data?.error || "Unable to start payment");
      }
      setQuote({
        subtotalKwd: Number(data.subtotalKwd),
        feeKwd: Number(data.feeKwd),
        deliveryKwd: Number(data.deliveryKwd ?? 0),
        chargeKwd: Number(data.chargeKwd),
      });
      let url: URL;
      try { url = new URL(data.url); } catch { throw new Error("Invalid payment URL"); }
      if (url.protocol !== "https:" || !isTrustedHotelPaymentHost(url.hostname)) {
        throw new Error("Untrusted payment URL");
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, STORE_PAYMENT_APP_RETURN_URL);
      const returned = result.type === "success" ? parseStorePaymentReturnUrl(result.url) : null;
      if (!returned || returned.orderId !== data.orderId) {
        if (result.type !== "cancel") {
          Alert.alert(rtl ? "لم يتم تأكيد الدفع" : "Payment not confirmed", rtl ? "بقيت المنتجات في سلتك." : "Your cart was preserved.");
        }
        return;
      }
      const statusResponse = await fetch(`${apiBase}/store/orders/${encodeURIComponent(data.orderId)}/status`);
      const status = await statusResponse.json();
      if (status?.paid === true || status?.status === "paid" || status?.status === "captured") {
        clearCart();
        Alert.alert(rtl ? "تم الدفع بنجاح" : "Payment successful", rtl ? "تم تأكيد طلب خدمة تجهيز المسافر." : "Your Traveler Preparation Service order has been confirmed.");
      } else {
        Alert.alert(rtl ? "لم يتم تأكيد الدفع" : "Payment not confirmed", rtl ? "بقيت المنتجات في سلتك." : "Your cart was preserved.");
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      const knownReason = reason === "You must accept the Travel Prep Service Terms & Conditions"
        ? (rtl ? "يجب قراءة شروط وأحكام خدمة تجهيز المسافر والموافقة عليها قبل الدفع." : "You must read and accept the Travel Prep Service Terms & Conditions before paying.")
        : reason === "Select an accurate delivery location inside Kuwait"
          ? (rtl ? "يرجى تحديد موقع توصيل دقيق داخل الكويت على الخريطة." : "Select an accurate delivery location inside Kuwait on the map.")
          : reason === "A valid Kuwait delivery address is required"
            ? (rtl ? "يرجى إكمال عنوان التوصيل داخل الكويت." : "Complete the Kuwait delivery address.")
            : "";
      Alert.alert(
        rtl ? "تعذر بدء الدفع" : "Unable to start payment",
        knownReason || (rtl ? "لم يتم إنشاء أي دفعة وبقيت المنتجات في سلتك. يرجى التحقق من البيانات والمحاولة مرة أخرى." : "No payment was created and your cart was preserved. Check your details and try again."),
      );
    } finally {
      setOrdering(false);
    }
  };

  const handleBack = () => {
    if (checkoutStep === "payment") {
      setCheckoutStep("address");
    } else if (checkoutStep === "address") {
      setCheckoutStep("cart");
    } else {
      onClose();
    }
  };

  const continueFromAddress = () => {
    if (!addressValid) {
      Alert.alert(
        rtl ? "يرجى إكمال البيانات" : "Please complete your details",
        rtl ? "يرجى إدخال عنوان التوصيل ورقم الهاتف وتحديد الموقع على الخريطة." : "Enter the delivery address, mobile number, and pin the location on the map.",
      );
      return;
    }
    setCheckoutStep("payment");
  };

  const renderItem = ({ item: { item, product } }: { item: { item: CartItem, product: typeof catalog[0] } }) => (
    <View style={[styles.cartItem, rtl && { flexDirection: "row-reverse" }]}>
      <Image source={product.image} style={styles.itemImg} />
      <View style={[styles.itemBody, rtl && { alignItems: "flex-end" }]}>
        <Text style={[styles.itemName, rtl && styles.rtlText]} numberOfLines={2}>{product.name[lang]}</Text>
        <Text style={styles.itemPrice}>KWD {(product.priceKwd * item.quantity).toFixed(3)}</Text>
        {__DEV__ && stockByProductId[item.productId] !== undefined && (
          <Text style={styles.stockWarning}>
            {stockByProductId[item.productId] < item.quantity
              ? (rtl ? `عذراً، الكمية المتاحة في المخزون هي ${stockByProductId[item.productId]} قطع فقط. يرجى تعديل الاختيار.` : `Sorry, only ${stockByProductId[item.productId]} units are available in stock. Please adjust your selection.`)
              : (rtl ? `المخزون: ${stockByProductId[item.productId]}` : `Stock: ${stockByProductId[item.productId]}`)}
          </Text>
        )}
        <View style={[styles.qtyRow, rtl && { flexDirection: "row-reverse" }]}>
          <Pressable onPress={() => updateQuantity(item.productId, item.quantity - 1)} style={styles.qtyBtn}>
            <HotelPortalIcon name="minus" size={16} color={C.navy} />
          </Pressable>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <Pressable onPress={() => updateQuantity(item.productId, item.quantity + 1)} style={styles.qtyBtn}>
            <HotelPortalIcon name="plus" size={16} color={C.navy} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => removeFromCart(item.productId)} style={styles.removeBtn}>
            <HotelPortalIcon name="trash" size={18} color="#ef4444" />
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 20) }]}>
      <View style={[styles.headerRow, rtl && { flexDirection: "row-reverse" }]}>
        <Pressable onPress={handleBack} style={styles.iconBtn}>
          <HotelPortalIcon name={rtl ? "arrow-forward" : "arrow-back"} size={24} color={C.navy} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {checkoutStep === "cart"
            ? (rtl ? "سلتي" : "My Cart")
            : checkoutStep === "address"
              ? (rtl ? "إضافة عنوان جديد" : "Add new address")
              : (rtl ? "التوصيل والدفع" : "Delivery & Payment")}
        </Text>
        <View style={{ width: 48 }} />
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <HotelPortalIcon name="cart" size={64} color="#CBD5E1" />
          <Text style={[styles.emptyText, rtl && styles.rtlText]}>
            {rtl ? "سلتك فارغة" : "Your cart is empty"}
          </Text>
        </View>
      ) : (
        checkoutStep === "cart" ? (
        <>
          <FlatList
            data={cartProducts}
            keyExtractor={p => p.item.productId}
            renderItem={renderItem}
             style={styles.itemsList}
            contentContainerStyle={styles.listContent}
             showsVerticalScrollIndicator={false}
          />
          <View style={[styles.cartSummary, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={[styles.totalRow, rtl && { flexDirection: "row-reverse" }]}>
              <Text style={styles.totalLabel}>{rtl ? "المجموع الفرعي:" : "Subtotal:"}</Text>
              <Text style={styles.totalValue}>KWD {quote ? quote.subtotalKwd.toFixed(3) : "—"}</Text>
            </View>
            <Pressable
              disabled={!quote || hasStockConflict}
              style={({ pressed }) => [styles.checkoutBtn, (!quote || hasStockConflict) && styles.checkoutBtnDisabled, pressed && { opacity: 0.9 }]}
              onPress={() => setCheckoutStep("address")}
            >
              <Text style={styles.checkoutText}>{rtl ? "متابعة الطلب" : "Checkout"}</Text>
            </Pressable>
          </View>
        </>
        ) : checkoutStep === "address" ? (
          <ScrollView
            style={styles.stepScroll}
            contentContainerStyle={[styles.stepContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.paymentLabel, rtl && styles.rtlText]}>{rtl ? "عنوان التوصيل (الكويت فقط)" : "Delivery address (Kuwait only)"}</Text>
            <KuwaitAreaPicker value={address.area} lang={lang} onChange={area => setAddress(current => ({ ...current, area }))} />
            {([
              ["block", rtl ? "القطعة" : "Block"],
              ["street", rtl ? "الشارع" : "Street"],
              ["houseApt", rtl ? "المنزل / الشقة" : "House / Apt"],
              ["mobile", rtl ? "رقم الهاتف المحمول" : "Mobile"],
            ] as const).map(([key, label]) => (
              <TextInput
                key={key}
                value={address[key]}
                onChangeText={value => setAddress(current => ({ ...current, [key]: value }))}
                placeholder={label}
                placeholderTextColor="#94A3B8"
                keyboardType={key === "mobile" ? "phone-pad" : "default"}
                style={[styles.addressInput, rtl && styles.rtlText]}
                textAlign={rtl ? "right" : "left"}
              />
            ))}
            <DeliveryLocationPicker value={deliveryLocation} lang={lang} onChange={setDeliveryLocation} />
            <Pressable style={styles.checkoutBtn} onPress={continueFromAddress}>
              <Text style={styles.checkoutText}>{rtl ? "حفظ ومتابعة" : "Save & Continue"}</Text>
            </Pressable>
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.stepScroll}
            contentContainerStyle={[styles.stepContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
                <Text style={[styles.paymentLabel, rtl && styles.rtlText]}>{rtl ? "طريقة التوصيل" : "Delivery method"}</Text>
                <View style={styles.deliveryMethods}>
                  {([
                    ["standard", rtl ? "التوصيل العادي — 1.500 د.ك" : "Standard Delivery — 1.500 KWD", rtl ? "توصيل ثاني يوم" : "Next-day delivery"],
                    ["express", rtl ? "التوصيل السريع — 3.000 د.ك" : "Express Delivery — 3.000 KWD", rtl ? "توصيل خلال ساعتين" : "Delivery within two hours"],
                  ] as const).map(([method, label, description]) => (
                    <Pressable key={method} onPress={() => setDeliveryMethod(method)}
                      style={[styles.deliveryMethod, deliveryMethod === method && styles.deliveryMethodActive, rtl && { alignItems: "flex-end" }]}>
                      <View style={[styles.deliveryTitleRow, rtl && { flexDirection: "row-reverse" }]}>
                        <View style={[styles.radio, deliveryMethod === method && styles.radioActive]} />
                        <Text style={styles.deliveryMethodTitle}>{label}</Text>
                      </View>
                      <Text style={[styles.deliveryDescription, rtl && styles.rtlText]}>{description}</Text>
                    </Pressable>
                  ))}
                </View>
            <Text style={[styles.paymentLabel, rtl && styles.rtlText]}>
              {rtl ? "طريقة الدفع" : "Payment method"}
            </Text>
            <View style={[styles.paymentMethods, rtl && { flexDirection: "row-reverse" }]}>
              {(Object.keys(methodLabel) as StorePaymentMethod[]).map((method) => (
                <Pressable
                  key={method}
                  onPress={() => setPaymentMethod(method)}
                  style={[styles.paymentMethod, paymentMethod === method && styles.paymentMethodActive]}
                  accessibilityLabel={methodLabel[method]}
                >
                  <PaymentMethodLogo method={method} />
                </Pressable>
              ))}
            </View>
            <View style={[styles.totalRow, rtl && { flexDirection: "row-reverse" }]}>
              <Text style={styles.totalLabel}>{rtl ? "المجموع الفرعي:" : "Subtotal:"}</Text>
              <Text style={styles.totalLabel}>KWD {quote ? quote.subtotalKwd.toFixed(3) : "—"}</Text>
            </View>
            <View style={[styles.totalRow, rtl && { flexDirection: "row-reverse" }]}>
              <Text style={styles.totalLabel}>{rtl ? "رسوم التوصيل:" : "Delivery fee:"}</Text>
              <Text style={styles.totalLabel}>KWD {quote?.deliveryKwd != null ? quote.deliveryKwd.toFixed(3) : "—"}</Text>
            </View>
            <View style={[styles.totalRow, rtl && { flexDirection: "row-reverse" }]}>
              <Text style={styles.totalLabel}>{rtl ? "رسوم الدفع:" : "Payment fee:"}</Text>
              <Text style={styles.totalLabel}>KWD {quote ? quote.feeKwd.toFixed(3) : "—"}</Text>
            </View>
            <View style={[styles.totalRow, rtl && { flexDirection: "row-reverse" }]}>
              <Text style={styles.totalLabel}>{rtl ? "الإجمالي النهائي:" : "Final total:"}</Text>
              <Text style={styles.totalValue}>KWD {quote ? quote.chargeKwd.toFixed(3) : "—"}</Text>
            </View>
            {__DEV__ && (
              <Pressable testID="store-terms-accept" style={[styles.termsRow, rtl && { flexDirection: "row-reverse" }]} onPress={() => setTermsAccepted(value => !value)}>
                <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                  {termsAccepted && <HotelPortalIcon name="check" size={15} color="#FFF" />}
                </View>
                <Text style={[styles.termsText, rtl && styles.rtlText]}>
                  {rtl ? "قرأت وأوافق على " : "I have read and accept the "}
                  <Text style={styles.termsLink} onPress={() => setTermsVisible(true)}>{rtl ? "شروط وأحكام خدمة تجهيز المسافر" : "Travel Prep Service Terms & Conditions"}</Text>
                </Text>
              </Pressable>
            )}
            <Pressable 
              disabled={ordering || !quote || (__DEV__ && !termsAccepted)}
              style={({pressed}) => [styles.checkoutBtn, (ordering || !quote || (__DEV__ && !termsAccepted)) && styles.checkoutBtnDisabled, pressed && { opacity: 0.9 }]}
              onPress={handleCheckout}
            >
              <HotelPortalIcon name="credit-card" size={20} color="#FFF" />
              <Text style={styles.checkoutText}>{ordering ? (rtl ? "جاري التحويل..." : "Opening payment...") : (rtl ? "ادفع الآن" : "Pay now")}</Text>
            </Pressable>
            <Text style={styles.disclaimer}>
              {rtl ? "يتم تأكيد الطلب بعد التحقق من الدفع." : "Your cart is cleared only after payment is verified."}
            </Text>
          </ScrollView>
        )
      )}
      <StoreTermsModal visible={termsVisible} lang={lang} onClose={() => setTermsVisible(false)} />
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
    paddingBottom: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)"
  },
  iconBtn: { padding: 12 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: C.navy },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { marginTop: 16, fontSize: 16, color: "#64748B", fontWeight: "600" },
  itemsList: { flex: 1, minHeight: 250 },
  listContent: { padding: 16, gap: 16 },
  cartItem: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 12,
    shadowColor: C.navy,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 12,
  },
  itemImg: { width: 80, height: 80, borderRadius: 8, backgroundColor: "#E2E8F0" },
  itemBody: { flex: 1, justifyContent: "space-between" },
  itemName: { fontSize: 15, fontWeight: "700", color: C.navy },
  itemPrice: { fontSize: 14, fontWeight: "800", color: "#D4AF37", marginTop: 4 },
  stockWarning: { fontSize: 11, color: "#B91C1C", fontWeight: "700", marginTop: 3 },
  qtyRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 12 },
  qtyBtn: { 
    width: 28, height: 28, borderRadius: 14, 
    backgroundColor: "rgba(0,53,128,0.1)", 
    alignItems: "center", justifyContent: "center" 
  },
  qtyText: { fontSize: 15, fontWeight: "700", color: C.navy, minWidth: 20, textAlign: "center" },
  removeBtn: { padding: 4 },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  footer: {
    maxHeight: "64%",
    backgroundColor: "#FFF",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -5 },
    elevation: 10,
  },
  cartSummary: {
    backgroundColor: "#FFF",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  stepScroll: { flex: 1, backgroundColor: "#FFF" },
  stepContent: { padding: 20 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  paymentLabel: { fontSize: 15, fontWeight: "800", color: C.navy, marginBottom: 8 },
  addressInput: { borderWidth: 1, borderColor: "#D8E0EC", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 7, color: C.navy, backgroundColor: "#FFF" },
  paymentMethods: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  paymentMethod: { width: 82, height: 44, borderWidth: 1, borderColor: "rgba(0,53,128,0.16)", borderRadius: 9, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center" },
  paymentMethodActive: { backgroundColor: "#FFF", borderColor: C.navy, borderWidth: 2 },
  paymentMethodText: { color: C.navy, fontSize: 12, fontWeight: "700" },
  paymentMethodTextActive: { color: "#FFF" },
  deliveryMethods: { gap: 7, marginBottom: 14 },
  deliveryMethod: { borderWidth: 1, borderColor: "#D8E0EC", borderRadius: 10, padding: 10, backgroundColor: "#FFF" },
  deliveryMethodActive: { borderColor: C.navy, backgroundColor: "#F3F7FC" },
  deliveryTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  radio: { width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, borderColor: "#94A3B8" },
  radioActive: { borderWidth: 4, borderColor: C.navy },
  deliveryMethodTitle: { color: C.navy, fontSize: 13, fontWeight: "800" },
  deliveryDescription: { color: "#64748B", fontSize: 11, marginTop: 4, marginStart: 23 },
  totalLabel: { fontSize: 16, fontWeight: "600", color: "#64748B" },
  totalValue: { fontSize: 22, fontWeight: "900", color: C.navy },
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginBottom: 14 },
  checkbox: { width: 22, height: 22, borderWidth: 1.5, borderColor: "#94A3B8", borderRadius: 5, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF" },
  checkboxChecked: { backgroundColor: C.navy, borderColor: C.navy },
  termsText: { flex: 1, color: "#475569", fontSize: 12, lineHeight: 19 },
  termsLink: { color: C.navy, fontWeight: "800", textDecorationLine: "underline" },
  checkoutBtn: {
    backgroundColor: C.navy,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  checkoutBtnDisabled: { opacity: 0.55 },
  checkoutText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  disclaimer: { textAlign: "center", fontSize: 11, color: "#94A3B8", marginTop: 12 },
});
