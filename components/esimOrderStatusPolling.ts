export const ESIM_PAYMENT_RETURN_FAST_CHECK_MS = 10_000;
export const ESIM_PAYMENT_RETURN_POLL_INTERVAL_MS = 1_000;
export const ESIM_PAYMENT_RETURN_BACKGROUND_INTERVAL_MS = 15_000;
export const ESIM_PAYMENT_RETURN_BACKGROUND_CHECKS = 40;

const IN_PROGRESS_STATUSES = new Set(["payment_pending", "fulfillment_pending"]);
const TERMINAL_STATUSES = new Set(["payment_failed", "pending_review", "completed"]);

export function isEsimOrderInProgress(status: string | null | undefined): boolean {
  return status != null && IN_PROGRESS_STATUSES.has(status);
}

export function isEsimOrderStatusTerminal(status: string | null | undefined): boolean {
  return status != null && TERMINAL_STATUSES.has(status);
}

/**
 * After a payment callback, poll only the same order for at most 10 seconds
 * rapidly, then make at most ten minutes of slower reads while a known status is pending.
 * A null delay means polling has completed; this never creates an order.
 */
export function nextEsimOrderStatusPollDelay(
  elapsedMs: number,
  status: string | null | undefined,
  backgroundChecks: number,
): number | null {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || isEsimOrderStatusTerminal(status)) {
    return null;
  }
  if (elapsedMs < ESIM_PAYMENT_RETURN_FAST_CHECK_MS) {
    return Math.min(ESIM_PAYMENT_RETURN_POLL_INTERVAL_MS, ESIM_PAYMENT_RETURN_FAST_CHECK_MS - elapsedMs);
  }
  if (!isEsimOrderInProgress(status) || backgroundChecks >= ESIM_PAYMENT_RETURN_BACKGROUND_CHECKS) {
    return null;
  }
  return ESIM_PAYMENT_RETURN_BACKGROUND_INTERVAL_MS;
}