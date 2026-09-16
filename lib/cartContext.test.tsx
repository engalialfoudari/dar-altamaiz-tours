import React from "react";
import { Text } from "react-native";
import { render, waitFor } from "@testing-library/react-native";

import { CartProvider, useCart } from "./cartContext";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

function CatalogCount() {
  const { catalog, items } = useCart();
  return <Text testID="catalog-state">{catalog.length}:{items.length}</Text>;
}

describe("CartProvider server catalog", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("accepts an empty production catalog and removes unavailable cart items", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    AsyncStorage.getItem.mockImplementation((key: string) =>
      Promise.resolve(key === "DT_TOURS_CART"
        ? JSON.stringify([{ productId: "universal-adapter", quantity: 1 }])
        : null));
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ products: [] }),
    } as unknown as Response);

    const { getByTestId } = render(
      <CartProvider>
        <CatalogCount />
      </CartProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("catalog-state").props.children.join("")).toBe("0:0");
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/store/products"),
      expect.objectContaining({ signal: expect.anything() }),
    );
  });
});