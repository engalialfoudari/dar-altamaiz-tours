import {
  ESIM_PAYMENT_RETURN_BACKGROUND_INTERVAL_MS,
  ESIM_PAYMENT_RETURN_FAST_CHECK_MS,
  ESIM_PAYMENT_RETURN_POLL_INTERVAL_MS,
  nextEsimOrderStatusPollDelay,
} from "./esimOrderStatusPolling";

describe("read-only eSIM payment-return checks", () => {
  it("checks the same pending order rapidly for at most ten seconds", () => {
    expect(nextEsimOrderStatusPollDelay(0, "payment_pending", 0))
      .toBe(ESIM_PAYMENT_RETURN_POLL_INTERVAL_MS);
    expect(nextEsimOrderStatusPollDelay(9_500, "fulfillment_pending", 0)).toBe(500);
    expect(nextEsimOrderStatusPollDelay(ESIM_PAYMENT_RETURN_FAST_CHECK_MS, "payment_pending", 0))
      .toBe(ESIM_PAYMENT_RETURN_BACKGROUND_INTERVAL_MS);
  });

  it("does not poll terminal, unknown-after-window, or completed statuses", () => {
    expect(nextEsimOrderStatusPollDelay(0, "completed", 0)).toBeNull();
    expect(nextEsimOrderStatusPollDelay(0, "payment_failed", 0)).toBeNull();
    expect(nextEsimOrderStatusPollDelay(ESIM_PAYMENT_RETURN_FAST_CHECK_MS, undefined, 0)).toBeNull();
  });

  it("makes at most three slower reads for a pending same-order status", () => {
    expect(nextEsimOrderStatusPollDelay(20_000, "fulfillment_pending", 0))
      .toBe(ESIM_PAYMENT_RETURN_BACKGROUND_INTERVAL_MS);
    expect(nextEsimOrderStatusPollDelay(40_000, "fulfillment_pending", 1))
      .toBe(ESIM_PAYMENT_RETURN_BACKGROUND_INTERVAL_MS);
    expect(nextEsimOrderStatusPollDelay(60_000, "payment_pending", 2))
      .toBe(ESIM_PAYMENT_RETURN_BACKGROUND_INTERVAL_MS);
    expect(nextEsimOrderStatusPollDelay(80_000, "payment_pending", 3)).toBeNull();
  });
});