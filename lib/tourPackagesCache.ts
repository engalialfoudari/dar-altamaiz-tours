type TourPayload = { tours?: unknown[] };

let homePayload: TourPayload | null = null;
const localizedPayloads = new Map<string, TourPayload>();

function isTourPayload(value: unknown): value is TourPayload {
  return !!value && typeof value === "object" && Array.isArray((value as TourPayload).tours);
}

/** Keep the package list already fetched for Home available to the Packages tab. */
export function cacheHomeTourPayload(value: unknown): void {
  if (isTourPayload(value)) homePayload = value;
}

/** Keep the server's language-specific package response for fast tab revisits. */
export function cacheLocalizedTourPayload(lang: string, value: unknown): void {
  if (isTourPayload(value)) localizedPayloads.set(lang, value);
}

export function getCachedTourPayload(lang: string): TourPayload | null {
  return localizedPayloads.get(lang) ?? homePayload;
}

export function clearTourPackageCache(): void {
  homePayload = null;
  localizedPayloads.clear();
}
