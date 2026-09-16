export interface PackageEstimateForWhatsApp {
  title: string;
  summary: string;
  days: Array<{ day: number; title: string; plan: string }>;
  hotelSuggestion: string;
  estimatedPricePerPersonKwd: number;
  estimatedTotalKwd: number;
  priceNote: string;
}

interface PackageTripDetails {
  destination: string;
  nights: number;
  travelers: number;
}

export function buildPackageWhatsAppMessage(
  result: PackageEstimateForWhatsApp,
  trip: PackageTripDetails,
  language: "en" | "ar",
): string {
  const sourceTag =
    "📦 حصلت على هذا العرض من تطبيق DT Tours (منشئ الباقات بالذكاء الاصطناعي) / I got this offer from the DT Tours app (AI Package Builder)";

  const itinerary = (result.days ?? [])
    .map((item) =>
      language === "ar"
        ? `اليوم ${item.day}: ${item.title}\n${item.plan}`
        : `Day ${item.day}: ${item.title}\n${item.plan}`,
    )
    .join("\n\n");

  if (language === "ar") {
    return [
      sourceTag,
      "مرحباً، أودّ حجز الباقة التالية:",
      `عنوان الباقة: ${result.title}`,
      `الملخص: ${result.summary}`,
      `الوجهة: ${trip.destination}`,
      `المدة: ${trip.nights} ليالٍ`,
      `عدد المسافرين: ${trip.travelers}`,
      `الفندق المقترح: ${result.hotelSuggestion}`,
      `السعر التقديري للشخص: ${result.estimatedPricePerPersonKwd} د.ك`,
      `الإجمالي التقديري: ${result.estimatedTotalKwd} د.ك`,
      `خط سير الرحلة:\n${itinerary}`,
      `ملاحظة السعر: ${result.priceNote}`,
    ].join("\n\n");
  }

  return [
    sourceTag,
    "Hello, I'd like to book this package:",
    `Package: ${result.title}`,
    `Summary: ${result.summary}`,
    `Destination: ${trip.destination}`,
    `Duration: ${trip.nights} nights`,
    `Travelers: ${trip.travelers}`,
    `Suggested hotel: ${result.hotelSuggestion}`,
    `Estimated price per person: KWD ${result.estimatedPricePerPersonKwd}`,
    `Estimated total: KWD ${result.estimatedTotalKwd}`,
    `Itinerary:\n${itinerary}`,
    `Price note: ${result.priceNote}`,
  ].join("\n\n");
}