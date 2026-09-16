import { buildPackageWhatsAppMessage } from "../utils/packageBuilderWhatsApp";

const estimate = {
  title: "Bali Serenity",
  summary: "A premium escape.",
  days: [
    { day: 1, title: "Arrival", plan: "Private transfer and check-in." },
    { day: 2, title: "Ubud", plan: "Explore temples and rice terraces." },
  ],
  hotelSuggestion: "Four Seasons Resort Bali at Sayan",
  estimatedPricePerPersonKwd: 565.11,
  estimatedTotalKwd: 1130.22,
  priceNote: "Final quote will be provided by our travel team.",
};

describe("buildPackageWhatsAppMessage", () => {
  it("includes the complete English package and every itinerary day", () => {
    const message = buildPackageWhatsAppMessage(
      estimate,
      { destination: "Bali", nights: 5, travelers: 2 },
      "en",
    );

    expect(message).toContain("Package: Bali Serenity");
    expect(message).toContain("Summary: A premium escape.");
    expect(message).toContain("Suggested hotel: Four Seasons Resort Bali at Sayan");
    expect(message).toContain("Estimated price per person: KWD 565.11");
    expect(message).toContain("Estimated total: KWD 1130.22");
    expect(message).toContain("Day 1: Arrival\nPrivate transfer and check-in.");
    expect(message).toContain("Day 2: Ubud\nExplore temples and rice terraces.");
    expect(message).toContain("Price note: Final quote will be provided by our travel team.");
  });

  it("uses Arabic labels while preserving the complete generated itinerary", () => {
    const message = buildPackageWhatsAppMessage(
      estimate,
      { destination: "بالي", nights: 5, travelers: 2 },
      "ar",
    );

    expect(message).toContain("الوجهة: بالي");
    expect(message).toContain("الفندق المقترح: Four Seasons Resort Bali at Sayan");
    expect(message).toContain("اليوم 1: Arrival\nPrivate transfer and check-in.");
    expect(message).toContain("اليوم 2: Ubud\nExplore temples and rice terraces.");
    expect(message).toContain("ملاحظة السعر: Final quote will be provided by our travel team.");
  });
});