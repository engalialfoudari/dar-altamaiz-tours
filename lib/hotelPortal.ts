export const PUBLIC_HOTEL_PORTAL_URL = "https://dt-tour.com/hotels";
const DEVELOPMENT_HOTEL_PORTAL_BUILD = "20260911-phase3-1";
export const HOTEL_PAYMENT_APP_RETURN_URL = "dttours://hotel-payment-return";
export const STORE_PAYMENT_APP_RETURN_URL = "dttours://store-payment-return";
export const HOTEL_DISPLAY_PREFERENCES_STORAGE_KEY = "dt_hotel_display_preferences";

export type HotelDisplayPreferences = {
  priceDisplay: "per-night" | "total-stay";
  currency: "KWD" | "USD";
};

export const DEFAULT_HOTEL_DISPLAY_PREFERENCES: HotelDisplayPreferences = {
  priceDisplay: "per-night",
  currency: "KWD",
};

export function parseHotelDisplayPreferences(value: unknown): HotelDisplayPreferences | null {
  if (!value || typeof value !== "object") return null;
  const preferences = value as Record<string, unknown>;
  const priceDisplay = preferences.priceDisplay;
  const currency = preferences.currency;
  if (
    (priceDisplay !== "per-night" && priceDisplay !== "total-stay") ||
    (currency !== "KWD" && currency !== "USD")
  ) return null;
  return { priceDisplay, currency };
}

/** Presentation-only conversion. Supplier and payment amounts remain KWD. */
export function formatHotelDisplayPrice(kwdAmount: number, preferences: HotelDisplayPreferences): string {
  const amount = preferences.currency === "USD" ? kwdAmount * 3.2 : kwdAmount;
  return `${preferences.currency} ${amount.toFixed(preferences.currency === "USD" ? 2 : 3)}`;
}

export function serializeHotelDisplayPreferencesMessage(preferences: HotelDisplayPreferences): string {
  return JSON.stringify({ type: "dt-hotel-display-preferences", preferences });
}

export type HotelPaymentReturn = {
  orderId: string;
  status: "success" | "failed";
};

export type StorePaymentReturn = {
  orderId: string;
  status: "success" | "failed";
};

/** Parse only the native store-payment callback; payment status is verified by the API. */
export function parseStorePaymentReturnUrl(rawUrl: string): StorePaymentReturn | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "dttours:" || url.hostname !== "store-payment-return") return null;
    const orderId = String(url.searchParams.get("orderId") ?? "")
      .replace(/[^A-Za-z0-9_-]/g, "")
      .slice(0, 100);
    if (!orderId) return null;
    return {
      orderId,
      status: url.searchParams.get("status") === "failed" ? "failed" : "success",
    };
  } catch {
    return null;
  }
}

export function parseHotelPortalHistoryMessage(rawMessage: string): boolean | null {
  try {
    const message = JSON.parse(rawMessage);
    if (
      message?.type !== "dt-hotel-history" ||
      typeof message?.canGoBack !== "boolean"
    ) {
      return null;
    }
    return message.canGoBack;
  } catch {
    return null;
  }
}

export function parseHotelPortalAuthHandoffMessage(rawMessage: string): string | null {
  try {
    const message = JSON.parse(rawMessage);
    if (
      message?.type !== "dt-portal-auth-handoff" ||
      typeof message?.ticket !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(message.ticket)
    ) {
      return null;
    }
    return message.ticket;
  } catch {
    return null;
  }
}

export function parseHotelPortalLanguageMessage(rawMessage: string): "en" | "ar" | null {
  try {
    const message = JSON.parse(rawMessage);
    return message?.type === "dt-portal-language" &&
      (message?.language === "en" || message?.language === "ar")
      ? message.language
      : null;
  } catch {
    return null;
  }
}

/** Accept only a hotel checkout handoff to an exact trusted payment host. */
export function parseHotelPaymentHandoffMessage(rawMessage: string): string | null {
  try {
    const message = JSON.parse(rawMessage);
    if (message?.type !== "dt-open-hotel-payment" || typeof message?.url !== "string") return null;
    const destination = new URL(message.url);
    return destination.protocol === "https:" && isTrustedHotelPaymentHost(destination.hostname)
      ? destination.toString()
      : null;
  } catch {
    return null;
  }
}

export function parseHotelPortalAccountAction(
  rawMessage: string,
): "google-signin" | "signed-out" | null {
  try {
    const message = JSON.parse(rawMessage);
    if (message?.type === "dt-portal-google-signin") return "google-signin";
    if (message?.type === "dt-portal-signed-out") return "signed-out";
    return null;
  } catch {
    return null;
  }
}

export function parseHotelPaymentReturnUrl(rawUrl: string): HotelPaymentReturn | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "dttours:" || url.hostname !== "hotel-payment-return") return null;
    const orderId = String(url.searchParams.get("orderId") ?? "")
      .replace(/[^A-Za-z0-9_-]/g, "")
      .slice(0, 100);
    if (!orderId) return null;
    return {
      orderId,
      status: url.searchParams.get("status") === "failed" ? "failed" : "success",
    };
  } catch {
    return null;
  }
}

const HOTEL_PAYMENT_HOSTS = [
  "upayments.com",
  "upayment.com",
  // UPayment's KNET gateway returns a direct hosted-payment URL here rather
  // than an upayments.com intermediary.
  "kpay.com.kw",
  "kpaytest.com.kw",
] as const;

const HOTEL_EXTERNAL_APP_HOSTS = new Set([
  "wa.me",
  "api.whatsapp.com",
]);

export function isHotelPortalExternalAppUrl(rawUrl: string): boolean {
  try {
    const destination = new URL(rawUrl);
    return destination.protocol === "https:" &&
      HOTEL_EXTERNAL_APP_HOSTS.has(destination.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isTrustedHotelPaymentHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return HOTEL_PAYMENT_HOSTS.some(
    (host) => normalized === host || normalized.endsWith(`.${host}`),
  );
}

export function shouldOpenHotelPaymentExternally(
  request: { url?: string; isTopFrame?: boolean },
  platform: string,
): boolean {
  if (platform !== "android" || request.isTopFrame === false) return false;
  try {
    const destination = new URL(String(request.url ?? ""));
    return destination.protocol === "https:" &&
      isTrustedHotelPaymentHost(destination.hostname);
  } catch {
    return false;
  }
}

export function hotelPortalHostsFor(portalUrl: string): Set<string> {
  return new Set([
    "dt-tour.com",
    "www.dt-tour.com",
    new URL(portalUrl).hostname.toLowerCase(),
  ]);
}

/** Allow only HTTPS portal/payment origins; never trust lookalike hostnames. */
export function isTrustedHotelPortalNavigation(
  rawUrl: string,
  portalUrl: string,
): boolean {
  try {
    const destination = new URL(rawUrl);
    if (destination.protocol !== "https:") return rawUrl === "about:blank";
    const hostname = destination.hostname.toLowerCase();
    return hotelPortalHostsFor(portalUrl).has(hostname) ||
      isTrustedHotelPaymentHost(hostname);
  } catch {
    return false;
  }
}

/**
 * Development needs the portal and handoff issuer on the same preview origin.
 * Release builds must retain the public portal domain customers already use.
 */
export function hotelPortalUrlFor(apiBase: string | undefined, isDevelopment: boolean): string {
  const normalizedApiBase = apiBase?.replace(/\/$/, "");
  if (!isDevelopment || !normalizedApiBase) return PUBLIC_HOTEL_PORTAL_URL;
  return `${normalizedApiBase.replace(/\/api$/, "")}/hotels?portalBuild=${DEVELOPMENT_HOTEL_PORTAL_BUILD}`;
}

export function hotelPortalUrlWithLanguage(portalUrl: string, language: "en" | "ar"): string {
  const url = new URL(portalUrl);
  url.searchParams.set("lang", language);
  return url.toString();
}

export function hotelPortalPrefillJavaScript(portalUrl: string | null | undefined): string {
  // Exact-hotel and date-picker handoffs are restored by the portal from the
  // navigated URL. Injecting the fallback city again on load would dispatch an
  // input event, clear the retained hotel ID, and open city suggestions.
  if (requiresHotelPortalNavigation(portalUrl)) {
    return "true;";
  }

  let city = "";
  let brandQuery = "";
  try {
    const url = new URL(portalUrl ?? "");
    city = url.searchParams.get("city") ?? "";
    brandQuery = url.searchParams.get("brandQuery") ?? "";
  } catch {}

  return `(function(){`
    + `var city=${JSON.stringify(city)};`
    + `var brand=${JSON.stringify(brandQuery)};`
    + `var input=document.getElementById('city');`
    + `if(input&&city){input.value=city;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}`
    + `if(brand){window.brandQuery=brand;}`
    + `true;`
    + `})();`;
}

export function requiresHotelPortalNavigation(portalUrl: string | null | undefined): boolean {
  try {
    const url = new URL(portalUrl ?? "");
    return url.searchParams.get("pickDates") === "1" ||
      Boolean(url.searchParams.get("hotelId"));
  } catch {
    return false;
  }
}

export function buildHotelDestinationUrl(
  apiBase: string | undefined,
  isDevelopment: boolean,
  language: "en" | "ar",
  city: string
): string {
  const baseUrl = hotelPortalUrlFor(apiBase, isDevelopment);
  const url = new URL(baseUrl);
  url.searchParams.set("lang", language);
  url.searchParams.set("city", city);
  url.searchParams.set("autoSearch", "0");
  return url.toString();
}

export function buildHotelDealUrl(
  apiBase: string | undefined,
  isDevelopment: boolean,
  language: "en" | "ar",
  deal: { scope: string; city?: string; targetHotel?: string; targetHotelId?: string }
): string {
  const baseUrl = hotelPortalUrlFor(apiBase, isDevelopment);
  const url = new URL(baseUrl);
  url.searchParams.set("lang", language);
  if (deal.city) {
    // Keep the destination anchored to the offer's real city. The hotel name is
    // passed separately so a failed exact-ID lookup cannot geocode the hotel
    // name as an unrelated city with a similar name.
    url.searchParams.set("city", deal.city);
  } else if (deal.scope === "kuwait") {
    url.searchParams.set("city", "Kuwait");
  } else if (deal.targetHotel) {
    url.searchParams.set("city", deal.targetHotel);
  }
  if (deal.targetHotel) {
    url.searchParams.set("brandQuery", deal.targetHotel);
    if (deal.city) {
      url.searchParams.set("fallbackCity", deal.city);
    }
  }
  if (deal.targetHotelId) {
    url.searchParams.set("hotelId", deal.targetHotelId);
  }
  url.searchParams.set("autoSearch", "0");
  url.searchParams.set("pickDates", "1");
  return url.toString();
}

export type HotelSearchTimingMode = "cold" | "warm";

export function formatHotelSearchTiming(
  mode: HotelSearchTimingMode | null,
  elapsedMs: number,
  language: "en" | "ar",
): string {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  if (language === "ar") {
    const label = mode === "warm" ? "نتيجة محفوظة" : mode === "cold" ? "بحث مباشر" : "جاري الاتصال";
    return `${label} · ${seconds} ث`;
  }
  const label = mode === "warm" ? "Cached result" : mode === "cold" ? "Live search" : "Connecting";
  return `${label} · ${seconds}s`;
}
