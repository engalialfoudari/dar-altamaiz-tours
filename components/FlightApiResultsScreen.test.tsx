import { buildFlightApiUrl, type FlightSearchValues } from "@/lib/flightSearch";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { FlightApiResultsScreen, baggageDetails, flightWhatsAppMessage, validateFlightPassengers } from "./FlightApiResultsScreen";

jest.mock("@/components/AppHeader", () => ({ AppHeader: () => null }));
jest.mock("@/components/InfoModal", () => ({ InfoModal: () => null }));

const values: FlightSearchValues = {
  tripType: "roundtrip",
  origin: { iata: "KWI", name: "Kuwait International", city: "Kuwait", country: "Kuwait" },
  destination: { iata: "DXB", name: "Dubai International", city: "Dubai", country: "UAE" },
  departure: "2026-10-05",
  returnDate: "2026-10-12",
  legs: [],
  adults: 1,
  children: 1,
  infants: 0,
  cabinClass: "Business",
};

const passenger = {
  firstName: "Noor", lastName: "Hassan", passportType: "Ordinary",
  passportNumber: "X123456", birthDate: "1990-02-03", passportExpiry: "2030-01-01",
};

describe("flight API and WhatsApp checkout handoff", () => {
  it("sends the selected trip type, cabin and traveller counts to the chatbot's flight API", () => {
    const url = new URL(buildFlightApiUrl("https://example.com/api", values));
    expect(url.pathname).toBe("/api/flights");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      origin: "KWI", destination: "DXB", departure: "2026-10-05",
      return: "2026-10-12", adults: "1", children: "1", infants: "0",
      cabin: "Business", strict: "1",
    });
    expect(() => buildFlightApiUrl("https://example.com/api", { ...values, tripType: "multicity" })).toThrow();
  });

  it("includes the selected flight and every passenger field, without treating WhatsApp as a completed payment", () => {
    const message = flightWhatsAppMessage({
      id: "itinerary-123", airline: "Kuwait Airways", airlineCode: "KU",
      departure: "12:00", arrival: "15:00", depDate: "05/10/2026",
      retDate: "12/10/2026", duration: "2h", stops: 0, price: "50.000", currency: "KWD",
      flightNumbers: "KU671", returnDeparture: "10:00", returnArrival: "11:00",
      returnDuration: "2h", returnStops: 0, returnFlightNumbers: "KU672",
    }, { ...values, specialRequests: "Aisle seats, please" }, [passenger, { ...passenger, firstName: "Ali", passportNumber: "Y789" }]);
    for (const expected of [
      "KWI", "DXB", "2026-10-05", "2026-10-12", "Kuwait Airways",
      "12:00", "15:00", "10:00", "11:00", "KU671", "KU672", "KWD 50.000", "Business", "itinerary-123",
      "Passenger 1 (Adult)", "Passenger 2 (Child)", "Noor", "Hassan",
      "Ordinary", "X123456", "1990-02-03", "2030-01-01", "Ali", "Y789",
      "Special requests: Aisle seats, please", "confirm availability and final fare",
    ]) expect(message).toContain(expected);
  });

  it("requires a valid date of birth and passport expiry on departure", () => {
    expect(validateFlightPassengers([passenger], values.departure)).toBe(-1);
    expect(validateFlightPassengers([{ ...passenger, passportExpiry: "2025-10-05" }], values.departure)).toBe(0);
    expect(validateFlightPassengers([{ ...passenger, birthDate: "2026-02-30" }], values.departure)).toBe(0);
    expect(validateFlightPassengers([passenger, { ...passenger, lastName: "" }], values.departure)).toBe(1);
  });

  it("renders only fare-specific measurements with explicit units", () => {
    expect(baggageDetails({ pieces: 2, weight: "23kg" }, false)).toBe("2 bags · 23kg");
    expect(baggageDetails({ pieces: 1 }, true)).toBe("1 حقيبة");
    expect(baggageDetails({ weight: "15lb" }, false)).toBe("15lb");
    expect(baggageDetails({ pieces: 0, weight: "23" }, false)).toBeNull();
  });

  it("opens the airline's flight and baggage details without inventing a baggage allowance", async () => {
    const request = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        configured: true,
        flights: [{
          id: "ku-one", airline: "Kuwait Airways", airlineCode: "KU",
          airlineLogo: "https://example.com/ku.png", departure: "11:55", arrival: "20:00",
          depDate: "02/10/2026", duration: "9h 5m", stops: 1,
          price: "46.875", currency: "KWD", cabinBagIncluded: true,
          outboundSegments: [
            { origin: "KWI", destination: "DXB", departure: "2026-10-02T11:55", arrival: "2026-10-02T14:00", duration: "2h 5m", flightNumber: "KU71", layoverMinutes: 120 },
            { origin: "DXB", destination: "MUC", departure: "2026-10-02T16:00", arrival: "2026-10-02T20:00", duration: "4h", flightNumber: "KU171" },
          ],
        }],
      }),
    } as Response);
    const screen = render(<FlightApiResultsScreen url="https://example.com/api/flights" values={{ ...values, tripType: "oneway" }} lang="en" onBack={jest.fn()} onClose={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId("flight-details-0")).toBeTruthy());
    fireEvent.press(screen.getByTestId("flight-details-0"));
    expect(screen.getByTestId("flight-details-popup")).toBeTruthy();
    expect(screen.getByText(/Transit at DXB · 2h 0m/)).toBeTruthy();
    expect(screen.getByText(/Cabin bag: Included/)).toBeTruthy();
    expect(screen.getByText(/Checked bag: Not specified/)).toBeTruthy();
    expect(screen.getByText(/Some bag weights or counts are not provided/)).toBeTruthy();
    request.mockRestore();
  });

  it("shows verified measurements for the selected fare and asks to confirm missing ones", async () => {
    const request = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configured: true, flights: [{
        id: "fare-1", airline: "Airline", airlineCode: "XY", departure: "10:00", arrival: "12:00",
        depDate: "20/10/2026", duration: "2h", stops: 0, price: "50.000", currency: "KWD",
        cabinBagIncluded: true, checkedBagIncluded: true,
        cabinBaggage: { pieces: 1 }, checkedBaggage: { pieces: 2, weight: "23kg" },
      }] }),
    } as Response);
    const screen = render(<FlightApiResultsScreen url="https://example.com/api/flights" values={values} lang="en" onBack={jest.fn()} onClose={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId("flight-details-0")).toBeTruthy());
    fireEvent.press(screen.getByTestId("flight-details-0"));
    expect(screen.getByText(/Cabin bag: Included · 1 bag/)).toBeTruthy();
    expect(screen.getByText(/Checked bag: Included · 2 bags · 23kg/)).toBeTruthy();
    expect(screen.getByText(/Some bag weights or counts are not provided/)).toBeTruthy();
    request.mockRestore();
  });

  it("offers passport types in a dropdown and sends the selected type in the request", async () => {
    const request = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configured: true, flights: [{
        id: "flight-1", airline: "Kuwait Airways", airlineCode: "KU",
        departure: "12:00", arrival: "15:00", depDate: "05/10/2026",
        duration: "3h", stops: 0, price: "50.000", currency: "KWD",
      }] }),
    } as Response);
    const whatsApp = jest.spyOn(Linking, "openURL").mockResolvedValueOnce(undefined);
    const screen = render(<FlightApiResultsScreen url="https://example.com/api/flights" values={{ ...values, adults: 1, children: 0 }} lang="en" onBack={jest.fn()} onClose={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId("flight-select-0")).toBeTruthy());
    fireEvent.press(screen.getByTestId("flight-select-0"));
    const dropdown = screen.getByTestId("passenger-0-passportType");
    expect(screen.queryByTestId("passenger-0-passport-option-Diplomatic")).toBeNull();
    fireEvent.press(dropdown);
    expect(screen.getByTestId("passenger-0-passport-option-Ordinary")).toBeTruthy();
    fireEvent.press(screen.getByTestId("passenger-0-passport-option-Diplomatic"));
    expect(screen.queryByTestId("passenger-0-passport-option-Diplomatic")).toBeNull();
    expect(screen.getByText("Diplomatic")).toBeTruthy();
    fireEvent.changeText(screen.getByTestId("passenger-0-firstName"), "Noor");
    fireEvent.changeText(screen.getByTestId("passenger-0-lastName"), "Hassan");
    fireEvent.changeText(screen.getByTestId("passenger-0-passportNumber"), "X123456");
    fireEvent.changeText(screen.getByTestId("passenger-0-birthDate"), "19900203");
    fireEvent.changeText(screen.getByTestId("passenger-0-passportExpiry"), "20300101");
    fireEvent.press(screen.getByTestId("flight-whatsapp-payment"));
    await waitFor(() => expect(whatsApp).toHaveBeenCalledTimes(1));
    expect(decodeURIComponent(whatsApp.mock.calls[0][0])).toContain("Passport type: Diplomatic");
    whatsApp.mockRestore();
    request.mockRestore();
  });
});