import { Router } from "express";
import { getFreshPage, applyStealthOverrides } from "../lib/browser";

const router = Router();

export interface HotelOption {
  name: string;
  stars: number;
  location: string;
  price: string;
  currency: string;
  nights?: number;
  bookUrl: string;
  thumbnail?: string;
}

interface HotelCityResult {
  id: string;
  label: string;
  value: string;
}

function fmtDateDMY(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Call travelomatix hotel city autocomplete API for the correct internal destination ID
async function getHotelCityId(query: string): Promise<HotelCityResult | null> {
  try {
    const url = `https://dt-tours.com/index.php/ajax/get_hotel_city_list?term=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137 Safari/537.36",
        "Referer": "https://dt-tours.com/",
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json, text/javascript, */*; q=0.01",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as HotelCityResult[];
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}

async function scrapeDtToursHotels(params: {
  city: string;
  checkin: string;
  checkout: string;
  rooms: number;
  adults: number;
}): Promise<HotelOption[]> {
  // Step 1 — resolve correct internal hotel city ID from autocomplete API
  const cityLoc = await getHotelCityId(params.city);

  // Fresh incognito context per request — prevents stale cookies from interfering
  const { page, cleanup } = await getFreshPage();

  try {
    await applyStealthOverrides(page);

    // Step 2 — load homepage with networkidle0
    await page.goto("https://dt-tours.com/", {
      waitUntil: "networkidle0",
      timeout: 45_000,
    });

    await page.waitForSelector("#hotel_search", { timeout: 15_000 });
    await new Promise((r) => setTimeout(r, 800));

    const checkinFmt = fmtDateDMY(params.checkin);
    const checkoutFmt = fmtDateDMY(params.checkout);

    // Step 3 — inject form values using the correct internal city ID
    await page.evaluate(
      (cityLabel, cityId, checkin, checkout, rooms, adults) => {
        const setV = (id: string, val: string) => {
          const el = document.getElementById(id) as HTMLInputElement | null;
          if (el) {
            el.value = val;
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
        };

        // Destination — internal ID is critical for travelomatix to accept the search
        setV("hotel_destination_search_name", cityLabel);
        setV("hot_id_dest", cityId);

        // Dates (fields may be readonly — remove that attr first)
        const ci = document.getElementById("hotel_checkin") as HTMLInputElement | null;
        if (ci) { ci.removeAttribute("readonly"); ci.value = checkin; ci.dispatchEvent(new Event("change", { bubbles: true })); }

        const co = document.getElementById("hotel_checkout") as HTMLInputElement | null;
        if (co) { co.removeAttribute("readonly"); co.value = checkout; co.dispatchEvent(new Event("change", { bubbles: true })); }

        // Rooms
        for (const sel of ["select[name='no_of_rooms']", "input[name='no_of_rooms']", "#no_of_rooms", "#rooms"]) {
          const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(sel);
          if (el) { el.value = String(rooms); el.dispatchEvent(new Event("change", { bubbles: true })); break; }
        }

        // Adults
        for (const sel of ["select[name='adult']", "input[name='adult']", "#adult", "#adt"]) {
          const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(sel);
          if (el) { el.value = String(adults); el.dispatchEvent(new Event("change", { bubbles: true })); break; }
        }
      },
      cityLoc?.label ?? params.city,
      cityLoc?.id ?? params.city,
      checkinFmt,
      checkoutFmt,
      params.rooms,
      params.adults
    );

    await new Promise((r) => setTimeout(r, 500));

    // Step 4 — click the submit button (triggers JS hooks)
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60_000 }),
      page.evaluate(() => {
        const btn =
          document.querySelector<HTMLElement>("#hotel_search [type='submit']") ??
          document.querySelector<HTMLElement>("#hotel_search button[type='submit']") ??
          document.querySelector<HTMLElement>("#hotel_search button") ??
          document.querySelector<HTMLElement>(".hotel-search-btn");
        if (btn) { btn.click(); return; }
        (document.getElementById("hotel_search") as HTMLFormElement | null)?.submit();
      }),
    ]);

    // Step 5 — hard 5-second delay for dynamic results to render
    await new Promise((r) => setTimeout(r, 5_000));

    // Step 6 — wait for actual result elements
    await page
      .waitForSelector(
        [
          ".hotel-result", ".hotel_result", ".hotel-card", ".property-card",
          "[class*='hotel-item']", "[class*='hotel_list']", ".result_box",
          "[data-hotel-id]", ".hotel-listing", "#hotel-results", ".hotel-row",
          "table.hotels tr", ".search-result", "#results",
        ].join(", "),
        { timeout: 25_000 }
      )
      .catch(() => {});

    // Step 7 — buffer for price updates
    await new Promise((r) => setTimeout(r, 2_000));

    const finalUrl = page.url();
    const html = await page.content();

    if (html.length < 500 || html.includes("An uncaught Exception")) return [];

    return await page.evaluate(
      (city: string, bookUrl: string): HotelOption[] => {
        const results: HotelOption[] = [];
        const priceRe = /(?:KWD|USD|AED|SAR|QAR|BHD)\s*([\d,]+\.?\d*)|(\d{1,6}(?:\.\d{1,3})?)\s*(?:KWD|USD|AED|SAR)/gi;

        const SELECTORS = [
          ".hotel-result", ".hotel_result", ".hotel-card", ".property-card",
          "[class*='hotel-item']", "[class*='hotel_list'] li", "[class*='property-item']",
          ".result_box", "[data-hotel-id]", ".hotel-listing", ".hotel-row",
          "table.hotels tr:not(:first-child)", "#results > *", ".search-result",
        ];

        let rows: NodeListOf<Element> | null = null;
        for (const sel of SELECTORS) {
          const found = document.querySelectorAll(sel);
          if (found.length > 0) { rows = found; break; }
        }

        if (rows) {
          rows.forEach((row) => {
            const text = (row as HTMLElement).innerText ?? "";
            if (text.length < 5) return;
            const priceMatches = [...text.matchAll(priceRe)];
            const netPriceStr = priceMatches[0]?.[1] ?? priceMatches[0]?.[2] ?? "";
            const currency = priceMatches[0]?.[0]?.match(/[A-Z]{3}/)?.[0] ?? "KWD";
            // Add 15% agency markup to net hotel prices before displaying
            const netNum = parseFloat(netPriceStr.replace(/,/g, ""));
            const price = netPriceStr && !isNaN(netNum)
              ? String(Math.ceil(netNum * 1.15 * 100) / 100)
              : netPriceStr;
            const nameEl = row.querySelector("h2, h3, h4, .hotel-name, .property-name, [class*='name']");
            const name = (nameEl as HTMLElement)?.innerText?.trim() ?? "";
            const starsEl = row.querySelector("[class*='star'], .rating, [data-star]");
            const starsMatch = ((starsEl as HTMLElement)?.innerText ?? "").match(/(\d)/);
            const stars = starsMatch ? parseInt(starsMatch[1]) : 0;
            const thumbEl = row.querySelector("img");
            const thumbnail = (thumbEl as HTMLImageElement)?.src ?? "";
            if (name || price) {
              results.push({ name: name || "Hotel", stars, location: city, price, currency, bookUrl, thumbnail });
            }
          });
        }

        // Fallback: scan page text for prices
        if (results.length === 0) {
          const seen = new Set<string>();
          for (const m of [...document.body.innerText.matchAll(priceRe)]) {
            const v = m[1] ?? m[2];
            if (v && !seen.has(v) && parseFloat(v.replace(/,/g, "")) > 5) {
              seen.add(v);
              results.push({ name: "Hotel Option", stars: 4, location: city, price: v, currency: "KWD", bookUrl });
              if (results.length >= 4) break;
            }
          }
        }

        return results.slice(0, 5);
      },
      params.city, finalUrl
    );
  } finally {
    await cleanup().catch(() => {});
  }
}

router.post("/hotel-search", async (req, res) => {
  const { city, checkin, checkout, rooms = 1, adults = 2 } = req.body as {
    city: string; checkin: string; checkout: string; rooms?: number; adults?: number;
  };

  if (!city || !checkin || !checkout) {
    res.status(400).json({ ok: false, error: "city, checkin, checkout required" });
    return;
  }

  try {
    const hotels = await scrapeDtToursHotels({
      city, checkin, checkout,
      rooms: Math.max(1, Math.min(9, Number(rooms))),
      adults: Math.max(1, Math.min(9, Number(adults))),
    });
    res.json({ ok: true, hotels, count: hotels.length });
  } catch (err: unknown) {
    req.log.error({ err }, "Hotel search failed");
    res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "Hotel search failed" });
  }
});

export default router;
