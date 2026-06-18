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
  stars?: number;
}): Promise<HotelOption[]> {
  const cityLoc = await getHotelCityId(params.city);
  const { page, cleanup } = await getFreshPage();

  try {
    await applyStealthOverrides(page);

    await page.goto("https://dt-tours.com/", {
      waitUntil: "networkidle0",
      timeout: 45_000,
    });

    await page.waitForSelector("#hotel_search", { timeout: 15_000 });
    await new Promise((r) => setTimeout(r, 800));

    const checkinFmt = fmtDateDMY(params.checkin);
    const checkoutFmt = fmtDateDMY(params.checkout);

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

        setV("hotel_destination_search_name", cityLabel);
        setV("hot_id_dest", cityId);

        const ci = document.getElementById("hotel_checkin") as HTMLInputElement | null;
        if (ci) { ci.removeAttribute("readonly"); ci.value = checkin; ci.dispatchEvent(new Event("change", { bubbles: true })); }

        const co = document.getElementById("hotel_checkout") as HTMLInputElement | null;
        if (co) { co.removeAttribute("readonly"); co.value = checkout; co.dispatchEvent(new Event("change", { bubbles: true })); }

        for (const sel of ["select[name='no_of_rooms']", "input[name='no_of_rooms']", "#no_of_rooms", "#rooms"]) {
          const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(sel);
          if (el) { el.value = String(rooms); el.dispatchEvent(new Event("change", { bubbles: true })); break; }
        }

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

    // Hard wait for results to render
    await new Promise((r) => setTimeout(r, 5_000));

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

    // ── Star filter: click dt-tours.com's own sidebar checkbox ──
    // This makes the site itself return only the requested star category,
    // so we don't have to guess from the full list.
    if (params.stars && params.stars > 0) {
      const starValue = String(params.stars);
      const clicked = await page.evaluate((sv: string) => {
        // travelomatix uses various patterns for star filter checkboxes
        const candidates = [
          // value attribute equals the star count
          `input[type="checkbox"][value="${sv}"]`,
          // id contains "star" and the number
          `input[type="checkbox"][id*="star_${sv}"]`,
          `input[type="checkbox"][id*="star"][id*="${sv}"]`,
          `input[type="checkbox"][name*="star"][value="${sv}"]`,
          // data attribute
          `input[type="checkbox"][data-value="${sv}"]`,
          `[data-star="${sv}"] input[type="checkbox"]`,
        ];
        for (const sel of candidates) {
          const el = document.querySelector<HTMLInputElement>(sel);
          if (el && !el.checked) {
            el.click();
            return true;
          }
        }
        // Fallback: find a label whose text is exactly "X Star" or "X Stars"
        const labels = Array.from(document.querySelectorAll("label, .filter-label, [class*='star-filter'] span"));
        for (const lbl of labels) {
          const txt = (lbl as HTMLElement).innerText?.trim() ?? "";
          if (/^[★]{0,5}$/.test(txt) && txt.length === parseInt(sv)) {
            (lbl as HTMLElement).click();
            return true;
          }
          if (new RegExp(`^${sv}\\s*[Ss]tar`).test(txt)) {
            (lbl as HTMLElement).click();
            return true;
          }
        }
        return false;
      }, starValue);

      if (clicked) {
        // Give the AJAX filter time to refresh results
        await new Promise((r) => setTimeout(r, 3_500));
      }
    }

    // Final buffer for price cells to finish loading
    await new Promise((r) => setTimeout(r, 2_000));

    const finalUrl = page.url();
    const html = await page.content();

    if (html.length < 500 || html.includes("An uncaught Exception")) return [];

    return await page.evaluate(
      (city: string, bookUrl: string): HotelOption[] => {
        const results: HotelOption[] = [];
        const priceRe = /(?:KWD|USD|AED|SAR|QAR|BHD)\s*([\d,]+\.?\d*)|(\d{1,6}(?:\.\d{1,3})?)\s*(?:KWD|USD|AED|SAR)/gi;

        const SELECTORS = [
          ".hotel-card:not(.skeleton)",
          ".hotel-result:not(.skeleton)", ".hotel_result", ".hotel-card", ".property-card",
          "[class*='hotel-item']:not(.skeleton)", "[class*='hotel_list'] li", "[class*='property-item']",
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
            const netNum = parseFloat(netPriceStr.replace(/,/g, ""));
            const price = netPriceStr && !isNaN(netNum)
              ? String(Math.ceil(netNum * 1.15 * 100) / 100)
              : netPriceStr;

            const NOT_NAME = /Select|Book|Room|Check Avail|View Deal|More Info|See Details|احجز|اختر/i;
            const NAME_SELS = [
              ".hotel-name", ".htl-name", ".hotel-title", ".property-name",
              "[class*='hotel-name']", "[class*='hotel-title']", "[class*='htl-name']",
              ".hotel-info a", ".hotel-details a", ".hotel-card-header a",
              "[class*='hotel-info'] a", "[class*='hotel-details'] a",
              "a[href*='hotel_id']", "a[href*='hotel/detail']", "a[href*='/hotel/']",
              "h2", "h3", "h4", "h5",
            ];
            let name = "";
            for (const sel of NAME_SELS) {
              const el = row.querySelector(sel);
              const t = (el as HTMLElement)?.innerText?.trim() ?? "";
              if (t && t.length > 3 && t.length < 120 && !NOT_NAME.test(t)) { name = t; break; }
            }
            if (!name) {
              const lines = ((row as HTMLElement).innerText ?? "")
                .split(/[\n\r]+/)
                .map((s) => s.trim())
                .filter((s) => s.length > 4 && s.length < 120);
              for (const line of lines) {
                if (!NOT_NAME.test(line) &&
                    !/\d+\.\d{2,3}|\bKWD\b|\bUSD\b|\bAED\b|Star|نجم|\bper night\b|\bليلة\b|[★☆]{2,}|^\d+\s*(Night|Star|نجم)|\bAvail|^Dubai$|^UAE$|^Abu Dhabi$/i.test(line)) {
                  name = line;
                  break;
                }
              }
            }

            // ── Star detection (priority order matters) ──
            // 1. Unicode ★ inside a star/rating container — most reliable
            //    because classification stars use ★ while review stars use icon fonts
            const starsEl = row.querySelector(
              "[class*='star'], .rating, [data-star], [class*='rating'], [class*='stars']"
            );
            const starsInner = (starsEl as HTMLElement)?.innerText ?? "";
            const unicodeCount = (starsInner.match(/★/g) ?? []).length;

            // 2. data-star attribute
            const dataStarEl = row.querySelector("[data-star]");
            const dataStar = dataStarEl ? parseInt((dataStarEl as HTMLElement).getAttribute("data-star") ?? "0") : 0;

            // 3. "X Star" text inside a dedicated badge
            const ratingBadge = row.querySelector(".rating-badge, [class*='star-label'], [class*='rating-text']");
            const ratingText = (ratingBadge as HTMLElement)?.innerText ?? "";
            const ratingTextMatch = ratingText.match(/(\d)\s*[Ss]tar/);

            // 4. Count filled fa-star icons ONLY inside a dedicated hotel-category
            //    container — NOT the whole row (avoids picking up 5/5 review stars)
            const starCategoryEl = row.querySelector(
              ".hotel-star, .htl-star, [class*='hotel-star'], [class*='htl-star'], " +
              ".star-rating, [class*='star-rating'], .category-star, [class*='category']"
            );
            const filledIcons = starCategoryEl
              ? starCategoryEl.querySelectorAll(
                  "i.fa-star:not(.fa-star-o):not(.fa-star-half), " +
                  ".star-on, .star-filled, [class*='star_on']"
                ).length
              : 0;

            const stars =
              unicodeCount > 0 ? unicodeCount :
              dataStar > 0 ? dataStar :
              filledIcons > 0 ? filledIcons :
              ratingTextMatch ? parseInt(ratingTextMatch[1]) : 0;

            const thumbEl = row.querySelector("img");
            const thumbnail = (thumbEl as HTMLImageElement)?.src ?? "";

            if (price) {
              results.push({ name: name || "Hotel", stars, location: city, price, currency, bookUrl, thumbnail });
            }
          });
        }

        // Fallback scan when no card selector matched
        if (results.length === 0) {
          const seen = new Set<string>();
          for (const m of [...document.body.innerText.matchAll(priceRe)]) {
            const v = m[1] ?? m[2];
            if (v && !seen.has(v) && parseFloat(v.replace(/,/g, "")) > 5) {
              seen.add(v);
              results.push({ name: "Hotel Option", stars: 0, location: city, price: v, currency: "KWD", bookUrl });
              if (results.length >= 15) break;
            }
          }
        }

        results.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        return results; // return ALL — caller applies star filter
      },
      params.city, finalUrl
    );
  } finally {
    await cleanup().catch(() => {});
  }
}

router.post("/hotel-search", async (req, res) => {
  const { city, checkin, checkout, rooms = 1, adults = 2, stars } = req.body as {
    city: string; checkin: string; checkout: string; rooms?: number; adults?: number; stars?: number;
  };

  if (!city || !checkin || !checkout) {
    res.status(400).json({ ok: false, error: "city, checkin, checkout required" });
    return;
  }

  try {
    const starsNum = Number(stars) || 0;

    const allHotels = await scrapeDtToursHotels({
      city, checkin, checkout,
      rooms: Math.max(1, Math.min(9, Number(rooms))),
      adults: Math.max(1, Math.min(9, Number(adults))),
      stars: starsNum,
    });

    let hotels: HotelOption[];
    let starsMismatch = false;

    if (starsNum > 0) {
      // Strict: only return hotels matching the requested star rating
      const exact = allHotels.filter((h) => h.stars === starsNum);
      if (exact.length >= 1) {
        // We have exact matches — return only those (up to 10, cheapest first)
        hotels = exact.slice(0, 10);
      } else {
        // The site's filter didn't help or no exact matches detected.
        // Try ±1 star as a graceful degradation (e.g. 4★ → also accept 3★ and 5★)
        const nearby = allHotels.filter((h) => Math.abs(h.stars - starsNum) <= 1 && h.stars > 0);
        if (nearby.length >= 1) {
          hotels = nearby.slice(0, 10);
          starsMismatch = true;
        } else {
          // Last resort: return all (star detection failed entirely)
          hotels = allHotels.slice(0, 10);
          starsMismatch = true;
        }
      }
    } else {
      hotels = allHotels.slice(0, 10);
    }

    res.json({ ok: true, hotels, count: hotels.length, starsMismatch });
  } catch (err: unknown) {
    req.log.error({ err }, "Hotel search failed");
    res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "Hotel search failed" });
  }
});

export default router;
