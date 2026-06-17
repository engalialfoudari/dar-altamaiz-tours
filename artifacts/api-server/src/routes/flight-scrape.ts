import { Router } from "express";
import { request as httpsRequest } from "node:https";
import { getFreshPage, applyStealthOverrides } from "../lib/browser";
import type { Page } from "puppeteer-core";

const router = Router();

export interface ScrapedFlight {
  carrier: string;
  departure: string;  // HH:MM
  arrival: string;    // HH:MM
  depDate: string;    // YYYY-MM-DD
  origin: string;
  destination: string;
  stops: number;
  duration: string;
  price: string;
  currency: string;
  bookUrl: string;
}

function toSkyscannerDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

function parseTime(iso: string): string {
  if (!iso) return "";
  const t = iso.includes("T") ? iso.split("T")[1] ?? "" : iso;
  return t.substring(0, 5);
}

function parseDate(iso: string): string {
  if (!iso) return "";
  return iso.includes("T") ? (iso.split("T")[0] ?? iso) : iso;
}

function parseDurMins(mins: number): string {
  if (!mins) return "";
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** Parse Skyscanner's v3 REST API response (captured via XHR interception) */
function parseSkyscannerV3(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  from: string,
  to: string,
  depDate: string,
  bookUrl: string
): ScrapedFlight[] {
  const results: ScrapedFlight[] = [];
  try {
    const content = data?.content?.results ?? data?.results ?? data?.content;
    if (!content) return results;

    const legs: Record<string, unknown> = content.legs ?? {};
    const carriers: Record<string, unknown> = content.carriers ?? {};

    // Collect itineraries from bucket groups or flat list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let itins: any[] = [];
    const buckets = content?.itineraries?.buckets;
    if (Array.isArray(buckets)) {
      for (const b of buckets) {
        if (Array.isArray(b?.items)) itins.push(...b.items);
      }
    }
    if (itins.length === 0) {
      const raw = content?.itineraries;
      itins = Array.isArray(raw) ? raw : Object.values(raw ?? {});
    }

    for (const itin of itins.slice(0, 8)) {
      if (!itin) continue;

      const priceRaw: number = itin?.price?.raw ?? itin?.rawPrice ?? 0;
      const priceFmt: string = itin?.price?.formatted ?? "";
      const currency = priceFmt.match(/[A-Z]{3}/)?.[0] ?? "USD";
      const price = priceRaw ? String(Math.round(priceRaw)) : "";

      const legId: string = Array.isArray(itin?.legs)
        ? itin.legs[0]
        : (itin?.legIds?.[0] ?? "");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const leg: any = legs[legId] ?? {};

      const depISO: string = leg?.departure ?? leg?.departureDateTime ?? "";
      const arrISO: string = leg?.arrival ?? leg?.arrivalDateTime ?? "";
      const dep = parseTime(depISO);
      const arr = parseTime(arrISO);
      const actualDepDate = parseDate(depISO) || depDate;

      const carrierId: string = Array.isArray(leg?.carriers)
        ? leg.carriers[0]
        : (leg?.marketingCarrier?.id ?? leg?.carrierId ?? "");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const carrierObj: any = carriers[carrierId] ?? {};
      const carrier: string =
        carrierObj?.name ?? leg?.marketingCarrier?.name ?? leg?.carriers?.[0]?.name ?? "";

      const stops: number = leg?.stopCount ?? leg?.stops ?? 0;
      const durMins: number = leg?.durationInMinutes ?? leg?.duration ?? 0;

      if (price || carrier) {
        results.push({
          carrier: carrier || "Airline",
          departure: dep,
          arrival: arr,
          depDate: actualDepDate,
          origin: from,
          destination: to,
          stops,
          duration: parseDurMins(durMins),
          price,
          currency,
          bookUrl,
        });
      }
    }
  } catch { /* ignore parse errors */ }
  return results;
}

/** Intercept Skyscanner XHR responses to capture structured JSON flight data */
async function captureSkyscannerFlightsViaXHR(
  page: Page,
  from: string,
  to: string,
  depDate: string,
  bookUrl: string
): Promise<ScrapedFlight[]> {
  const captured: ScrapedFlight[] = [];

  const onResponse = async (response: import("puppeteer-core").HTTPResponse) => {
    const url = response.url();
    if (!url.includes("skyscanner")) return;
    const ct = response.headers()["content-type"] ?? "";
    if (!ct.includes("application/json")) return;
    try {
      const json = await response.json();
      const flights = parseSkyscannerV3(json, from, to, depDate, bookUrl);
      captured.push(...flights);
    } catch { /* ignore */ }
  };

  page.on("response", onResponse);
  return { captured, cleanup: () => page.off("response", onResponse) } as unknown as ScrapedFlight[];
}

/** DOM fallback: extract visible flight card text when XHR interception yields nothing */
async function parseSkyscannerDOM(
  page: Page,
  from: string,
  to: string,
  depDate: string,
  bookUrl: string
): Promise<ScrapedFlight[]> {
  return page.evaluate(
    (
      originCode: string,
      destCode: string,
      depDateStr: string,
      bUrl: string
    ): ScrapedFlight[] => {
      const results: ScrapedFlight[] = [];
      const priceRe = /[\$€£]?([\d,]+(?:\.\d{1,2})?)\s*(?:[A-Z]{3})?|([A-Z]{3})\s*([\d,]+)/g;
      const timeRe = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;
      const knownCarriers = [
        "Jazeera Airways", "Jazeera", "Kuwait Airways", "flydubai", "FlyDubai",
        "Air Arabia", "Emirates", "Etihad", "Qatar Airways", "flynas",
        "Gulf Air", "Oman Air", "Saudia", "SaudiArabia", "Wizz Air",
        "Turkish Airlines", "IndiGo", "Air India", "SpiceJet",
        "Pegasus", "British Airways", "KLM", "Lufthansa", "Air France",
      ];

      const CARD_SELECTORS = [
        "[data-testid*='itinerary-card']",
        "[class*='ItineraryCard']",
        "[class*='FlightCard']",
        "[class*='ResultCard']",
        "[class*='result-card']",
        "[class*='result_card']",
        "[aria-label*='flight']",
        "[class*='BpkCard']",
        "li[class*='itinerary']",
        "li[class*='result']",
        "[class*='flight-list'] > div",
        "[class*='results'] > article",
        "[class*='Results_result']",
      ];

      let cards: NodeListOf<Element> | null = null;
      for (const sel of CARD_SELECTORS) {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) { cards = found; break; }
      }

      if (!cards || cards.length === 0) return results;

      cards.forEach((card) => {
        const text = (card as HTMLElement).innerText ?? "";
        if (text.length < 10) return;

        const times = [...text.matchAll(timeRe)].map((m) => m[0]);
        const priceMatches = [...text.matchAll(priceRe)];
        const price = priceMatches[0]?.[1] ?? priceMatches[0]?.[3] ?? "";
        const currency = priceMatches[0]?.[2] ?? "USD";
        const carrier = knownCarriers.find((c) => text.includes(c)) ?? "";

        const stopsMatch = text.match(/\bNonstop\b|\bDirect\b|\b(\d)\s*stop/i);
        const stops = stopsMatch?.[1] ? parseInt(stopsMatch[1]) : 0;

        const durMatch = text.match(/(\d{1,2}h\s*\d{0,2}m?|\d+\s*hr)/i);
        const duration = durMatch?.[0] ?? "";

        // Find alt text on carrier logo images
        const logoEl = card.querySelector("img[alt]");
        const logoName = (logoEl as HTMLImageElement)?.alt?.replace(/logo/i, "").trim() ?? "";

        if (price || carrier || logoName) {
          results.push({
            carrier: carrier || logoName || "Airline",
            departure: times[0] ?? "",
            arrival: times[1] ?? "",
            depDate: depDateStr,
            origin: originCode,
            destination: destCode,
            stops,
            duration,
            price,
            currency,
            bookUrl: bUrl,
          });
        }
      });

      return results.slice(0, 6);
    },
    from,
    to,
    depDate,
    bookUrl
  );
}

/** HTTP POST to dt-tours.com to create a search session — still used for session cookie approach */
function createDTToursSession(formBody: string): Promise<{ searchUrl: string; cookies: Array<{ name: string; value: string }> }> {
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
          "Origin": "https://dt-tours.com",
        },
      },
      (res) => {
        const locationHeader = (res.headers["location"] as string | undefined) ?? "";
        const searchUrl = locationHeader.startsWith("http") ? locationHeader : `https://dt-tours.com${locationHeader}`;
        const rawCookies: string[] = Array.isArray(res.headers["set-cookie"]) ? (res.headers["set-cookie"] as string[]) : [];
        const cookieMap = new Map<string, string>();
        for (const raw of rawCookies) {
          const match = raw.match(/^([^=]+)=([^;]*)/);
          if (match) cookieMap.set(match[1], match[2]);
        }
        const cookies = [...cookieMap.entries()].map(([name, value]) => ({ name, value }));
        res.resume();
        resolve({ searchUrl, cookies });
      }
    );
    req.on("error", reject);
    req.setTimeout(20_000, () => { req.destroy(); reject(new Error("POST timeout")); });
    req.write(bodyBuf);
    req.end();
  });
}

async function scrapeFlights(params: {
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  depDate: string;
  retDate?: string;
  adults: number;
}): Promise<ScrapedFlight[]> {
  const { from, to, depDate, retDate, adults } = params;

  const depSky = toSkyscannerDate(depDate);
  const retSky = retDate ? toSkyscannerDate(retDate) : "";

  const isRoundTrip = !!retSky;
  const skyscannerUrl = [
    `https://www.skyscanner.com/transport/flights/`,
    `${from.toLowerCase()}/${to.toLowerCase()}/`,
    `${depSky}/`,
    retSky ? `${retSky}/` : "",
    `?adults=${adults}&cabinclass=economy&currency=USD&locale=en-US`,
  ].join("");

  const bookUrl = skyscannerUrl;

  const { page, cleanup } = await getFreshPage();

  try {
    await applyStealthOverrides(page);

    // Capture XHR responses from Skyscanner API
    const xhrCapture: ScrapedFlight[] = [];

    page.on("response", async (response) => {
      const url = response.url();
      if (!url.includes("skyscanner")) return;
      const ct = response.headers()["content-type"] ?? "";
      if (!ct.includes("json")) return;
      try {
        const json = await response.json();
        const flights = parseSkyscannerV3(json, from, to, depDate, skyscannerUrl);
        if (flights.length > 0) xhrCapture.push(...flights);
      } catch { /* ignore */ }
    });

    await page.goto(skyscannerUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });

    // Skyscanner renders async — wait up to 40s for prices to appear
    await page
      .waitForSelector(
        [
          "[data-testid*='price']",
          "[class*='Price']",
          "[class*='price']",
          "[class*='ItineraryCard']",
          "[data-testid*='itinerary']",
          "[class*='FlightCard']",
          "[class*='result-card']",
          "[class*='BpkCard']",
        ].join(", "),
        { timeout: 40_000 }
      )
      .catch(() => {});

    // Buffer for lazy-loaded results
    await new Promise((r) => setTimeout(r, 6_000));

    // Prefer XHR-captured structured data; fall back to DOM parsing
    if (xhrCapture.length > 0) {
      const seen = new Set<string>();
      const deduped: ScrapedFlight[] = [];
      for (const f of xhrCapture) {
        const key = `${f.carrier}|${f.departure}|${f.price}`;
        if (!seen.has(key)) { seen.add(key); deduped.push(f); }
      }
      return deduped.slice(0, 6);
    }

    const domResults = await parseSkyscannerDOM(page, from, to, depDate, skyscannerUrl);
    if (domResults.length > 0) return domResults;

    // If Skyscanner blocked us, try dt-tours.com as a last resort (may fail gracefully)
    const getAirportId = async (q: string) => {
      try {
        const r = await fetch(
          `https://dt-tours.com/index.php/ajax/get_airport_code_list?term=${encodeURIComponent(q)}&type=international`,
          { headers: { "Referer": "https://dt-tours.com/", "X-Requested-With": "XMLHttpRequest", "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8_000) }
        );
        const data = (await r.json()) as Array<{ id: string; code: string; label: string; category: string }>;
        return data?.[0] ?? null;
      } catch { return null; }
    };
    const [fromLoc, toLoc] = await Promise.all([getAirportId(params.fromLabel), getAirportId(params.toLabel)]);
    const formBody = new URLSearchParams({
      trip_type: isRoundTrip ? "circle" : "oneway",
      sector_type: "international",
      from_label: fromLoc?.label ?? params.fromLabel,
      from: fromLoc?.code ?? from,
      from_loc_id: fromLoc?.id ?? from,
      from_loc_type: fromLoc?.category ?? "All_data",
      to_label: toLoc?.label ?? params.toLabel,
      to: toLoc?.code ?? to,
      to_loc_id: toLoc?.id ?? to,
      to_loc_type: toLoc?.category ?? "All_data",
      depature: `${depDate.split("-")[2]}/${depDate.split("-")[1]}/${depDate.split("-")[0]}`,
      return: retDate ? `${retDate.split("-")[2]}/${retDate.split("-")[1]}/${retDate.split("-")[0]}` : "",
      adult: String(adults), child: "0", infant: "0",
      v_class: "Economy", search_flight: "Search",
    }).toString();

    try {
      const session = await createDTToursSession(formBody);
      if (session.searchUrl.includes("flight/search") && session.cookies.length > 0) {
        await page.setCookie(...session.cookies.map((c) => ({ name: c.name, value: c.value, domain: "dt-tours.com", path: "/" })));
        await page.goto(session.searchUrl, { waitUntil: "networkidle0", timeout: 45_000 });
        await new Promise((r) => setTimeout(r, 5_000));
        const dtHtml = await page.content();
        if (dtHtml.includes("payment got failed")) return [];
      }
    } catch { /* dt-tours fallback failed silently */ }

    return [];
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
    const flights = await scrapeFlights({
      from: from.toUpperCase(), to: to.toUpperCase(),
      fromLabel: fromLabel || from, toLabel: toLabel || to,
      depDate, retDate,
      adults: Math.max(1, Math.min(9, Number(adults))),
    });
    res.json({ ok: true, flights, count: flights.length });
  } catch (err: unknown) {
    req.log.error({ err }, "Flight scrape failed");
    res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "Scrape failed" });
  }
});

export default router;
