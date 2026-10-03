import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { EsimCountryPicker, getEsimCountryOptions } from "./EsimCountryPicker";
import { localizedEsimDestination, esimCountryFlag } from "@workspace/api-client-react/esim-localization";
import { getCountries } from "libphonenumber-js";

describe("unified offline eSIM country names", () => {
  it("has Arabic and English names for every selectable country without Intl.DisplayNames", () => {
    const original = Object.getOwnPropertyDescriptor(Intl, "DisplayNames");
    Object.defineProperty(Intl, "DisplayNames", { configurable: true, value: undefined });
    try {
      for (const language of ["ar", "en"]) {
        const options = getEsimCountryOptions(language);
        expect(options).toHaveLength(getCountries().length);
        for (const country of options) {
          expect(country.name).not.toBe(country.iso);
          expect(country.name).not.toMatch(/Unknown country|دولة غير معروفة/);
          if (language === "ar") expect(country.name).toMatch(/[\u0600-\u06ff]/);
        }
      }
      expect(localizedEsimDestination("Saudi Arabia", "ar", "SA")).toBe("المملكة العربية السعودية");
      expect(localizedEsimDestination("Turkey", "ar", "TR")).toBe("تركيا");
      expect(localizedEsimDestination("Middle East and North Africa", "ar")).toBe("الخليج وشمال أفريقيا");
      expect(localizedEsimDestination("Saudi Arabia", "en", "SA")).toBe("Saudi Arabia");
    } finally {
      if (original) Object.defineProperty(Intl, "DisplayNames", original);
      else delete (Intl as unknown as Record<string, unknown>).DisplayNames;
    }
  });
  it("shows a small flag, searches Arabic names and updates names when the language changes", () => {
    const onSelect = jest.fn();
    const props = { testID: "country", selectedIso: "KW", locale: "ar", title: "اختر الدولة", placeholder: "الدولة", mode: "country" as const, onSelect };
    const screen = render(<EsimCountryPicker {...props} />);
    expect(screen.getByText(`${esimCountryFlag("KW")}  الكويت`)).toBeTruthy();
    fireEvent.press(screen.getByTestId("country"));
    fireEvent.changeText(screen.getByTestId("country-search"), "السعودية");
    expect(screen.getByTestId("country-option-SA")).toBeTruthy();
    expect(screen.getByText(esimCountryFlag("SA"), { includeHiddenElements: true })).toBeTruthy();
    fireEvent.press(screen.getByTestId("country-option-SA"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ iso: "SA", name: "المملكة العربية السعودية", englishName: "Saudi Arabia" }));
    screen.rerender(<EsimCountryPicker {...props} locale="en" />);
    expect(screen.getByText(`${esimCountryFlag("KW")}  Kuwait`)).toBeTruthy();
  });
});