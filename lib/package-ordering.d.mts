export function fixedPackagePrice(trip: { pricing?: unknown }): number | null;
export function pricedPackagesFirst<T extends { pricing?: unknown }>(trips: readonly T[]): T[];
