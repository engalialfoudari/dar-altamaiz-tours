import { customFetch } from "./custom-fetch";

export type EsimReturnStatus = "payment_pending" | "payment_failed" | "fulfillment_pending" | "pending_review" | "completed";
/** Public opaque-reference status only. Never fetches activation or starts reconciliation. */
export async function getEsimPaymentReturnState(orderId: string): Promise<{ status: EsimReturnStatus; paymentConfirmedAt: string | null }> {
  if (!/^ESIM-[0-9A-F]{30}$/i.test(orderId)) throw new Error("Invalid eSIM order reference");
  const html = await customFetch<string>(
    `/api/esim/payment-return?statusOnly=1&orderId=${encodeURIComponent(orderId)}`,
    { method: "GET", cache: "no-store", responseType: "text" },
  );
  const match = html.match(/data-esim-status="(payment_pending|payment_failed|fulfillment_pending|pending_review|completed)"/);
  if (!match) throw new Error("eSIM status unavailable");
  const confirmed = html.match(/data-esim-payment-confirmed-at="([^"]*)"/)?.[1] || null;
  return { status: match[1] as EsimReturnStatus, paymentConfirmedAt: confirmed };
}

export async function getEsimPaymentReturnStatus(orderId: string): Promise<EsimReturnStatus> {
  return (await getEsimPaymentReturnState(orderId)).status;
}

/** One callback-triggered reconciliation; never creates a charge or a new checkout. */
export async function reconcileEsimReturnedPayment(orderId: string, headers?: HeadersInit): Promise<void> {
  if (!/^ESIM-[0-9A-F]{30}$/i.test(orderId)) throw new Error("Invalid eSIM order reference");
  await customFetch(`/api/esim/orders/${encodeURIComponent(orderId)}/reconcile`, { method: "POST", headers });
}