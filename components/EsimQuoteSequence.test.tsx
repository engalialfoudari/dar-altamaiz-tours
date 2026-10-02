import { EsimQuoteSequence } from "./EsimQuoteSequence";

describe("eSIM quote requests", () => {
  it("allows the edited payment selection to quote again while the previous request is pending", () => {
    const gate = new EsimQuoteSequence();
    const oldQuote = gate.begin()!;
    expect(gate.begin()).toBeNull(); // duplicate taps for the same inputs are blocked

    gate.invalidate(); // payment method or promo changed before the request settled
    const latestQuote = gate.begin()!;
    expect(latestQuote).not.toBe(oldQuote);
    expect(gate.isCurrent(oldQuote)).toBe(false);
    expect(gate.finish(oldQuote)).toBe(false); // stale finally cannot reset newer pending state
    expect(gate.isCurrent(latestQuote)).toBe(true);
    expect(gate.finish(latestQuote)).toBe(true);
    expect(gate.begin()).not.toBeNull(); // latest quote can be retried after settling
  });

  it("discards a quote when inputs change and allows an immediate retry", () => {
    const gate = new EsimQuoteSequence();
    const stale = gate.begin()!;
    gate.invalidate();
    expect(gate.finish(stale)).toBe(false);
    expect(gate.begin()).not.toBeNull();
  });
});