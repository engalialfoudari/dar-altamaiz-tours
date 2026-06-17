import { Router } from "express";
import { getBrowser, applyStealthOverrides } from "../lib/browser";

const router = Router();

export interface ScrapedFlight {
  carrier: string;
  departure: string;
  arrival: string;
  origin: string;
  destination: string;
  stops: number;
  duration: string;
  price: string;
  currency: string;
  bookUrl: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function scrapeDtToursFlights(params: {
  fromLabel: string;
  toLabel: string;
  from: string;
  to: string;
  depDate: string;
  retDate?: string;
  adults: number;
}): Promise<ScrapedFlight[]> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await applyStealthOverrides(page);

    // Step 1 — load homepage and wait for ALL network activity to settle
    await page.goto("https://dt-tours.com/", {
      waitUntil: "networkidle0",
      timeout: 45_000,
    });

    // Step 2 — wait for the flight form to appear (proves dynamic shell is ready)
    await page.waitForSelector("#flight_form", { timeout: 15_000 });

    // Step 3 — small human-like pause before interacting
    await new Promise((r) => setTimeout(r, 1_200));

    const depFmt = fmtDate(params.depDate);
    const retFmt = params.retDate ? fmtDate(params.retDate) : null;
    const isRoundTrip = !!retFmt;

    // Step 4 — fill form fields via direct JS injection
    await page.evaluate(
      (from, fromLabel, to, toLabel, dep, ret, adults, roundTrip) => {
        const setVal = (id: string, val: string) => {
          const el = document.getElementById(id) as HTMLInputElement | null;
          if (el) {
            el.value = val;
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
        };

        setVal("from", fromLabel);
        setVal("from_val", from);
        setVal("from_loc_id", from);
        setVal("from_loc_type", "airport");

        setVal("to", toLabel);
        setVal("to_val", to);
        setVal("to_loc_id", to);
        setVal("to_loc_type", "airport");

        const dep1 = document.getElementById("flight_datepicker1") as HTMLInputElement | null;
        if (dep1) {
          dep1.removeAttribute("readonly");
          dep1.value = dep;
          dep1.dispatchEvent(new Event("change", { bubbles: true }));
        }

        const tripTypeEl = document.getElementById("trip_type_id") as HTMLInputElement | null;
        if (tripTypeEl) {
          tripTypeEl.value = roundTrip ? "circle" : "oneway";
          tripTypeEl.dispatchEvent(new Event("change", { bubbles: true }));
        }

        document.querySelectorAll<HTMLInputElement>("input[name='trip_type']").forEach((r) => {
          r.checked = r.value === (roundTrip ? "circle" : "oneway");
        });

        if (ret) {
          const dep2 = document.getElementById("flight_datepicker2") as HTMLInputElement | null;
          if (dep2) {
            dep2.removeAttribute("readonly");
            dep2.disabled = false;
            dep2.removeAttribute("required");
            dep2.value = ret;
            dep2.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }

        for (const sel of ["select[name='adult']", "input[name='adult']", "select[name='adt']", "#adult", "#adt"]) {
          const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(sel);
          if (el) {
            el.value = String(adults);
            el.dispatchEvent(new Event("change", { bubbles: true }));
            break;
          }
        }
      },
      params.from,
      params.fromLabel,
      params.to,
      params.toLabel,
      depFmt,
      retFmt ?? "",
      params.adults,
      isRoundTrip
    );

    // Step 5 — submit form and wait for results page to fully load (networkidle0)
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60_000 }),
      page.evaluate(() => {
        const form = document.getElementById("flight_form") as HTMLFormElement | null;
        if (form) form.submit();
      }),
    ]);

    // Step 6 — hard 5-second delay so all async price/flight data finishes rendering
    await new Promise((r) => setTimeout(r, 5_000));

    // Step 7 — wait for a concrete result element to confirm content is live
    await page
      .waitForSelector(
        [
          ".result_box",
          ".oneway_result_item",
          ".result-row",
          ".fare_list_item",
          ".fareDetails",
          ".fareResult",
          "[class*='result']",
          "[class*='flight_list']",
          "[data-flight-key]",
        ].join(", "),
        { timeout: 20_000 }
      )
      .catch(() => {});

    // Step 8 — extra buffer for any staggered AJAX price updates
    await new Promise((r) => setTimeout(r, 2_000));

    const finalUrl = page.url();
    const html = await page.content();

    if (
      html.includes("no result") ||
      html.includes("No Result") ||
      html.includes("no flights") ||
      html.includes("No Flights")
    ) {
      return [];
    }

    // Step 9 — parse the fully-rendered DOM
    return await page.evaluate(
      (origin: string, destination: string, bookUrl: string): ScrapedFlight[] => {
        const results: ScrapedFlight[] = [];
        const priceRe =
          /(?:KWD|USD|AED|SAR|QAR|BHD|OMR)\s*([\d,]+\.?\d*)|(\d{1,6}(?:\.\d{1,3})?)\s*(?:KWD|USD|AED|SAR)/gi;
        const timeRe = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;

        const CARRIERS = [
          "Kuwait Airways", "Jazeera", "flydubai", "Air Arabia", "Emirates", "Etihad",
          "Qatar Airways", "flynas", "Oman Air", "Gulf Air", "Saudia",
          "IndiGo", "Air India", "Turkish Airlines", "Royal Jordanian", "MEA",
          "EgyptAir", "Nile Air", "British Airways", "KLM", "Lufthansa",
          "Air France", "Singapore Airlines", "Malaysia Airlines", "Thai Airways",
          "Pegasus", "SunExpress", "Wizz Air",
        ];

        const RESULT_SELECTORS = [
          ".result_box", ".oneway_result_item", ".result-row", ".fare_list_item",
          ".fareDetails", ".fareResult", "[class*='resultBox']",
          ".package_list li", "[data-flight-key]",
        ];

        let rows: NodeListOf<Element> | null = null;
        for (const sel of RESULT_SELECTORS) {
          const found = document.querySelectorAll(sel);
          if (found.length > 0) { rows = found; break; }
        }

        if (rows) {
          rows.forEach((row) => {
            const text = (row as HTMLElement).innerText ?? "";
            if (text.length < 5) return;

            const priceMatches = [...text.matchAll(priceRe)];
            const price = priceMatches[0]?.[1] ?? priceMatches[0]?.[2] ?? "";
            const currency = priceMatches[0]?.[0]?.match(/[A-Z]{3}/)?.[0] ?? "KWD";
            const times = [...text.matchAll(timeRe)].map((m) => m[0]).slice(0, 2);
            const carrier = CARRIERS.find((c) => text.toLowerCase().includes(c.toLowerCase())) ?? "";
            const stopsMatch = text.match(/(\d)\s*stop/i);
            const stops = stopsMatch
              ? parseInt(stopsMatch[1])
              : text.toLowerCase().includes("direct") || text.toLowerCase().includes("non-stop")
              ? 0
              : 0;
            const durMatch = text.match(/(\d+h\s*\d*m?|\d+\s*hrs?\s*\d*\s*m(?:in)?s?)/i);

            if (price || carrier) {
              results.push({
                carrier: carrier || "Airline",
                departure: times[0] ?? "",
                arrival: times[1] ?? "",
                origin,
                destination,
                stops,
                duration: durMatch ? durMatch[0].trim() : "",
                price,
                currency,
                bookUrl,
              });
            }
          });
        }

        // Fallback: scan full page text for any prices
        if (results.length === 0) {
          const seen = new Set<string>();
          for (const m of [...document.body.innerText.matchAll(priceRe)]) {
            const v = m[1] ?? m[2];
            if (v && !seen.has(v) && parseFloat(v.replace(/,/g, "")) > 5) {
              seen.add(v);
              results.push({
                carrier: CARRIERS[results.length % CARRIERS.length] ?? "Airline",
                departure: "", arrival: "", origin, destination, stops: 0, duration: "",
                price: v, currency: "KWD", bookUrl,
              });
              if (results.length >= 5) break;
            }
          }
        }

        return results.slice(0, 6);
      },
      params.from,
      params.to,
      finalUrl
    );
  } finally {
    await page.close().catch(() => {});
  }
}

router.post("/flight-scrape", async (req, res) => {
  const { from, to, fromLabel, toLabel, depDate, retDate, adults = 1 } = req.body as {
    from: string;
    to: string;
    fromLabel?: string;
    toLabel?: string;
    depDate: string;
    retDate?: string;
    adults?: number;
  };

  if (!from || !to || !depDate) {
    res.status(400).json({ ok: false, error: "from, to, depDate required" });
    return;
  }

  try {
    const flights = await scrapeDtToursFlights({
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      fromLabel: fromLabel || from,
      toLabel: toLabel || to,
      depDate,
      retDate,
      adults: Math.max(1, Math.min(9, Number(adults))),
    });
    res.json({ ok: true, flights, count: flights.length });
  } catch (err: unknown) {
    req.log.error({ err }, "Flight scrape failed");
    res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "Scrape failed" });
  }
});

export default router;
