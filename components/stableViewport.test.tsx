import { resolveStableViewport } from "../utils/stableViewport";

describe("resolveStableViewport", () => {
  it("preserves the full app layer while an iOS web keyboard reduces the viewport", () => {
    const result = resolveStableViewport(
      { width: 390, height: 844 },
      { width: 390, height: 509 },
      true,
      true,
    );

    expect(result.layoutHeight).toBe(844);
    expect(result.keyboardViewportReduced).toBe(true);
  });

  it("uses ordinary viewport changes when no text input is focused", () => {
    const result = resolveStableViewport(
      { width: 390, height: 844 },
      { width: 390, height: 620 },
      true,
      false,
    );

    expect(result.layoutHeight).toBe(620);
    expect(result.keyboardViewportReduced).toBe(false);
  });

  it("resets the stable size after an orientation change", () => {
    const result = resolveStableViewport(
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      true,
      true,
    );

    expect(result.stable).toEqual({ width: 844, height: 390 });
    expect(result.layoutHeight).toBe(390);
    expect(result.keyboardViewportReduced).toBe(false);
  });
});