import type { EsimDestination, EsimPackage } from "@workspace/api-client-react";
import { localizedEsimDestination } from "@workspace/api-client-react/esim-localization";

const REGIONAL_SLUG = "middle-east-and-north-africa";

/** Customer-facing label only; supplier identifiers and order snapshots stay unchanged. */
export function esimDestinationTitle(title: string, locale = "en", countryCode?: string): string {
  return localizedEsimDestination(title, locale, countryCode);
}

/** Keep names, flags and country codes paired before excluding a displayed country. */
export function esimDisplayedCountries(destination: EsimDestination, plan: EsimPackage) {
  const names = plan.coverage.length
    ? plan.coverage
    : destination.category === "local" ? [destination.title] : [];
  return names.map((name, index) => ({
    name,
    flagUrl: plan.coverage.length ? plan.coverageFlagUrls?.[index] : destination.imageUrl,
    code: plan.coverageCountryCodes?.[index],
  })).filter(({ name, code }) => destination.slug !== REGIONAL_SLUG
    || !(code?.trim().toUpperCase() === "IL" || /^(israel|إسرائيل|اسرائيل)$/i.test(name.trim())));
}