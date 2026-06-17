import { Router } from "express";
import { getBrowser } from "../lib/browser";
import { getHotelCredentials as getRawHotelCredentials } from "../lib/credentials";

function getHotelCredentials() {
  const raw = getRawHotelCredentials();
  return { username: raw.apiKey, password: raw.secret };
}

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

function fmtDateDMY(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

async function tryHotelApi(params: {
  city: string;
  checkin: string;
  checkout: string;
  rooms: number;
  adults: number;
}): Promise<HotelOption[] | null> {
  const { username, password } = getHotelCredentials();
  if (!username || !password) return null;

  try {
    const res = await fetch("https://dt-tours.com/index.php/api/hotel/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      },
      body: JSON.stringify({
        city: params.city,
        checkin: params.checkin,
        checkout: params.checkout,
        rooms: params.rooms,
        adults: params.adults,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const data = (await res.json()) as { hotels?: HotelOption[] };
      if (data.hotels && data.hotels.length > 0) return data.hotels;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function scrapeDtToursHotels(params: {
  city: string;
  checkin: string;
  checkout: string;
  rooms: number;
  adults: number;
}): Promise<HotelOption[]> {
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

    await page.waitForSelector("#hotel_search", { timeout: 10_000 });

    const checkinFmt = fmtDateDMY(params.checkin);
    const checkoutFmt = fmtDateDMY(params.checkout);

    await page.evaluate(
      (city: string, checkin: string, checkout: string, rooms: number) => {
        const setVal = (id: string, val: string) => {
          const el = document.getElementById(id) as HTMLInputElement | null;
          if (el) el.value = val;
        };

        setVal("hotel_destination_search_name", city);
        setVal("hot_id_dest", city);

        const ci = document.getElementById("hotel_checkin") as HTMLInputElement | null;
        if (ci) {
          ci.removeAttribute("readonly");
          ci.value = checkin;
        }

        const co = document.getElementById("hotel_checkout") as HTMLInputElement | null;
        if (co) {
          co.removeAttribute("readonly");
          co.value = checkout;
        }

        const roomSels = ["select[name='rooms']", "input[name='rooms']", "#rooms", ".rooms_count"];
        for (const sel of roomSels) {
          const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(sel);
          if (el) {
            el.value = String(rooms);
            break;
          }
        }
      },
      params.city,
      checkinFmt,
      checkoutFmt,
      params.rooms
    );

    await new Promise((r) => setTimeout(r, 300));

    const [navResult] = await Promise.allSettled([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 38_000 }),
      page.evaluate(() => {
        const form = document.getElementById("hotel_search") as HTMLFormElement | null;
        if (form) form.submit();
      }),
    ]);

    if (navResult.status === "rejected") {
      throw new Error(`Navigation failed: ${String(navResult.reason)}`);
    }

    await page
      .waitForSelector(
        ".hotel-result, .hotel_result, .hotel-card, .property-card, [class*='hotel-item'], [class*='hotel_list'], [class*='property']",
        { timeout: 25_000 }
      )
      .catch(() => {});

    await new Promise((r) => setTimeout(r, 3_000));

    const finalUrl = page.url();
    return await page.evaluate(
      (city: string, bookUrl: string): HotelOption[] => {
        const results: HotelOption[] = [];
        const priceRe = /(?:KWD|USD|AED|SAR|QAR|BHD)\s*([\d,]+\.?\d*)|(\d{1,6}(?:\.\d{1,3})?)\s*(?:KWD|USD|AED|SAR)/gi;

        const SELECTORS = [
          ".hotel-result", ".hotel_result", ".hotel-card", ".property-card",
          "[class*='hotel-item']", "[class*='hotel_list'] li", "[class*='property-item']",
          ".result_box", "[data-hotel-id]",
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
            const price = priceMatches[0]?.[1] ?? priceMatches[0]?.[2] ?? "";
            const currency = priceMatches[0]?.[0]?.match(/[A-Z]{3}/)?.[0] ?? "KWD";

            const nameEl = row.querySelector("h2, h3, h4, .hotel-name, .property-name, [class*='name']");
            const name = (nameEl as HTMLElement)?.innerText?.trim() ?? "";

            const starsEl = row.querySelector("[class*='star'], .rating, [data-star]");
            const starsText = (starsEl as HTMLElement)?.innerText ?? "";
            const starsMatch = starsText.match(/(\d)/);
            const stars = starsMatch ? parseInt(starsMatch[1]) : 0;

            const thumbEl = row.querySelector("img");
            const thumbnail = (thumbEl as HTMLImageElement)?.src ?? "";

            if (name || price) {
              results.push({ name: name || "Hotel", stars, location: city, price, currency, bookUrl, thumbnail });
            }
          });
        }

        if (results.length === 0) {
          const allPrices = [...document.body.innerText.matchAll(priceRe)];
          const seen = new Set<string>();
          for (const m of allPrices) {
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
      params.city,
      finalUrl
    );
  } finally {
    await page.close().catch(() => {});
  }
}

router.post("/hotel-search", async (req, res) => {
  const {
    city,
    checkin,
    checkout,
    rooms = 1,
    adults = 2,
  } = req.body as {
    city: string;
    checkin: string;
    checkout: string;
    rooms?: number;
    adults?: number;
  };

  if (!city || !checkin || !checkout) {
    res.status(400).json({ ok: false, error: "city, checkin, checkout required" });
    return;
  }

  try {
    const apiResult = await tryHotelApi({ city, checkin, checkout, rooms, adults });
    if (apiResult && apiResult.length > 0) {
      res.json({ ok: true, hotels: apiResult, source: "api" });
      return;
    }

    const hotels = await scrapeDtToursHotels({
      city,
      checkin,
      checkout,
      rooms: Math.max(1, Math.min(9, Number(rooms))),
      adults: Math.max(1, Math.min(9, Number(adults))),
    });

    res.json({ ok: true, hotels, count: hotels.length, source: "scrape" });
  } catch (err: unknown) {
    req.log.error({ err }, "Hotel search failed");
    const msg = err instanceof Error ? err.message : "Hotel search failed";
    res.status(502).json({ ok: false, error: msg });
  }
});

export default router;
