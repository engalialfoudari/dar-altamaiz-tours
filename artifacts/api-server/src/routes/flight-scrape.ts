import { Router } from "express";
import { request as httpsRequest } from "node:https";
import { getFreshPage, applyStealthOverrides } from "../lib/browser";

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

interface LocationResult {
  id: string;
  code: string;
  label: string;
  category: string; // "All_data" — this is the correct from_loc_type value
}

interface SessionData {
  searchUrl: string;
  cookies: Array<{ name: string; value: string }>;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Call travelomatix autocomplete API to get internal location ID + correct loc_type */
async function getAirportId(query: string): Promise<LocationResult | null> {
  for (const type of ["international", "domestic", ""]) {
    try {
      const url = `https://dt-tours.com/index.php/ajax/get_airport_code_list?term=${encodeURIComponent(query)}${type ? `&type=${type}` : ""}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137 Safari/537.36",
          "Referer": "https://dt-tours.com/",
          "X-Requested-With": "XMLHttpRequest",
          "Accept": "application/json, text/javascript, */*; q=0.01",
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as Array<{ id: string; code: string; label: string; category?: string }>;
      if (data?.length > 0 && data[0]?.id) {
        const item = data[0];
        return { id: item.id, code: item.code ?? query, label: item.label ?? query, category: item.category ?? "All_data" };
      }
    } catch { /* try next */ }
  }
  return null;
}

/**
 * POST to travelomatix pre_flight_search using node:https (which exposes all Set-Cookie headers).
 * The session cookie is named "DT-Tours" and the search param cookie is "sparam" —
 * both must be forwarded to puppeteer so the results page loads correctly.
 * fetch() silently drops these cookies; node:https exposes res.headers["set-cookie"] reliably.
 */
function createFlightSearchSession(formBody: string): Promise<SessionData> {
  return new Promise((resolve, reject) => {
    const bodyBuf = Buffer.from(formBody, "utf8");
    const req = httpsRequest(
      {
        hostname: "dt-tours.com",
        path: "/index.php/general/pre_flight_search",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": bodyBuf.length,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137 Safari/537.36",
          "Referer": "https://dt-tours.com/",
          "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Origin": "https://dt-tours.com",
        },
      },
      (res) => {
        const locationHeader = (res.headers["location"] as string | undefined) ?? "";
        const searchUrl = locationHeader.startsWith("http")
          ? locationHeader
          : `https://dt-tours.com${locationHeader}`;

        // Deduplicate cookies — keep the LAST value for each cookie name (PHP sets DT-Tours multiple times)
        const rawCookies: string[] = Array.isArray(res.headers["set-cookie"])
          ? (res.headers["set-cookie"] as string[])
          : [];
        const cookieMap = new Map<string, string>();
        for (const raw of rawCookies) {
          const match = raw.match(/^([^=]+)=([^;]*)/);
          if (match) cookieMap.set(match[1], match[2]);
        }
        const cookies = [...cookieMap.entries()].map(([name, value]) => ({ name, value }));

        res.resume(); // drain body
        resolve({ searchUrl, cookies });
      }
    );
    req.on("error", reject);
    req.setTimeout(25_000, () => { req.destroy(); reject(new Error("Flight search POST timed out")); });
    req.write(bodyBuf);
    req.end();
  });
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
  // Step 1 — resolve internal location IDs + loc_type categories
  const [fromLoc, toLoc] = await Promise.all([
    getAirportId(params.fromLabel),
    getAirportId(params.toLabel),
  ]);

  const depFmt = fmtDate(params.depDate);
  const retFmt = params.retDate ? fmtDate(params.retDate) : "";
  const isRoundTrip = !!retFmt;

  // Step 2 — POST to create search session via node:https (captures DT-Tours + sparam cookies)
  const formBody = new URLSearchParams({
    trip_type: isRoundTrip ? "circle" : "oneway",
    sector_type: "international",
    from_label: fromLoc?.label ?? params.fromLabel,
    from: fromLoc?.code ?? params.from,
    from_loc_id: fromLoc?.id ?? params.from,
    from_loc_type: fromLoc?.category ?? "All_data", // MUST be "All_data" — not "airport"
    to_label: toLoc?.label ?? params.toLabel,
    to: toLoc?.code ?? params.to,
    to_loc_id: toLoc?.id ?? params.to,
    to_loc_type: toLoc?.category ?? "All_data",
    depature: depFmt, // intentional site typo in field name
    return: retFmt,
    adult: String(params.adults),
    child: "0",
    infant: "0",
    v_class: "Economy",
    search_flight: "Search",
  }).toString();

  const { searchUrl, cookies } = await createFlightSearchSession(formBody);

  if (!searchUrl.includes("flight/search")) {
    return []; // POST didn't redirect to a search results URL
  }

  // Step 3 — navigate to the results URL with the session cookies
  const { page, cleanup } = await getFreshPage();

  try {
    await applyStealthOverrides(page);

    // Set the DT-Tours session cookie + sparam cookie so the results page finds the right search
    if (cookies.length > 0) {
      await page.setCookie(
        ...cookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: "dt-tours.com",
          path: "/",
        }))
      );
    }

    await page.goto(searchUrl, { waitUntil: "networkidle0", timeout: 60_000 });

    // Step 4 — hard 6-second delay; travelomatix uses a two-phase render
    await new Promise((r) => setTimeout(r, 6_000));

    // Step 5 — wait for result elements (broad selector list)
    await page
      .waitForSelector(
        [
          ".result_box", ".oneway_result_item", ".result-row", ".fare_list_item",
          ".fareDetails", ".fareResult", "[class*='result']", "[class*='flight_list']",
          "[data-flight-key]", ".flight-result", ".flight_result",
          ".search-result", "#results", ".results-container",
        ].join(", "),
        { timeout: 25_000 }
      )
      .catch(() => {});

    // Step 6 — extra 2s for staggered price updates
    await new Promise((r) => setTimeout(r, 2_000));

    const finalUrl = page.url();
    const html = await page.content();

    if (html.length < 500 || html.includes("An uncaught Exception")) return [];
    if (html.includes("payment got failed") || html.includes("payment failed")) return [];
    if (html.includes("no result") || html.includes("No Result") || html.includes("no flights")) return [];

    // Step 7 — parse the fully-rendered DOM
    return await page.evaluate(
      (origin: string, destination: string, bookUrl: string): ScrapedFlight[] => {
        const results: ScrapedFlight[] = [];
        const priceRe = /(?:KWD|USD|AED|SAR|QAR|BHD|OMR)\s*([\d,]+\.?\d*)|(\d{1,6}(?:\.\d{1,3})?)\s*(?:KWD|USD|AED|SAR)/gi;
        const timeRe = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;

        const CARRIERS = [
          "Kuwait Airways", "Jazeera", "flydubai", "Air Arabia", "Emirates", "Etihad",
          "Qatar Airways", "flynas", "Oman Air", "Gulf Air", "Saudia",
          "IndiGo", "Air India", "Turkish Airlines", "Royal Jordanian", "MEA",
          "EgyptAir", "Nile Air", "British Airways", "KLM", "Lufthansa",
          "Air France", "Singapore Airlines", "Malaysia Airlines", "Thai Airways",
          "Pegasus", "SunExpress", "Wizz Air", "FlyArystan", "Air Astana",
        ];

        const RESULT_SELECTORS = [
          ".result_box", ".oneway_result_item", ".result-row", ".fare_list_item",
          ".fareDetails", ".fareResult", "[class*='resultBox']", ".flight-result",
          ".flight_result", ".search-result", ".package_list li", "[data-flight-key]",
          "table.flights tr", "#results li", ".results-container > div",
        ];

        let rows: NodeListOf<Element> | null = null;
        for (const sel of RESULT_SELECTORS) {
          const found = document.querySelectorAll(sel);
          if (found.length > 0) { rows = found; break; }
        }

        if (rows) {
          rows.forEach((row) => {
            const text = (row as HTMLElement).innerText ?? "";
            if (text.length < 10) return;
            const priceMatches = [...text.matchAll(priceRe)];
            const price = priceMatches[0]?.[1] ?? priceMatches[0]?.[2] ?? "";
            const currency = priceMatches[0]?.[0]?.match(/[A-Z]{3}/)?.[0] ?? "KWD";
            const times = [...text.matchAll(timeRe)].map((m) => m[0]).slice(0, 2);
            const carrier = CARRIERS.find((c) => text.toLowerCase().includes(c.toLowerCase())) ?? "";
            const stopsMatch = text.match(/(\d)\s*stop/i);
            const stops = stopsMatch ? parseInt(stopsMatch[1]) : 0;
            const durMatch = text.match(/(\d+h\s*\d*m?|\d+\s*hrs?\s*\d*\s*m(?:in)?s?)/i);
            if (price || carrier) {
              results.push({ carrier: carrier || "Airline", departure: times[0] ?? "", arrival: times[1] ?? "", origin, destination, stops, duration: durMatch ? durMatch[0].trim() : "", price, currency, bookUrl });
            }
          });
        }

        // Fallback: scan all page text for prices
        if (results.length === 0) {
          const seen = new Set<string>();
          for (const m of [...document.body.innerText.matchAll(priceRe)]) {
            const v = m[1] ?? m[2];
            if (v && !seen.has(v) && parseFloat(v.replace(/,/g, "")) > 5) {
              seen.add(v);
              results.push({ carrier: CARRIERS[results.length % CARRIERS.length] ?? "Airline", departure: "", arrival: "", origin, destination, stops: 0, duration: "", price: v, currency: "KWD", bookUrl });
              if (results.length >= 5) break;
            }
          }
        }

        return results.slice(0, 6);
      },
      params.from, params.to, finalUrl
    );
  } finally {
    await cleanup().catch(() => {});
  }
}

router.post("/flight-scrape", async (req, res) => {
  const { from, to, fromLabel, toLabel, depDate, retDate, adults = 1 } = req.body as {
    from: string; to: string; fromLabel?: string; toLabel?: string;
    depDate: string; retDate?: string; adults?: number;
  };

  if (!from || !to || !depDate) {
    res.status(400).json({ ok: false, error: "from, to, depDate required" });
    return;
  }

  try {
    const flights = await scrapeDtToursFlights({
      from: from.toUpperCase(), to: to.toUpperCase(),
      fromLabel: fromLabel || from, toLabel: toLabel || to,
      depDate, retDate, adults: Math.max(1, Math.min(9, Number(adults))),
    });
    res.json({ ok: true, flights, count: flights.length });
  } catch (err: unknown) {
    req.log.error({ err }, "Flight scrape failed");
    res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "Scrape failed" });
  }
});

export default router;
