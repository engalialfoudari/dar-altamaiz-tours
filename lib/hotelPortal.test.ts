import {
  buildHotelDestinationUrl,
  buildHotelDealUrl,
  hotelPortalUrlFor,
  hotelPortalPrefillJavaScript,
  requiresHotelPortalNavigation,
} from "./hotelPortal";

describe("hotelPortal URL builders", () => {
  const API_BASE = "https://example.com/api";

  it("cache-busts the development portal without changing the public portal URL", () => {
    const developmentUrl = new URL(hotelPortalUrlFor(API_BASE, true));
    expect(developmentUrl.pathname).toBe("/hotels");
    expect(developmentUrl.searchParams.get("portalBuild")).toBeTruthy();
    expect(hotelPortalUrlFor(API_BASE, false)).toBe("https://dt-tour.com/hotels");
  });

  describe("buildHotelDestinationUrl", () => {
    it("builds correct URL with city and autoSearch=0", () => {
      const url = buildHotelDestinationUrl(API_BASE, true, "en", "Dubai");
      const parsed = new URL(url);
      expect(parsed.searchParams.get("city")).toBe("Dubai");
      expect(parsed.searchParams.get("autoSearch")).toBe("0");
      expect(parsed.searchParams.get("lang")).toBe("en");
    });
  });

  describe("buildHotelDealUrl", () => {
    it("builds correct URL for kuwait scope", () => {
      const url = buildHotelDealUrl(API_BASE, true, "ar", { scope: "kuwait", targetHotel: "Hilton" });
      const parsed = new URL(url);
      expect(parsed.searchParams.get("city")).toBe("Kuwait");
      expect(parsed.searchParams.get("brandQuery")).toBe("Hilton");
      expect(parsed.searchParams.get("lang")).toBe("ar");
      expect(parsed.searchParams.get("autoSearch")).toBe("0");
      expect(parsed.searchParams.get("pickDates")).toBe("1");
    });

    it("builds correct URL for destination scope", () => {
      const url = buildHotelDealUrl(API_BASE, true, "en", {
        scope: "destination", city: "London", targetHotel: "Ritz", targetHotelId: "hotel-7",
      });
      const parsed = new URL(url);
      expect(parsed.searchParams.get("city")).toBe("London");
      expect(parsed.searchParams.get("brandQuery")).toBe("Ritz");
      expect(parsed.searchParams.get("hotelId")).toBe("hotel-7");
      expect(parsed.searchParams.get("fallbackCity")).toBe("London");
      expect(parsed.searchParams.get("autoSearch")).toBe("0");
      expect(parsed.searchParams.get("pickDates")).toBe("1");
      expect(parsed.searchParams.get("lang")).toBe("en");
    });

    it("builds correct URL without targetHotel", () => {
      const url = buildHotelDealUrl(API_BASE, true, "en", { scope: "destination", city: "Paris" });
      const parsed = new URL(url);
      expect(parsed.searchParams.get("city")).toBe("Paris");
      expect(parsed.searchParams.has("brandQuery")).toBe(false);
      expect(parsed.searchParams.get("pickDates")).toBe("1");
    });
  });

  describe("hotelPortalPrefillJavaScript", () => {
    it("does not overwrite an exact hotel after its navigated document loads", () => {
      const script = hotelPortalPrefillJavaScript(
        "https://dt-tour.com/hotels?city=London&hotelId=the-savoy&brandQuery=The%20Savoy&fallbackCity=London&pickDates=1",
      );

      expect(script).toBe("true;");
      expect(script).not.toContain("new Event('input'");
    });

    it("injects the selected destination after the hotel document loads", () => {
      const script = hotelPortalPrefillJavaScript(
        "https://example.com/hotels?lang=en&city=Dubai&autoSearch=0",
      );

      expect(script).toContain('var city="Dubai"');
      expect(script).toContain("document.getElementById('city')");
      expect(script).toContain("new Event('input',{bubbles:true})");
      expect(script).not.toContain("autoSearch");
    });

    it("safely serializes destination and hotel-chain values", () => {
      const script = hotelPortalPrefillJavaScript(
        "https://example.com/hotels?city=Istanbul&brandQuery=Hilton",
      );

      expect(script).toContain('var city="Istanbul"');
      expect(script).toContain('var brand="Hilton"');
      expect(script).toContain("window.brandQuery=brand");
    });
  });

  describe("requiresHotelPortalNavigation", () => {
    it("requires a real portal navigation for member-offer hotel and date handoffs", () => {
      expect(requiresHotelPortalNavigation(
        "https://dt-tour.com/hotels?city=London&hotelId=the-savoy&pickDates=1",
      )).toBe(true);
      expect(requiresHotelPortalNavigation(
        "https://dt-tour.com/hotels?city=Istanbul&pickDates=1",
      )).toBe(true);
      expect(requiresHotelPortalNavigation(
        "https://dt-tour.com/hotels?city=Dubai",
      )).toBe(false);
    });
  });
});
