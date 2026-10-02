import React from "react";
import { Image } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { getBundledEsimDestination } from "@workspace/api-client-react/esim-static";
import { esimDestinationTitle, esimDisplayedCountries } from "./esimDisplayPolicy";
import { EsimCoverageSheet } from "./EsimCoverageSheet";

const destination = getBundledEsimDestination("middle-east-and-north-africa")!.destination;
const plan = destination.packages[0];

describe("GCC & North Africa customer display", () => {
  it("renames only the requested region without changing supplier data", () => {
    expect(esimDestinationTitle(destination.title)).toBe("GCC & North Africa");
    expect(esimDestinationTitle("Europe")).toBe("Europe");
    expect(destination.slug).toBe("middle-east-and-north-africa");
    expect(destination.title).toBe("Middle East and North Africa");
  });

  it("excludes Israel while keeping remaining country flags and codes correctly paired", () => {
    const before = JSON.stringify(plan);
    const countries = esimDisplayedCountries(destination, plan);
    expect(plan.coverage).toContain("Israel");
    expect(countries.some((country) => country.code === "IL" || country.name === "Israel")).toBe(false);
    expect(countries).toHaveLength(plan.coverage.length - 1);
    for (const country of countries) {
      const index = plan.coverage.indexOf(country.name);
      expect(country.flagUrl).toBe(plan.coverageFlagUrls?.[index]);
      expect(country.code).toBe(plan.coverageCountryCodes?.[index]);
    }
    expect(JSON.stringify(plan)).toBe(before);
    expect(esimDisplayedCountries({ ...destination, slug: "world" }, plan)).toHaveLength(plan.coverage.length);
  });

  it.each(["en", "ar"] as const)("updates the coverage sheet title, count and search in %s", (lang) => {
    const view = render(<EsimCoverageSheet visible lang={lang} destination={destination} plan={plan} bottomInset={0} onClose={() => {}} />);
    expect(view.getByText(`GCC & North Africa · ${plan.title}`)).toBeTruthy();
    expect(view.queryByText("Israel")).toBeNull();
    const count = plan.coverage.length - 1;
    expect(view.getByText(lang === "ar" ? `الدول المشمولة (${count})` : `Covered countries (${count})`)).toBeTruthy();
    expect(view.UNSAFE_getAllByType(Image)).toHaveLength(count);
    expect(view.getByText("Kuwait")).toBeTruthy();
    fireEvent.changeText(view.getByTestId("esim-coverage-search"), "Israel");
    expect(view.queryByText("Israel")).toBeNull();
    expect(view.queryByText("Kuwait")).toBeNull();
  });
});