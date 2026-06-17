import { Router } from "express";
import { getBrowser, applyStealthOverrides } from "../lib/browser";

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
    await applyStealthOverrides(page);

    // Step 1 — load homepage and wait for ALL network activity to settle
    await page.goto("https://dt-tours.com/", {
      waitUntil: "networkidle0",
      timeout: 45_000,
    });

    // Step 2 — wait for hotel search form to appear (proves dynamic shell is ready)
    await page.waitForSelector("#hotel_search", { timeout: 15_000 });

    // Step 3 — small human-like pause before interacting
    await new Promise((r) => setTimeout(r, 1_200));

    // Step 4 — fill hotel form fields via direct JS injection
    await page.evaluate(
      (city: string, checkin: string, checkout: string, rooms: number) => {
        const setVal = (id: string, val: string) => {
          const el = document.getElementById(id) as HTMLInputElement | null;
          if (el) {
            el.value = val;
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
        };

        setVal("hotel_destination_search_name", city);
        setVal("hot_id_dest", city);

        const ci = document.getElementById("hotel_checkin") as HTMLInputElement | null;
        if (ci) {
          ci.removeAttribute("readonly");
          ci.value = checkin;
          ci.dispatchEvent(new Event("change", { bubbles: true }));
        }

        const co = document.getElementById("hotel_checkout") as HTMLInputElement | null;
        if (co) {
          co.removeAttribute("readonly");
          co.value = checkout;
          co.dispatchEvent(new Event("change", { bubbles: true }));
        }

        for (const sel of ["select[name='rooms']", "input[name='rooms']", "#rooms"]) {
          const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(sel);
          if (el) { el.value = String(rooms); break; }
        }
      },
      params.city,
      fmtDateDMY(params.checkin),
      fmtDateDMY(params.checkout),
      params.rooms
    );

    // Step 5 — submit form and wait for results page (networkidle0)
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60_000 }),
      page.evaluate(() => {
        const form = document.getElementById("hotel_search") as HTMLFormElement | null;
        if (form) form.submit();
      }),
    ]);

    // Step 6 — hard 5-second delay so all async hotel data finishes rendering
    await new Promise((r) => setTimeout(r, 5_000));

    // Step 7 — wait for a concrete result element to confirm live content is present
    await page
      .waitForSelector(
        [
          ".hotel-result",
          ".hotel_result",
          ".hotel-card",
          ".property-card",
          "[class*='hotel-item']",
          "[class*='hotel_list']",
          ".result_box",
          "[data-hotel-id]",
        ].join(", "),
        { timeout: 20_000 }
      )
      .catch(() => {});

    // Step 8 — extra buffer for staggered price updates
    await new Promise((r) => setTimeout(r, 2_000));

    const finalUrl = page.url();

    // Step 9 — parse the fully-rendered DOM
    return await page.evaluate(
      (city: string, bookUrl: string): HotelOption[] => {
        const results: HotelOption[] = [];
        const priceRe =
          /(?:KWD|USD|AED|SAR|QAR|BHD)\s*([\d,]+\.?\d*)|(\d{1,6}(?:\.\d{1,3})?)\s*(?:KWD|USD|AED|SAR)/gi;

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
            const starsMatch = ((starsEl as HTMLElement)?.innerText ?? "").match(/(\d)/);
            const stars = starsMatch ? parseInt(starsMatch[1]) : 0;
            const thumbEl = row.querySelector("img");
            const thumbnail = (thumbEl as HTMLImageElement)?.src ?? "";
            if (name || price) {
              results.push({ name: name || "Hotel", stars, location: city, price, currency, bookUrl, thumbnail });
            }
          });
        }

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
      params.city,
      finalUrl
    );
  } finally {
    await page.close().catch(() => {});
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
