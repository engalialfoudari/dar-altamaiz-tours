import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useClerk, useSignIn, useSignUp } from "@clerk/expo";
import { useSignInWithGoogle } from "@clerk/expo/google";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { linkPushTokenAfterAuth } from "@/utils/pushTokenLink";
import { requestClerkToken } from "@/lib/clerkTokenCoordinator";
import { useAccountRequestGuard } from "@/hooks/useAccountRequestGuard";
import { useColors } from "@/hooks/useColors";
import {
  DEFAULT_HOTEL_DISPLAY_PREFERENCES,
  formatHotelDisplayPrice,
  type HotelDisplayPreferences,
  parseHotelPaymentReturnUrl,
} from "@/lib/hotelPortal";
import { HotelPortalIcon } from "./HotelPortalIcon";

const clerkGoogleWebClientId =
  process.env.EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID;
if (clerkGoogleWebClientId && Constants.expoConfig) {
  const runtimeExtra = Constants.expoConfig.extra as
    | Record<string, unknown>
    | undefined;
  if (runtimeExtra) {
    runtimeExtra.EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID =
      clerkGoogleWebClientId;
  }
}

type PriceLock = {
  id: number;
  hotelName: string | null;
  roomName: string | null;
  checkin: string | null;
  checkout: string | null;
  nights: number;
  lockedPriceKwd: string | null;
  expiresAt: string | null;
  status: string;
  guestToken?: string | null;
};

function fmtLockCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const API_BASE = (
  process.env["EXPO_PUBLIC_API_BASE"] ??
  "https://tours-dar-tamaiz--engalialfoudari.replit.app/api"
).replace(/\/$/, "");

WebBrowser.maybeCompleteAuthSession?.();

export async function startWebGoogleRedirect(
  signIn: {
    create: (params: { strategy: "oauth_google"; redirectUrl: string }) => Promise<unknown>;
    firstFactorVerification: { externalVerificationRedirectURL: URL | null };
  },
  redirectUrl: string,
  navigate: (url: string) => void,
): Promise<void> {
  await signIn.create({ strategy: "oauth_google", redirectUrl });
  const externalUrl = signIn.firstFactorVerification.externalVerificationRedirectURL;
  if (!externalUrl) throw new Error("Google sign-in redirect was not created");
  navigate(externalUrl.toString());
}

export async function waitForNativeGoogleReturn(
  authorizationUrl: string,
  redirectUrl: string,
  timeoutMs = 120_000,
): Promise<string> {
  let resolveDeepLink!: (url: string) => void;
  const deepLinkPromise = new Promise<string>((resolve) => {
    resolveDeepLink = resolve;
  });
  const subscription = Linking.addEventListener("url", ({ url }) => {
    if (url.startsWith(redirectUrl)) resolveDeepLink(url);
  });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const browserPromise = WebBrowser.openAuthSessionAsync(authorizationUrl, redirectUrl)
      .then((result) => result.type === "success" ? result.url : null);
    const returnedUrl = await Promise.race([
      browserPromise,
      deepLinkPromise,
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    if (!returnedUrl) throw new Error("Google sign-in timed out. Please try again.");
    void WebBrowser.dismissBrowser?.().catch(() => {});
    return returnedUrl;
  } finally {
    if (timeout) clearTimeout(timeout);
    subscription.remove();
  }
}

function isAndroidAccountReauthFailure(error: unknown): boolean {
  if (Platform.OS !== "android") return false;
  const message = error instanceof Error
    ? error.message
    : String((error as { message?: unknown } | null)?.message ?? error ?? "");
  return /\[16\]\s*Account reauth failed/i.test(message);
}

const TIER_LABELS: Record<string, string> = {
  new: "متميز جديد",
  silver: "متميز فضي",
  gold: "متميز ذهبي",
};
const TIER_COLORS: Record<string, string> = {
  new: "#6b7280",
  silver: "#94a3b8",
  gold: "#D4AF37",
};
const TIER_EMOJIS: Record<string, string> = {
  new: "🆕",
  silver: "🥈",
  gold: "🥇",
};

interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone?: string;
  loyaltyTier: string;
  pointsBalance: number;
  bookingCount: number;
}
interface LoyaltyBalance {
  expiringSoonPoints: number;
  expiringSoonEarliest?: string | null;
}
interface Booking {
  orderId: string;
  rhOrderId: string | null;
  status: string;
  isPaid: boolean;
  createdAt: string;
  hotelName: string;
  checkin: string;
  checkout: string;
  nights?: string;
  roomName?: string;
  rooms?: string;
  totalKWD: string;
  cancelBefore?: string | null;
  canCancel?: boolean;
  balanceReminder?: {
    stage: "10" | "3";
    sentAt: string;
    balanceKWD: string;
    deadline: string;
  } | null;
}
type BalanceNotification = {
  orderId: string;
  hotelName: string;
  checkin: string;
  stage: "10" | "3";
  sentAt: string;
  balanceKWD: string;
  deadline: string;
};

function formatExpiryDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ar-KW");
}

function formatBalanceDeadline(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuwait", day: "2-digit", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date)} (Kuwait time)`;
}

function formatBookingDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type AccountDialog = {
  kind: "confirm" | "info";
  title: string;
  message: string;
  orderId?: string;
  showSupport?: boolean;
  action?: "cancelBooking" | "privacyDelete" | "welcome";
};

export function ProfileScreen({
  onClose,
  onLoginSuccess,
  onAuthenticated,
  onLoggedOut,
  onOpenHotelPortal,
  onOpenCart,
  sessionRefreshVersion = 0,
  language = "en",
  hotelDisplayPreferences = DEFAULT_HOTEL_DISPLAY_PREFERENCES,
  onHotelDisplayPreferencesChange,
}: {
  onClose?: () => void;
  onLoginSuccess?: () => void;
  onAuthenticated?: () => void | Promise<void>;
  onLoggedOut?: () => void | Promise<void>;
  onOpenHotelPortal?: (url: string) => void;
  onOpenCart?: () => void;
  sessionRefreshVersion?: number;
  language?: "en" | "ar";
  hotelDisplayPreferences?: HotelDisplayPreferences;
  onHotelDisplayPreferencesChange?: (preferences: HotelDisplayPreferences) => void;
}) {
  const insets = useSafeAreaInsets();
  const { startGoogleAuthenticationFlow } = useSignInWithGoogle();
  const { client, setActive: setClerkActive } = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const {
    getToken,
    isLoaded: isClerkLoaded,
    isSignedIn,
    signOut,
    sessionId,
    userId,
  } = useAuth();
  const theme = useColors();
  const isArabic = language === "ar";
  const copy = isArabic
    ? {
        eyebrow: "دار التميز للسفريات · حسابي",
        bookings: "الحجوزات",
        points: "نقاط تميّز",
        currentLevel: "المستوى الحالي",
        savedBookings: "الحجوزات المحفوظة",
        savedBookingsSubtitle: "ثبّت السعر قبل انتهاء المهلة",
        priceHeld: "السعر محفوظ",
        continue: "متابعة",
        priceProtectedFor: (value: string) => `السعر محمي لمدة ${value} إضافية`,
        myBookings: "حجوزاتي",
        myBookingsSubtitle: "إدارة إقامتك وحجوزاتك",
        noBookings: "لا توجد حجوزات بعد",
        noBookingsBody: "ستظهر هنا إقاماتك المؤكدة وطلبات الدفع.",
        booked: "تم الحجز",
        stayDates: "تواريخ الإقامة",
        total: "الإجمالي",
        paymentPending: "الدفع قيد الانتظار",
        rooms: (value: string) => `${value} غرف`,
        hotelConfirmation: "تأكيد الفندق",
        confirmingWithHotel: "جارٍ التأكيد مع الفندق…",
        freeCancellationUntil: (value: string) => `إلغاء مجاني حتى ${value}`,
        cancellationProcessed: "تم تسجيل الإلغاء",
        bookingReference: "مرجع الحجز",
        completePayment: "إتمام الدفع",
        paymentRedirecting: "جارٍ التحويل…",
        cancelBooking: "إلغاء الحجز",
        cancellationInProgress: "جارٍ الإلغاء…",
        importantTitle: "معلومات مهمة",
        protectedTitle: "حجوزاتك محمية",
        protectedBody: "يتم التعامل مع تفاصيل الدفع بأمان. احتفظ برقم تأكيد الفندق عند تسجيل الوصول.",
        cancellationTitle: "الإلغاء والاسترداد",
        cancellationBody: "يظهر زر الإلغاء فقط عندما يكون حجز الفندق مؤهلاً. تتم مراجعة أي استرداد مستحق للدفع بشكل منفصل من قبل فريق دعم دار التميز.",
        helpTitle: "تحتاج مساعدة؟",
        supportLink: "تواصل مع دعم دار التميز عبر الواتساب",
        bookingDetails: "تفاصيل الحجز",
        viewBookingDetails: "عرض تفاصيل الحجز",
        closeDetails: "إغلاق",
        room: "الغرفة",
        nights: "الليالي",
        orderReference: "مرجع الطلب",
        hotelBookingId: "رقم حجز الفندق",
        contactSupport: "تواصل مع الدعم",
        programTiers: "مستويات البرنامج",
        cashback: (value: string) => `استرداد نقدي ${value}`,
        defaultTier: "افتراضي",
        active: "نشط",
        signOut: "تسجيل خروج",
        privacyTitle: "الخصوصية وبياناتك",
        privacySubtitle: "إدارة طلبات بياناتك الشخصية",
        privacyAccess: "طلب نسخة من بياناتي",
        privacyAccessHint: "اطلب الوصول أو نسخة من بيانات حسابك.",
        privacyCorrect: "تصحيح بياناتي",
        privacyCorrectHint: "راسلنا لتصحيح بيانات الحساب أو الحجز.",
        privacyDelete: "طلب حذف حسابي",
        privacyDeleteHint: "اطلب حذف الحساب وإخفاء البيانات غير الضرورية.",
        privacyEmail: "أو راسلنا على info@dt-tour.com",
        privacyExportLoading: "جارٍ طلب النسخة…",
        privacyExportSuccess: "تم استلام طلب نسخة بياناتك. سنعالج الطلب بعد التحقق عند الحاجة.",
        privacyExportError: "تعذّر طلب النسخة الآن. راسلنا على info@dt-tour.com.",
        privacyCorrectSubject: "طلب تصحيح بيانات الخصوصية",
        privacyDeleteConfirmTitle: "طلب حذف الحساب",
        privacyDeleteConfirm: "هل تريد إرسال طلب حذف حسابك؟ سنحذف أو نُخفي هوية البيانات الشخصية غير الضرورية عندما يكون ذلك آمناً. قد نحتفظ بسجلات الحجز والدفع والاسترداد والسجلات القانونية أو الخاضعة لتعليق قانوني بالقدر والمدة اللازمين.",
        privacyDeleteLoading: "جارٍ إرسال طلب الحذف…",
        privacyDeleteSuccess: "أرسلنا رابط تحقق إلى بريد حسابك. لن يبدأ الحذف حتى تفتح الرابط وتؤكد الطلب.",
        privacyDeleteError: "تعذّر إرسال طلب الحذف. راسلنا على info@dt-tour.com.",
        privacyDeleteAction: "إرسال طلب الحذف",
      }
    : {
        eyebrow: "D.T. TOURS · MY ACCOUNT",
        bookings: "Bookings",
        points: "Tamayuz points",
        currentLevel: "Current level",
        savedBookings: "Saved bookings",
        savedBookingsSubtitle: "Act before the price hold expires",
        priceHeld: "Price held",
        continue: "Continue",
        priceProtectedFor: (value: string) => `Price protected for ${value} more`,
        myBookings: "My bookings",
        myBookingsSubtitle: "Manage your stays and bookings",
        noBookings: "No bookings yet",
        noBookingsBody: "Your confirmed stays and payment requests will appear here.",
        booked: "Booked",
        stayDates: "Stay dates",
        total: "Total",
        paymentPending: "Payment pending",
        rooms: (value: string) => `${value} rooms`,
        hotelConfirmation: "Hotel confirmation",
        confirmingWithHotel: "Confirming with hotel…",
        freeCancellationUntil: (value: string) => `Free cancellation until ${value}`,
        cancellationProcessed: "Cancellation processed",
        bookingReference: "Booking reference",
        completePayment: "Complete payment",
        paymentRedirecting: "Redirecting…",
        cancelBooking: "Cancel booking",
        cancellationInProgress: "Cancelling…",
        importantTitle: "Important information",
        protectedTitle: "Your bookings are protected",
        protectedBody: "Payment details are handled securely. Keep your hotel confirmation number for check-in.",
        cancellationTitle: "Cancellation & refunds",
        cancellationBody: "The cancel button appears only while the hotel booking is eligible. Any eligible payment refund is reviewed separately by D.T. Tours support.",
        helpTitle: "Need help?",
        supportLink: "Chat with D.T. Tours support on WhatsApp",
        bookingDetails: "Booking details",
        viewBookingDetails: "View booking details",
        closeDetails: "Close",
        room: "Room",
        nights: "Nights",
        orderReference: "Order reference",
        hotelBookingId: "Hotel booking ID",
        contactSupport: "Contact support",
        programTiers: "Program Tiers",
        cashback: (value: string) => `${value} cashback`,
        defaultTier: "Default",
        active: "Active",
        signOut: "Sign out",
        privacyTitle: "Privacy & your data",
        privacySubtitle: "Manage requests about your personal data",
        privacyAccess: "Request a copy of my data",
        privacyAccessHint: "Request access to or a copy of your account data.",
        privacyCorrect: "Correct my data",
        privacyCorrectHint: "Contact us to correct account or booking details.",
        privacyDelete: "Request account deletion",
        privacyDeleteHint: "Request account deletion and anonymisation where appropriate.",
        privacyEmail: "Or email us at info@dt-tour.com",
        privacyExportLoading: "Requesting your copy…",
        privacyExportSuccess: "Your data-copy request was received. We will process it after verification where needed.",
        privacyExportError: "We could not request your copy now. Email info@dt-tour.com.",
        privacyCorrectSubject: "Privacy data correction request",
        privacyDeleteConfirmTitle: "Request account deletion",
        privacyDeleteConfirm: "Do you want to send an account-deletion request? We will delete or anonymize nonessential personal data when it is safe to do so. Booking, payment, refund, legal, and legal-hold records may be protected and retained where required.",
        privacyDeleteLoading: "Sending deletion request…",
        privacyDeleteSuccess: "We sent a verification link to your account email. Deletion will not start until you open it and confirm the request.",
        privacyDeleteError: "We could not send your deletion request. Email info@dt-tour.com.",
        privacyDeleteAction: "Send deletion request",
      };
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loyaltyBalance, setLoyaltyBalance] = useState<LoyaltyBalance | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [balanceNotifications, setBalanceNotifications] = useState<BalanceNotification[]>([]);
  // If Clerk's browser SDK cannot initialize, Account must still open instead
  // of waiting forever. Auth actions already report that sign-in is loading.
  const [loading, setLoading] = useState(isClerkLoaded);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [passwordResetStage, setPasswordResetStage] = useState<"request" | "verify" | null>(null);
  const [passwordResetCode, setPasswordResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [continuingOrderId, setContinuingOrderId] = useState<string | null>(null);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [dialog, setDialog] = useState<AccountDialog | null>(null);
  const [privacyExporting, setPrivacyExporting] = useState(false);
  const [privacyCorrecting, setPrivacyCorrecting] = useState(false);
  const [privacyDeleting, setPrivacyDeleting] = useState(false);
  const [accountView, setAccountView] = useState<"overview" | "settings">("overview");
  const pendingWelcomeRef = useRef(false);
  const {
    accountKey,
    getAccountGeneration,
    isCurrentRequest: isCurrentAccountGeneration,
  } = useAccountRequestGuard({
    isLoaded: isClerkLoaded,
    isSignedIn,
    sessionId,
    userId,
  });

  const showWelcomeForProfile = useCallback((nextProfile: UserProfile) => {
    pendingWelcomeRef.current = false;
    setDialog({
      kind: "info",
      action: "welcome",
      title: isArabic ? `مرحباً، ${nextProfile.name}` : `Welcome, ${nextProfile.name}`,
      message: isArabic
        ? "تم تسجيل دخولك بنجاح. تابع لاستكشاف الرحلات والفنادق والباقات السياحية."
        : "You’re signed in successfully. Continue to explore flights, hotels, and travel packages.",
    });
  }, [isArabic]);

  // ── Price locks (On Hold) ─────────────────────────────────────────────────
  const [locks, setLocks] = useState<PriceLock[]>([]);
  const [lockCountdowns, setLockCountdowns] = useState<Record<number, string>>({});
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const accountLoadRef = useRef<{
    accountKey: string | null;
    controller: AbortController;
    promise: Promise<UserProfile | null>;
  } | null>(null);
  const accountMutationControllerRef = useRef(new AbortController());

  const clerkFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const token = await requestClerkToken({
      sessionId: sessionIdRef.current,
      getToken: getTokenRef.current,
    });
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { cache: "no-store", ...init, headers });
  }, []);

  const loadLocks = useCallback(async (
    generation = getAccountGeneration(),
    signal?: AbortSignal,
  ) => {
    try {
      const r = await clerkFetch(`${API_BASE}/my-price-locks`, { signal });
      if (!isCurrentAccountGeneration(generation)) return;
      if (!r.ok) return;
      const data = await r.json();
      if (!isCurrentAccountGeneration(generation)) return;
      if (data.ok && Array.isArray(data.locks)) {
        const active = (data.locks as PriceLock[]).filter((l) => l.status === "active" && l.expiresAt);
        setLocks(active);
      }
    } catch { /* non-fatal */ }
  }, [clerkFetch, getAccountGeneration, isCurrentAccountGeneration]);

  // Tick countdown every minute
  useEffect(() => {
    if (!locks.length) return;
    const tick = () => {
      const next: Record<number, string> = {};
      locks.forEach((l) => {
        if (l.expiresAt) next[l.id] = fmtLockCountdown(l.expiresAt);
      });
      setLockCountdowns(next);
      // Expire locks that have run out
      setLocks((prev) => prev.filter((l) => l.expiresAt && new Date(l.expiresAt).getTime() > Date.now()));
    };
    tick();
    lockTimerRef.current = setInterval(tick, 60_000);
    return () => { if (lockTimerRef.current) clearInterval(lockTimerRef.current); };
  }, [locks.length]);

  const loadProfile = useCallback((): Promise<UserProfile | null> => {
    const inFlight = accountLoadRef.current;
    if (inFlight?.accountKey === accountKey) return inFlight.promise;
    inFlight?.controller.abort();

    const generation = getAccountGeneration();
    const controller = new AbortController();
    const promise = (async () => {
      setLoading(true);
      try {
        const meRes = await clerkFetch(`${API_BASE}/auth/me`, { signal: controller.signal });
        const me = await meRes.json();
        if (!isCurrentAccountGeneration(generation)) return null;
        if (me.user) {
          const [profRes, balanceRes] = await Promise.all([
            clerkFetch(`${API_BASE}/auth/profile`, { signal: controller.signal }),
            clerkFetch(`${API_BASE}/loyalty/balance`, { signal: controller.signal }).catch(() => null),
          ]);
          const prof = await profRes.json();
          const balance = balanceRes?.ok ? await balanceRes.json() : null;
          if (!isCurrentAccountGeneration(generation)) return null;
          let loadedProfile: UserProfile | null = null;
          if (prof.ok) {
            loadedProfile = prof.user as UserProfile;
            setProfile(loadedProfile);
            setBookings(prof.bookings || []);
            setBalanceNotifications(prof.notifications || []);
            await loadLocks(generation, controller.signal);
          }
          if (!isCurrentAccountGeneration(generation)) return null;
          setLoyaltyBalance(balance?.ok ? {
            expiringSoonPoints: Number(balance.expiringSoonPoints) || 0,
            expiringSoonEarliest: balance.expiringSoonEarliest ?? null,
          } : null);
          return loadedProfile;
        } else {
          setProfile(null);
          setLoyaltyBalance(null);
          setBookings([]);
          setBalanceNotifications([]);
          setLocks([]);
          return null;
        }
      } catch {
        if (isCurrentAccountGeneration(generation)) setProfile(null);
        return null;
      } finally {
        if (isCurrentAccountGeneration(generation)) setLoading(false);
      }
    })();
    accountLoadRef.current = { accountKey, controller, promise };
    void promise.finally(() => {
      if (accountLoadRef.current?.promise === promise) accountLoadRef.current = null;
    });
    return promise;
  }, [accountKey, clerkFetch, getAccountGeneration, isCurrentAccountGeneration, loadLocks]);

  useEffect(() => {
    if (!isClerkLoaded) return;
    accountLoadRef.current?.controller.abort();
    accountLoadRef.current = null;
    accountMutationControllerRef.current.abort();
    accountMutationControllerRef.current = new AbortController();
    setProfile(null);
    setLoyaltyBalance(null);
    setBookings([]);
    setBalanceNotifications([]);
    setLocks([]);
    setSelectedBooking(null);
    setDialog(null);
    setPrivacyExporting(false);
    setPrivacyCorrecting(false);
    setPrivacyDeleting(false);
    setCancelingOrderId(null);
    setContinuingOrderId(null);
    pendingWelcomeRef.current = false;
    setLoading(true);
  }, [accountKey, isClerkLoaded]);

  useEffect(() => () => {
    accountLoadRef.current?.controller.abort();
    accountMutationControllerRef.current.abort();
  }, []);

  useEffect(() => {
    if (!isClerkLoaded) return;
    void loadProfile();
  }, [accountKey, isClerkLoaded, loadProfile, sessionRefreshVersion]);

  const notifiedPortalUserRef = useRef<number | null>(null);
  useEffect(() => {
    if (!profile) {
      notifiedPortalUserRef.current = null;
      return;
    }
    if (notifiedPortalUserRef.current === profile.id) return;
    notifiedPortalUserRef.current = profile.id;
    void onAuthenticated?.();
  }, [onAuthenticated, profile]);

  useEffect(() => {
    if (dialog?.action !== "welcome") return;
    const timer = setTimeout(() => {
      setDialog(null);
      void (onLoginSuccess ?? onClose)?.();
    }, 3_000);
    return () => clearTimeout(timer);
  }, [dialog?.action, onClose, onLoginSuccess]);

  const handleAuth = async () => {
    setError("");
    if (!email.trim() || !password) { setError("Email and password are required"); return; }
    if (mode === "register" && !name.trim()) { setError("Full name is required"); return; }
    setSubmitting(true);
    try {
      if (!isClerkLoaded) throw new Error("Authentication is still loading");
      const emailAddress = email.trim().toLowerCase();
      if (mode === "login") {
        const { error: signInError } = await signIn.password({ emailAddress, password });
        if (signInError) throw signInError;
        if (signIn.status !== "complete") {
          throw new Error("Additional verification is required. Please use Google sign-in or contact support.");
        }
        await signIn.finalize({ navigate: async () => {} });
        pendingWelcomeRef.current = true;
      } else {
        const { error: signUpError } = await signUp.password({ emailAddress, password });
        if (signUpError) throw signUpError;
        await signUp.verifications.sendEmailCode();
        setAwaitingVerification(true);
        return;
      }
      linkPushTokenAfterAuth(await requestClerkToken({ sessionId, getToken })).catch(() => {});
      const authenticatedProfile = await loadProfile();
      if (!authenticatedProfile) throw new Error("Could not load your DT Tours profile");
      showWelcomeForProfile(authenticatedProfile);
    } catch (authError: any) {
      setError(authError?.errors?.[0]?.longMessage || authError?.message || "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifySignUp = async () => {
    if (!verificationCode.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await signUp.verifications.verifyEmailCode({ code: verificationCode.trim() });
      if (signUp.status !== "complete") throw new Error("Email verification is not complete");
      await signUp.finalize({ navigate: async () => {} });
      pendingWelcomeRef.current = true;
      const response = await clerkFetch(`${API_BASE}/auth/clerk/exchange`, { method: "POST" });
      if (!response.ok) throw new Error("Could not link your DT Tours account");
      if (name.trim() || phone.trim()) {
        await clerkFetch(`${API_BASE}/auth/update-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() || email.split("@")[0], phone: phone.trim() }),
        });
      }
      linkPushTokenAfterAuth(await requestClerkToken({ sessionId, getToken })).catch(() => {});
      setAwaitingVerification(false);
      const authenticatedProfile = await loadProfile();
      if (!authenticatedProfile) throw new Error("Could not load your DT Tours profile");
      showWelcomeForProfile(authenticatedProfile);
    } catch (authError: any) {
      setError(authError?.errors?.[0]?.longMessage || authError?.message || "Verification failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    if (!email.trim()) {
      setError(isArabic ? "أدخل بريدك الإلكتروني" : "Enter your email address");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { error: createError } = await signIn.create({
        identifier: email.trim().toLowerCase(),
      });
      if (createError) throw createError;
      const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
      if (sendError) throw sendError;
      setPasswordResetStage("verify");
    } catch (resetError: any) {
      setError(
        resetError?.errors?.[0]?.longMessage ||
        resetError?.message ||
        (isArabic ? "تعذر إرسال رمز إعادة التعيين" : "Could not send the reset code"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!passwordResetCode.trim() || !newPassword) {
      setError(isArabic ? "أدخل الرمز وكلمة المرور الجديدة" : "Enter the code and your new password");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { error: verifyError } = await signIn.resetPasswordEmailCode.verifyCode({
        code: passwordResetCode.trim(),
      });
      if (verifyError) throw verifyError;
      const { error: passwordError } = await signIn.resetPasswordEmailCode.submitPassword({
        password: newPassword,
        signOutOfOtherSessions: true,
      });
      if (passwordError) throw passwordError;
      if (signIn.status !== "complete") {
        throw new Error(isArabic ? "تعذر إكمال إعادة تعيين كلمة المرور" : "Password reset could not be completed");
      }
      await signIn.finalize({ navigate: async () => {} });
      setPasswordResetStage(null);
      setPasswordResetCode("");
      setNewPassword("");
      pendingWelcomeRef.current = true;
      const authenticatedProfile = await loadProfile();
      if (!authenticatedProfile) throw new Error("Could not load your DT Tours profile");
      showWelcomeForProfile(authenticatedProfile);
    } catch (resetError: any) {
      setError(
        resetError?.errors?.[0]?.longMessage ||
        resetError?.message ||
        (isArabic ? "فشل تغيير كلمة المرور" : "Password reset failed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    if (!signIn || !signUp) {
      setError(isArabic ? "خدمة Google قيد التحميل، حاول مرة أخرى" : "Google sign-in is still loading. Please try again.");
      return;
    }
    setSubmitting(true);
    try {
      if (Platform.OS === "web") {
        const redirectUrl = AuthSession.makeRedirectUri({ path: "app/sso-callback" });
        pendingWelcomeRef.current = true;
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem("dt-auth-welcome", "1");
            window.sessionStorage.setItem("dt-auth-language", language);
          } catch {}
        }
        await startWebGoogleRedirect(
          signIn,
          redirectUrl,
          (url) => window.location.assign(url),
        );
        return;
      }

      pendingWelcomeRef.current = true;
      let createdSessionId: string | null = null;
      let activateSession: ((params: { session: string }) => Promise<unknown>) | undefined;
      try {
        const nativeResult = await startGoogleAuthenticationFlow();
        createdSessionId = nativeResult.createdSessionId;
        activateSession = nativeResult.setActive;
        if (!createdSessionId || !activateSession) {
          pendingWelcomeRef.current = false;
          return;
        }
      } catch (nativeError) {
        if (!isAndroidAccountReauthFailure(nativeError)) throw nativeError;

        const redirectUrl = AuthSession.makeRedirectUri({
          scheme: "dttours",
          path: "sso-callback",
        });
        const { error: createError } = await signIn.create({
          strategy: "oauth_google",
          redirectUrl,
        });
        if (createError) throw createError;
        const authorizationUrl = signIn.firstFactorVerification.externalVerificationRedirectURL;
        if (!authorizationUrl) throw new Error("Google sign-in redirect was not created");

        const returnedUrl = await waitForNativeGoogleReturn(
          authorizationUrl.toString(),
          redirectUrl,
        );
        const rotatingTokenNonce = new URL(returnedUrl).searchParams.get("rotating_token_nonce") ?? "";
        if (!rotatingTokenNonce) throw new Error("Google did not return a valid sign-in response");

        const currentSignIn = (await client.signIn.reload({ rotatingTokenNonce })).__internal_future;
        const needsSignUp = currentSignIn.firstFactorVerification.status === "transferable";
        if (needsSignUp) {
          const { error: transferError } = await signUp.create({ transfer: true });
          if (transferError) throw transferError;
        }
        const completedResource = needsSignUp ? signUp : currentSignIn;
        createdSessionId = completedResource.createdSessionId;
        if (!createdSessionId) {
          throw new Error("Google sign-in could not be completed");
        }
        const { error: finalizeError } = await completedResource.finalize({
          navigate: async () => {},
        });
        if (finalizeError) throw finalizeError;
        activateSession = async ({ session }) => setClerkActive({ session });
      }

      await activateSession({ session: createdSessionId });
      let clerkToken: string | null = null;
      for (let attempt = 0; attempt < 6 && !clerkToken; attempt += 1) {
        clerkToken = await requestClerkToken({ sessionId: createdSessionId, getToken });
        if (!clerkToken && attempt < 5) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
      if (!clerkToken) throw new Error("Missing Clerk session token");
      const response = await fetch(`${API_BASE}/auth/clerk/exchange`, {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${clerkToken}` },
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Google sign-in failed");
      }
      linkPushTokenAfterAuth(clerkToken).catch(() => {});
      const authenticatedProfile = await loadProfile();
      if (!authenticatedProfile) throw new Error("Could not load your DT Tours profile");
      showWelcomeForProfile(authenticatedProfile);
    } catch (authError: any) {
      pendingWelcomeRef.current = false;
      if (Platform.OS === "web" && typeof window !== "undefined") {
        try { window.sessionStorage.removeItem("dt-auth-welcome"); } catch {}
      }
      setError(authError?.message || (isArabic ? "فشل تسجيل الدخول عبر Google" : "Google sign-in failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (isSignedIn) {
      if (Platform.OS === "web") {
        await signOut({ redirectUrl: AuthSession.makeRedirectUri({ path: "app" }) });
      } else {
        await signOut();
      }
    }
    setProfile(null);
    setLoyaltyBalance(null);
    setBookings([]);
    setBalanceNotifications([]);
    void onLoggedOut?.();
  };

  const openSupport = useCallback((context?: string) => {
    const message = context
      ? `Hello D.T. Tours support, I need help with booking ${context}.`
      : "Hello D.T. Tours support, I need help with my account.";
    Linking.openURL(`https://wa.me/96590087797?text=${encodeURIComponent(message)}`).catch(() => {});
  }, []);

  const requestPrivacyExport = async () => {
    if (privacyExporting) return;
    const generation = getAccountGeneration();
    setPrivacyExporting(true);
    try {
      const response = await clerkFetch(`${API_BASE}/privacy/requests`, {
        method: "POST",
        credentials: "include",
        signal: accountMutationControllerRef.current.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "access" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!isCurrentAccountGeneration(generation)) return;
      if (!response.ok || data.ok === false) throw new Error(data.error || copy.privacyExportError);
      setDialog({ kind: "info", title: copy.privacyAccess, message: copy.privacyExportSuccess });
    } catch (err) {
      if (!isCurrentAccountGeneration(generation)) return;
      setDialog({ kind: "info", title: copy.privacyAccess, message: err instanceof Error ? err.message : copy.privacyExportError });
    } finally {
      if (isCurrentAccountGeneration(generation)) setPrivacyExporting(false);
    }
  };

  const requestPrivacyCorrection = async () => {
    if (privacyCorrecting) return;
    const generation = getAccountGeneration();
    setPrivacyCorrecting(true);
    try {
      const response = await clerkFetch(`${API_BASE}/privacy/requests`, {
        method: "POST",
        credentials: "include",
        signal: accountMutationControllerRef.current.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "correction" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!isCurrentAccountGeneration(generation)) return;
      if (!response.ok || data.ok === false) throw new Error(data.error || copy.privacyExportError);
      setDialog({ kind: "info", title: copy.privacyCorrect, message: copy.privacyExportSuccess });
    } catch (err) {
      if (!isCurrentAccountGeneration(generation)) return;
      setDialog({ kind: "info", title: copy.privacyCorrect, message: err instanceof Error ? err.message : copy.privacyExportError });
    } finally {
      if (isCurrentAccountGeneration(generation)) setPrivacyCorrecting(false);
    }
  };

  const deletePrivacyAccount = async () => {
    if (privacyDeleting) return;
    const generation = getAccountGeneration();
    setPrivacyDeleting(true);
    try {
      const response = await clerkFetch(`${API_BASE}/privacy/requests`, {
        method: "POST",
        credentials: "include",
        signal: accountMutationControllerRef.current.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "deletion" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!isCurrentAccountGeneration(generation)) return;
      if (!response.ok || data.ok === false) throw new Error(data.error || copy.privacyDeleteError);
      setDialog({ kind: "info", title: copy.privacyDelete, message: copy.privacyDeleteSuccess });
    } catch (err) {
      if (!isCurrentAccountGeneration(generation)) return;
      setDialog({ kind: "info", title: copy.privacyDelete, message: err instanceof Error ? err.message : copy.privacyDeleteError });
    } finally {
      if (isCurrentAccountGeneration(generation)) setPrivacyDeleting(false);
    }
  };

  const cancelBooking = async (orderId: string) => {
    if (cancelingOrderId) return;
    const generation = getAccountGeneration();
    setCancelingOrderId(orderId);
    try {
      const response = await clerkFetch(`${API_BASE}/hotel-booking/cancel`, {
        method: "POST",
        signal: accountMutationControllerRef.current.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!isCurrentAccountGeneration(generation)) return;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to cancel this booking");
      }
      setBookings((current) => current.map((booking) => (
        booking.orderId === orderId
          ? { ...booking, status: "cancelled", canCancel: false }
          : booking
      )));
      setDialog({
        kind: "info",
        title: isArabic ? "تم إلغاء الحجز" : "Booking cancelled",
        message: isArabic
          ? "تم إلغاء حجز الفندق بنجاح. استرداد مبلغ الدفعة، إن كان مستحقًا، تتم مراجعته بشكل منفصل مع فريق دار التميز."
          : "The hotel booking was cancelled successfully. Any eligible payment refund is reviewed separately by D.T. Tours support.",
      });
      await loadProfile();
    } catch (err) {
      if (!isCurrentAccountGeneration(generation)) return;
      setDialog({
        kind: "info",
        title: isArabic ? "تعذّر إلغاء الحجز" : "Cancellation unavailable",
        message: err instanceof Error
          ? err.message
          : isArabic
            ? "تعذّر إتمام الإلغاء الآن. يمكنك المحاولة مرة أخرى أو التواصل مع فريق الدعم."
            : "The cancellation could not be completed. Please try again or contact support.",
        showSupport: true,
      });
    } finally {
      if (isCurrentAccountGeneration(generation)) setCancelingOrderId(null);
    }
  };

  const requestCancelBooking = (booking: Booking) => {
    setDialog({
      kind: "confirm",
      title: isArabic ? "إلغاء الحجز" : "Cancel booking",
      message: isArabic
        ? `هل تريد إلغاء حجز ${booking.hotelName || "الفندق"}؟ هذا الإجراء لا يمكن التراجع عنه.`
        : `Do you want to cancel the booking for ${booking.hotelName || "this hotel"}? This action cannot be undone.`,
      orderId: booking.orderId,
    });
  };

  const openBookingDetails = (booking: Booking) => {
    setSelectedBooking(booking);
  };

  const continueBookingPayment = async (orderId: string) => {
    if (continuingOrderId) return;
    const generation = getAccountGeneration();
    setContinuingOrderId(orderId);
    try {
      const response = await clerkFetch(`${API_BASE}/hotel-booking/retry-payment`, {
        method: "POST",
        signal: accountMutationControllerRef.current.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, source: "native" }),
      });
      const data = await response.json();
      if (!isCurrentAccountGeneration(generation)) return;
      if (!response.ok || !data.ok || typeof data.url !== "string") {
        throw new Error(data.error || "Unable to continue payment");
      }
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        "dttours://hotel-payment-return",
      );
      if (!isCurrentAccountGeneration(generation)) return;
      if (result.type === "success") {
        const paymentReturn = parseHotelPaymentReturnUrl(result.url);
        if (paymentReturn) {
          const resultPath = paymentReturn.status === "failed"
            ? "hotel-payment-failed"
            : "hotel-payment-success";
          onOpenHotelPortal?.(
            `${API_BASE}/${resultPath}?orderId=${encodeURIComponent(paymentReturn.orderId)}`,
          );
        }
      }
      await loadProfile();
    } catch (err) {
      if (!isCurrentAccountGeneration(generation)) return;
      setDialog({
        kind: "info",
        title: isArabic ? "تعذّر إكمال الدفع" : "Payment unavailable",
        message: err instanceof Error ? err.message : isArabic ? "يرجى المحاولة مرة أخرى." : "Please try again.",
        showSupport: true,
      });
    } finally {
      if (isCurrentAccountGeneration(generation)) setContinuingOrderId(null);
    }
  };

  const continuePriceLock = async (lock: PriceLock) => {
    if (!lock.guestToken) {
      setDialog({
        kind: "info",
        title: isArabic ? "تعذّر فتح الحجز" : "Unable to continue",
        message: isArabic ? "يرجى تحديث الصفحة والمحاولة مرة أخرى." : "Refresh the page and try again.",
      });
      return;
    }
    const url = `https://dt-tour.com/hotels?resumeLock=${encodeURIComponent(lock.id)}&gt=${encodeURIComponent(lock.guestToken)}`;
    try {
      if (onOpenHotelPortal) {
        onOpenHotelPortal(url);
      } else {
        await Linking.openURL(url);
      }
    } catch {
      setDialog({
        kind: "info",
        title: isArabic ? "تعذّر فتح الحجز" : "Unable to continue",
        message: isArabic ? "تعذّر فتح الحجز الآن. يرجى المحاولة مرة أخرى." : "The booking cannot be opened right now. Please try again.",
      });
    }
  };

  if (loading) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        {onClose && (
          <Pressable onPress={onClose} style={[s.closeButton, s.closeButtonFloating]} accessibilityRole="button" accessibilityLabel="Back">
            <HotelPortalIcon name="arrow-back" size={20} color="#003580" />
             <Text style={s.closeButtonText}>{isArabic ? "رجوع" : "Back"}</Text>
          </Pressable>
        )}
        <ActivityIndicator color="#003580" size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <ScrollView style={[s.authContainer, { paddingTop: insets.top + 12 }]} contentContainerStyle={s.authContent}>
        {onClose && (
          <Pressable onPress={onClose} style={s.authCloseButton} accessibilityRole="button" accessibilityLabel="Back">
            <HotelPortalIcon name="arrow-back" size={20} color="#003580" />
             <Text style={s.authCloseButtonText}>{isArabic ? "رجوع" : "Back"}</Text>
          </Pressable>
        )}
        <View style={s.authHeading}>
          <View style={s.authLogoFrame}>
            <Image
              source={require("../assets/images/dt-tours-logo-transparent.png")}
              style={s.authLogo}
              resizeMode="contain"
              accessibilityLabel="Dar AlTamaiz Tours"
            />
          </View>
          <Text style={s.screenTitle}>{isArabic ? "حسابي" : "My Account"}</Text>
          <Text style={s.authSubtitle}>{isArabic ? "أدر حجوزاتك ومكافآتك بسهولة." : "Manage your bookings and rewards with ease."}</Text>
        </View>
        <View style={s.authBox}>
          <View style={s.modeTabs}>
            <Pressable onPress={() => { setMode("login"); setAwaitingVerification(false); setPasswordResetStage(null); setError(""); }} style={[s.modeTab, mode === "login" && s.modeTabActive]} accessibilityRole="tab" accessibilityState={{ selected: mode === "login" }}>
              <Text style={[s.modeTabText, mode === "login" && s.modeTabTextActive]}>{isArabic ? "دخول" : "Login"}</Text>
            </Pressable>
            <Pressable onPress={() => { setMode("register"); setAwaitingVerification(false); setPasswordResetStage(null); setError(""); }} style={[s.modeTab, mode === "register" && s.modeTabActive]} accessibilityRole="tab" accessibilityState={{ selected: mode === "register" }}>
              <Text style={[s.modeTabText, mode === "register" && s.modeTabTextActive]}>{isArabic ? "تسجيل" : "Register"}</Text>
            </Pressable>
          </View>
          {passwordResetStage ? (
            <>
              <Text style={s.forgotHint}>
                {passwordResetStage === "request"
                  ? isArabic ? "أدخل بريدك الإلكتروني وسنرسل لك رمزاً لتغيير كلمة المرور." : "Enter your email and we’ll send you a code to change your password."
                  : isArabic ? "أدخل الرمز المرسل إلى بريدك وكلمة المرور الجديدة." : "Enter the code sent to your email and choose a new password."}
              </Text>
              {passwordResetStage === "request" ? (
                <>
                  <Text style={s.fieldLabel}>{isArabic ? "البريد الإلكتروني" : "Email address"}</Text>
                  <TextInput
                    style={s.input}
                    placeholder="name@example.com"
                    placeholderTextColor="#6b7280"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    testID="password-reset-email"
                  />
                </>
              ) : (
                <>
                  <Text style={s.fieldLabel}>{isArabic ? "رمز التحقق" : "Verification code"}</Text>
                  <TextInput
                    style={s.input}
                    placeholder="123456"
                    placeholderTextColor="#6b7280"
                    value={passwordResetCode}
                    onChangeText={setPasswordResetCode}
                    keyboardType="number-pad"
                    testID="password-reset-code"
                  />
                  <Text style={s.fieldLabel}>{isArabic ? "كلمة المرور الجديدة" : "New password"}</Text>
                  <TextInput
                    style={s.input}
                    placeholder={isArabic ? "أدخل كلمة المرور الجديدة" : "Enter your new password"}
                    placeholderTextColor="#6b7280"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    testID="password-reset-new-password"
                  />
                </>
              )}
              {!!error && <Text style={s.errorText}>{error}</Text>}
              <Pressable
                style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={passwordResetStage === "request" ? handleRequestPasswordReset : handleResetPassword}
                disabled={submitting}
                testID="password-reset-submit"
              >
                <Text style={s.submitBtnText}>
                  {submitting
                    ? "..."
                    : passwordResetStage === "request"
                      ? isArabic ? "إرسال الرمز" : "Send reset code"
                      : isArabic ? "تغيير كلمة المرور" : "Change password"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { setPasswordResetStage(null); setError(""); }}
                style={s.backToLogin}
                testID="password-reset-back"
              >
                <Text style={s.backToLoginText}>{isArabic ? "العودة لتسجيل الدخول" : "Back to login"}</Text>
              </Pressable>
            </>
          ) : awaitingVerification ? (
            <>
              <Text style={s.forgotHint}>{isArabic ? "أدخل رمز التحقق المرسل إلى بريدك الإلكتروني." : "Enter the verification code sent to your email."}</Text>
              <TextInput
                style={s.input}
                placeholder="123456"
                placeholderTextColor="#6b7280"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                testID="clerk-verification-code"
              />
              {!!error && <Text style={s.errorText}>{error}</Text>}
              <Pressable
                style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleVerifySignUp}
                disabled={submitting}
                testID="clerk-verification-submit"
              >
                <Text style={s.submitBtnText}>
                  {submitting ? "..." : isArabic ? "تأكيد البريد" : "Verify email"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { setAwaitingVerification(false); setError(""); }}
                style={s.backToLogin}
                testID="back-to-registration"
              >
                <Text style={s.backToLoginText}>{isArabic ? "العودة" : "Back"}</Text>
              </Pressable>
            </>
          ) : (
            <>
              {mode === "register" && (
                <>
                  <Text style={s.fieldLabel}>{isArabic ? "الاسم الكامل" : "Full name"}</Text>
                  <TextInput style={s.input} placeholder={isArabic ? "أدخل اسمك الكامل" : "Enter your full name"} placeholderTextColor="#6b7280"
                    value={name} onChangeText={setName} autoCapitalize="words" />
                  <Text style={s.fieldLabel}>{isArabic ? "رقم الهاتف" : "Phone number"}</Text>
                  <TextInput style={s.input} placeholder={isArabic ? "أدخل رقم هاتفك" : "Enter your phone number"} placeholderTextColor="#6b7280"
                    value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                </>
              )}
              <Text style={s.fieldLabel}>{isArabic ? "البريد الإلكتروني" : "Email address"}</Text>
              <TextInput style={s.input} placeholder="name@example.com" placeholderTextColor="#6b7280"
                value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <Text style={s.fieldLabel}>{isArabic ? "كلمة المرور" : "Password"}</Text>
              <TextInput style={s.input} placeholder={isArabic ? "أدخل كلمة المرور" : "Enter your password"} placeholderTextColor="#6b7280"
                value={password} onChangeText={setPassword} secureTextEntry />
              {mode === "login" && (
                <Pressable
                  style={s.forgotLink}
                  onPress={() => { setPasswordResetStage("request"); setError(""); }}
                  testID="forgot-password"
                >
                  <Text style={s.forgotLinkText}>{isArabic ? "نسيت كلمة المرور؟" : "Forgot password?"}</Text>
                </Pressable>
              )}
              <Text style={s.forgotHint}>
                {isArabic
                  ? "لديك حساب قديم؟ أنشئ حساباً بنفس البريد أو تابع باستخدام Google لاستعادة حجوزاتك ونقاطك."
                  : "Existing customer? Create an account with the same email, or continue with Google, to restore your bookings and points."}
              </Text>
              {!!error && <Text style={s.errorText}>{error}</Text>}
              <Pressable style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleAuth} disabled={submitting}>
                <Text style={s.submitBtnText}>
                  {submitting ? "..." : mode === "login" ? (isArabic ? "تسجيل دخول" : "Sign In") : (isArabic ? "إنشاء حساب" : "Create Account")}
                </Text>
              </Pressable>
              <View style={s.authDivider}>
                <View style={s.authDividerLine} />
                <Text style={s.authDividerText}>{isArabic ? "أو" : "OR"}</Text>
                <View style={s.authDividerLine} />
              </View>
              <Pressable
                style={[s.googleBtn, submitting && { opacity: 0.6 }]}
                onPress={handleGoogleAuth}
                disabled={submitting}
                testID="google-auth-button"
                accessibilityRole="button"
                accessibilityLabel={isArabic ? "المتابعة باستخدام Google" : "Continue with Google"}
              >
                <Ionicons name="logo-google" size={19} color="#1A73E8" />
                <Text style={s.googleBtnText}>
                  {isArabic ? "المتابعة باستخدام Google" : "Continue with Google"}
                </Text>
              </Pressable>
            </>
          )}
        </View>
        <Text style={s.authNote}>{isArabic ? "سجّل حسابك لتتبع حجوزاتك وتجميع نقاط التميز والحصول على استرداد نقدي." : "Create an account to track bookings, earn Tamayuz points, and get cashback."}</Text>
      </ScrollView>
    );
  }

  const tier = profile.loyaltyTier || "new";
  const tierLabel = isArabic
    ? (TIER_LABELS[tier] || tier)
    : ({ new: "New Tamayuz", silver: "Silver Tamayuz", gold: "Gold Tamayuz" }[tier] || tier);
  const expiringSoonPoints = loyaltyBalance?.expiringSoonPoints ?? 0;
  const expiryDate = formatExpiryDate(loyaltyBalance?.expiringSoonEarliest);
  // Some Samsung Android navigation modes report a zero bottom inset even
  // though the three-button navigation bar still overlays the app window.
  // Keep the account action clear of that area with a conservative fallback.
  const bottomSafeSpace = Math.max(insets.bottom, 24);

  if (accountView === "settings") {
    return (
      <View style={[s.settingsScreen, { paddingTop: insets.top }]}>
        <View style={s.settingsHeader}>
          <Pressable
            onPress={() => setAccountView("overview")}
            style={s.settingsBackButton}
            accessibilityRole="button"
            accessibilityLabel={isArabic ? "العودة إلى حسابي" : "Back to My Account"}
            testID="account-settings-back"
          >
            <HotelPortalIcon name="arrow-back" size={21} color="#003580" />
          </Pressable>
          <Text style={s.settingsTitle}>{isArabic ? "الإعدادات" : "Settings"}</Text>
          <View style={s.settingsHeaderSpacer} />
        </View>
        <ScrollView
          contentContainerStyle={[s.settingsContent, { paddingBottom: bottomSafeSpace + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.settingsCard} testID="hotel-price-display-settings">
            <View style={s.settingsOption}>
              <View style={s.settingsOptionCopy}>
                <Text style={[s.settingsOptionTitle, isArabic && s.rtlText]}>
                  {isArabic ? "عرض السعر" : "Price display"}
                </Text>
                <Text style={[s.settingsOptionHint, isArabic && s.rtlText]}>
                  {isArabic ? "اختر طريقة عرض أسعار الفنادق" : "Choose how hotel prices are shown"}
                </Text>
              </View>
              <View style={s.settingsChoices}>
                {(["per-night", "total-stay"] as const).map((priceDisplay) => (
                  <Pressable
                    key={priceDisplay}
                    testID={`price-display-${priceDisplay}`}
                    onPress={() => onHotelDisplayPreferencesChange?.({ ...hotelDisplayPreferences, priceDisplay })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: hotelDisplayPreferences.priceDisplay === priceDisplay }}
                    style={[s.settingsChoice, hotelDisplayPreferences.priceDisplay === priceDisplay && s.settingsChoiceActive]}
                  >
                    <Text style={[s.settingsChoiceText, hotelDisplayPreferences.priceDisplay === priceDisplay && s.settingsChoiceTextActive]}>
                      {priceDisplay === "per-night" ? (isArabic ? "لكل ليلة" : "Per night") : (isArabic ? "الإجمالي" : "Total stay")}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={s.settingsDivider} />
            <View style={s.settingsOption}>
              <View style={s.settingsOptionCopy}>
                <Text style={[s.settingsOptionTitle, isArabic && s.rtlText]}>
                  {isArabic ? "عملة العرض" : "Display currency"}
                </Text>
                <Text style={[s.settingsOptionHint, isArabic && s.rtlText]}>
                  {isArabic ? "1 د.ك = 3.2 دولار أمريكي" : "1 KWD = 3.2 USD"}
                </Text>
              </View>
              <View style={s.settingsChoices}>
                {(["KWD", "USD"] as const).map((currency) => (
                  <Pressable
                    key={currency}
                    testID={`hotel-currency-${currency}`}
                    onPress={() => onHotelDisplayPreferencesChange?.({ ...hotelDisplayPreferences, currency })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: hotelDisplayPreferences.currency === currency }}
                    style={[s.settingsChoice, hotelDisplayPreferences.currency === currency && s.settingsChoiceActive]}
                  >
                    <Text style={[s.settingsChoiceText, hotelDisplayPreferences.currency === currency && s.settingsChoiceTextActive]}>
                      {currency}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          <View style={s.settingsPreviewCard}>
            <Text style={[s.settingsPreviewLabel, isArabic && s.rtlText]}>
              {isArabic ? "معاينة" : "Preview"}
            </Text>
            <Text style={[s.settingsPreviewValue, isArabic && s.rtlText]}>
              {formatHotelDisplayPrice(10, hotelDisplayPreferences)}
            </Text>
            <Text style={[s.settingsPreviewHint, isArabic && s.rtlText]}>
              {hotelDisplayPreferences.priceDisplay === "per-night"
                ? (isArabic ? "لكل ليلة · للعرض فقط" : "Per night · Display only")
                : (isArabic ? "إجمالي الإقامة · للعرض فقط" : "Total stay · Display only")}
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={[s.container, { paddingTop: insets.top }]}
        contentContainerStyle={{ paddingBottom: bottomSafeSpace + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {onClose && (
          <Pressable
            onPress={onClose}
            style={[s.closeButton, { marginHorizontal: 16, marginTop: 12 }]}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <HotelPortalIcon name="arrow-back" size={18} color="#003580" />
            <Text style={s.closeButtonText}>{isArabic ? "رجوع" : "Back"}</Text>
          </Pressable>
        )}

        <View style={s.profileHero}>
          <View style={s.heroTopLine}>
            <Text style={s.heroEyebrow}>{copy.eyebrow}</Text>
            <View style={s.heroShield}>
              <HotelPortalIcon name="check" size={14} color="#D4AF37" />
            </View>
          </View>
          <View style={s.heroIdentity}>
            <View style={s.avatarCircle}>
              <Text style={s.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={s.heroCopy}>
              <Text style={s.profileName} numberOfLines={1}>{profile.name}</Text>
              <Text style={s.profileEmail} numberOfLines={1}>{profile.email}</Text>
              <View style={[s.tierBadge, { borderColor: TIER_COLORS[tier] || "#D4AF37" }]}>
                <Text style={[s.tierText, { color: TIER_COLORS[tier] || "#D4AF37" }]}>
                  {TIER_EMOJIS[tier] || "•"}  {tierLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={s.summaryCard}>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{profile.bookingCount}</Text>
             <Text style={s.summaryLabel}>{copy.bookings}</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{profile.pointsBalance.toLocaleString()}</Text>
             <Text style={s.summaryLabel}>{copy.points}</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={[s.summaryValue, { color: TIER_COLORS[tier] || "#D4AF37" }]}>
               {tierLabel}
            </Text>
             <Text style={s.summaryLabel}>{copy.currentLevel}</Text>
          </View>
        </View>

      {balanceNotifications.length > 0 && (
        <View style={s.section} testID="account-balance-notifications">
          <View style={s.sectionHeadingRow}>
            <Ionicons name="notifications-outline" size={18} color="#0A192F" />
            <Text style={s.sectionTitle}>{isArabic ? "إشعارات الحجوزات" : "Booking notifications"}</Text>
          </View>
          {balanceNotifications.map((notice) => (
            <View key={notice.orderId} style={s.policyHint}>
              <Ionicons name="alert-circle-outline" size={18} color="#147A4B" />
              <Text style={s.policyHintText}>
                {isArabic
                  ? `${notice.stage === "3" ? "التذكير الأخير" : "تذكير بسداد الرصيد"} · ${notice.hotelName}: ${notice.balanceKWD} د.ك قبل ${formatBalanceDeadline(notice.deadline)}. يجب السداد قبل الوصول بـ 48 ساعة أو قبل موعد الإلغاء المجاني إن كان أبكر. عدم السداد يؤدي إلى الإلغاء تلقائياً وعدم استرداد المبلغ المدفوع. افتح حجزك لسداد الرصيد.`
                  : `${notice.stage === "3" ? "Final reminder" : "Balance reminder"} · ${notice.hotelName}: Pay KWD ${notice.balanceKWD} by ${formatBalanceDeadline(notice.deadline)}. The balance is due at least 48 hours before check-in or by the earlier free-cancellation deadline. If unpaid, the booking is cancelled automatically and payments become non-refundable. Open your booking to pay.`}
              </Text>
            </View>
          ))}
        </View>
      )}

      {expiringSoonPoints > 0 && (
        <View
          style={[
            s.expiryBanner,
            {
              backgroundColor: theme.warningBackground,
              borderColor: theme.warningBorder,
            },
          ]}
          testID="loyalty-expiry-warning"
          accessibilityRole="alert"
        >
          <Ionicons name="time-outline" size={22} color={theme.warningForeground} />
          <View style={s.expiryCopy}>
              <Text style={[s.expiryTitle, { color: theme.warningForeground }]}>
               {isArabic
                 ? `${expiringSoonPoints.toLocaleString()} نقطة ستنتهي قريباً`
                 : `${expiringSoonPoints.toLocaleString()} points expiring soon`}
            </Text>
            {expiryDate ? (
              <Text style={[s.expirySub, { color: theme.warningMutedForeground }]}>
                 {isArabic
                   ? `أقرب تاريخ انتهاء: ${expiryDate} — استخدمها قبل انتهاء صلاحيتها`
                   : `Earliest expiry: ${expiryDate} — use them before they expire`}
              </Text>
            ) : null}
          </View>
        </View>
      )}

        <Pressable
          style={({ pressed }) => [s.settingsEntry, pressed && s.settingsEntryPressed, { marginBottom: 16 }]}
          onPress={() => onOpenCart?.()}
          accessibilityRole="button"
          accessibilityLabel={isArabic ? "فتح سلتي" : "Open My Cart"}
          testID="account-cart-entry"
        >
          <View style={s.settingsEntryIcon}>
            <Ionicons name="cart-outline" size={18} color="#003580" />
          </View>
          <View style={s.settingsEntryCopy}>
            <Text style={[s.settingsEntryTitle, isArabic && s.rtlText]}>
              {isArabic ? "سلتي" : "My Cart"}
            </Text>
            <Text style={[s.settingsEntryValue, isArabic && s.rtlText]}>
              {isArabic ? "عرض سلة التسوق الخاصة بك" : "View your travel store cart"}
            </Text>
          </View>
          <HotelPortalIcon name={isArabic ? "chevron-back" : "chevron-forward"} size={18} color="#94A3B8" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [s.settingsEntry, pressed && s.settingsEntryPressed]}
          onPress={() => setAccountView("settings")}
          accessibilityRole="button"
          accessibilityLabel={isArabic ? "فتح الإعدادات" : "Open Settings"}
          testID="account-settings-entry"
        >
          <View style={s.settingsEntryIcon}>
            <Ionicons name="settings-outline" size={18} color="#003580" />
          </View>
          <View style={s.settingsEntryCopy}>
            <Text style={[s.settingsEntryTitle, isArabic && s.rtlText]}>
              {isArabic ? "الإعدادات" : "Settings"}
            </Text>
            <Text style={[s.settingsEntryValue, isArabic && s.rtlText]}>
              {hotelDisplayPreferences.priceDisplay === "per-night"
                ? (isArabic ? "لكل ليلة" : "Per night")
                : (isArabic ? "إجمالي الإقامة" : "Total stay")}
              {" · "}
              {hotelDisplayPreferences.currency}
            </Text>
          </View>
          <HotelPortalIcon name={isArabic ? "chevron-back" : "chevron-forward"} size={18} color="#94A3B8" />
        </Pressable>

        {/* Price locks (On Hold) */}
        {locks.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeadingRow}>
              <View style={s.sectionHeadingIcon}>
                <Ionicons name="lock-closed-outline" size={16} color="#003580" />
              </View>
              <View style={s.sectionHeadingCopy}>
                 <Text style={s.sectionTitle}>{copy.savedBookings}</Text>
                 <Text style={s.sectionSubtitle}>{copy.savedBookingsSubtitle}</Text>
              </View>
              <View style={s.countBadge}><Text style={s.countBadgeText}>{locks.length}</Text></View>
            </View>
            {locks.map((lock, idx) => {
              const cd = lockCountdowns[lock.id] || "";
              return (
                <Pressable
                  key={lock.id}
                  onPress={() => continuePriceLock(lock)}
                  style={[s.lockCard, idx < locks.length - 1 && s.listDivider]}
                  accessibilityRole="button"
                   accessibilityLabel={`${copy.continue} ${lock.hotelName || (isArabic ? "الفندق" : "hotel")}`}
                    testID={`continue-price-lock-${lock.id}`}
                >
                  <View style={s.bookingCardHeader}>
                    <View style={s.hotelIdentity}>
                      <View style={s.hotelIcon}><HotelPortalIcon name="building" size={18} color="#003580" /></View>
                       <Text style={s.lockHotelName} numberOfLines={2}>{lock.hotelName || copy.priceHeld}</Text>
                    </View>
                    {cd ? <View style={s.lockCdBadge}><Ionicons name="time-outline" size={13} color="#003580" /><Text style={s.lockCdText}>{cd}</Text></View> : null}
                  </View>
                  {lock.roomName ? <Text style={s.lockMeta}>{lock.roomName}</Text> : null}
                  <Text style={s.lockMeta}>{formatBookingDate(lock.checkin)} → {formatBookingDate(lock.checkout)}</Text>
                  <View style={s.lockBottomRow}>
                     <Text style={s.lockPrice}>{lock.lockedPriceKwd ? `KWD ${parseFloat(lock.lockedPriceKwd).toFixed(3)}` : copy.priceHeld}</Text>
                     <Text style={s.lockAction}>{copy.continue} <Ionicons name="arrow-forward" size={12} color="#003580" /></Text>
                  </View>
                   {cd ? <Text style={s.lockExpiry}>{copy.priceProtectedFor(cd)}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Recent bookings */}
        <View style={s.section}>
          <View style={[s.sectionHeadingRow, s.bookingSectionHeading]}>
            <View style={[s.sectionHeadingIcon, s.bookingSectionHeadingIcon]}>
              <Ionicons name="briefcase-outline" size={16} color="#0A192F" />
            </View>
            <View style={s.sectionHeadingCopy}>
                 <Text style={[s.sectionTitle, s.bookingSectionTitle]}>{copy.myBookings}</Text>
                 <Text style={[s.sectionSubtitle, s.bookingSectionSubtitle]}>{copy.myBookingsSubtitle}</Text>
            </View>
            {bookings.length > 0 && (
              <View style={[s.countBadge, s.bookingSectionCountBadge]}>
                <Text style={[s.countBadgeText, s.bookingSectionCountText]}>{bookings.length}</Text>
              </View>
            )}
          </View>
          {bookings.length === 0 ? (
            <View style={s.emptyBookings}>
              <View style={s.emptyIcon}><Ionicons name="calendar-outline" size={22} color="#64748B" /></View>
               <Text style={s.emptyTitle}>{copy.noBookings}</Text>
               <Text style={s.emptySub}>{copy.noBookingsBody}</Text>
            </View>
          ) : bookings.map((b, index) => {
            const isConfirmed = b.status === "confirmed";
            const isCancelled = b.status === "cancelled";
            const statusBg = isConfirmed ? "#E8F7EF" : isCancelled ? "#FEF0F0" : "#FFF7DD";
            const statusColor = isConfirmed ? "#147A4B" : isCancelled ? "#B42318" : "#9A6700";
             const statusLabel = isConfirmed
               ? (isArabic ? "مؤكد" : "Confirmed")
               : isCancelled
                 ? (isArabic ? "ملغى" : "Cancelled")
                 : b.status === "pending_payment"
                   ? (isArabic ? "بانتظار الدفع" : "Payment due")
                   : (isArabic ? "قيد المعالجة" : "Processing");
            const statusIcon = isConfirmed ? "checkmark-circle" : isCancelled ? "close-circle" : "time-outline";
            return (
               <View key={b.orderId} style={[s.bookingCard, index < bookings.length - 1 && s.bookingListDivider, isCancelled && s.cancelledCard]}>
                <Pressable
                  onPress={() => openBookingDetails(b)}
                  style={({ pressed }) => [s.bookingDetailsArea, pressed && s.bookingDetailsPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`${copy.viewBookingDetails}: ${b.hotelName || (isArabic ? "حجز فندق" : "Hotel booking")}`}
                  testID={`booking-details-${b.orderId}`}
                >
                  <View style={s.bookingCardHeader}>
                    <View style={s.hotelIdentity}>
                      <View style={s.hotelIcon}><HotelPortalIcon name="building" size={18} color="#003580" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.bookingHotelName} numberOfLines={2}>{b.hotelName || (isArabic ? "حجز فندق" : "Hotel booking")}</Text>
                        <Text style={s.bookingCreated}>{copy.booked} {formatBookingDate(b.createdAt.slice(0, 10))}</Text>
                      </View>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: statusBg }]}>
                      <Ionicons name={statusIcon as any} size={13} color={statusColor} />
                      <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                  </View>

                  <View style={s.bookingInfoGrid}>
                    <View style={s.bookingInfoItem}>
                      <Ionicons name="calendar-outline" size={16} color="#64748B" />
                      <View style={{ flex: 1 }}>
                        <Text style={s.bookingInfoLabel}>{copy.stayDates}</Text>
                        <Text style={s.bookingInfoValue}>{formatBookingDate(b.checkin)} → {formatBookingDate(b.checkout)}</Text>
                      </View>
                    </View>
                    <View style={s.bookingInfoItem}>
                      <Ionicons name="wallet-outline" size={16} color="#64748B" />
                      <View style={{ flex: 1 }}>
                        <Text style={s.bookingInfoLabel}>{copy.total}</Text>
                        <Text style={s.bookingInfoValue}>{b.totalKWD ? `KWD ${b.totalKWD}` : copy.paymentPending}</Text>
                      </View>
                    </View>
                  </View>

                  {b.roomName ? (
                    <View style={s.detailLine}>
                      <Ionicons name="bed-outline" size={15} color="#64748B" />
                      <Text style={s.detailLineText}>{b.roomName}{b.rooms && b.rooms !== "1" ? ` · ${copy.rooms(b.rooms)}` : ""}</Text>
                    </View>
                  ) : null}

                  {b.balanceReminder ? (
                    <View style={s.policyHint} accessibilityRole="alert" testID={`balance-reminder-${b.orderId}`}>
                      <Ionicons name="notifications-outline" size={16} color="#147A4B" />
                      <Text style={s.policyHintText}>
                        {isArabic
                          ? `${b.balanceReminder.stage === "3" ? "التذكير الأخير" : "تذكير بسداد الرصيد"}: ${b.balanceReminder.balanceKWD} د.ك قبل ${formatBalanceDeadline(b.balanceReminder.deadline)}`
                          : `${b.balanceReminder.stage === "3" ? "Final reminder" : "Balance reminder"}: Pay KWD ${b.balanceReminder.balanceKWD} by ${formatBalanceDeadline(b.balanceReminder.deadline)}`}
                      </Text>
                    </View>
                  ) : null}

                  {b.rhOrderId ? (
                    <View style={s.referenceRow}>
                      <View>
                        <Text style={s.referenceLabel}>{copy.hotelConfirmation}</Text>
                        <Text style={s.referenceValue}>{b.rhOrderId}</Text>
                      </View>
                      <Ionicons name="shield-checkmark-outline" size={20} color="#147A4B" />
                    </View>
                  ) : b.isPaid ? (
                    <View style={s.referenceRow}>
                      <View>
                        <Text style={s.referenceLabel}>{copy.hotelConfirmation}</Text>
                        <Text style={s.referencePending}>{copy.confirmingWithHotel}</Text>
                      </View>
                      <Ionicons name="sync-outline" size={20} color="#9A6700" />
                    </View>
                  ) : null}

                  {isConfirmed && b.cancelBefore ? (
                    <View style={s.policyHint}>
                      <Ionicons name="information-circle-outline" size={16} color="#147A4B" />
                      <Text style={s.policyHintText}>{copy.freeCancellationUntil(formatExpiryDate(b.cancelBefore))}</Text>
                    </View>
                  ) : isCancelled ? (
                    <View style={s.policyHintCancelled}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#147A4B" />
                      <Text style={s.policyHintText}>{copy.cancellationProcessed}</Text>
                    </View>
                  ) : null}

                  <Text style={s.bookingInternalRef}>{copy.bookingReference}: #{b.orderId}</Text>
                </Pressable>
                {b.status === "pending_payment" && (
                  <Pressable
                    style={[s.primaryAction, continuingOrderId === b.orderId && s.disabledAction]}
                    disabled={continuingOrderId === b.orderId}
                    onPress={() => continueBookingPayment(b.orderId)}
                    testID={`continue-payment-${b.orderId}`}
                  >
                    <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                    <Text style={s.primaryActionText}>
                      {continuingOrderId === b.orderId ? copy.paymentRedirecting : copy.completePayment}
                    </Text>
                  </Pressable>
                )}
                {b.canCancel && isConfirmed && (
                  <Pressable
                    style={[s.cancelAction, cancelingOrderId === b.orderId && s.disabledAction]}
                    disabled={cancelingOrderId === b.orderId}
                    onPress={() => requestCancelBooking(b)}
                    accessibilityRole="button"
                    testID={`cancel-booking-${b.orderId}`}
                  >
                    <Ionicons name="close-circle-outline" size={17} color="#B42318" />
                    <Text style={s.cancelActionText}>
                      {cancelingOrderId === b.orderId ? copy.cancellationInProgress : copy.cancelBooking}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>

        <View style={s.section} testID="privacy-requests-section">
          <View style={s.sectionHeadingRow}>
            <View style={s.sectionHeadingIcon}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#003580" />
            </View>
            <View style={s.sectionHeadingCopy}>
              <Text style={[s.sectionTitle, isArabic && s.rtlText]}>{copy.privacyTitle}</Text>
              <Text style={[s.sectionSubtitle, isArabic && s.rtlText]}>{copy.privacySubtitle}</Text>
            </View>
          </View>
          <Pressable
            style={s.privacyRow}
            onPress={requestPrivacyExport}
            disabled={privacyExporting}
            accessibilityRole="button"
            testID="privacy-request-export"
          >
            <Ionicons name="download-outline" size={18} color="#003580" />
            <View style={s.infoRowCopy}>
              <Text style={[s.infoRowTitle, isArabic && s.rtlText]}>{privacyExporting ? copy.privacyExportLoading : copy.privacyAccess}</Text>
              <Text style={[s.infoRowText, isArabic && s.rtlText]}>{copy.privacyAccessHint}</Text>
            </View>
          </Pressable>
          <Pressable style={s.privacyRow} onPress={requestPrivacyCorrection} disabled={privacyCorrecting} accessibilityRole="button" testID="privacy-request-correction">
            <Ionicons name="create-outline" size={18} color="#003580" />
            <View style={s.infoRowCopy}>
              <Text style={[s.infoRowTitle, isArabic && s.rtlText]}>{copy.privacyCorrect}</Text>
              <Text style={[s.infoRowText, isArabic && s.rtlText]}>{copy.privacyCorrectHint}</Text>
            </View>
          </Pressable>
          <Pressable style={s.privacyRow} onPress={() => setDialog({
            kind: "confirm", action: "privacyDelete", title: copy.privacyDeleteConfirmTitle, message: copy.privacyDeleteConfirm,
          })} accessibilityRole="button" testID="privacy-request-delete">
            <Ionicons name="trash-outline" size={18} color="#B42318" />
            <View style={s.infoRowCopy}>
              <Text style={[s.infoRowTitle, { color: "#B42318" }, isArabic && s.rtlText]}>{copy.privacyDelete}</Text>
              <Text style={[s.infoRowText, isArabic && s.rtlText]}>{copy.privacyDeleteHint}</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL("mailto:info@dt-tour.com").catch(() => {})}
            accessibilityRole="link"
            testID="privacy-email-fallback"
          >
            <Text style={[s.privacyEmail, isArabic && s.rtlText]}>{copy.privacyEmail}</Text>
          </Pressable>
        </View>

        <View style={s.importantCard}>
          <View style={[s.sectionHeadingRow, s.importantHeadingRow]}>
            <View style={[s.sectionHeadingIcon, s.importantHeadingIcon]}><Ionicons name="information-outline" size={16} color="#003580" /></View>
            <Text style={[s.sectionTitle, s.importantSectionTitle, isArabic && s.rtlText]}>{copy.importantTitle}</Text>
          </View>
          <View style={s.infoRow}>
            <View style={s.infoRowIcon}><Ionicons name="shield-checkmark-outline" size={18} color="#147A4B" /></View>
            <View style={s.infoRowCopy}>
              <Text style={[s.infoRowTitle, isArabic && s.rtlText]}>{copy.protectedTitle}</Text>
              <Text style={[s.infoRowText, isArabic && s.rtlText]}>{copy.protectedBody}</Text>
            </View>
          </View>
          <View style={s.infoRow}>
            <View style={s.infoRowIcon}><Ionicons name="time-outline" size={18} color="#9A6700" /></View>
            <View style={s.infoRowCopy}>
              <Text style={[s.infoRowTitle, isArabic && s.rtlText]}>{copy.cancellationTitle}</Text>
              <Text style={[s.infoRowText, isArabic && s.rtlText]}>{copy.cancellationBody}</Text>
            </View>
          </View>
          <Pressable style={s.supportRow} onPress={() => openSupport()} accessibilityRole="button" testID="account-support">
            <View style={s.infoRowIcon}><Ionicons name="chatbubble-ellipses-outline" size={18} color="#003580" /></View>
            <View style={s.infoRowCopy}>
              <Text style={[s.infoRowTitle, isArabic && s.rtlText]}>{copy.helpTitle}</Text>
              <Text style={[s.supportLink, isArabic && s.rtlText]}>{copy.supportLink}</Text>
            </View>
            <Ionicons name="arrow-forward" size={17} color="#003580" />
          </Pressable>
        </View>

      {/* Tier info */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>{copy.programTiers}</Text>
        {[
          { key: "new",    label: isArabic ? "متميز جديد" : "New Tamayuz", cashback: "1.5%", req: copy.defaultTier },
          { key: "silver", label: isArabic ? "متميز فضي" : "Silver Tamayuz", cashback: "2.0%", req: isArabic ? "5 حجوزات / 500 د.ك" : "5 bookings / 500 KWD" },
          { key: "gold",   label: isArabic ? "متميز ذهبي" : "Gold Tamayuz", cashback: "3.0%", req: isArabic ? "15 حجزاً / 1500 د.ك" : "15 bookings / 1500 KWD" },
        ].map((t) => (
          <View key={t.key} style={[s.tierRow, t.key === tier && s.tierRowActive]}>
            <Text style={s.tierRowEmoji}>{TIER_EMOJIS[t.key]}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.tierRowLabel, t.key === tier && { color: TIER_COLORS[t.key] }]}>{t.label}</Text>
              <Text style={s.tierRowSub}>{copy.cashback(t.cashback)} · {t.req}</Text>
            </View>
            {t.key === tier && <Text style={{ color: TIER_COLORS[t.key], fontSize: 11, fontWeight: "700" }}>✓ {copy.active}</Text>}
          </View>
        ))}
      </View>

      <Pressable
        style={[s.logoutBtn, { marginBottom: bottomSafeSpace + 28 }]}
        onPress={handleLogout}
        accessibilityRole="button"
        testID="account-sign-out"
      >
        <Ionicons name="log-out-outline" size={18} color="#B42318" />
        <Text style={s.logoutText}>{copy.signOut}</Text>
      </Pressable>
      </ScrollView>

      <Modal
        visible={selectedBooking !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBooking(null)}
        statusBarTranslucent
      >
        <View style={s.dialogBackdrop}>
          {selectedBooking && (
            <ScrollView style={s.bookingDetailsCard} contentContainerStyle={{ paddingBottom: 4 }}>
              <View style={s.bookingDetailsHeader}>
                <Text style={[s.dialogTitle, isArabic && s.rtlText]}>{copy.bookingDetails}</Text>
                <Pressable
                  onPress={() => setSelectedBooking(null)}
                  style={s.bookingDetailsClose}
                  accessibilityRole="button"
                  accessibilityLabel={copy.closeDetails}
                  testID="booking-details-close"
                >
                  <HotelPortalIcon name="close" size={19} color="#64748B" />
                </Pressable>
              </View>
              <Text style={[s.bookingDetailsHotel, isArabic && s.rtlText]}>{selectedBooking.hotelName || (isArabic ? "حجز فندق" : "Hotel booking")}</Text>
              <View style={s.bookingDetailsStatus}>
                <Text style={s.bookingDetailsStatusText}>
                  {selectedBooking.status === "confirmed"
                    ? (isArabic ? "مؤكد" : "Confirmed")
                    : selectedBooking.status === "cancelled"
                      ? (isArabic ? "ملغى" : "Cancelled")
                      : selectedBooking.status === "pending_payment"
                        ? (isArabic ? "بانتظار الدفع" : "Payment due")
                        : (isArabic ? "قيد المعالجة" : "Processing")}
                </Text>
              </View>
              <View style={s.bookingDetailsRow}>
                <Text style={s.bookingDetailsLabel}>{copy.stayDates}</Text>
                <Text style={s.bookingDetailsValue}>{formatBookingDate(selectedBooking.checkin)} → {formatBookingDate(selectedBooking.checkout)}</Text>
              </View>
              {selectedBooking.roomName ? (
                <View style={s.bookingDetailsRow}>
                  <Text style={s.bookingDetailsLabel}>{copy.room}</Text>
                  <Text style={s.bookingDetailsValue}>{selectedBooking.roomName}</Text>
                </View>
              ) : null}
              <View style={s.bookingDetailsRow}>
                <Text style={s.bookingDetailsLabel}>{copy.total}</Text>
                <Text style={s.bookingDetailsValue}>{selectedBooking.totalKWD ? `KWD ${selectedBooking.totalKWD}` : copy.paymentPending}</Text>
              </View>
              <View style={s.bookingDetailsRow}>
                <Text style={s.bookingDetailsLabel}>{copy.orderReference}</Text>
                <Text style={s.bookingDetailsValue}>{selectedBooking.orderId}</Text>
              </View>
              {selectedBooking.rhOrderId ? (
                <View style={s.bookingDetailsRow}>
                  <Text style={s.bookingDetailsLabel}>{copy.hotelBookingId}</Text>
                  <Text style={s.bookingDetailsValue}>{selectedBooking.rhOrderId}</Text>
                </View>
              ) : null}
              {selectedBooking.balanceReminder ? (
                <View style={s.policyHint} testID="booking-balance-reminder-terms">
                  <Ionicons name="notifications-outline" size={16} color="#147A4B" />
                  <Text style={s.policyHintText}>
                    {isArabic
                      ? `${selectedBooking.balanceReminder.stage === "3" ? "التذكير الأخير: " : "تذكير: "}الرصيد ${selectedBooking.balanceReminder.balanceKWD} د.ك مستحق قبل ${formatBalanceDeadline(selectedBooking.balanceReminder.deadline)}. يجب السداد بالكامل قبل الوصول بـ 48 ساعة على الأقل أو قبل موعد الإلغاء المجاني إن كان أبكر. عدم السداد في الموعد يؤدي إلى إلغاء الحجز تلقائياً وعدم استرداد المبالغ المدفوعة. ${selectedBooking.cancelBefore ? `الإلغاء المجاني وفق سياسة الفندق حتى ${formatExpiryDate(selectedBooking.cancelBefore)}.` : ""}`
                      : `${selectedBooking.balanceReminder.stage === "3" ? "Final reminder: " : "Reminder: "}KWD ${selectedBooking.balanceReminder.balanceKWD} is due by ${formatBalanceDeadline(selectedBooking.balanceReminder.deadline)}. Pay in full at least 48 hours before check-in or by the earlier free-cancellation deadline. If unpaid, the reservation is cancelled automatically and amounts already paid become non-refundable. ${selectedBooking.cancelBefore ? `Free cancellation under hotel policy until ${formatExpiryDate(selectedBooking.cancelBefore)}.` : ""}`}
                  </Text>
                </View>
              ) : null}
              <View style={s.bookingDetailsActions}>
                <Pressable
                  style={s.dialogSupport}
                  onPress={() => openSupport(selectedBooking.orderId)}
                  accessibilityRole="button"
                  testID="booking-details-support"
                >
                  <Ionicons name="logo-whatsapp" size={17} color="#FFFFFF" />
                  <Text style={s.dialogSupportText}>{copy.contactSupport}</Text>
                </Pressable>
                <Pressable
                  style={s.dialogSecondary}
                  onPress={() => setSelectedBooking(null)}
                  accessibilityRole="button"
                  testID="booking-details-done"
                >
                  <Text style={s.dialogSecondaryText}>{copy.closeDetails}</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        onRequestClose={() => setDialog(null)}
        statusBarTranslucent
      >
        <View style={s.dialogBackdrop}>
          <View style={s.dialogCard}>
            <View style={[s.dialogIcon, dialog?.kind === "confirm" ? s.dialogIconWarning : s.dialogIconSuccess]}>
              <Ionicons
                name={dialog?.kind === "confirm" ? "help-outline" : dialog?.showSupport ? "alert-outline" : "checkmark-outline"}
                size={26}
                color={dialog?.kind === "confirm" ? "#9A6700" : dialog?.showSupport ? "#B42318" : "#147A4B"}
              />
            </View>
            <Text style={s.dialogTitle}>{dialog?.title}</Text>
            <Text style={s.dialogMessage}>{dialog?.message}</Text>
            {dialog?.kind === "confirm" ? (
              <View style={s.dialogActions}>
                <Pressable style={s.dialogSecondary} onPress={() => setDialog(null)}>
                  <Text style={s.dialogSecondaryText}>{dialog?.action === "privacyDelete" ? (isArabic ? "إلغاء" : "Cancel") : (isArabic ? "إبقاء الحجز" : "Keep booking")}</Text>
                </Pressable>
                <Pressable
                  style={s.dialogDanger}
                  testID={dialog?.action === "privacyDelete" ? "confirm-privacy-delete" : "confirm-cancel-booking"}
                  onPress={() => {
                    const orderId = dialog.orderId;
                    const action = dialog.action;
                    setDialog(null);
                    if (action === "privacyDelete") void deletePrivacyAccount();
                    else if (orderId) void cancelBooking(orderId);
                  }}
                  disabled={privacyDeleting}
                >
                  <Text style={s.dialogDangerText}>{privacyDeleting ? copy.privacyDeleteLoading : dialog?.action === "privacyDelete" ? copy.privacyDeleteAction : (isArabic ? "إلغاء الحجز" : "Cancel booking")}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={s.dialogActions}>
                {dialog?.showSupport && (
                  <Pressable style={s.dialogSupport} onPress={() => openSupport(dialog.orderId)}>
                    <Ionicons name="logo-whatsapp" size={17} color="#FFFFFF" />
                    <Text style={s.dialogSupportText}>{isArabic ? "تواصل معنا" : "Contact support"}</Text>
                  </Pressable>
                )}
                <Pressable
                  style={s.dialogSecondary}
                  testID={dialog?.action === "welcome" ? "welcome-continue" : undefined}
                  onPress={() => {
                    const action = dialog?.action;
                    setDialog(null);
                    if (action === "welcome") void (onLoginSuccess ?? onClose)?.();
                  }}
                >
                  <Text style={s.dialogSecondaryText}>
                    {dialog?.action === "welcome"
                      ? (isArabic ? "متابعة" : "Continue")
                      : (isArabic ? "تم" : "Done")}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  center:          { flex: 1, backgroundColor: "#f2f2f2", alignItems: "center", justifyContent: "center" },
  container:       { flex: 1, backgroundColor: "#f2f2f2" },
  authContainer:   { flex: 1, backgroundColor: "#f5f7fa" },
  authContent:     { paddingHorizontal: 24, paddingBottom: 40, flexGrow: 1 },
  closeButton:     { minHeight: 40, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#e2e6ed", marginBottom: 12 },
  closeButtonFloating: { position: "absolute", top: 12, left: 16, zIndex: 1 },
  closeButtonText: { color: "#003580", fontSize: 13, fontWeight: "800" },
  authCloseButton: { minHeight: 40, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#d9e2ec", marginBottom: 28 },
  authCloseButtonText: { color: "#003580", fontSize: 13, fontWeight: "700" },
  authHeading:     { marginBottom: 24 },
  authLogoFrame:   { width: 196, height: 42, overflow: "hidden", position: "relative", alignSelf: "center", marginBottom: 10 },
  authLogo:        { position: "absolute", width: 204, height: 204, left: -7, top: -84 },
  screenTitle:     { fontSize: 27, fontWeight: "800", color: "#1a1f36", textAlign: "center" },
  authSubtitle:    { color: "#5a6473", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 9, paddingHorizontal: 8 },
  authBox:         { backgroundColor: "#fff", borderRadius: 12, padding: 20, borderWidth: 1, borderColor: "#d9e2ec", shadowColor: "#1a1f36", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  modeTabs:        { flexDirection: "row", marginBottom: 22, backgroundColor: "#f1f5f9", borderRadius: 8, padding: 4 },
  modeTab:         { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: "center" },
  modeTabActive:   { backgroundColor: "#fff", shadowColor: "#1a1f36", shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  modeTabText:     { color: "#5a6473", fontSize: 12, fontWeight: "700" },
  modeTabTextActive:{ color: "#003580" },
  fieldLabel:      { color: "#1a1f36", fontSize: 12, fontWeight: "700", marginBottom: 7 },
  input:           { backgroundColor: "#fff", borderWidth: 1, borderColor: "#aeb9c5", borderRadius: 8, paddingHorizontal: 13, paddingVertical: 12, color: "#1a1f36", marginBottom: 15, fontSize: 14 },
  errorText:       { color: "#c62828", fontSize: 12, marginBottom: 10, textAlign: "center" },
  forgotHint:     { color: "#5a6473", fontSize: 13, lineHeight: 21, textAlign: "center", marginBottom: 16 },
  forgotLink:     { alignSelf: "flex-end", marginTop: -7, marginBottom: 13 },
  forgotLinkText: { color: "#003580", fontSize: 12, fontWeight: "800" },
  resetMessage:   { color: "#16794C", fontSize: 12, lineHeight: 19, marginBottom: 10, textAlign: "center" },
  backToLogin:    { alignItems: "center", marginTop: 14, paddingVertical: 3 },
  backToLoginText:{ color: "#003580", fontSize: 12, fontWeight: "800" },
  submitBtn:       { backgroundColor: "#003580", borderRadius: 8, padding: 15, alignItems: "center", marginTop: 3 },
  submitBtnText:   { color: "#fff", fontWeight: "800", fontSize: 15 },
  authDivider:     { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 16 },
  authDividerLine: { flex: 1, height: 1, backgroundColor: "#d9e2ec" },
  authDividerText: { color: "#6b7280", fontSize: 10, fontWeight: "800" },
  googleBtn:       { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: "#aeb9c5", backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  googleBtnText:   { color: "#1a1f36", fontSize: 14, fontWeight: "800" },
  authNote:        { marginTop: 20, color: "#5a6473", fontSize: 12, lineHeight: 20, textAlign: "center", paddingHorizontal: 8 },
  profileHero:     { marginHorizontal: 16, marginTop: 4, borderRadius: 24, padding: 20, backgroundColor: "#0A192F", shadowColor: "#0A192F", shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  heroTopLine:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  heroEyebrow:     { color: "#D4AF37", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  heroShield:      { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(212,175,55,0.13)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(212,175,55,0.28)" },
  heroIdentity:    { flexDirection: "row", alignItems: "center" },
  heroCopy:        { flex: 1, marginLeft: 14 },
  avatarCircle:    { width: 64, height: 64, borderRadius: 20, backgroundColor: "#11315A", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(212,175,55,0.45)" },
  avatarText:      { fontSize: 26, color: "#FFFFFF", fontWeight: "900" },
  profileName:     { fontSize: 21, fontWeight: "900", color: "#FFFFFF", marginBottom: 3 },
  profileEmail:    { fontSize: 12, color: "#B8C4D8", marginBottom: 10 },
  tierBadge:       { alignSelf: "flex-start", borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "rgba(255,255,255,0.05)" },
  tierText:        { fontWeight: "800", fontSize: 11 },
  summaryCard:     { marginHorizontal: 16, marginTop: 12, backgroundColor: "#FFFFFF", borderRadius: 18, paddingVertical: 16, flexDirection: "row", borderWidth: 1, borderColor: "#E3E8F2", shadowColor: "#0A192F", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  summaryItem:     { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  summaryValue:    { fontSize: 17, fontWeight: "900", color: "#0A192F", textAlign: "center", marginBottom: 4 },
  summaryLabel:    { fontSize: 9.5, lineHeight: 13, color: "#64748B", textAlign: "center" },
  summaryDivider:  { width: 1, backgroundColor: "#E8EDF4", marginVertical: 3 },
  expiryBanner:    { marginHorizontal: 16, marginBottom: 16, borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: "row-reverse", alignItems: "flex-start", gap: 9 },
  expiryCopy:      { flex: 1, alignItems: "flex-end" },
  expiryTitle:     { fontSize: 13, fontWeight: "800", textAlign: "right", lineHeight: 19 },
  expirySub:       { fontSize: 11, marginTop: 3, textAlign: "right", lineHeight: 17 },
  section:         { marginHorizontal: 16, marginTop: 14, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#E3E8F2", shadowColor: "#0A192F", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  sectionHeadingRow:  { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  sectionHeadingIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#EEF4FF", alignItems: "center", justifyContent: "center", marginRight: 10 },
  sectionHeadingCopy: { flex: 1 },
  sectionTitle:       { fontSize: 15, fontWeight: "900", color: "#0A192F" },
  sectionSubtitle:    { color: "#718096", fontSize: 10.5, marginTop: 2 },
  countBadge:         { minWidth: 26, height: 26, paddingHorizontal: 7, borderRadius: 13, backgroundColor: "#0A192F", alignItems: "center", justifyContent: "center" },
  countBadgeText:     { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  bookingCard:        { paddingHorizontal: 12, paddingVertical: 16, marginBottom: 10, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 14 },
  bookingSectionHeading: { backgroundColor: "#0A192F", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 15 },
  bookingSectionHeadingIcon: { backgroundColor: "#D4AF37" },
  bookingSectionTitle: { fontSize: 16.5, color: "#FFFFFF" },
  bookingSectionSubtitle: { color: "#B8C4D8" },
  bookingSectionCountBadge: { backgroundColor: "#D4AF37" },
  bookingSectionCountText: { color: "#0A192F" },
  bookingListDivider: { borderBottomWidth: 1, borderBottomColor: "#CBD5E1" },
  bookingDetailsArea: { borderRadius: 12 },
  bookingDetailsPressed: { opacity: 0.78, backgroundColor: "#F8FAFC" },
  cancelledCard:      { opacity: 0.78 },
  listDivider:        { borderBottomWidth: 1, borderBottomColor: "#E8EDF4" },
  bookingCardHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 13, gap: 8 },
  hotelIdentity:      { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" },
  hotelIcon:          { width: 36, height: 36, borderRadius: 11, backgroundColor: "#F2F6FC", alignItems: "center", justifyContent: "center", marginRight: 10 },
  bookingHotelName:   { color: "#0F172A", fontWeight: "900", fontSize: 13.5, lineHeight: 18 },
  bookingCreated:     { color: "#94A3B8", fontSize: 9.5, marginTop: 3 },
  statusBadge:        { maxWidth: 112, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, flexShrink: 0 },
  statusText:         { flexShrink: 1, fontSize: 8.5, lineHeight: 11, fontWeight: "900", textAlign: "center" },
  bookingInfoGrid:    { borderRadius: 13, backgroundColor: "#F7F9FC", padding: 11, gap: 9 },
  bookingInfoItem:    { flexDirection: "row", alignItems: "center", gap: 9 },
  bookingInfoLabel:   { color: "#94A3B8", fontSize: 9.5, marginBottom: 2 },
  bookingInfoValue:   { color: "#334155", fontSize: 11.5, fontWeight: "800" },
  detailLine:         { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 11, paddingHorizontal: 2 },
  detailLineText:     { flex: 1, color: "#64748B", fontSize: 10.5, lineHeight: 15 },
  referenceRow:       { marginTop: 11, borderRadius: 12, padding: 11, backgroundColor: "#EEF4FF", borderWidth: 1, borderColor: "#D7E5FA", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  referenceLabel:     { color: "#64748B", fontSize: 9.5, fontWeight: "700", marginBottom: 3 },
  referenceValue:     { color: "#003580", fontSize: 14, fontWeight: "900", letterSpacing: 0.6 },
  referencePending:   { color: "#9A6700", fontSize: 11, fontWeight: "700" },
  policyHint:         { marginTop: 10, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#ECFDF3", flexDirection: "row", alignItems: "center", gap: 7 },
  policyHintCancelled:{ marginTop: 10, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#F0FDF4", flexDirection: "row", alignItems: "center", gap: 7 },
  policyHintText:     { flex: 1, color: "#38664F", fontSize: 9.5, lineHeight: 14, fontWeight: "700" },
  bookingInternalRef:{ color: "#94A3B8", fontSize: 9, marginTop: 9 },
  primaryAction:      { minHeight: 44, marginTop: 12, borderRadius: 12, paddingHorizontal: 14, backgroundColor: "#D97706", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryActionText:  { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  cancelAction:       { minHeight: 42, marginTop: 8, borderRadius: 12, paddingHorizontal: 14, backgroundColor: "#FFF7F7", borderWidth: 1, borderColor: "#F5C2C0", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  cancelActionText:   { color: "#B42318", fontSize: 11.5, fontWeight: "900" },
  disabledAction:     { opacity: 0.55 },
  emptyBookings:      { alignItems: "center", paddingVertical: 22, paddingHorizontal: 14 },
  emptyIcon:          { width: 48, height: 48, borderRadius: 16, backgroundColor: "#F3F6FA", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  emptyTitle:         { color: "#334155", fontSize: 12.5, fontWeight: "900", textAlign: "center" },
  emptySub:           { color: "#94A3B8", fontSize: 10.5, lineHeight: 15, marginTop: 5, textAlign: "center" },
  importantCard:      { marginHorizontal: 16, marginTop: 14, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#E3E8F2" },
  importantHeadingRow:{ justifyContent: "center", position: "relative" },
  importantHeadingIcon:{ position: "absolute", left: 0, marginRight: 0 },
  importantSectionTitle:{ flex: 1, textAlign: "center", fontWeight: "900" },
  rtlText:             { textAlign: "right", writingDirection: "rtl" },
  infoRow:            { flexDirection: "row", alignItems: "flex-start", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#EEF1F5" },
  infoRowIcon:        { width: 34, height: 34, borderRadius: 11, backgroundColor: "#F3F6FA", alignItems: "center", justifyContent: "center", marginRight: 10 },
  infoRowCopy:        { flex: 1 },
  infoRowTitle:       { color: "#253247", fontSize: 11.5, fontWeight: "900", lineHeight: 16 },
  infoRowText:        { color: "#718096", fontSize: 10, lineHeight: 15, marginTop: 3 },
  supportRow:         { flexDirection: "row", alignItems: "center", paddingTop: 12 },
  supportLink:        { color: "#003580", fontSize: 10, fontWeight: "800", marginTop: 3 },
  tierRow:         { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, marginBottom: 6 },
  tierRowActive:   { backgroundColor: "#eef4ff", borderWidth: 1, borderColor: "#b9d2f7" },
  tierRowEmoji:    { fontSize: 20, marginRight: 12 },
  tierRowLabel:    { color: "#1a1a1a", fontWeight: "700", fontSize: 14 },
  tierRowSub:      { color: "#6b7280", fontSize: 11, marginTop: 2 },
  logoutBtn:       { minHeight: 44, marginHorizontal: 16, marginTop: 16, backgroundColor: "#FFF8F8", borderRadius: 13, paddingHorizontal: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "#F4D3D1" },
  logoutText:      { color: "#B42318", fontWeight: "900", fontSize: 12 },
  lockCard:        { paddingVertical: 14 },
  lockHotelName:   { color: "#0F172A", fontWeight: "900", fontSize: 13, lineHeight: 18, flex: 1 },
  lockCdBadge:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#EEF4FF", borderRadius: 9, borderWidth: 1, borderColor: "#D7E5FA", paddingHorizontal: 8, paddingVertical: 5, flexShrink: 0 },
  lockCdText:      { color: "#003580", fontSize: 10, fontWeight: "900" },
  lockMeta:        { color: "#64748B", fontSize: 10.5, lineHeight: 15, marginTop: 3, marginLeft: 46 },
  lockBottomRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 11, marginLeft: 46 },
  lockPrice:       { color: "#0A192F", fontSize: 14, fontWeight: "900" },
  lockAction:      { color: "#003580", fontSize: 10.5, fontWeight: "900" },
  lockExpiry:      { color: "#9A6700", fontSize: 9.5, marginTop: 5, marginLeft: 46, fontWeight: "700" },
  dialogBackdrop:  { flex: 1, backgroundColor: "rgba(10,25,47,0.62)", justifyContent: "center", padding: 24 },
  dialogCard:      { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 22, alignItems: "center", shadowColor: "#000000", shadowOpacity: 0.22, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  dialogIcon:      { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 15 },
  dialogIconWarning:{ backgroundColor: "#FFF7DD" },
  dialogIconSuccess:{ backgroundColor: "#ECFDF3" },
  dialogTitle:     { color: "#0A192F", fontSize: 17, lineHeight: 23, fontWeight: "900", textAlign: "center" },
  dialogMessage:   { color: "#64748B", fontSize: 12, lineHeight: 19, textAlign: "center", marginTop: 8 },
  dialogActions:   { width: "100%", marginTop: 20, gap: 9 },
  bookingDetailsCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 22, maxHeight: "85%", shadowColor: "#000000", shadowOpacity: 0.22, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  bookingDetailsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 13 },
  bookingDetailsClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F3F6FA", alignItems: "center", justifyContent: "center" },
  bookingDetailsHotel: { color: "#0A192F", fontSize: 18, lineHeight: 24, fontWeight: "900", marginBottom: 10 },
  bookingDetailsStatus: { alignSelf: "flex-start", backgroundColor: "#FFF7DD", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  bookingDetailsStatusText: { color: "#9A6700", fontSize: 11, fontWeight: "900" },
  bookingDetailsRow: { borderTopWidth: 1, borderTopColor: "#EEF1F5", paddingVertical: 10, gap: 3 },
  bookingDetailsLabel: { color: "#94A3B8", fontSize: 10, fontWeight: "700" },
  bookingDetailsValue: { color: "#334155", fontSize: 12, fontWeight: "800" },
  bookingDetailsActions: { width: "100%", marginTop: 10, gap: 9 },
  dialogSecondary: { minHeight: 45, borderRadius: 12, backgroundColor: "#F3F6FA", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  dialogSecondaryText:{ color: "#334155", fontSize: 11.5, fontWeight: "900" },
  dialogDanger:    { minHeight: 45, borderRadius: 12, backgroundColor: "#B42318", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  dialogDangerText:{ color: "#FFFFFF", fontSize: 11.5, fontWeight: "900" },
  dialogSupport:   { minHeight: 45, borderRadius: 12, backgroundColor: "#147A4B", flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  dialogSupportText:{ color: "#FFFFFF", fontSize: 11.5, fontWeight: "900" },
  privacyRow:      { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  privacyEmail:    { color: "#003580", fontSize: 12, fontWeight: "700", marginTop: 12 },
  settingsEntry: { marginHorizontal: 16, marginTop: 14, minHeight: 72, paddingHorizontal: 16, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E3E8F2", flexDirection: "row", alignItems: "center" },
  settingsEntryPressed: { opacity: 0.75 },
  settingsEntryIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#EEF4FF", alignItems: "center", justifyContent: "center", marginRight: 12 },
  settingsEntryCopy: { flex: 1 },
  settingsEntryTitle: { color: "#0A192F", fontSize: 14, fontWeight: "900" },
  settingsEntryValue: { color: "#718096", fontSize: 11, marginTop: 4 },
  settingsScreen: { flex: 1, backgroundColor: "#F7F8FA" },
  settingsHeader: { minHeight: 58, paddingHorizontal: 16, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  settingsBackButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  settingsHeaderSpacer: { width: 40 },
  settingsTitle: { color: "#0A192F", fontSize: 18, fontWeight: "900" },
  settingsContent: { padding: 16 },
  settingsCard: { backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#E3E8F2", overflow: "hidden" },
  settingsOption: { padding: 16 },
  settingsOptionCopy: { marginBottom: 13 },
  settingsOptionTitle: { color: "#0A192F", fontSize: 14, fontWeight: "800" },
  settingsOptionHint: { color: "#718096", fontSize: 10.5, marginTop: 4, lineHeight: 15 },
  settingsChoices: { flexDirection: "row", gap: 8 },
  settingsChoice: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: "#D7E5FA", borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  settingsChoiceActive: { backgroundColor: "#003580", borderColor: "#003580" },
  settingsChoiceText: { color: "#334155", fontSize: 11, fontWeight: "800" },
  settingsChoiceTextActive: { color: "#FFFFFF" },
  settingsDivider: { height: 1, backgroundColor: "#E5E7EB", marginHorizontal: 16 },
  settingsPreviewCard: { marginTop: 14, padding: 16, backgroundColor: "#EEF4FF", borderRadius: 16, borderWidth: 1, borderColor: "#D7E5FA" },
  settingsPreviewLabel: { color: "#64748B", fontSize: 10.5, fontWeight: "800" },
  settingsPreviewValue: { color: "#003580", fontSize: 22, fontWeight: "900", marginTop: 7 },
  settingsPreviewHint: { color: "#64748B", fontSize: 10.5, marginTop: 4 },
});
