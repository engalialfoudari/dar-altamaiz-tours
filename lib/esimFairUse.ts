type Locale = "en" | "ar" | "tr";
type FairUsePlan = {
  isUnlimited?: boolean;
  hasFairUsagePolicy?: boolean;
  fairUsagePolicy?: string;
};

/** Display supplier facts only. Never assign Airalo's default to a specific plan. */
export function esimFairUseText(plan: FairUsePlan, locale: Locale): string {
  const policy = plan.fairUsagePolicy?.trim() ?? "";
  if (policy) {
    // Recognize the complete documented API sentence, not loose numbers that
    // could belong to a different restriction or reset period.
    const match = policy.replace(/\s+/g, " ").match(
      /^Lower speed rate of (\d+(?:\.\d+)?)\s*(Mbps|Kbps|Gbps) after (\d+(?:\.\d+)?)\s*(GB|MB) usage per day\.?$/i,
    );
    if (match) {
      const speed = `${match[1]} ${match[2]!.toLowerCase() === "kbps" ? "Kbps" : match[2]!.toLowerCase() === "gbps" ? "Gbps" : "Mbps"}`;
      const allowance = `${match[3]} ${match[4]!.toUpperCase()}`;
      if (locale === "ar") return `${allowance} من البيانات عالية السرعة يومياً، ثم تنخفض السرعة إلى ${speed}.`;
      if (locale === "tr") return `Günde ${allowance} yüksek hızlı veri; ardından hız ${speed} olur.`;
      return `${allowance} high-speed data per day, then ${speed}.`;
    }
    // Preserve unfamiliar supplier terms verbatim rather than inventing limits.
    return policy;
  }
  // Show only actual supplier terms, never a missing-information warning.
  return "";
}