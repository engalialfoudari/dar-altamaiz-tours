import React from "react";
import { render, waitFor, fireEvent } from "@testing-library/react-native";
import { LuxuryHome } from "./LuxuryHome";

const commonProps = {
  onChangeLang: jest.fn(),
  onFlights: jest.fn(),
  onHotels: jest.fn(),
  onAIBuilder: jest.fn(),
  onWhereToGo: jest.fn(),
  onOpenUrl: jest.fn(),
  onOpenHotelPortalUrl: jest.fn(),
  onExplore: jest.fn(),
  isOffline: false,
};

describe("LuxuryHome Trending and Deals", () => {
  const trendingData = [
    { city: "Dubai", country: "UAE", cityAr: "دبي", countryAr: "الإمارات", imageUrl: "https://example.com/dubai.jpg", query: "dubai", code: "dxb", hotelName: "Season Hotel", fromPriceKwd: 245, stayNights: 5 }
  ];
  const dealData = [
    { id: "deal-1", title: "Summer Sale", subtitle: "20% off", imageUrl: "https://example.com/deal.jpg", targetHotel: "Hilton", scope: "destination", country: "UK", city: "London", expiryDate: "2024-12-31" }
  ];

  beforeEach(() => {
    jest.spyOn(global, "fetch").mockImplementation(async (url) => {
      const urlStr = typeof url === "string" ? url : url instanceof Request ? url.url : url.toString();
      if (urlStr.endsWith("/tours")) {
        return { json: async () => ({ tours: [] }) } as Response;
      }
      if (urlStr.includes("/trending-destinations")) {
        return { json: async () => ({ destinations: trendingData }) } as Response;
      }
      if (urlStr.includes("/hotel-deals")) {
        return { json: async () => ({ deals: dealData }) } as Response;
      }
      return { json: async () => ({}) } as Response;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("renders trending destinations and calls onOpenHotelPortalUrl when clicked", async () => {
    const { getByTestId, getByText } = render(<LuxuryHome {...commonProps} lang="en" />);

    await waitFor(() => expect(getByTestId("trending-dxb")).toBeTruthy());
    
    expect(getByText("Dubai")).toBeTruthy();
    expect(getByText("Season Hotel")).toBeTruthy();
    expect(getByText("From 245 KWD")).toBeTruthy();
    
    fireEvent.press(getByTestId("trending-dxb"));
    
    expect(commonProps.onOpenHotelPortalUrl).toHaveBeenCalled();
    const urlCalled = commonProps.onOpenHotelPortalUrl.mock.calls[0][0];
    expect(urlCalled).toContain("city=Dubai");
  });

  it("renders hotel deals and calls onOpenHotelPortalUrl when clicked", async () => {
    const { getByTestId, getByText } = render(<LuxuryHome {...commonProps} lang="en" />);

    await waitFor(() => expect(getByTestId("deal-deal-1")).toBeTruthy());
    
    expect(getByText("Summer Sale")).toBeTruthy();
    
    fireEvent.press(getByTestId("deal-deal-1"));
    
    expect(commonProps.onOpenHotelPortalUrl).toHaveBeenCalled();
    const urlCalled = commonProps.onOpenHotelPortalUrl.mock.calls[0][0];
    expect(urlCalled).toContain("brandQuery=Hilton");
    expect(urlCalled).toContain("city=London");
  });
});
