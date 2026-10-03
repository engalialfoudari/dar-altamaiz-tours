import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAppLocale } from "@/localization/engine";
import { AppState, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { ESIM_PAYMENT_APP_RETURN_URL, parseEsimPaymentReturnUrl } from "@/lib/esimPaymentReturn";
import { useAuth, useUser } from "@clerk/expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EsimIcon } from "./EsimIcon";
import { esimDestinationTitle } from "./esimDisplayPolicy";
import { useAppLanguage } from "@/localization/provider";
import { esimFairUseText } from "@/lib/esimFairUse";
import { EMPTY_BILLING, isValidE164, normalizeNationalPhone, parseBilling, serializeBilling, type BillingFields } from "./esimBilling";
import { EsimCountryPicker, getEsimCountryOptions, type EsimCountryOption } from "./EsimCountryPicker";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateEsimOrder,
  getEsimPaymentReturnState,
  reconcileEsimReturnedPayment,
  useGetMyEsimBillingProfile,
  downloadMyEsimDocument,
  useGetMyEsimOrder,
  useListMyEsimOrders,
  useQuoteEsimPackage,
  useSendEsimGuestRecoveryCode,
  useRecoverEsimGuestOrders,
  downloadEsimGuestDocument,
  type EsimOrderDetailResponse,
  type EsimActivation,
  type EsimDestination,
  type EsimPackage,
  type EsimOrderSummary,
  type EsimPaymentMethod,
  type EsimQuoteResponse,
} from "@workspace/api-client-react";
import { EsimCatalogScreen, type EsimOwnedOrder } from "@/components/EsimCatalogScreen";
import { isPrivateEsimTestEnabled, isPrivateEsimTrialPackage, isPrivateEsimTrialQuote } from "@/utils/esimPrivateTest";
import { PaymentMethodLogo } from "@/components/PaymentMethodLogo";
import { EsimQuoteSequence } from "@/components/EsimQuoteSequence";
import { requestClerkToken } from "@/lib/clerkTokenCoordinator";
import { isTrustedHotelPaymentHost } from "@/lib/hotelPortal";
import {
  ESIM_PAYMENT_RETURN_FAST_CHECK_MS,
  ESIM_PAYMENT_RETURN_POLL_INTERVAL_MS,
  ESIM_PAYMENT_RETURN_BACKGROUND_CHECKS,
  ESIM_PAYMENT_RETURN_BACKGROUND_INTERVAL_MS,
  isEsimOrderStatusTerminal,
  nextEsimOrderStatusPollDelay,
} from "@/components/esimOrderStatusPolling";

type Props = {
  lang: "en" | "ar";
  privateTest?: boolean;
  onClose: () => void;
  selectedSlug: string | null;
  initialSelectedPackageId?: string | null;
  initialShowOrders?: boolean;
  initialOrderId?: string | null;
  paymentReturnSeq?: number;
  paymentReturnOrderId?: string | null;
  paymentReturnRecovery?: boolean;
  onSelectDestination: (slug: string | null) => void;
};

function textField(record: unknown, key: string): string {
  if (!record || typeof record !== "object") return "";
  const value = (record as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function orderForDisplay(order: EsimOrderSummary): EsimOwnedOrder {
  const product = order.product;
  return {
    id: order.orderId,
    destinationTitle: textField(product, "destination") || textField(product, "slug"),
    packageTitle: textField(product, "title"),
    status: order.status,
    paymentConfirmedAt: order.paymentConfirmedAt,
    purchasedAt: order.createdAt,
  };
}

function activationForDisplay(value: EsimActivation | null): string | null {
  if (!value) return null;
  const lines: string[] = [];
  if (value.code) lines.push(`Code: ${value.code}`);
  for (const sim of value.sims) {
    if (sim.iccid) lines.push(`ICCID: ${sim.iccid}`);
    if (sim.qrcode) lines.push(`QR installation data: ${sim.qrcode}`);
    if (sim.qrcodeUrl) lines.push(`QR code URL: ${sim.qrcodeUrl}`);
    if (sim.directAppleInstallationUrl) lines.push(`Apple installation URL: ${sim.directAppleInstallationUrl}`);
    if (sim.manualInstallation) {
      for (const [key, entry] of Object.entries(sim.manualInstallation)) {
        collectSupplierStrings(entry, lines, key);
      }
    }
  }
  return lines.length ? lines.join("\n") : null;
}

function collectSupplierStrings(value: unknown, lines: string[], label: string, depth = 0): void {
  if (depth > 5) return;
  if (typeof value === "string" && value.trim()) {
    lines.push(`${label}: ${value}`);
  } else if (Array.isArray(value)) {
    for (const item of value) collectSupplierStrings(item, lines, label, depth + 1);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) collectSupplierStrings(item, lines, key, depth + 1);
  }
}

type Review = {
  item: EsimPackage;
  destination: EsimDestination;
  promoCode: string;
  paymentMethod: EsimPaymentMethod;
  customer: Customer;
  quote: EsimQuoteResponse;
  changed: boolean;
  blocked?: boolean;
};

type Customer = { firstName: string; lastName: string; email: string; phoneNumber: string; countryIso: string; phoneDialCountryIso: string } & BillingFields;
type CheckoutStep = "customer" | "payment";
type PaymentStatusCheck = {
  orderId: string;
  sessionId: string;
  startedAt: number;
  phase: "checking" | "waiting" | "paused";
};
const EMPTY_CUSTOMER: Customer = { firstName: "", lastName: "", email: "", phoneNumber: "", countryIso: "", phoneDialCountryIso: "KW", ...EMPTY_BILLING };
const PAYMENT_METHODS: EsimPaymentMethod[] = ["knet", "cc", "apple-pay", "samsung-pay"];
const BLUE = "#006CE4";
const BLUE_LIGHT = "#003580";
const NAVY = "#F3F5F7";
const SURFACE = "#FFFFFF";
const BORDER = "#D8DFE7";

function validQuote(quote: EsimQuoteResponse, slug: string, packageId: string, paymentMethod: EsimPaymentMethod) {
  return Number.isSafeInteger(quote.amountFils) && quote.amountFils > 0
    && Number.isSafeInteger(quote.baseAmountFils) && quote.baseAmountFils > 0
    && Number.isSafeInteger(quote.paymentFeeFils) && quote.paymentFeeFils >= 0
    && quote.baseAmountFils + quote.paymentFeeFils === quote.amountFils
    // The signed server quote owns pricing. Do not hard-code a gateway
    // surcharge here: old and fee-free servers may coexist during rollout.
    && Math.round(quote.amountKwd * 1000) === quote.amountFils
    && quote.paymentMethod === paymentMethod
    && Number.isSafeInteger(quote.discountFils) && quote.discountFils >= 0
    && quote.product.slug === slug && quote.product.packageId === packageId;
}

const methodLabel: Record<EsimPaymentMethod, { en: string; ar: string }> = {
  knet: { en: "KNET", ar: "كي نت" },
  cc: { en: "Visa / Mastercard", ar: "فيزا / ماستركارد" },
  "apple-pay": { en: "Apple Pay", ar: "أبل باي" },
  "samsung-pay": { en: "Samsung Pay", ar: "سامسونج باي" },
};

function isPendingEsimStatus(status: string): boolean {
  return status === "payment_pending" || status === "fulfillment_pending";
}

function trustedInvoiceUrl(raw: string | null): raw is string {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && isTrustedHotelPaymentHost(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function resolveSavedCountry(value: string): EsimCountryOption | undefined {
  const normalized = value.trim().toLocaleLowerCase("en");
  if (!normalized) return undefined;
  return getEsimCountryOptions("en").find((option) =>
    option.iso.toLocaleLowerCase("en") === normalized || option.name.toLocaleLowerCase("en") === normalized,
  );
}

function parseUnambiguousProfilePhone(value: string): { iso: string; nationalNumber: string } | undefined {
  if (!/^\+\d{7,15}$/.test(value.trim())) return undefined;
  const digits = value.trim().slice(1);
  const options = getEsimCountryOptions("en");
  const dialCodes = [...new Set(options.map((option) => option.dialCode))]
    .filter((dialCode) => digits.startsWith(dialCode))
    .sort((a, b) => b.length - a.length);
  const dialCode = dialCodes[0];
  if (!dialCode) return undefined;
  const matches = options.filter((option) => option.dialCode === dialCode);
  const nationalNumber = digits.slice(dialCode.length);
  if (matches.length !== 1 || !/^\d{4,14}$/.test(nationalNumber)) return undefined;
  return { iso: matches[0].iso, nationalNumber };
}

export function ConnectedEsimCatalogScreen(props: Props) {
  const { locale } = useAppLanguage();
  const privateTestAvailable = isPrivateEsimTestEnabled(__DEV__, process.env.EXPO_PUBLIC_ESIM_PRIVATE_TEST);
  const privateCheckoutRestricted = props.privateTest === true
    || (!__DEV__ && process.env.EXPO_PUBLIC_ESIM_PRIVATE_TEST === "true");
  const privateCheckoutMessage = props.lang === "ar"
    ? "الاختبار الخاص متاح فقط لباقة Global ‏300 MB لمدة 3 أيام، دون رمز خصم، وبحد أقصى 0.321 د.ك. يمكنك اختيار أي طريقة دفع متاحة."
    : "The private test only supports Global 300 MB / 3 days, no promo code, and a maximum of 0.321 KWD. You can choose any available payment method.";
  const { isLoaded, isSignedIn, sessionId, getToken } = useAuth();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [auth, setAuth] = useState<{ session: string; token: string } | null>(null);
  const [authError, setAuthError] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [paymentStatusCheck, setPaymentStatusCheck] = useState<PaymentStatusCheck | null>(null);
  const [verificationNextCheckAt, setVerificationNextCheckAt] = useState<number | null>(null);
  const [guestVerificationActive, setGuestVerificationActive] = useState(false);
  const [guestPayment, setGuestPayment] = useState<{ confirmedAt: string; completed: boolean; review: boolean } | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [pendingLink, setPendingLink] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [checkoutItem, setCheckoutItem] = useState<{ item: EsimPackage; destination: EsimDestination } | null>(null);
  const [step, setStep] = useState<CheckoutStep>("customer");
  const [customer, setCustomer] = useState<Customer>(EMPTY_CUSTOMER);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof Customer, string>>>({});
  const [promoCode, setPromoCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<EsimPaymentMethod>("cc");
  const [emailAcknowledged, setEmailAcknowledged] = useState(false);
  const [downloadPending, setDownloadPending] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryProof, setRecoveryProof] = useState<{ email: string; code: string } | null>(null);
  const [recoveredOrders, setRecoveredOrders] = useState<EsimOrderDetailResponse[]>([]);
  const [recoveryOrderId, setRecoveryOrderId] = useState<string | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const recoveryGeneration = useRef(0);
  const paymentReturnSeqRef = useRef(props.paymentReturnSeq ?? 0);
  const paymentStatusReturnSeqRef = useRef(0);
  const reconciledReturns = useRef(new Set<string>());
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const nativePayment = useRef<{ orderId: string; sessionId: string | null | undefined } | null>(null);
  const inFlight = useRef(false);
  const quoteGate = useRef(new EsimQuoteSequence());
  const generation = useRef(0);
  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;
  const ready = isSignedIn === true && !!sessionId && auth?.session === sessionId;
  const guest = isLoaded === true && isSignedIn === false;
  const buyerMode = guest ? "guest" : ready ? "signed-in" : "blocked";
  const checkoutAuthRef = useRef({ mode: buyerMode, sessionId });
  checkoutAuthRef.current = { mode: buyerMode, sessionId };
  const accountKey = sessionId ?? "signed-out";
  const orderKey = useMemo(() => ["esim-owned-orders", accountKey], [accountKey]);
  const detailKey = useMemo(() => ["esim-owned-order", accountKey, selectedOrderId ?? ""], [accountKey, selectedOrderId]);

  const refreshToken = useCallback(async () => {
    const current = ++generation.current;
    if (isSignedIn !== true || !sessionId) {
      setAuth(null);
      setAuthError(false);
      return;
    }
    setAuth(null);
    setAuthError(false);
    try {
      const token = await requestClerkToken({ sessionId, getToken: () => getTokenRef.current() });
      if (generation.current !== current || sessionRef.current !== sessionId) return;
      setAuth(token ? { session: sessionId, token } : null);
      setAuthError(!token);
      if (token) {
        await queryClient.invalidateQueries({ queryKey: ["esim-owned-orders", sessionId] });
        await queryClient.invalidateQueries({ queryKey: ["esim-owned-order", sessionId] });
      }
    } catch {
      if (generation.current === current && sessionRef.current === sessionId) {
        setAuth(null);
        setAuthError(true);
      }
    }
  }, [isSignedIn, sessionId, queryClient]);

  useEffect(() => {
    void refreshToken();
    return () => { generation.current += 1; };
  }, [refreshToken]);

  useEffect(() => {
    recoveryGeneration.current += 1;
    setRecoveryOpen(false);
    setRecoveryProof(null);
    setRecoveredOrders([]);
    setRecoveryOrderId(null);
    setRecoveryEmail("");
    setRecoveryCode("");
    setRecoveryNotice(null);
    setRecoveryError(null);
    attempt.current = null;
    nativePayment.current = null;
    quoteGate.current.invalidate();
    setReview(null);
    setCheckoutItem(null);
    setCustomer(EMPTY_CUSTOMER);
    setSelectedOrderId(null);
    setPaymentStatusCheck(null);
    setCheckoutPending(false);
    setCheckoutError(null);
    setCheckoutNotice(null);
    setPendingLink(false);
    setEmailAcknowledged(false);
    setDownloadPending(false);
    setDownloadError(null);
    return () => {
      if (sessionId) {
        queryClient.removeQueries({ queryKey: ["esim-owned-orders", sessionId] });
        queryClient.removeQueries({ queryKey: ["esim-owned-order", sessionId] });
      }
    };
  }, [sessionId, queryClient]);

  useEffect(() => {
    quoteGate.current.invalidate();
    setCheckoutPending(false);
    setReview(null);
    attempt.current = null;
    setPendingLink(false);
  }, [props.selectedSlug]);

  useEffect(() => {
    setEmailAcknowledged(false);
  }, [review?.customer.email, props.selectedSlug]);

  const onCheckoutInputChange = () => {
    if (pendingLink) return;
    quoteGate.current.invalidate();
    if (!inFlight.current) setCheckoutPending(false);
    attempt.current = null;
    setReview(null);
    setCheckoutError(null);
    setCheckoutNotice(null);
    setEmailAcknowledged(false);
  };

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshToken();
    });
    const onWebFocus = () => { void refreshToken(); };
    if (Platform.OS === "web" && typeof window !== "undefined") window.addEventListener("focus", onWebFocus);
    return () => {
      subscription?.remove();
      if (Platform.OS === "web" && typeof window !== "undefined") window.removeEventListener("focus", onWebFocus);
    };
  }, [refreshToken]);

  useEffect(() => {
    const sequence = props.paymentReturnSeq ?? 0;
    if (sequence <= paymentReturnSeqRef.current) return;
    paymentReturnSeqRef.current = sequence;
    void refreshToken();
  }, [props.paymentReturnSeq, refreshToken]);

  useEffect(() => {
    const sequence = props.paymentReturnSeq ?? 0;
    const orderId = props.paymentReturnOrderId;
    if (sequence <= paymentStatusReturnSeqRef.current || !orderId) return;
    // Guest recovery requires its verified email-code flow. Do not fetch an
    // order detail under an anonymous identity merely because a URL has an ID.
    if (guest) {
      paymentStatusReturnSeqRef.current = sequence;
      return;
    }
    if (!ready || !sessionId) return;
    paymentStatusReturnSeqRef.current = sequence;
    setSelectedOrderId(orderId);
    setPaymentStatusCheck({ orderId, sessionId, startedAt: Date.now(), phase: "checking" });
  }, [props.paymentReturnSeq, props.paymentReturnOrderId, guest, ready, sessionId]);

  useEffect(() => {
    const orderId = props.paymentReturnOrderId;
    if (!orderId || (!guest && !ready)) return;
    const key = `${orderId}:${props.paymentReturnSeq ?? 0}`;
    if (reconciledReturns.current.has(key)) return;
    reconciledReturns.current.add(key);
    // Start verification promptly; all subsequent observation is read-only.
    // The backend's existing payment and supplier claims own fulfillment.
    void reconcileEsimReturnedPayment(orderId, ready ? { Authorization: `Bearer ${auth.token}` } : undefined).catch(() => {});
  }, [props.paymentReturnOrderId, props.paymentReturnSeq, guest, ready, auth]);

  useEffect(() => {
    const orderId = props.paymentReturnOrderId;
    if (!guest || !orderId) return;
    let active = true;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setGuestVerificationActive(true);
    setVerificationNextCheckAt(null);
    setCheckoutNotice(null);
    const foregroundTimer = setTimeout(() => setGuestVerificationActive(false), ESIM_PAYMENT_RETURN_FAST_CHECK_MS);
    const check = async () => {
      if (!active) return;
      setVerificationNextCheckAt(null);
      try {
        const returned = await getEsimPaymentReturnState(orderId);
        const status = returned.status;
        if (!active) return;
        if (returned.paymentConfirmedAt || status === "completed") {
          setGuestPayment({ confirmedAt: returned.paymentConfirmedAt ?? new Date().toISOString(),
            completed: status === "completed", review: status === "pending_review" });
        }
        const messages = {
          completed: ["Your eSIM is ready. Check your email for the invoice, QR and installation instructions.", "شريحتك جاهزة. تحقق من بريدك الإلكتروني للحصول على الفاتورة ورمز QR وتعليمات التثبيت."],
          pending_review: ["Your eSIM order needs review because payment or supplier fulfillment could not be fully confirmed. Do not pay again. Contact the eSIM team about this same order.", "طلب الشريحة يحتاج إلى مراجعة لأن الدفع أو تسليم المورد لم يُؤكّد بالكامل. لا تدفع مرة أخرى. تواصل مع فريق الشرائح بشأن الطلب نفسه."],
          payment_pending: ["Payment is still being checked for this same order. Do not pay again.", "جارٍ التحقق من الدفع للطلب نفسه. لا تدفع مرة أخرى."],
          fulfillment_pending: ["We are confirming your eSIM with the supplier. Your QR will be emailed once ready. Do not pay again.", "جارٍ تأكيد الشريحة مع المورد. سنرسل رمز QR إلى بريدك عند جاهزيته. لا تدفع مرة أخرى."],
          payment_failed: ["Payment was not confirmed. If your bank shows a charge, contact us before retrying.", "لم يُؤكّد الدفع. إذا ظهر خصم في حسابك البنكي فتواصل معنا قبل إعادة المحاولة."],
        };
        setCheckoutNotice(messages[status][props.lang === "ar" ? 1 : 0]);
        if (isEsimOrderStatusTerminal(status)) {
          active = false;
          clearTimeout(deadlineTimer);
          setGuestVerificationActive(false);
          return;
        }
      } catch {
        if (!active) return;
        setCheckoutNotice(props.lang === "ar"
          ? "تعذر التحقق من حالة الطلب الآن. لا تدفع مرة أخرى؛ تحقق من البريد أو تواصل معنا بشأن الطلب نفسه."
          : "Order status could not be verified yet. Do not pay again; check your email or contact us about this same order.");
      }
      if (active && Date.now() - startedAt < 10 * 60_000) {
        setVerificationNextCheckAt(Date.now() + 15_000);
        timer = setTimeout(check, 15_000);
      } else if (active) {
        setGuestVerificationActive(false);
        setCheckoutNotice(props.lang === "ar"
          ? "استغرق التأكيد وقتاً أطول. تحقق من بريدك أو استرجع الطلب ببريد الشراء؛ لا تدفع مرة أخرى."
          : "Confirmation is taking longer. Check your email or recover this order with your purchase email; do not pay again.");
      }
    };
    // Stop the waiting state even if a status request never settles.
    const deadlineTimer = setTimeout(() => {
      if (!active) return;
      active = false;
      if (timer) clearTimeout(timer);
      setGuestVerificationActive(false);
      setVerificationNextCheckAt(null);
      setCheckoutNotice(props.lang === "ar"
        ? "استغرق التأكيد وقتاً أطول. تحقق من بريدك أو استرجع الطلب ببريد الشراء؛ لا تدفع مرة أخرى."
        : "Confirmation is taking longer. Check your email or recover this order with your purchase email; do not pay again.");
    }, ESIM_PAYMENT_RETURN_BACKGROUND_CHECKS * ESIM_PAYMENT_RETURN_BACKGROUND_INTERVAL_MS);
    void check();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      clearTimeout(deadlineTimer);
      clearTimeout(foregroundTimer);
      setGuestVerificationActive(false);
      setVerificationNextCheckAt(null);
      setGuestPayment(null);
    };
  }, [guest, props.paymentReturnOrderId, props.paymentReturnSeq, props.lang]);

  useEffect(() => {
    const launch = nativePayment.current;
    if (!launch || launch.orderId !== props.paymentReturnOrderId || launch.sessionId !== sessionId) return;
    // The Linking callback can arrive before openAuthSessionAsync resolves.
    // Close only this buyer's original checkout, not a newer buyer's form.
    nativePayment.current = null;
    quoteGate.current.invalidate();
    attempt.current = null;
    setReview(null);
    setCheckoutItem(null);
    setCheckoutPending(false);
    setPendingLink(false);
    setEmailAcknowledged(false);
    setCheckoutError(null);
  }, [props.paymentReturnOrderId, props.paymentReturnSeq, sessionId]);

  const headers = ready ? { Authorization: `Bearer ${auth.token}` } : undefined;
  const billing = useGetMyEsimBillingProfile({
    query: { enabled: ready, queryKey: ["esim-billing-profile", accountKey] },
    request: { headers },
  });
  const orders = useListMyEsimOrders({
    query: { enabled: ready, queryKey: orderKey, refetchOnWindowFocus: true },
    request: { headers },
  });
  const appliedInitialOrder = useRef<string | null>(null);
  useEffect(() => {
    if (ready && props.initialOrderId && appliedInitialOrder.current !== props.initialOrderId) {
      appliedInitialOrder.current = props.initialOrderId;
      setSelectedOrderId(props.initialOrderId);
    }
  }, [ready, props.initialOrderId]);

  const detail = useGetMyEsimOrder(selectedOrderId ?? "", {
    query: { enabled: ready && !!selectedOrderId, queryKey: detailKey, refetchOnWindowFocus: true },
    request: { headers },
  });
  const orderDetailQueryRef = useRef(detail);
  orderDetailQueryRef.current = detail;
  const create = useCreateEsimOrder({ request: { headers: {
    ...headers,
    "X-DT-Checkout-Surface": Platform.OS === "web" ? "webapp" : "native",
    "X-DT-Language": props.lang,
  } } });
  const quotePackage = useQuoteEsimPackage({ request: { headers } });
  const sendRecoveryCode = useSendEsimGuestRecoveryCode();
  const recoverOrders = useRecoverEsimGuestOrders();
  const ownedOrders = useMemo(() => ready ? (orders.data?.orders ?? []).map(orderForDisplay) : undefined, [ready, orders.data?.orders]);
  const ownedDetail = useMemo(() => {
    const item = detail.data;
    if (!ready || !selectedOrderId || !item || item.orderId !== selectedOrderId) return null;
    return {
      ...orderForDisplay(item),
      activationInstructions: item.status === "completed" ? activationForDisplay(item.activation) : null,
    };
  }, [ready, selectedOrderId, detail.data]);
  const paymentStatusMessage = paymentStatusCheck?.orderId === selectedOrderId
    && ready
    && paymentStatusCheck.sessionId === sessionId
    && (!ownedDetail || isPendingEsimStatus(ownedDetail.status))
    && !ownedDetail?.paymentConfirmedAt
    ? paymentStatusCheck.phase === "checking"
      ? props.lang === "ar"
        ? "نتحقق من الدفع وطلب الشريحة. يرجى عدم الدفع مرة أخرى."
        : "Checking this payment and eSIM order. Please don't pay again."
      : paymentStatusCheck.phase === "waiting"
        ? props.lang === "ar"
          ? "يستغرق تحديث هذا الطلب وقتاً أطول. سنواصل التحقق من الطلب نفسه؛ لا تدفع مرة أخرى."
          : "This order is taking longer to update. We'll keep checking this same order; please don't pay again."
        : props.lang === "ar"
          ? "لم نتمكن من تأكيد تحديث الحالة بعد. ارجع إلى هذا الطلب لاحقاً، ولا تدفع مرة أخرى."
          : "We couldn't verify an update yet. Check this same order again later; please don't pay again."
    : null;

  useEffect(() => {
    if (!paymentStatusCheck || ownedDetail?.id !== paymentStatusCheck.orderId) return;
    if (!isEsimOrderStatusTerminal(ownedDetail.status)) return;
    if (ownedDetail.status === "completed") {
      void queryClient.invalidateQueries({ queryKey: orderKey });
    }
    setPaymentStatusCheck((current) => current?.orderId === paymentStatusCheck.orderId ? null : current);
  }, [paymentStatusCheck?.orderId, ownedDetail?.id, ownedDetail?.status, queryClient, orderKey]);

  useEffect(() => {
    const check = paymentStatusCheck;
    if (
      !check
      || !ready
      || !sessionId
      || sessionId !== check.sessionId
      || selectedOrderId !== check.orderId
    ) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let phaseTimer: ReturnType<typeof setTimeout> | undefined;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    let backgroundChecks = 0;
    const poll = async () => {
      if (!active) return;
      setVerificationNextCheckAt(null);
      try {
        // This is a read-only GET for the callback's exact order ID. Never
        // recreate the checkout or supplier order while payment settles.
        const result = await orderDetailQueryRef.current.refetch();
        if (!active || sessionRef.current !== check.sessionId) return;
        const status = result.data?.status ?? orderDetailQueryRef.current.data?.status;
        if (isEsimOrderStatusTerminal(status)) {
          if (status === "completed") {
            void queryClient.invalidateQueries({ queryKey: orderKey });
          }
          setPaymentStatusCheck((current) => current?.orderId === check.orderId ? null : current);
          return;
        }
        const elapsed = Date.now() - check.startedAt;
        const delay = nextEsimOrderStatusPollDelay(elapsed, status, backgroundChecks);
        if (delay === null) {
          setPaymentStatusCheck((current) => current?.orderId === check.orderId
            ? isEsimOrderStatusTerminal(status) ? null : { ...current, phase: "paused" }
            : current);
          return;
        }
        if (elapsed >= ESIM_PAYMENT_RETURN_FAST_CHECK_MS) backgroundChecks += 1;
        setVerificationNextCheckAt(Date.now() + delay);
        timer = setTimeout(() => { void poll(); }, delay);
      } catch {
        if (!active || sessionRef.current !== check.sessionId) return;
        const delay = nextEsimOrderStatusPollDelay(Date.now() - check.startedAt, undefined, backgroundChecks);
        if (delay === null) {
          setPaymentStatusCheck((current) => current?.orderId === check.orderId
            ? { ...current, phase: "paused" }
            : current);
          return;
        }
        setVerificationNextCheckAt(Date.now() + delay);
        timer = setTimeout(() => { void poll(); }, delay);
      }
    };

    setVerificationNextCheckAt(Date.now() + ESIM_PAYMENT_RETURN_POLL_INTERVAL_MS);
    timer = setTimeout(() => { void poll(); }, ESIM_PAYMENT_RETURN_POLL_INTERVAL_MS);
    deadlineTimer = setTimeout(() => {
      if (!active || sessionRef.current !== check.sessionId) return;
      active = false;
      if (timer) clearTimeout(timer);
      if (phaseTimer) clearTimeout(phaseTimer);
      setVerificationNextCheckAt(null);
      setPaymentStatusCheck((current) => current?.orderId === check.orderId
        ? { ...current, phase: "paused" } : current);
    }, ESIM_PAYMENT_RETURN_FAST_CHECK_MS + ESIM_PAYMENT_RETURN_BACKGROUND_CHECKS * ESIM_PAYMENT_RETURN_BACKGROUND_INTERVAL_MS);
    phaseTimer = setTimeout(() => {
      if (!active || sessionRef.current !== check.sessionId) return;
      setPaymentStatusCheck((current) => current?.orderId === check.orderId
        ? { ...current, phase: "waiting" }
        : current);
    }, Math.max(0, ESIM_PAYMENT_RETURN_FAST_CHECK_MS - (Date.now() - check.startedAt)));
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      if (phaseTimer) clearTimeout(phaseTimer);
      if (deadlineTimer) clearTimeout(deadlineTimer);
    };
  }, [
    paymentStatusCheck?.orderId,
    paymentStatusCheck?.sessionId,
    paymentStatusCheck?.startedAt,
    selectedOrderId,
    ready,
    sessionId,
    queryClient,
    orderKey,
  ]);

  const onBuy = (item: EsimPackage, destination: EsimDestination) => {
    if (item.isInStock === false) return;
    if (privateCheckoutRestricted && !isPrivateEsimTrialPackage(destination.slug, item.id)) {
      setCheckoutError(privateCheckoutMessage);
      return;
    }
    setCheckoutError(null);
    setCheckoutNotice(null);
    setEmailAcknowledged(false);
    const saved = ready ? billing.data?.profile : null;
    const savedBilling = parseBilling(saved?.billingAddress);
    const savedCountry = resolveSavedCountry(savedBilling.country);
    const savedPhone = parseUnambiguousProfilePhone(textField(saved, "customerMobile"));
    const savedCountryForLocale = savedCountry && getEsimCountryOptions(props.lang).find((option) => option.iso === savedCountry.iso);
    setCustomer({
      firstName: saved?.firstName || user?.firstName || "",
      // Never derive a family name from a display/full name or an email.
      lastName: saved?.lastName || user?.lastName || "",
      email: saved?.email || user?.primaryEmailAddress?.emailAddress || "",
      phoneNumber: savedPhone?.nationalNumber || "",
      country: savedCountryForLocale?.name || "",
      countryIso: savedCountry?.iso || "",
      phoneDialCountryIso: savedPhone?.iso || "KW",
    });
    setFormErrors({});
    setPromoCode("");
    setPaymentMethod("cc");
    setCheckoutItem({ item, destination });
    setStep("customer");
  };

  const selectOwnedOrder = (orderId: string | null) => {
    setSelectedOrderId(orderId);
    if (orderId !== paymentStatusCheck?.orderId) {
      const selectedSummary = ownedOrders?.find((order) => order.id === orderId);
      setPaymentStatusCheck(
        ready && sessionId && selectedSummary && isPendingEsimStatus(selectedSummary.status)
          ? { orderId: selectedSummary.id, sessionId, startedAt: Date.now(), phase: "checking" }
          : null,
      );
    }
  };

  const closeCheckout = () => {
    if (inFlight.current || pendingLink) return;
    quoteGate.current.invalidate();
    setCheckoutPending(false);
    setCheckoutItem(null);
    setReview(null);
    setEmailAcknowledged(false);
    setCheckoutError(null);
  };

  const updateCustomer = (field: keyof Customer, value: string) => {
    setCustomer((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    onCheckoutInputChange();
  };

  const selectBillingCountry = (option: EsimCountryOption) => {
    setCustomer((current) => ({ ...current, country: option.name, countryIso: option.iso }));
    setFormErrors((current) => ({ ...current, country: undefined }));
    onCheckoutInputChange();
  };

  const selectPhoneDialCountry = (option: EsimCountryOption) => {
    setCustomer((current) => ({ ...current, phoneDialCountryIso: option.iso }));
    setFormErrors((current) => ({ ...current, phoneNumber: undefined }));
    onCheckoutInputChange();
  };

  const proceedToPayment = () => {
    const errors: Partial<Record<keyof Customer, string>> = {};
    if (!customer.firstName.trim() || customer.firstName.trim().length > 80) errors.firstName = "Required (80 characters maximum)";
    if (!customer.lastName.trim() || customer.lastName.trim().length > 80) errors.lastName = "Required (80 characters maximum)";
    if (customer.email.trim().length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email.trim())) errors.email = "Enter a valid email";
    if (!customer.country.trim() || !customer.countryIso) errors.country = "Required";
    const dialCountry = getEsimCountryOptions(props.lang).find((option) => option.iso === customer.phoneDialCountryIso);
    if (!dialCountry || !isValidE164(dialCountry.dialCode, customer.phoneNumber)) errors.phoneNumber = "Enter a valid phone number";
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    setStep("payment");
  };

  const requestQuote = async () => {
    if (!checkoutItem || inFlight.current) return;
    if (buyerMode === "blocked") {
      setCheckoutError(props.lang === "ar" ? "ننتظر تأكيد تسجيل الدخول. أعد محاولة الاتصال قبل المتابعة." : "Waiting for your sign-in to finish. Retry connection before continuing.");
      return;
    }
    const { item, destination } = checkoutItem;
    if (privateCheckoutRestricted
      && (!isPrivateEsimTrialPackage(destination.slug, item.id) || promoCode !== "")) {
      setCheckoutError(privateCheckoutMessage);
      return;
    }
    setCheckoutError(null);
    setCheckoutNotice(null);
    setReview(null);
    setEmailAcknowledged(false);
    const current = quoteGate.current.begin();
    if (current === null) return;
    const buyerSession = sessionId;
    const quotedMode = buyerMode;
    setCheckoutPending(true);
    try {
      const authoritative = await quotePackage.mutateAsync({
         data: { slug: destination.slug, packageId: item.id, paymentMethod, ...(promoCode ? { promoCode: promoCode.toUpperCase() } : {}) },
      });
      if (sessionRef.current !== buyerSession || checkoutAuthRef.current.mode !== quotedMode || !quoteGate.current.isCurrent(current)) return;
       if (!validQuote(authoritative, destination.slug, item.id, paymentMethod)) throw new Error("Invalid quote");
       if (privateCheckoutRestricted
         && !isPrivateEsimTrialQuote(destination.slug, item.id, paymentMethod, promoCode, authoritative.amountFils)) {
         setCheckoutError(privateCheckoutMessage);
         return;
       }
        setReview({ item, destination, promoCode: promoCode.toUpperCase(), paymentMethod, customer: {
         firstName: customer.firstName.trim(), lastName: customer.lastName.trim(),
           email: customer.email.trim(), phoneNumber: normalizeNationalPhone(customer.phoneNumber),
           country: customer.country.trim(), countryIso: customer.countryIso,
           phoneDialCountryIso: customer.phoneDialCountryIso,
       }, quote: authoritative, changed: false });
    } catch (error) {
      if (sessionRef.current === buyerSession && checkoutAuthRef.current.mode === quotedMode && quoteGate.current.isCurrent(current)) {
        const outOfStock = typeof error === "object" && error !== null && "status" in error && error.status === 409;
        setCheckoutError(outOfStock
          ? (props.lang === "ar" ? "نفدت هذه الشريحة. اختر باقة أخرى؛ لم يتم إنشاء دفعة." : "This eSIM is out of stock. Choose another plan; no payment was created.")
          : (props.lang === "ar" ? "تعذر عرض السعر النهائي. حاول مجدداً." : "Couldn't get a final price. Please try again."));
      }
    } finally {
      if (quoteGate.current.finish(current)) {
        if (sessionRef.current === buyerSession) setCheckoutPending(false);
      }
    }
  };

  const closeReview = () => {
    if (inFlight.current || pendingLink) return;
    quoteGate.current.invalidate();
    setReview(null);
    setEmailAcknowledged(false);
  };

  const confirmOrder = async () => {
    if (!review || review.blocked || inFlight.current || props.selectedSlug !== review.destination.slug) return;
    if (!emailAcknowledged) {
      setCheckoutError(props.lang === "ar" ? "يرجى تأكيد أن عنوان البريد الإلكتروني صحيح قبل المتابعة." : "Confirm that your email address is correct before continuing.");
      return;
    }
    if (buyerMode === "blocked") {
      setCheckoutError(props.lang === "ar" ? "ننتظر تأكيد تسجيل الدخول. أعد محاولة الاتصال قبل المتابعة." : "Waiting for your sign-in to finish. Retry connection before continuing.");
      return;
    }
    const current = quoteGate.current.sequence;
    const buyerSession = sessionId;
    const confirmedMode = buyerMode;
    const { item, destination, promoCode, paymentMethod, quote, customer: buyer } = review;
    if (privateCheckoutRestricted
      && !isPrivateEsimTrialQuote(destination.slug, item.id, paymentMethod, promoCode, quote.amountFils)) {
      setCheckoutError(privateCheckoutMessage);
      return;
    }
    if (!validQuote(quote, destination.slug, item.id, paymentMethod)) return;
    const fingerprint = JSON.stringify([buyerSession, destination.slug, item.id, promoCode, paymentMethod, buyer]);
    const dialCountry = getEsimCountryOptions(props.lang).find((option) => option.iso === buyer.phoneDialCountryIso);
    if (!dialCountry || !isValidE164(dialCountry.dialCode, buyer.phoneNumber)) return;
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { fingerprint, key: `esim_${Crypto.randomUUID()}` };
    }
    inFlight.current = true;
    setCheckoutPending(true);
    setCheckoutError(null);
    try {
      const result = await create.mutateAsync({
        data: {
            slug: destination.slug, packageId: item.id, paymentMethod, expectedAmountFils: quote.amountFils,
            firstName: buyer.firstName, lastName: buyer.lastName, email: buyer.email,
            customerMobile: `+${dialCountry.dialCode}${normalizeNationalPhone(buyer.phoneNumber)}`,
            billingAddress: serializeBilling(buyer),
          requestKey: attempt.current.key, ...(promoCode ? { promoCode } : {}),
           emailAcknowledged: true,
        },
      });
      if (sessionRef.current !== buyerSession || checkoutAuthRef.current.mode !== confirmedMode || !quoteGate.current.isCurrent(current)) return;
      if (Math.round(result.order.amountKwd * 1000) !== quote.amountFils) {
        // A prior idempotent invoice may have a different frozen amount. Never open it as this quote.
        setEmailAcknowledged(false);
          setReview({ item, destination, promoCode, paymentMethod, customer: buyer, quote, changed: false, blocked: true });
        setCheckoutError(props.lang === "ar"
          ? "يوجد طلب سابق بسعر مختلف. راجعه في شرائحي، ثم أكّد السعر الحالي مجدداً إن رغبت."
          : "A previous order has a different price. Check My eSIMs, then confirm this price again if you wish.");
         if (ready) void queryClient.invalidateQueries({ queryKey: orderKey });
        return;
      }
      if (result.paymentUrl === null) {
        // A charge claim may still be in progress. Never replace this requestKey or lose the form.
        setPendingLink(true);
        setCheckoutError(props.lang === "ar"
          ? "رابط الدفع قيد التجهيز. أعد المحاولة هنا بنفس الطلب؛ لا تنشئ طلباً جديداً."
          : "Your secure payment link is still being prepared. Retry here; we will use the same order, not create another.");
        return;
      }
      if (!trustedInvoiceUrl(result.paymentUrl)) {
        setCheckoutError(props.lang === "ar" ? "رابط الدفع غير آمن. أعد المحاولة بنفس الطلب." : "Secure payment link unavailable. Retry this same order.");
        return;
      }
      try {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.location.assign(result.paymentUrl);
        } else {
          // Use a secure in-app browser session, not the standalone browser.
          // The server returns native checkouts to our registered app callback.
          nativePayment.current = { orderId: result.order.orderId.toUpperCase(), sessionId: buyerSession };
          const browserResult = await WebBrowser.openAuthSessionAsync(result.paymentUrl, ESIM_PAYMENT_APP_RETURN_URL);
          if (sessionRef.current !== buyerSession || checkoutAuthRef.current.mode !== confirmedMode || !quoteGate.current.isCurrent(current)) return;
          const returnedOrder = browserResult.type === "success" ? parseEsimPaymentReturnUrl(browserResult.url) : null;
          if (!returnedOrder || returnedOrder.orderId !== result.order.orderId.toUpperCase()) {
            // Dismissing a browser is not proof that payment failed. Preserve
            // the original request key so reopening cannot create a new charge.
            setPendingLink(true);
            setCheckoutError(props.lang === "ar"
              ? "أُغلقت نافذة الدفع. لم يُلغَ الطلب؛ يمكنك استئناف الدفع بنفس الطلب. لا تدفع مرة أخرى إذا خُصم المبلغ."
              : "Payment window closed. The order was not cancelled; resume this same order. Do not pay again if you were charged.");
            return;
          }
        }
        if (sessionRef.current !== buyerSession || checkoutAuthRef.current.mode !== confirmedMode || !quoteGate.current.isCurrent(current)) return;
        attempt.current = null;
        setPendingLink(false);
        setReview(null);
        setCheckoutItem(null);
        quoteGate.current.invalidate();
        if (ready) void queryClient.invalidateQueries({ queryKey: orderKey });
         setCheckoutNotice(props.lang === "ar" ? "تم فتح صفحة الدفع. تحقق من بريدك الإلكتروني للحصول على تأكيد الطلب وتعليمات الشريحة بعد الدفع." : "Payment page opened. Check your email for your order confirmation and eSIM instructions after payment is confirmed.");
      } catch {
         setCheckoutError(props.lang === "ar" ? "تعذر فتح صفحة الدفع. أعد المحاولة بنفس الطلب." : "Couldn't open the payment page. Retry this same order.");
      }
    } catch (error) {
      if (sessionRef.current !== buyerSession || checkoutAuthRef.current.mode !== confirmedMode || !quoteGate.current.isCurrent(current)) return;
      if (
        (error as { status?: number })?.status === 409
        && (error as { data?: { error?: unknown } })?.data?.error === "Private trial order already exists with different customer details"
      ) {
        setCheckoutError(props.lang === "ar"
          ? "يوجد طلب تجريبي بهذه الباقة ببيانات مختلفة. استخدم البيانات الأصلية أو تواصل معنا؛ لا تكرر الدفع."
          : "A private test order already exists with different details. Use the original details or contact us; do not pay twice.");
        setReview({ ...review, blocked: true });
      } else if (
        (error as { status?: number })?.status === 409
        && (error as { data?: { error?: unknown } })?.data?.error === "The eSIM price changed. Review the latest quote before confirming checkout."
      ) {
        // No charge was made. Drop the old idempotency key and require an entirely new confirmation.
        attempt.current = null;
        setReview(null);
        setEmailAcknowledged(false);
        try {
          const updated = await quotePackage.mutateAsync({
             data: { slug: destination.slug, packageId: item.id, paymentMethod, ...(promoCode ? { promoCode } : {}) },
          });
          if (sessionRef.current !== buyerSession || !quoteGate.current.isCurrent(current)) return;
           if (!validQuote(updated, destination.slug, item.id, paymentMethod)) throw new Error("Invalid quote");
            setReview({ item, destination, promoCode, paymentMethod, customer: buyer, quote: updated, changed: true });
        } catch {
          if (sessionRef.current === buyerSession && quoteGate.current.isCurrent(current)) {
            setCheckoutError(props.lang === "ar" ? "تغير السعر وتعذر تحديثه. حاول مجدداً." : "The price changed and couldn't be refreshed. Please try again.");
          }
        }
      } else if ((error as { status?: number })?.status === 409) {
        // A conflict is not necessarily a price change: an existing invoice may
        // already be payable. Preserve the attempt and never automatically requote.
        setReview({ ...review, blocked: true });
        const unavailable = (error as { data?: { error?: unknown } })?.data?.error === "The selected eSIM package is temporarily out of stock";
        setCheckoutError(unavailable
          ? props.lang === "ar"
            ? "هذه الباقة غير متاحة حالياً. لا توجد حاجة لإعادة تأكيد السعر؛ تواصل معنا إذا سبق أن بدأت الدفع."
            : "This plan is currently unavailable. Contact us if you already started a payment."
          : props.lang === "ar"
            ? "لا يمكن متابعة هذا الطلب. قد يوجد رابط دفع سابق ببيانات أو طريقة دفع مختلفة. تواصل معنا لمراجعته؛ لا تبدأ دفعة أخرى."
            : "This checkout cannot continue. An earlier payment link may use different details or a different payment method. Contact us to review it; do not start another payment.");
      } else if ((error as { status?: number })?.status === 403) {
        setCheckoutError(props.lang === "ar" ? "هذه الباقة أو هذا الحساب غير متاح للشراء التجريبي. لم يُنشأ رابط دفع." : "This plan or account isn't enabled for the private test. No payment link was created.");
      } else if (
        (error as { status?: number })?.status === 503
        && (error as { data?: { error?: unknown } })?.data?.error === "New eSIM purchases are not available yet"
      ) {
        setCheckoutError(privateTestAvailable
          ? props.lang === "ar"
            ? "الشراء التجريبي غير متاح الآن. لم يُنشأ رابط دفع."
            : "Private checkout is not available yet. No payment link was created."
          : props.lang === "ar"
            ? "شراء الشرائح غير متاح بعد. لم يُنشأ رابط دفع."
            : "eSIM purchases aren't open yet. No payment link was created.");
      } else {
        setCheckoutError(props.lang === "ar" ? "تعذر تجهيز الدفع. حاول مجدداً؛ لن ينشأ طلب مكرر." : "Couldn't prepare checkout. Try again; the same attempt will not create a duplicate order.");
      }
    } finally {
      inFlight.current = false;
      if (sessionRef.current === buyerSession && quoteGate.current.isCurrent(current)) setCheckoutPending(false);
    }
  };

  const downloadOrder = async (id: string) => {
    const guestDownload = recoveryOpen && guest && recoveryProof && recoveryOrderId === id
      && recoveredOrders.some((row) => row.orderId === id && row.status === "completed");
    if ((!guestDownload && (!ready || selectedOrderId !== id || ownedDetail?.status !== "completed")) || downloadPending) return;
    setDownloadPending(true);
    setDownloadError(null);
    const buyerSession = sessionId;
    const recoveryAttempt = recoveryGeneration.current;
    const stillCurrent = () => sessionRef.current === buyerSession && (!guestDownload || recoveryGeneration.current === recoveryAttempt);
    let temporaryFile: File | null = null;
    let handedToSharing = false;
    try {
      const pdf = (guestDownload
        ? await downloadEsimGuestDocument({ ...recoveryProof!, orderId: id }, { headers: { Accept: "application/pdf", "Accept-Language": getAppLocale() }, responseType: "arrayBuffer" })
        : await downloadMyEsimDocument(id, { headers: { Authorization: `Bearer ${auth!.token}`, Accept: "application/pdf", "Accept-Language": getAppLocale() }, responseType: "arrayBuffer" })) as unknown as ArrayBuffer;
      if (!stillCurrent()) return;
      const bytes = new Uint8Array(pdf);
      if (bytes.length < 5 || String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") throw new Error("Invalid PDF document");
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `esim-${id.replace(/[^a-zA-Z0-9_-]/g, "")}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        if (!(await Sharing.isAvailableAsync())) throw new Error("Document sharing unavailable");
        // Share only the verified PDF bytes from the private authenticated response.
        temporaryFile = new File(Paths.cache, `esim-${id.replace(/[^a-zA-Z0-9_-]/g, "")}-${Crypto.randomUUID()}.pdf`);
        temporaryFile.write(bytes);
        if (!stillCurrent()) return;
        // Chooser completion does not acknowledge that the receiver read/saved
        // its content URI. Keep handed-off files in private cache, even on an
        // ambiguous error or cancellation; a saved copy is needed long term.
        handedToSharing = true;
        await Sharing.shareAsync(temporaryFile.uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          dialogTitle: "Save eSIM installation document",
        });
      }
    } catch {
      if (stillCurrent()) setDownloadError(props.lang === "ar" ? "تعذر تجهيز مستند الشريحة. حاول مجدداً." : "Couldn't prepare your eSIM document. Please try again.");
    } finally {
      if (temporaryFile && !handedToSharing) {
        try { if (temporaryFile.exists) temporaryFile.delete(); } catch { /* OS may already have moved the shared file. */ }
      }
      if (stillCurrent()) setDownloadPending(false);
    }
  };

  const closeRecovery = () => {
    recoveryGeneration.current += 1;
    setRecoveryPending(false);
    setDownloadPending(false);
    setRecoveryOpen(false);
    setRecoveryEmail("");
    setRecoveryCode("");
    setRecoveryProof(null);
    setRecoveredOrders([]);
    setRecoveryOrderId(null);
    setRecoveryNotice(null);
    setRecoveryError(null);
    setDownloadError(null);
  };

  const requestRecoveryCode = async () => {
    if (recoveryPending) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recoveryEmail.trim()) || recoveryEmail.trim().length > 254) {
      setRecoveryError(props.lang === "ar" ? "أدخل بريداً إلكترونياً صحيحاً." : "Enter a valid email address.");
      return;
    }
    setRecoveryPending(true);
    setRecoveryError(null);
    const current = recoveryGeneration.current;
    try {
      await sendRecoveryCode.mutateAsync({ data: { email: recoveryEmail.trim() } });
      if (current !== recoveryGeneration.current) return;
      setRecoveryNotice(props.lang === "ar" ? "إذا كان لديك طلب مكتمل كزائر بهذا البريد، سيصلك رمز الاستعادة." : "If you have a completed guest order at this address, we'll email you a recovery code.");
    } catch {
      if (current === recoveryGeneration.current) setRecoveryError(props.lang === "ar" ? "تعذر إرسال الرمز الآن. حاول لاحقاً." : "Couldn't send the code right now. Try again later.");
    } finally {
      if (current === recoveryGeneration.current) setRecoveryPending(false);
    }
  };

  const verifyRecovery = async () => {
    if (recoveryPending) return;
    setRecoveryPending(true);
    setRecoveryError(null);
    const current = recoveryGeneration.current;
    try {
      const proof = { email: recoveryEmail.trim(), code: recoveryCode.trim().toUpperCase() };
      const result = await recoverOrders.mutateAsync({ data: proof });
      if (current !== recoveryGeneration.current) return;
      setRecoveryProof(proof);
      setRecoveredOrders(result.orders);
      setRecoveryOrderId(null);
    } catch {
      if (current !== recoveryGeneration.current) return;
      setRecoveryProof(null);
      setRecoveredOrders([]);
      setRecoveryError(props.lang === "ar" ? "الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزاً جديداً." : "Invalid or expired code. Request a new one.");
    } finally {
      if (current === recoveryGeneration.current) setRecoveryPending(false);
    }
  };

  useEffect(() => {
    if (!recoveryOpen || !recoveryProof || !guest
      || !recoveredOrders.some((row) => row.status !== "completed")) return;
    let active = true;
    const current = recoveryGeneration.current;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const result = await recoverOrders.mutateAsync({ data: recoveryProof });
        if (!active || current !== recoveryGeneration.current) return;
        setRecoveredOrders(result.orders);
        if (result.orders.some((row) => row.status !== "completed")) timer = setTimeout(refresh, 60_000);
      } catch {
        if (!active || current !== recoveryGeneration.current) return;
        setRecoveryError(props.lang === "ar" ? "تعذر تحديث حالة الطلب. استخدم رمزاً جديداً للتحقق مجدداً؛ لا تدفع مرة أخرى." : "Could not refresh the order. Use a new code to check again; do not pay again.");
      }
    };
    // Respect the shared email-proof rate limit and stop on expiry or closing.
    timer = setTimeout(refresh, 60_000);
    return () => { active = false; clearTimeout(timer); };
  }, [recoveryOpen, recoveryProof, guest, props.lang]);

  return <>
    <EsimCatalogScreen
    {...props}
    paymentReturnSeq={props.paymentReturnOrderId ? props.paymentReturnSeq : undefined}
    signedIn={ready}
    paymentStatusOrderId={paymentStatusCheck?.orderId}
    paymentStatusMessage={paymentStatusMessage}
    verificationActive={guest ? guestVerificationActive && !guestPayment : !!paymentStatusMessage && paymentStatusCheck?.phase === "checking"}
    verificationNextCheckAt={verificationNextCheckAt}
    paymentReturnNotice={guest && !guestPayment && props.paymentReturnOrderId && !guestVerificationActive ? checkoutNotice : null}
    paymentSuccess={props.paymentReturnOrderId && (guest ? guestPayment : ownedDetail?.id === props.paymentReturnOrderId
      && (ownedDetail.paymentConfirmedAt || ownedDetail.status === "completed"))
      ? { noticeKey: `${props.paymentReturnOrderId}:${props.paymentReturnSeq ?? 0}`,
          ...(guest ? guestPayment! : { confirmedAt: ownedDetail!.paymentConfirmedAt ?? new Date().toISOString(),
            completed: ownedDetail!.status === "completed", review: ownedDetail!.status === "pending_review" }) } : null}
    paymentReturnRecovery={props.paymentReturnRecovery}
    onRecoverGuest={guest ? () => setRecoveryOpen(true) : undefined}
    onBuy={onBuy}
    onCheckoutInputChange={onCheckoutInputChange}
    checkoutPending={checkoutPending}
    checkoutError={checkoutError}
    checkoutNotice={guest && props.paymentReturnOrderId ? null : checkoutNotice}
    ownedOrders={ownedOrders}
    ownedOrdersStatus={isSignedIn !== true || authError ? "unavailable" : !ready || orders.isPending ? "loading" : orders.isError ? "error" : "ready"}
    onRetryOwnedOrders={() => { void refreshToken(); void orders.refetch(); }}
    selectedOwnedOrderId={selectedOrderId}
    onSelectOwnedOrder={selectOwnedOrder}
    ownedOrderDetail={ownedDetail}
    ownedDetailStatus={!ready || detail.isPending ? "loading" : detail.isError ? "error" : "ready"}
    onRetryOwnedDetail={() => { void refreshToken(); void detail.refetch(); }}
    onDownloadOwnedOrder={downloadOrder}
    downloadPending={downloadPending}
    downloadError={downloadError}
    />
    <Modal visible={recoveryOpen && guest} animationType="slide" onRequestClose={closeRecovery}>
      <View style={[modalStyles.fullScreen, { paddingTop: Math.max(insets.top, 18) }]}>
        <View style={modalStyles.formHeader}>
          <Text style={modalStyles.headerTitle}>{props.lang === "ar" ? "استعادة شريحة eSIM" : "Recover your eSIM"}</Text>
          <Pressable testID="esim-recovery-close" accessibilityRole="button" accessibilityLabel="Close recovery" onPress={closeRecovery} style={modalStyles.headerBack}><EsimIcon name="close" size={22} color={BLUE_LIGHT} /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[modalStyles.formContent, { paddingBottom: Math.max(insets.bottom, 24) + 30 }]}>
          <Text style={modalStyles.formSubtitle}>{props.lang === "ar" ? "أدخل البريد الذي استخدمته للشراء كزائر. سنرسل رمزاً للتحقق قبل عرض تفاصيل الشريحة." : "Enter the email used at guest checkout. We'll send a code before showing your eSIM details."}</Text>
          {!recoveryProof ? <>
            <Text style={modalStyles.fieldLabel}>{props.lang === "ar" ? "بريد الشراء" : "Purchase email"}</Text>
            <TextInput testID="esim-recovery-email" accessibilityLabel="Purchase email" value={recoveryEmail} onChangeText={(value) => { setRecoveryEmail(value); setRecoveryCode(""); setRecoveryNotice(null); setRecoveryError(null); }} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" maxLength={254} style={modalStyles.fieldInput} />
            <Pressable testID="esim-recovery-send" accessibilityRole="button" disabled={recoveryPending} onPress={() => void requestRecoveryCode()} style={[modalStyles.retryAuth, recoveryPending && modalStyles.disabled]}><Text style={modalStyles.retryAuthText}>{props.lang === "ar" ? "أرسل رمزاً إلى بريدي" : "Email me a code"}</Text></Pressable>
            {!!recoveryNotice && <Text style={modalStyles.note}>{recoveryNotice}</Text>}
            <Text style={modalStyles.fieldLabel}>{props.lang === "ar" ? "رمز البريد" : "Email code"}</Text>
            <TextInput testID="esim-recovery-code" accessibilityLabel="Email code" value={recoveryCode} onChangeText={(value) => setRecoveryCode(value.replace(/[^a-fA-F0-9]/g, "").toUpperCase())} maxLength={16} autoCapitalize="characters" autoCorrect={false} style={modalStyles.fieldInput} />
            <Pressable testID="esim-recovery-verify" accessibilityRole="button" disabled={recoveryPending || recoveryCode.length !== 16} onPress={() => void verifyRecovery()} style={[modalStyles.confirm, (recoveryPending || recoveryCode.length !== 16) && modalStyles.disabled]}><Text style={modalStyles.confirmText}>{props.lang === "ar" ? "عرض شرائحي" : "Show my eSIMs"}</Text></Pressable>
          </> : <>
            <Pressable testID="esim-recovery-reset" accessibilityRole="button" onPress={() => { setRecoveryProof(null); setRecoveredOrders([]); setRecoveryOrderId(null); setRecoveryError(null); }} style={modalStyles.retryAuth}><Text style={modalStyles.retryAuthText}>{props.lang === "ar" ? "استخدم بريداً آخر أو رمزاً جديداً" : "Use another email or code"}</Text></Pressable>
            {recoveredOrders.length === 0 && <Text style={modalStyles.note}>{props.lang === "ar" ? "لا توجد طلبات كزائر لهذا البريد." : "No guest orders found for this email."}</Text>}
            {recoveredOrders.map((order) => <View key={order.orderId} style={modalStyles.productStrip}>
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.productStripTitle}>{textField(order.product, "destination") || textField(order.product, "slug")}</Text>
                <Text style={modalStyles.productStripMeta}>{textField(order.product, "title")}</Text>
                {order.status !== "completed" && <Text style={modalStyles.note}>{props.lang === "ar"
                  ? (order.status === "pending_review" ? "الطلب قيد المراجعة. لا تدفع مرة أخرى؛ لم يجهز مستند التفعيل بعد." : "جارٍ تجهيز الطلب. لا تدفع مرة أخرى؛ سيظهر مستند التفعيل عند اكتماله.")
                  : (order.status === "pending_review" ? "This order is under review. Do not pay again; activation is not ready yet." : "This order is processing. Do not pay again; activation will appear when complete.")}</Text>}
                {order.status === "completed" && <Pressable testID={`esim-recovery-order-${order.orderId}`} accessibilityRole="button" onPress={() => setRecoveryOrderId(recoveryOrderId === order.orderId ? null : order.orderId)}><Text style={modalStyles.retryAuthText}>{recoveryOrderId === order.orderId ? (props.lang === "ar" ? "إخفاء التفاصيل" : "Hide details") : (props.lang === "ar" ? "تعليمات التفعيل" : "Activation instructions")}</Text></Pressable>}
                {recoveryOrderId === order.orderId && order.status === "completed" && order.activation && <>
                  <Text selectable style={modalStyles.note}>{activationForDisplay(order.activation) || (props.lang === "ar" ? "التعليمات غير متاحة مؤقتاً." : "Instructions are temporarily unavailable.")}</Text>
                  <Pressable testID="esim-recovery-download" accessibilityRole="button" disabled={downloadPending} onPress={() => void downloadOrder(order.orderId)} style={[modalStyles.confirm, downloadPending && modalStyles.disabled]}><Text style={modalStyles.confirmText}>{props.lang === "ar" ? "تنزيل مستند الشريحة" : "Download installation document"}</Text></Pressable>
                </>}
              </View>
            </View>)}
          </>}
          {!!recoveryError && <Text accessibilityRole="alert" style={modalStyles.checkoutAlert}>{recoveryError}</Text>}
          {!!downloadError && <Text accessibilityRole="alert" style={modalStyles.checkoutAlert}>{downloadError}</Text>}
        </ScrollView>
      </View>
    </Modal>
    <Modal visible={!!checkoutItem && !review} animationType="slide" onRequestClose={closeCheckout}>
      <KeyboardAvoidingView style={modalStyles.fullScreen} behavior="padding" keyboardVerticalOffset={0}>
        <View style={[modalStyles.formHeader, { paddingTop: Math.max(insets.top, 18) + 10 }]}>
          <Pressable testID="esim-checkout-back" accessibilityRole="button" accessibilityLabel={step === "customer" ? "Close checkout" : "Back to customer details"} onPress={() => step === "payment" ? setStep("customer") : closeCheckout()} hitSlop={10} style={modalStyles.headerBack}>
             <EsimIcon name="arrow-back" size={23} color={BLUE_LIGHT} />
          </Pressable>
          <Text style={modalStyles.headerTitle}>{props.lang === "ar" ? "شراء شريحة eSIM" : "eSIM checkout"}</Text>
           <Pressable accessibilityRole="button" accessibilityLabel="Close checkout" onPress={closeCheckout} hitSlop={10} style={modalStyles.headerBack}><EsimIcon name="close" size={22} color={BLUE_LIGHT} /></Pressable>
        </View>
        <ScrollView style={modalStyles.formScroll} contentContainerStyle={[modalStyles.formContent, { paddingBottom: Math.max(insets.bottom, 24) + 30 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={modalStyles.progress}><View style={modalStyles.progressActive} /><View style={[modalStyles.progressTrack, step === "payment" && modalStyles.progressActive]} /><View style={modalStyles.progressTrack} /></View>
          <Text style={modalStyles.kicker}>{step === "customer" ? (props.lang === "ar" ? "٠١ / بيانات العميل" : "01 / CUSTOMER DETAILS") : (props.lang === "ar" ? "٠٢ / طريقة الدفع" : "02 / PAYMENT METHOD")}</Text>
          <Text style={modalStyles.formTitle}>{step === "customer" ? (props.lang === "ar" ? "لمن هذه الشريحة؟" : "Who’s travelling?") : (props.lang === "ar" ? "كيف تود الدفع؟" : "How would you like to pay?")}</Text>
          <Text style={modalStyles.formSubtitle}>{step === "customer" ? (props.lang === "ar" ? "نحتاج بياناتك لإصدار الطلب وإرسال تفاصيل شريحتك." : "These details are needed for your order and installation instructions.") : (props.lang === "ar" ? "اختر وسيلة الدفع، ثم راجع السعر النهائي قبل المتابعة." : "Choose a method, then review your final price before continuing.")}</Text>
           <View style={modalStyles.productStrip}><EsimIcon name="cellular" size={24} color={BLUE} /><View style={{ flex: 1 }}><Text style={modalStyles.productStripTitle}>{esimDestinationTitle(checkoutItem?.destination.title ?? "", props.lang, checkoutItem?.destination.countryCode)}</Text><Text style={modalStyles.productStripMeta}>{checkoutItem?.item.title}</Text></View><Text style={modalStyles.productStripPrice}>{checkoutItem?.item.priceKwd?.toFixed(3)} KWD</Text></View>
          {step === "customer" ? <>
              {(["firstName", "lastName", "email"] as const).map((field) => {
                const labels = props.lang === "ar"
                  ? { firstName: "الاسم الأول", lastName: "اسم العائلة", email: "البريد الإلكتروني" }
                  : { firstName: "First name", lastName: "Last name", email: "Email address" };
                return <View key={field} style={modalStyles.fieldGroup}>
                  <Text style={modalStyles.fieldLabel}>{labels[field]} <Text style={modalStyles.required}>*</Text></Text>
                  <TextInput
                    testID={`esim-${field}`}
                    accessibilityLabel={labels[field]}
                    accessibilityHint={formErrors[field]}
                    value={customer[field]}
                    onChangeText={(value) => updateCustomer(field, value)}
                    maxLength={field === "email" ? 254 : 80}
                    keyboardType={field === "email" ? "email-address" : "default"}
                    textContentType={field === "email" ? "emailAddress" : field === "firstName" ? "givenName" : "familyName"}
                    autoCapitalize={field === "email" ? "none" : "words"}
                    autoCorrect={field !== "email"}
                    returnKeyType="next"
                    placeholder={labels[field]}
                    placeholderTextColor="#768393"
                    style={[modalStyles.fieldInput, !!formErrors[field] && modalStyles.fieldInvalid, props.lang === "ar" && modalStyles.rtl]}
                  />
                  {!!formErrors[field] && <Text accessibilityRole="alert" style={modalStyles.fieldError}>
                    {props.lang === "ar" ? (field === "email" ? "يرجى إدخال بريد إلكتروني صحيح" : "تحقق من هذا الحقل") : formErrors[field]}
                  </Text>}
                </View>;
              })}
              <View style={modalStyles.fieldGroup}>
                <Text style={modalStyles.fieldLabel}>{props.lang === "ar" ? "الدولة" : "Country"} <Text style={modalStyles.required}>*</Text></Text>
                <EsimCountryPicker
                  testID="esim-country"
                  selectedIso={customer.countryIso}
                  locale={props.lang}
                  title={props.lang === "ar" ? "اختر الدولة" : "Select country"}
                  placeholder={props.lang === "ar" ? "اختر الدولة" : "Select country"}
                  mode="country"
                  onSelect={selectBillingCountry}
                />
                {!!formErrors.country && <Text accessibilityRole="alert" style={modalStyles.fieldError}>{props.lang === "ar" ? "الدولة مطلوبة" : formErrors.country}</Text>}
              </View>
              <View style={modalStyles.fieldGroup}>
                <Text style={modalStyles.fieldLabel}>{props.lang === "ar" ? "رقم الهاتف" : "Phone number"} <Text style={modalStyles.required}>*</Text></Text>
                <View style={modalStyles.phoneRow}>
                  <View style={modalStyles.phoneDialPicker}>
                    <EsimCountryPicker
                      testID="esim-phone-dial-country"
                      selectedIso={customer.phoneDialCountryIso}
                      locale={props.lang}
                      title={props.lang === "ar" ? "رمز الاتصال" : "Select dialing code"}
                      placeholder="+965"
                      mode="dialCode"
                      onSelect={selectPhoneDialCountry}
                    />
                  </View>
                  <TextInput
                    testID="esim-phoneNumber"
                    accessibilityLabel={props.lang === "ar" ? "رقم الهاتف" : "Phone number"}
                    accessibilityHint={formErrors.phoneNumber}
                    value={customer.phoneNumber}
                    onChangeText={(value) => updateCustomer("phoneNumber", value)}
                    maxLength={24}
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    placeholder={props.lang === "ar" ? "رقم الهاتف" : "Phone number"}
                    placeholderTextColor="#768393"
                    style={[modalStyles.fieldInput, modalStyles.phoneNumberInput, !!formErrors.phoneNumber && modalStyles.fieldInvalid]}
                  />
                </View>
                {!!formErrors.phoneNumber && <Text accessibilityRole="alert" style={modalStyles.fieldError}>{props.lang === "ar" ? "أدخل رقم هاتف صحيحاً" : formErrors.phoneNumber}</Text>}
              </View>
             <Pressable testID="esim-details-next" accessibilityRole="button" onPress={proceedToPayment} style={modalStyles.confirm}><Text style={modalStyles.confirmText}>{props.lang === "ar" ? "متابعة إلى الدفع" : "Continue to payment"}</Text><EsimIcon name="arrow-forward" size={18} color="#FFFFFF" /></Pressable>
          </> : <>
            <Text style={modalStyles.fieldLabel}>{props.lang === "ar" ? "طريقة الدفع" : "Payment method"}</Text>
            {PAYMENT_METHODS.map((method) => <Pressable key={method} testID={`esim-payment-${method}`} accessibilityRole="radio" accessibilityLabel={methodLabel[method][props.lang]} accessibilityState={{ checked: paymentMethod === method, disabled: false }} onPress={() => { setPaymentMethod(method); onCheckoutInputChange(); }} style={[modalStyles.methodRow, paymentMethod === method && modalStyles.methodSelected]}>
              <View style={modalStyles.logoFrame}><PaymentMethodLogo method={method} /></View>
               <View style={{ flex: 1 }}><Text style={modalStyles.methodName}>{methodLabel[method][props.lang]}</Text></View>
               <EsimIcon name={paymentMethod === method ? "radio-on" : "radio-off"} size={21} color={paymentMethod === method ? BLUE : "#7288A8"} />
            </Pressable>)}
              <Text style={modalStyles.note}>{props.lang === "ar"
                ? "سيتم خصم المبلغ بعد تأكيدك. نطلب الشريحة من Airalo بعد التحقق من الدفع، ونؤكد الطلب بعد تأكيد المورّد."
                : "Payment is charged after you confirm. We request your eSIM from Airalo after verifying payment, and confirm the order only after Airalo confirms it."}</Text>
             <View style={modalStyles.fieldGroup}><Text style={modalStyles.fieldLabel}>{props.lang === "ar" ? "رمز الخصم (اختياري)" : "Promo code (optional)"}</Text><TextInput testID="esim-promo-code" accessibilityLabel="Promo code" value={promoCode} editable={!privateCheckoutRestricted} accessibilityState={{ disabled: privateCheckoutRestricted }} onChangeText={(value) => { if (privateCheckoutRestricted) return; setPromoCode(value.replace(/[^A-Za-z0-9_-]/g, "").toUpperCase()); onCheckoutInputChange(); }} maxLength={32} autoCapitalize="characters" autoCorrect={false} placeholder={props.lang === "ar" ? "أدخل الرمز" : "Enter your code"} placeholderTextColor="#7288A8" style={modalStyles.fieldInput} /></View>
            {!!checkoutError && <Text accessibilityRole="alert" style={modalStyles.checkoutAlert}>{checkoutError}</Text>}
            {buyerMode === "blocked" && <Pressable testID="esim-auth-retry" accessibilityRole="button" onPress={() => void refreshToken()} style={modalStyles.retryAuth}><Text style={modalStyles.retryAuthText}>{props.lang === "ar" ? "إعادة محاولة الاتصال" : "Retry sign-in connection"}</Text></Pressable>}
            <Pressable testID="esim-pay" accessibilityRole="button" accessibilityState={{ disabled: checkoutPending }} disabled={checkoutPending} onPress={() => void requestQuote()} style={[modalStyles.confirm, checkoutPending && modalStyles.disabled]}><Text style={modalStyles.confirmText}>{checkoutPending ? (props.lang === "ar" ? "جارٍ عرض السعر…" : "Getting your price…") : (props.lang === "ar" ? "الدفع — مراجعة السعر" : "Pay · Review price")}</Text><EsimIcon name="arrow-forward" size={18} color="#FFFFFF" /></Pressable>
          </>}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={!!review} transparent animationType="fade" onRequestClose={closeReview}>
      <View style={modalStyles.backdrop}>
        <ScrollView contentContainerStyle={modalStyles.reviewScroll} keyboardShouldPersistTaps="handled"><View style={modalStyles.card}>
          <Text style={[modalStyles.kicker, props.lang === "ar" && modalStyles.rtl]}>{props.lang === "ar" ? "مراجعة الطلب" : "REVIEW YOUR ORDER"}</Text>
          <Text style={[modalStyles.heading, props.lang === "ar" && modalStyles.rtl]}>
            {review?.changed
              ? props.lang === "ar" ? "تحدّث السعر — راجعه مجدداً" : "Quote refreshed — review again"
              : props.lang === "ar" ? "تأكيد السعر النهائي" : "Confirm final price"}
          </Text>
          <Text style={[modalStyles.product, props.lang === "ar" && modalStyles.rtl]}>{esimDestinationTitle(review?.quote.product.destination ?? "", props.lang)} · {review?.quote.product.title}</Text>
          {!!review && (review.quote.product.isUnlimited || review.quote.product.hasFairUsagePolicy) && (
            <Text style={[modalStyles.note, props.lang === "ar" && modalStyles.rtl]}>
              {esimFairUseText(review.quote.product, locale === "tr" ? "tr" : props.lang)}
            </Text>
          )}
          {!!review?.promoCode && <Text style={[modalStyles.promo, props.lang === "ar" && modalStyles.rtl]}>{props.lang === "ar" ? "رمز الخصم" : "Promo code"}: {review.promoCode}</Text>}
           {!!review && <Text style={[modalStyles.promo, props.lang === "ar" && modalStyles.rtl]}>{props.lang === "ar" ? "طريقة الدفع" : "Payment method"}: {methodLabel[review.paymentMethod][props.lang]}</Text>}
          <View style={modalStyles.divider} />
            <View style={[modalStyles.amountRow, props.lang === "ar" && modalStyles.reverse]}>
              <Text style={[modalStyles.lineLabel, props.lang === "ar" && modalStyles.rtl]}>{props.lang === "ar" ? "سعر الباقة" : "Package subtotal"}</Text>
             <Text style={modalStyles.lineAmount}>{review ? ((review.quote.baseAmountFils + review.quote.discountFils) / 1000).toFixed(3) : ""} KWD</Text>
           </View>
           {!!review?.quote.discountFils && <View style={[modalStyles.amountRow, props.lang === "ar" && modalStyles.reverse]}>
             <Text style={[modalStyles.lineLabel, props.lang === "ar" && modalStyles.rtl]}>{props.lang === "ar" ? "الخصم" : "Discount"}</Text>
            <Text style={modalStyles.discount}>− {(review.quote.discountFils / 1000).toFixed(3)} KWD</Text>
          </View>}
             {!!review?.quote.paymentFeeFils && <View style={[modalStyles.amountRow, props.lang === "ar" && modalStyles.reverse]}>
               <Text style={[modalStyles.lineLabel, props.lang === "ar" && modalStyles.rtl]}>{props.lang === "ar" ? "رسوم طريقة الدفع" : "Payment method fee"}</Text>
              <Text style={modalStyles.lineAmount}>+ {(review.quote.paymentFeeFils / 1000).toFixed(3)} KWD</Text>
            </View>}
           <View style={[modalStyles.amountRow, props.lang === "ar" && modalStyles.reverse]}>
            <Text style={modalStyles.totalLabel}>{props.lang === "ar" ? "المبلغ المستحق" : "Final total"}</Text>
             <Text style={modalStyles.total}>{review ? review.quote.amountKwd.toFixed(3) : ""} KWD</Text>
          </View>
           <Text style={[modalStyles.note, props.lang === "ar" && modalStyles.rtl]}>
            {props.lang === "ar"
                ? "سيتم خصم المبلغ بعد تأكيدك. نطلب الشريحة من Airalo بعد التحقق من الدفع، ونؤكد الطلب بعد تأكيد المورّد."
                : "Payment is charged after you confirm. We'll request the eSIM from Airalo after verifying payment, and confirm the order after the supplier responds."}
          </Text>
           {!!review && <Text style={modalStyles.recipient}>{review.customer.firstName} {review.customer.lastName} · {review.customer.email}</Text>}
            {!!review && <Pressable
              testID="esim-email-acknowledgement"
              accessibilityRole="checkbox"
              accessibilityLabel={props.lang === "ar" ? "أؤكد أن عنوان البريد الإلكتروني صحيح" : "I confirm this email address is correct"}
              accessibilityState={{ checked: emailAcknowledged, disabled: checkoutPending || pendingLink }}
              disabled={checkoutPending || pendingLink}
              onPress={() => {
                if (checkoutPending || pendingLink) return;
                setEmailAcknowledged((checked) => !checked);
                setCheckoutError(null);
              }}
              style={[modalStyles.emailAcknowledgement, props.lang === "ar" && modalStyles.reverse]}
            >
              <View style={[modalStyles.emailCheckbox, emailAcknowledged && modalStyles.emailCheckboxChecked]}>
                {emailAcknowledged && <Text style={modalStyles.emailCheckmark}>✓</Text>}
              </View>
              <Text style={[modalStyles.emailAcknowledgementLabel, props.lang === "ar" && modalStyles.rtl]}>
                {props.lang === "ar" ? "أؤكد أن عنوان البريد الإلكتروني صحيح" : "I confirm this email address is correct"}
              </Text>
            </Pressable>}
           {!!checkoutError && <Text accessibilityRole="alert" style={modalStyles.checkoutAlert}>{checkoutError}</Text>}
           {buyerMode === "blocked" && <Pressable testID="esim-auth-retry-review" accessibilityRole="button" onPress={() => void refreshToken()} style={modalStyles.retryAuth}><Text style={modalStyles.retryAuthText}>{props.lang === "ar" ? "إعادة محاولة الاتصال" : "Retry sign-in connection"}</Text></Pressable>}
          <Pressable testID="esim-confirm-checkout" accessibilityRole="button" accessibilityState={{ disabled: checkoutPending || !emailAcknowledged || !!review?.blocked }} disabled={checkoutPending || !emailAcknowledged || !!review?.blocked} onPress={() => void confirmOrder()} style={[modalStyles.confirm, (checkoutPending || !emailAcknowledged || review?.blocked) && modalStyles.disabled]}>
            <Text style={modalStyles.confirmText}>{checkoutPending
              ? props.lang === "ar" ? "جارٍ تجهيز الدفع…" : "Preparing payment…"
              : review?.blocked ? props.lang === "ar" ? "الطلب يحتاج إلى مراجعة" : "Checkout needs review"
              : pendingLink ? props.lang === "ar" ? "إعادة محاولة رابط الدفع" : "Retry secure payment link"
              : props.lang === "ar" ? "تأكيد والانتقال للدفع" : "Confirm & continue to payment"}</Text>
          </Pressable>
          <Pressable testID="esim-cancel-checkout" accessibilityRole="button" disabled={checkoutPending || pendingLink} onPress={closeReview} style={[modalStyles.cancel, pendingLink && modalStyles.disabled]}>
            <Text style={modalStyles.cancelText}>{props.lang === "ar" ? "إلغاء" : "Cancel"}</Text>
          </Pressable>
         </View></ScrollView>
      </View>
    </Modal>
  </>;
}

const modalStyles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: NAVY },
  formHeader: { backgroundColor: SURFACE, minHeight: 78, paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: BORDER },
  headerBack: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: BLUE_LIGHT, fontSize: 17, fontWeight: "800", alignSelf: "center" },
  formScroll: { flex: 1 },
  formContent: { paddingHorizontal: 20, paddingTop: 27, maxWidth: 520, width: "100%", alignSelf: "center" },
  progress: { flexDirection: "row", gap: 6, marginBottom: 28 },
  progressTrack: { height: 3, flex: 1, borderRadius: 3, backgroundColor: BORDER },
  progressActive: { height: 3, flex: 1, borderRadius: 3, backgroundColor: BLUE },
  formTitle: { fontSize: 28, lineHeight: 35, fontWeight: "800", color: "#202A36", marginTop: 8 },
  formSubtitle: { color: "#687583", fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 22 },
  productStrip: { backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 15, flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 26 },
  productStripTitle: { color: "#202A36", fontWeight: "800", fontSize: 14 },
  productStripMeta: { color: "#687583", fontSize: 12, marginTop: 4 },
  productStripPrice: { color: BLUE_LIGHT, fontSize: 12, fontWeight: "800" },
  fieldGroup: { marginBottom: 12 },
  emailAcknowledgement: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, marginBottom: 12 },
  emailCheckbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" },
  emailCheckboxChecked: { backgroundColor: BLUE, borderColor: BLUE },
  emailCheckmark: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  emailAcknowledgementLabel: { flex: 1, color: "#202A36", fontSize: 13, lineHeight: 19 },
  fieldLabel: { color: "#202A36", fontSize: 13, fontWeight: "700", marginBottom: 7 },
  required: { color: BLUE_LIGHT },
  fieldInput: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, paddingHorizontal: 12, paddingVertical: 10, color: "#202A36", fontSize: 15 },
  phoneRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  phoneDialPicker: { width: 172 },
  phoneNumberInput: { flex: 1, minWidth: 90 },
  fieldInvalid: { borderColor: "#B63F43" },
  fieldError: { color: "#A42D31", fontSize: 12, marginTop: 6 },
  methodRow: { minHeight: 72, marginBottom: 10, backgroundColor: SURFACE, borderColor: BORDER, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, gap: 10 },
  methodSelected: { borderColor: BLUE, backgroundColor: "#EAF3FF" },
  logoFrame: { width: 70, height: 40, alignItems: "center", justifyContent: "center" },
  methodName: { color: "#202A36", fontSize: 14, fontWeight: "800" },
  checkoutAlert: { color: "#A42D31", fontSize: 13, marginBottom: 12, lineHeight: 19 },
  retryAuth: { borderWidth: 1, borderColor: BLUE_LIGHT, borderRadius: 8, minHeight: 44, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  retryAuthText: { color: BLUE_LIGHT, fontWeight: "700", fontSize: 13 },
  recipient: { color: "#687583", fontSize: 12, marginBottom: 16 },
  backdrop: { flex: 1, justifyContent: "center", backgroundColor: "rgba(4,14,32,0.85)" },
  reviewScroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 24 },
    card: { backgroundColor: SURFACE, borderRadius: 19, padding: 23, borderWidth: 1, borderColor: BORDER, maxWidth: 460, width: "100%", alignSelf: "center" },
    kicker: { color: BLUE_LIGHT, fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
    heading: { color: "#202A36", fontSize: 23, fontWeight: "800", marginTop: 9, lineHeight: 29 },
   product: { color: "#687583", fontSize: 14, marginTop: 10, lineHeight: 20 },
   promo: { color: "#202A36", fontSize: 12, marginTop: 7, fontWeight: "700" },
   divider: { height: 1, backgroundColor: BORDER, marginVertical: 18 },
  amountRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 },
   reverse: { flexDirection: "row-reverse" },
   lineLabel: { color: "#687583", fontSize: 13, flexShrink: 1 },
   lineAmount: { color: "#202A36", fontSize: 13, fontWeight: "700" },
    discount: { color: BLUE_LIGHT, fontSize: 14, fontWeight: "700" },
   totalLabel: { color: "#202A36", fontSize: 15, fontWeight: "800" },
    total: { color: BLUE_LIGHT, fontSize: 20, fontWeight: "800" },
   note: { color: "#687583", fontSize: 12, lineHeight: 18, marginTop: 9, marginBottom: 20 },
   confirm: { minHeight: 52, borderRadius: 12, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 9, backgroundColor: BLUE, marginTop: 8 },
  confirmText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.55 },
  cancel: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 6 },
    cancelText: { color: BLUE_LIGHT, fontWeight: "700", fontSize: 14 },
  rtl: { textAlign: "right", writingDirection: "rtl" },
});
