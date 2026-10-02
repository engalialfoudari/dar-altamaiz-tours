export const ESIM_PAYMENT_APP_RETURN_URL = "dttours://esim-payment-return";

const ESIM_ORDER_ID_PATTERN = /^ESIM-[0-9A-F]{30}$/i;

export function validateEsimPaymentOrderId(value: unknown): string | null {
  if (typeof value !== "string" || !ESIM_ORDER_ID_PATTERN.test(value)) return null;
  return value.toUpperCase();
}

export function esimPaymentReturnRedirectHref(rawOrderId: unknown):
  | { pathname: "/"; params: { esimPaymentOrderId: string } }
  | "/" {
  const value = Array.isArray(rawOrderId)
    ? rawOrderId.length === 1 ? rawOrderId[0] : undefined
    : rawOrderId;
  const orderId = validateEsimPaymentOrderId(value);
  return orderId ? { pathname: "/", params: { esimPaymentOrderId: orderId } } : "/";
}

export function parseEsimPaymentReturnUrl(rawUrl: string): { orderId: string } | null {
  try {
    const url = new URL(rawUrl);
    if (
      url.protocol !== "dttours:" ||
      url.hostname !== "esim-payment-return" ||
      (url.pathname !== "" && url.pathname !== "/") ||
      url.username ||
      url.password ||
      url.port
    ) return null;
    const orderIds = url.searchParams.getAll("orderId");
    if (orderIds.length !== 1) return null;
    const orderId = validateEsimPaymentOrderId(orderIds[0]);
    return orderId ? { orderId } : null;
  } catch {
    return null;
  }
}