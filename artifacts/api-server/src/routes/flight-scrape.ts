import { Router } from "express";
import { getBrowser } from "../lib/browser";

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
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 900 });

    await page.goto("https://dt-tours.com/", {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });

    await page.waitForSelector("#flight_form", { timeout: 10_000 });

    const depFmt = fmtDate(params.depDate);
    const retFmt = params.retDate ? fmtDate(params.retDate) : null;
    const isRoundTrip = !!retFmt;

    await page.evaluate(
      (from, fromLabel, to, toLabel, dep, ret, adults, roundTrip) => {
        const setVal = (id: string, val: string) => {
          const el = document.getElementById(id) as HTMLInputElement | null;
          if (el) el.value = val;
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
        }

        const tripTypeEl = document.getElementById("trip_type_id") as HTMLInputElement | null;
        if (tripTypeEl) tripTypeEl.value = roundTrip ? "circle" : "oneway";

        const tripTypeRadios = document.querySelectorAll<HTMLInputElement>("input[name='trip_type']");
        tripTypeRadios.forEach((r) => {
          r.checked = r.value === (roundTrip ? "circle" : "oneway");
        });

        if (ret) {
          const dep2 = document.getElementById("flight_datepicker2") as HTMLInputElement | null;
          if (dep2) {
            dep2.removeAttribute("readonly");
            dep2.disabled = false;
            dep2.removeAttribute("required");
            dep2.value = ret;
          }
        }

        const adultSel = [
          "select[name='adult']",
          "input[name='adult']",
          "select[name='adt']",
          "#adult",
          "#adt",
        ];
        for (const sel of adultSel) {
          const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(sel);
          if (el) {
            el.value = String(adults);
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

    await new Promise((r) => setTimeout(r, 300));

    const [navResult] = await Promise.allSettled([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 38_000 }),
      page.evaluate(() => {
        const form = document.getElementById("flight_form") as HTMLFormElement | null;
        if (form) form.submit();
      }),
    ]);

    if (navResult.status === "rejected") {
      throw new Error(`Navigation failed: ${String(navResult.reason)}`);
    }

    await page
      .waitForSelector(
        ".result_box, .oneway_result_item, .result-row, .fare_list_item, .fareDetails, [class*='result'], [class*='flight_list']",
        { timeout: 28_000 }
      )
      .catch(() => {});

    await new Promise((r) => setTimeout(r, 3_000));

    const finalUrl = page.url();
    return await page.evaluate(
      (origin: string, destination: string, bookUrl: string): ScrapedFlight[] => {
        const results: ScrapedFlight[] = [];
        const priceRe = /(?:KWD|USD|AED|SAR|QAR|BHD|OMR)\s*([\d,]+\.?\d*)|(\d{1,6}(?:\.\d{1,3})?)\s*(?:KWD|USD|AED|SAR)/gi;
        const timeRe = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;

        const CARRIERS = [
          "Kuwait Airways", "Jazeera", "flydubai", "Air Arabia", "Emirates", "Etihad",
          "Qatar Airways", "flynas", "Oman Air", "Gulf Air", "Saudi", "Saudia",
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
            const dep = times[0] ?? "";
            const arr = times[1] ?? "";

            const carrier = CARRIERS.find((c) => text.toLowerCase().includes(c.toLowerCase())) ?? "";
            const stopsMatch = text.match(/(\d)\s*stop/i);
            const stops = stopsMatch ? parseInt(stopsMatch[1]) : text.toLowerCase().includes("direct") || text.toLowerCase().includes("non-stop") ? 0 : -1;
            const durMatch = text.match(/(\d+h\s*\d*m?|\d+\s*hrs?\s*\d*\s*m(?:in)?s?)/i);
            const duration = durMatch ? durMatch[0].trim() : "";

            if (price || carrier) {
              results.push({
                carrier: carrier || "Airline",
                departure: dep,
                arrival: arr,
                origin,
                destination,
                stops: stops < 0 ? 0 : stops,
                duration,
                price,
                currency,
                bookUrl,
              });
            }
          });
        }

        if (results.length === 0) {
          const allText = document.body.innerText;
          const allPrices = [...allText.matchAll(priceRe)];
          const uniquePrices: string[] = [];
          const seen = new Set<string>();
          for (const m of allPrices) {
            const v = m[1] ?? m[2];
            if (v && !seen.has(v) && parseFloat(v.replace(/,/g, "")) > 5) {
              seen.add(v);
              uniquePrices.push(v);
              if (uniquePrices.length >= 5) break;
            }
          }
          uniquePrices.forEach((p, i) => {
            results.push({
              carrier: CARRIERS[i % CARRIERS.length] ?? "Airline",
              departure: "", arrival: "", origin, destination, stops: 0, duration: "",
              price: p, currency: "KWD", bookUrl,
            });
          });
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
    const msg = err instanceof Error ? err.message : "Scrape failed";
    res.status(502).json({ ok: false, error: msg });
  }
});

export default router;
