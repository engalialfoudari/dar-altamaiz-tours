/** Only an exact, published, bookable card price belongs in the priced group. */
export function fixedPackagePrice(trip) {
  const p = trip?.pricing;
  return p?.mode === "bookable" && p.requiresDate === false &&
    typeof p.adultsFils === "number" && Number.isFinite(p.adultsFils) && p.adultsFils > 0
    ? p.adultsFils / 1000 : null;
}

/** Stable partition: preserve the selected ordering inside each price group. */
export function pricedPackagesFirst(trips) {
  return [
    ...trips.filter(trip => fixedPackagePrice(trip) !== null),
    ...trips.filter(trip => fixedPackagePrice(trip) === null),
  ];
}
