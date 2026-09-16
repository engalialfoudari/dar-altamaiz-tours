import { STORE_CATALOG } from "./storeCatalog";

export function calculateCartTotals(items: { productId: string, quantity: number }[]) {
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalPriceKwd = items.reduce((acc, item) => {
    const product = STORE_CATALOG.find(p => p.id === item.productId);
    return acc + (product ? product.priceKwd * item.quantity : 0);
  }, 0);
  return { totalItems, totalPriceKwd };
}

describe("Cart Logic", () => {
  it("calculates totals correctly for empty cart", () => {
    const { totalItems, totalPriceKwd } = calculateCartTotals([]);
    expect(totalItems).toBe(0);
    expect(totalPriceKwd).toBe(0);
  });

  it("calculates totals correctly with valid items", () => {
    const adapter = STORE_CATALOG.find(p => p.id === "universal-adapter")!;
    const { totalItems, totalPriceKwd } = calculateCartTotals([
      { productId: "universal-adapter", quantity: 2 }
    ]);
    expect(totalItems).toBe(2);
    expect(totalPriceKwd).toBe(adapter.priceKwd * 2);
  });

  it("ignores invalid product IDs", () => {
    const { totalItems, totalPriceKwd } = calculateCartTotals([
      { productId: "invalid-id", quantity: 5 }
    ]);
    expect(totalItems).toBe(5);
    expect(totalPriceKwd).toBe(0);
  });
});
