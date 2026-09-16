import React from "react";
import { StyleSheet } from "react-native";
import { render, waitFor } from "@testing-library/react-native";

import { LuxuryHome } from "./LuxuryHome";

const tour = {
  id: "almaty-1",
  title: "Discover Almaty: Mountains and City",
  url: "https://dt-tours.com/almaty",
  image: null,
  priceKwd: 113.4,
  nights: 3,
};

const commonProps = {
  onChangeLang: jest.fn(),
  onFlights: jest.fn(),
  onHotels: jest.fn(),
  onAIBuilder: jest.fn(),
  onWhereToGo: jest.fn(),
  onOpenUrl: jest.fn(),
  onExplore: jest.fn(),
  isOffline: false,
};

describe("LuxuryHome tour cards", () => {
  beforeEach(() => {
    jest.spyOn(global, "fetch").mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("/tours")) {
        return { json: async () => ({ tours: [tour] }) } as Response;
      }
      if (urlStr.includes("/trending-destinations")) {
        return { json: async () => ({ destinations: [] }) } as Response;
      }
      if (urlStr.includes("/hotel-deals")) {
        return { json: async () => ({ deals: [] }) } as Response;
      }
      return { json: async () => ({}) } as Response;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps Arabic cards on the same full-width button and price-row geometry as English", async () => {
    const { getByTestId, queryByTestId, rerender } = render(
      <LuxuryHome {...commonProps} lang="en" />,
    );

    await waitFor(() => expect(getByTestId("offer-book-almaty-1")).toBeTruthy());
    const englishButton = StyleSheet.flatten(
      getByTestId("offer-book-almaty-1").props.style,
    );
    const englishMeta = StyleSheet.flatten(
      getByTestId("offer-meta-almaty-1").props.style,
    );

    rerender(<LuxuryHome {...commonProps} lang="ar" />);

    const arabicMeta = StyleSheet.flatten(
      getByTestId("offer-meta-almaty-1").props.style,
    );

    expect(queryByTestId("btn-guest")).toBeNull();
    expect(arabicMeta.flexDirection).toBe(englishMeta.flexDirection);
    expect(arabicMeta.flexDirection).toBe("row");
  });
});