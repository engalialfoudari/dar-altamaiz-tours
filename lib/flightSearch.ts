export type FlightTripType = "oneway" | "roundtrip" | "multicity";

export const SAMPLE_FLIGHT_PREVIEW_URL = "dt-tours://sample-flight-preview";

export function isSampleFlightPreviewUrl(value: string): boolean {
  return value === SAMPLE_FLIGHT_PREVIEW_URL;
}

export type FlightAirport = {
  iata: string;
  name: string;
  city: string;
  country: string;
  label?: string;
};

export type FlightLeg = {
  origin: FlightAirport | null;
  destination: FlightAirport | null;
  departure: string;
  originText?: string;
  destinationText?: string;
};

export type FlightSearchValues = {
  tripType: FlightTripType;
  origin: FlightAirport | null;
  destination: FlightAirport | null;
  departure: string;
  returnDate: string;
  legs: FlightLeg[];
  adults: number;
  children: number;
  infants: number;
  cabinClass: "Economy" | "Premium Economy" | "Business" | "First";
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function dateIsValid(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function validateFlightSearch(values: FlightSearchValues): string | null {
  const hasValidPassengers = Number.isInteger(values.adults)
    && Number.isInteger(values.children)
    && Number.isInteger(values.infants)
    && values.adults >= 1
    && values.children >= 0
    && values.infants >= 0
    && values.infants <= values.adults;
  if (values.tripType === "multicity") {
    if (values.legs.length < 2) return "legs";
    let previousDeparture = "";
    for (const leg of values.legs) {
      if (!leg.origin) return "leg-origin";
      if (!leg.destination) return "leg-destination";
      if (leg.origin.iata === leg.destination.iata) return "leg-same-airport";
      if (!dateIsValid(leg.departure)) return "leg-departure";
      if (previousDeparture && leg.departure < previousDeparture) return "leg-order";
      previousDeparture = leg.departure;
    }
    if (!hasValidPassengers) return "passengers";
    return null;
  }
  if (!values.origin) return "origin";
  if (!values.destination) return "destination";
  if (values.origin.iata === values.destination.iata) return "same-airport";
  if (!dateIsValid(values.departure)) return "departure";
  if (values.tripType === "roundtrip" && (!dateIsValid(values.returnDate) || values.returnDate <= values.departure)) {
    return "return";
  }
  if (!hasValidPassengers) return "passengers";
  return null;
}

export function buildFlightRedirectUrl(apiBase: string, values: FlightSearchValues): string {
  if (validateFlightSearch(values)) throw new Error("Flight search values are not valid");
  const baseUrl = `${apiBase.replace(/\/$/, "")}/flight-redirect`;
  if (values.tripType === "multicity") {
    const params = new URLSearchParams({
      trip: "multicity",
      adults: String(values.adults),
      children: String(values.children),
      infants: String(values.infants),
      cabin: values.cabinClass,
      legs: JSON.stringify(values.legs.map((leg) => ({
        from: leg.origin!.iata,
        to: leg.destination!.iata,
        dep: leg.departure,
      }))),
    });
    return `${baseUrl}?${params.toString()}`;
  }
  const params = new URLSearchParams({
    from: values.origin!.iata,
    from_id: values.origin!.iata,
    to: values.destination!.iata,
    to_id: values.destination!.iata,
    dep: values.departure,
    adults: String(values.adults),
    children: String(values.children),
    infants: String(values.infants),
    cabin: values.cabinClass,
    trip: values.tripType,
  });

  if (values.tripType === "roundtrip") params.set("ret", values.returnDate);
  return `${baseUrl}?${params.toString()}`;
}