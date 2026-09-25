import {
  buildFlightRedirectUrl,
  dateIsValid,
  validateFlightSearch,
  type FlightSearchValues,
} from "../lib/flightSearch";
import React from "react";
import { fireEvent, render, within } from "@testing-library/react-native";
import { I18nManager, StyleSheet } from "react-native";
import { FlightSearchScreen, isoAfter } from "./FlightSearchScreen";

const values: FlightSearchValues = {
  tripType: "roundtrip",
  origin: { iata: "KWI", name: "Kuwait International Airport", city: "Kuwait City", country: "Kuwait" },
  destination: { iata: "LHR", name: "Heathrow Airport", city: "London", country: "United Kingdom" },
  departure: "2026-09-10",
  returnDate: "2026-09-18",
  legs: [],
  adults: 2,
  children: 1,
  infants: 1,
  cabinClass: "Business",
};

describe("flight search handoff", () => {
  it("builds an encoded redirect URL with the real flight search values", () => {
    expect(buildFlightRedirectUrl("https://example.com/api/", values)).toBe(
      "https://example.com/api/flight-redirect?from=KWI&from_id=KWI&to=LHR&to_id=LHR&dep=2026-09-10&adults=2&children=1&infants=1&cabin=Business&trip=roundtrip&ret=2026-09-18",
    );
  });

  it("rejects incomplete, invalid, and reversed date searches", () => {
    expect(validateFlightSearch({ ...values, origin: null })).toBe("origin");
    expect(validateFlightSearch({ ...values, destination: values.origin })).toBe("same-airport");
    expect(validateFlightSearch({ ...values, departure: "2026-02-31" })).toBe("departure");
    expect(validateFlightSearch({ ...values, returnDate: "2026-09-09" })).toBe("return");
    expect(validateFlightSearch({ ...values, infants: 3 })).toBe("passengers");
    expect(dateIsValid("2026-09-10")).toBe(true);
  });

  it("encodes every verified airport and date for a multi-city handoff", () => {
    const multiCityValues: FlightSearchValues = {
      ...values,
      tripType: "multicity",
      legs: [
        { origin: values.origin, destination: values.destination, departure: "2026-09-10" },
        { origin: values.destination, destination: { iata: "CDG", name: "Charles de Gaulle Airport", city: "Paris", country: "France" }, departure: "2026-09-13" },
      ],
    };
    const url = new URL(buildFlightRedirectUrl("https://example.com/api/", multiCityValues));
    expect(url.searchParams.get("trip")).toBe("multicity");
    expect(url.searchParams.get("adults")).toBe("2");
    expect(url.searchParams.get("children")).toBe("1");
    expect(url.searchParams.get("infants")).toBe("1");
    expect(url.searchParams.get("cabin")).toBe("Business");
    expect(JSON.parse(url.searchParams.get("legs") ?? "[]")).toEqual([
      { from: "KWI", to: "LHR", dep: "2026-09-10" },
      { from: "LHR", to: "CDG", dep: "2026-09-13" },
    ]);
  });

  it("rejects incomplete, same-airport, and out-of-order multi-city legs", () => {
    const multiCityValues: FlightSearchValues = {
      ...values,
      tripType: "multicity",
      legs: [
        { origin: values.origin, destination: values.destination, departure: "2026-09-10" },
        { origin: values.destination, destination: { iata: "CDG", name: "Charles de Gaulle Airport", city: "Paris", country: "France" }, departure: "2026-09-13" },
      ],
    };
    expect(validateFlightSearch({ ...multiCityValues, legs: [multiCityValues.legs[0]] })).toBe("legs");
    expect(validateFlightSearch({ ...multiCityValues, legs: [{ ...multiCityValues.legs[0], destination: null }, multiCityValues.legs[1]] })).toBe("leg-destination");
    expect(validateFlightSearch({ ...multiCityValues, legs: [{ ...multiCityValues.legs[0], destination: values.origin }, multiCityValues.legs[1]] })).toBe("leg-same-airport");
    expect(validateFlightSearch({ ...multiCityValues, legs: [multiCityValues.legs[0], { ...multiCityValues.legs[1], departure: "2026-09-09" }] })).toBe("leg-order");
  });

  it("hides multi-city and keeps optional special requests in the search draft", () => {
    const onValuesChange = jest.fn();
    const { getByTestId, queryByTestId, getByText } = render(
      <FlightSearchScreen
        lang="en"
        onChangeLang={jest.fn()}
        onBack={jest.fn()}
        onSearch={jest.fn()}
        initialValues={{ ...values, tripType: "multicity", specialRequests: "Aisle seat" }}
        onValuesChange={onValuesChange}
      />,
    );

    expect(queryByTestId("flight-trip-multicity")).toBeNull();
    expect(queryByTestId("flight-multicity-legs")).toBeNull();
    expect(getByText("Special requests (optional)")).toBeTruthy();
    expect(getByTestId("flight-special-requests").props.value).toBe("Aisle seat");
    fireEvent.changeText(getByTestId("flight-special-requests"), "Wheelchair assistance");

    const latestValues = onValuesChange.mock.calls.at(-1)?.[0] as FlightSearchValues;
    expect(latestValues.tripType).toBe("roundtrip");
    expect(latestValues.specialRequests).toBe("Wheelchair assistance");
  });

  it("opens a cabin dropdown and changes class only after an option is selected", () => {
    const onValuesChange = jest.fn();
    const { getByTestId, getByText, queryByTestId } = render(
      <FlightSearchScreen
        lang="ar"
        onChangeLang={jest.fn()}
        onBack={jest.fn()}
        onSearch={jest.fn()}
        initialValues={values}
        onValuesChange={onValuesChange}
      />,
    );

    expect(getByText("رجال الأعمال")).toBeTruthy();
    fireEvent.press(getByTestId("flight-cabin"));

    expect(getByTestId("flight-cabin-options")).toBeTruthy();
    expect(onValuesChange.mock.calls.at(-1)?.[0].cabinClass).toBe("Business");

    fireEvent.press(getByTestId("flight-cabin-option-Economy"));

    expect(queryByTestId("flight-cabin-options")).toBeNull();
    expect(getByText("السياحية")).toBeTruthy();
    expect(onValuesChange.mock.calls.at(-1)?.[0].cabinClass).toBe("Economy");
  });

  it("keeps English weekday headers aligned with the Sunday-first date columns under device RTL", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-03T12:00:00"));
    const deviceRtl = jest.replaceProperty(I18nManager, "isRTL", true);

    try {
      const { getByTestId, getByText, getAllByText, queryByText } = render(
        <FlightSearchScreen
          lang="ar"
          onChangeLang={jest.fn()}
          onBack={jest.fn()}
          onSearch={jest.fn()}
          initialValues={{ ...values, departure: "2026-09-10", returnDate: "2026-09-18" }}
        />,
      );

      fireEvent.press(getByTestId("flight-departure-input"));

      expect(getByText("اختَر تواريخ الرحلة")).toBeTruthy();
      expect(getAllByText("المغادرة")).toHaveLength(2);
      expect(getAllByText("العودة")).toHaveLength(2);
      expect(getAllByText("Thu 10 سبتمبر")).toHaveLength(2);
      expect(getAllByText("Fri 18 سبتمبر")).toHaveLength(2);
      expect(getByText("سبتمبر 2026")).toBeTruthy();
      expect(getByText("8 ليالٍ")).toBeTruthy();
      expect(getByText("تم")).toBeTruthy();
      expect(queryByText("Select flight dates")).toBeNull();

      expect(getByTestId("flight-calendar-weekdays").children.map((child) => (
        (child as { props: { children: { props: { children: string } } } }).props.children.props.children
      ))).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);

      expect(StyleSheet.flatten(getByTestId("flight-calendar-weekdays").props.style)).toMatchObject({
        position: "relative",
      });
      expect(StyleSheet.flatten(getByTestId("flight-calendar-week-0").props.style)).toMatchObject({
        position: "relative",
      });
      expect(StyleSheet.flatten(getByTestId("flight-calendar-weekday-2").props.style)).toMatchObject({
        position: "absolute",
        left: `${2 * (100 / 7)}%`,
        width: "14.2857%",
      });
      expect(StyleSheet.flatten(getByTestId("flight-calendar-cell-2").props.style)).toMatchObject({
        position: "absolute",
        left: `${2 * (100 / 7)}%`,
        width: "14.2857%",
      });

      const leadingBlankCells = [0, 1].map((index) => getByTestId(`flight-calendar-cell-${index}`));
      leadingBlankCells.forEach((cell) => {
        expect(within(cell).queryAllByTestId(/flight-calendar-day-/)).toHaveLength(0);
      });

      const secondWeekDates = ["06", "07", "08", "09", "10", "11", "12"];
      secondWeekDates.forEach((day, weekdayIndex) => {
        const column = getByTestId(`flight-calendar-cell-${7 + weekdayIndex}`);
        expect(within(column).getByTestId(`flight-calendar-day-2026-09-${day}`)).toBeTruthy();
      });
    } finally {
      deviceRtl.restore();
      jest.useRealTimers();
    }
  });
});
