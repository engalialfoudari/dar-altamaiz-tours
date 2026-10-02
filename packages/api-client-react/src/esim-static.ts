import snapshot from "./esim-catalog-snapshot.json";
import type { EsimCatalogResponse, EsimDestinationResponse } from "./generated/api.schemas";

/**
 * Offline destination/plan metadata only. Bundled prices cannot reflect current
 * supplier net costs or admin markup; display prices only after the live API
 * responds. Checkout always obtains a fresh server quote.
 */
export const bundledEsimCatalog: EsimCatalogResponse = {
  ...snapshot.catalog,
  destinations: snapshot.catalog.destinations.map(destination => ({
    ...destination,
    minPriceKwd: null,
  })),
} as EsimCatalogResponse;
const details = snapshot.details as Record<string, EsimDestinationResponse>;

export function getBundledEsimDestination(slug: string): EsimDestinationResponse | undefined {
  if (!Object.prototype.hasOwnProperty.call(details, slug)) return undefined;
  const detail = details[slug];
  return {
    ...detail,
    destination: {
      ...detail.destination,
      minPriceKwd: null,
      packages: detail.destination.packages.map(plan => ({
        ...plan,
        minPriceKwd: null,
        priceKwd: null,
      })),
    },
  };
}