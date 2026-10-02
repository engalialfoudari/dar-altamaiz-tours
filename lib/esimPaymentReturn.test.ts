import {
  esimPaymentReturnRedirectHref,
  parseEsimPaymentReturnUrl,
  validateEsimPaymentOrderId,
} from "./esimPaymentReturn";

const ORDER_ID = "ESIM-0123456789ABCDEF0123456789ABCD";

describe("eSIM hosted-payment return links", () => {
  it("parses the custom-scheme link used when the app cold-starts", () => {
    expect(parseEsimPaymentReturnUrl(`dttours://esim-payment-return?orderId=${ORDER_ID}`))
      .toEqual({ orderId: ORDER_ID });
  });

  it("routes a valid cold-start order into the app's My eSIMs entry state", () => {
    expect(esimPaymentReturnRedirectHref(ORDER_ID)).toEqual({
      pathname: "/",
      params: { esimPaymentOrderId: ORDER_ID },
    });
  });

  it("rejects wrong-host, missing, malformed, and ambiguous order IDs", () => {
    expect(parseEsimPaymentReturnUrl(`dttours://hotel-payment-return?orderId=${ORDER_ID}`)).toBeNull();
    expect(parseEsimPaymentReturnUrl("dttours://esim-payment-return")).toBeNull();
    expect(parseEsimPaymentReturnUrl("dttours://esim-payment-return?orderId=ESIM-not-an-id")).toBeNull();
    expect(parseEsimPaymentReturnUrl(
      `dttours://esim-payment-return?orderId=${ORDER_ID}&orderId=${ORDER_ID}`,
    )).toBeNull();
    expect(validateEsimPaymentOrderId("ESIM-0123456789ABCDEF0123456789ABCG")).toBeNull();
    expect(esimPaymentReturnRedirectHref(["ESIM-invalid"])).toBe("/");
    expect(esimPaymentReturnRedirectHref([ORDER_ID, ORDER_ID])).toBe("/");
  });
});