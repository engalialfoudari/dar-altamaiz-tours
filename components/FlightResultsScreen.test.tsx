jest.mock("react-native-webview", () => ({ WebView: "WebView" }));

import {
  dtCabinValue,
  flightSearchInjection,
  isDtFlightResultPath,
  isDtFlightResultUrl,
  isPaymentOrCheckoutUrl,
} from "./FlightResultsScreen";
import { SAMPLE_FLIGHT_PREVIEW_URL, isSampleFlightPreviewUrl } from "@/lib/flightSearch";

describe("in-app DT Tours flight results", () => {
  it("keeps the explicit sample preview separate from live handoffs", () => {
    expect(isSampleFlightPreviewUrl(SAMPLE_FLIGHT_PREVIEW_URL)).toBe(true);
    expect(isSampleFlightPreviewUrl("https://dt-tours.com/")).toBe(false);
  });

  it("recognizes result pages without treating them as payment pages", () => {
    const resultsUrl = "https://dt-tours.com/index.php/flight/search/19008";
    expect(isDtFlightResultUrl(resultsUrl)).toBe(true);
    expect(isPaymentOrCheckoutUrl(resultsUrl)).toBe(false);
  });

  it("recognizes a supplier result path sent before the WebView URL event", () => {
    expect(isDtFlightResultPath("/index.php/flight/search/19008")).toBe(true);
    expect(isDtFlightResultPath("/index.php/payment/failure")).toBe(false);
    expect(isDtFlightResultPath(undefined)).toBe(false);
  });

  it("blocks payment and checkout pages before results are shown", () => {
    expect(isPaymentOrCheckoutUrl("https://dt-tours.com/index.php/payment/failure")).toBe(true);
    expect(isPaymentOrCheckoutUrl("https://www.upayments.com/checkout")).toBe(true);
    expect(isDtFlightResultUrl("https://dt-tours.com/index.php/payment/failure")).toBe(false);
  });

  it("builds syntactically valid device-side form injection", () => {
    const script = flightSearchInjection({
      tripType: "circle",
      cabin: "Economy",
      adults: 1,
      departure: "2026-08-31",
      returnDate: "2026-09-07",
      from: { iata: "KWI", id: "3945", label: "Kuwait", category: "All_data" },
      to: { iata: "DWC", id: "8971", label: "Dubai", category: "Search Results" },
    });
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain("function formatDate(value)");
    expect(script).not.toContain("bytecode");
  });

  it("serializes the live DT Tours contract, including supplier cabin and date formats", () => {
    const script = flightSearchInjection({
      tripType: "circle",
      cabin: "Premium Economy",
      adults: 2,
      children: 1,
      infants: 1,
      departure: "2026-08-31",
      returnDate: "2026-09-07",
      from: { iata: "KWI", id: "3945", label: "Kuwait, Kuwait ALL Airport", category: "All_data" },
      to: { iata: "DXB", id: "1921", label: "Dubai, United Arab Emirates, UAE ALL Airport", category: "All_data" },
    });

    expect(dtCabinValue("Premium Economy")).toBe("PremiumEconomy");
    expect(dtCabinValue("Business")).toBe("Business");
    expect(script).toContain('"cabin":"PremiumEconomy"');
    expect(script).toContain("parts.length === 3 ? parts[2] + '-' + parts[1] + '-' + parts[0]");
    expect(script).toContain("dateFormat: 'DD-MM-YYYY'");
    expect(script).not.toContain("parts[2] + '/' + parts[1]");
    expect(script).toContain("array to string conversion");
    expect(script).toContain("function supplierFailure()");
    expect(script).toContain("setValue('#from', config.from.label)");
    expect(script).toContain("setValue('#from_val', config.from.iata)");
    expect(script).toContain("setValue('#from_loc_id', config.from.id)");
    expect(script).toContain("setValue('#from_loc_type', config.from.category)");
    expect(script).toContain("setValue('#to', config.to.label)");
    expect(script).toContain("setValue('#flight_datepicker1', formatDate(config.departure))");
    expect(script).toContain("#flight-form-submit, [name=\"search_flight\"]");
  });

  it("waits for the native message bridge before consuming its one-time boot guard", () => {
    const script = flightSearchInjection({
      tripType: "oneway",
      cabin: "Economy",
      adults: 1,
      departure: "2026-08-31",
      from: { iata: "KWI", id: "3945", label: "Kuwait", category: "All_data" },
      to: { iata: "DXB", id: "8971", label: "Dubai", category: "Search Results" },
    });

    const bridgeGuard = script.indexOf("!window.ReactNativeWebView");
    const bootGuard = script.indexOf("window.__dtNativeFlightBooted = true");
    expect(bridgeGuard).toBeGreaterThan(-1);
    expect(bootGuard).toBeGreaterThan(bridgeGuard);
  });

  it("submits the DT Tours form only once instead of retrying while navigation is pending", () => {
    const script = flightSearchInjection({
      tripType: "circle",
      cabin: "Economy",
      adults: 1,
      departure: "2026-08-31",
      returnDate: "2026-09-07",
      from: { iata: "KWI", id: "3945", label: "Kuwait, Kuwait ALL Airport", category: "All_data" },
      to: { iata: "DXB", id: "1921", label: "Dubai, United Arab Emirates, UAE ALL Airport", category: "All_data" },
    });

    expect(script).toContain("function submitOnce()");
    expect(script).toContain("window.__dtNativeFlightSubmitTriggered = true");
    expect(script).not.toContain("stillOnStartPage");
    expect(script).toContain("if (attempt >= 105)");
  });

  it("fills every live standard-form field and clicks the supplier submit control once", () => {
    const script = flightSearchInjection({
      tripType: "circle",
      cabin: "Business",
      adults: 2,
      children: 1,
      infants: 1,
      departure: "2026-08-31",
      returnDate: "2026-09-07",
      from: { iata: "KWI", id: "3945", label: "Kuwait, Kuwait ALL Airport", category: "All_data" },
      to: { iata: "DXB", id: "1921", label: "Dubai, United Arab Emirates, UAE ALL Airport", category: "All_data" },
    });
    const messages: Array<Record<string, unknown>> = [];
    const field = () => ({
      value: "",
      disabled: false,
      removeAttribute: () => {},
      setAttribute: () => {},
      dispatchEvent: () => true,
    });
    const fields = {
      "#trip_type_id": field(),
      "#from": field(),
      "#from_val": field(),
      "#from_loc_id": field(),
      "#from_loc_type": field(),
      "#to": field(),
      "#to_val": field(),
      "#to_loc_id": field(),
      "#to_loc_type": field(),
      "#flight_datepicker1": field(),
      "#flight_datepicker2": field(),
      sector: { ...field(), checked: false },
      cabin: field(),
      adult: field(),
      child: field(),
      infant: field(),
      submit: { click: jest.fn() },
    };
    const form = {
      querySelector: (selector: string) => {
        if (selector.includes("sector_type")) return fields.sector;
        if (selector === '[name="v_class"]') return fields.cabin;
        if (selector === '[name="adult"]') return fields.adult;
        if (selector === '[name="child"]') return fields.child;
        if (selector === '[name="infant"]') return fields.infant;
        if (selector.includes("flight-form-submit")) return fields.submit;
        return null;
      },
    };
    const document = {
      readyState: "complete",
      title: "DT Tours",
      body: { innerText: "" },
      getElementById: (id: string) => id === "flight_form" ? form : fields[id as keyof typeof fields] ?? null,
      querySelector: (selector: string) => fields[selector as keyof typeof fields] ?? null,
      querySelectorAll: () => [],
      addEventListener: () => {},
    };

    new Function("window", "document", "location", "Event", "setTimeout", script)(
      {
        ReactNativeWebView: { postMessage: (message: string) => messages.push(JSON.parse(message)) },
        addEventListener: () => {},
      },
      document,
      { pathname: "/", hostname: "dt-tours.com" },
      function Event() {},
      (callback: () => void) => { callback(); return 0; },
    );

    expect(fields["#trip_type_id"].value).toBe("circle");
    expect(fields["#from"].value).toBe("Kuwait, Kuwait ALL Airport");
    expect(fields["#from_val"].value).toBe("KWI");
    expect(fields["#from_loc_id"].value).toBe("3945");
    expect(fields["#from_loc_type"].value).toBe("All_data");
    expect(fields["#to"].value).toBe("Dubai, United Arab Emirates, UAE ALL Airport");
    expect(fields["#to_val"].value).toBe("DXB");
    expect(fields["#to_loc_id"].value).toBe("1921");
    expect(fields["#to_loc_type"].value).toBe("All_data");
    expect(fields["#flight_datepicker1"].value).toBe("31-08-2026");
    expect(fields["#flight_datepicker2"].value).toBe("07-09-2026");
    expect(fields.cabin.value).toBe("Business");
    expect(fields.adult.value).toBe("2");
    expect(fields.child.value).toBe("1");
    expect(fields.infant.value).toBe("1");
    expect(fields.submit.click).toHaveBeenCalledTimes(1);
    expect(messages.some((message) => message.type === "DT_FLIGHT_SUBMITTED")).toBe(true);
  });

  it("records a concise supplier-failure diagnostic without customer data", () => {
    const script = flightSearchInjection({
      tripType: "circle",
      cabin: "Economy",
      adults: 1,
      departure: "2026-08-31",
      returnDate: "2026-09-07",
      from: { iata: "KWI", id: "3945", label: "Kuwait", category: "All_data" },
      to: { iata: "DXB", id: "1921", label: "Dubai", category: "All_data" },
    });
    const messages: Array<Record<string, unknown>> = [];
    const supplierError = "Flight Booking Engine Could Not Process Your Request";
    const document = {
      readyState: "complete",
      title: "DT Tours",
      body: { innerText: supplierError },
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
    };

    new Function("window", "document", "location", "Event", "setTimeout", script)(
      {
        ReactNativeWebView: { postMessage: (message: string) => messages.push(JSON.parse(message)) },
        addEventListener: () => {},
      },
      document,
      { pathname: "/index.php/flight/search/19016", hostname: "dt-tours.com" },
      function Event() {},
      () => 0,
    );

    const failure = messages.find((message) => message.failureCategory === "dt_error");
    expect(failure).toMatchObject({
      type: "DT_FLIGHT_DIAGNOSTIC",
      route: "KWI-DXB",
      tripType: "circle",
      dateFormat: "DD-MM-YYYY",
      supplierResponse: "flight_booking_engine_could_not_process",
    });
    expect(messages.some((message) => message.type === "DT_FLIGHT_FAILED")).toBe(true);
  });
});