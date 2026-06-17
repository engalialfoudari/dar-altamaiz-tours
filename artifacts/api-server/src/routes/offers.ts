import { Router } from "express";
import { getBrowser, applyStealthOverrides } from "../lib/browser";

const router = Router();

export interface OfferCard {
  title: string;
  description: string;
  price?: string;
  image?: string;
  link: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
let _cache: { offers: OfferCard[]; at: number } | null = null;

async function fetchOffers(): Promise<OfferCard[]> {
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) {
    return _cache.offers;
  }

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await applyStealthOverrides(page);

    // Step 1 — load homepage and wait for ALL network activity to settle
    await page.goto("https://dt-tours.com/", {
      waitUntil: "networkidle0",
      timeout: 45_000,
    });

    // Step 2 — hard 5-second delay so all dynamic packages/prices finish rendering
    await new Promise((r) => setTimeout(r, 5_000));

    // Step 3 — wait until placeholder text is replaced by real dynamic content
    await page
      .waitForFunction(
        () => {
          const PLACEHOLDERS = [
            "top international city",
            "recommended hotels",
            "recommended holidays",
            "recommended destination",
            "top destination",
            "city name",
            "package name",
            "hotel name",
          ];
          const cards = document.querySelectorAll(
            ".destpack, .package-card, .tour-card, .destpack .pname, .package-name"
          );
          if (cards.length === 0) return false;
          // At least one card must have a real (non-placeholder) title
          return Array.from(cards).some((el) => {
            const text = ((el as HTMLElement).innerText ?? "").trim().toLowerCase();
            return text.length > 3 && !PLACEHOLDERS.some((p) => text.includes(p));
          });
        },
        { timeout: 20_000 }
      )
      .catch(() => {});

    // Step 4 — extra buffer for images and trailing price updates
    await new Promise((r) => setTimeout(r, 1_500));

    // Step 5 — extract offers from the fully-rendered DOM
    const homepageOffers = await page.evaluate((): OfferCard[] => {
      const results: OfferCard[] = [];
      const BASE = "https://dt-tours.com";

      const PLACEHOLDERS = [
        "top international city", "recommended hotels", "recommended holidays",
        "recommended destination", "top destination", "city name",
        "package name", "hotel name", "destination name", "your destination",
        "tour name", "package title",
      ];

      const isPlaceholder = (text: string) => {
        const t = text.trim().toLowerCase();
        return t.length === 0 || PLACEHOLDERS.some((p) => t.includes(p));
      };

      const absUrl = (href: string | undefined | null): string => {
        if (!href) return BASE;
        return href.startsWith("http") ? href : `${BASE}${href}`;
      };

      const absImg = (src: string | undefined | null): string | undefined => {
        if (!src || src.startsWith("data:")) return undefined;
        return src.startsWith("http") ? src : `${BASE}${src}`;
      };

      // Package cards (.destpack is the travelomatix class for package tiles)
      document.querySelectorAll(".destpack, .package-card, .tour-card, [class*='package-item'], [class*='tour-item']").forEach((el) => {
        const titleEl = el.querySelector(".pname, .package-name, h3, h4, [class*='title']");
        const title = (titleEl as HTMLElement)?.innerText?.trim() ?? "";

        if (!title || title.length < 3 || isPlaceholder(title)) return;

        const priceEl = el.querySelector(".pprice, h4.numm, .price, [class*='price'], .amount");
        const priceText = (priceEl as HTMLElement)?.innerText?.trim() ?? "";
        const priceMatch = priceText.match(/([\d,]+\.?\d*)/);
        const price = priceMatch
          ? `${parseFloat(priceMatch[1].replace(/,/g, "")).toFixed(3)} KWD`
          : "";

        const descEl = el.querySelector("p, .desc, [class*='desc'], .excerpt");
        const description = (descEl as HTMLElement)?.innerText?.trim() ?? "";

        const imgEl = el.querySelector("img");
        const image = absImg((imgEl as HTMLImageElement)?.src || (imgEl as HTMLImageElement)?.getAttribute("data-src"));

        const linkEl =
          el.querySelector("a[href*='tours/details'], a[href*='package'], a[href*='holiday']") ||
          el.querySelector("a[href]");
        const link = absUrl((linkEl as HTMLAnchorElement)?.getAttribute("href"));

        results.push({ title, description, price, image, link });
      });

      // Promo / offer banners
      document.querySelectorAll(".offer, .deal, .promo, .special-offer, .hot-deal, [class*='offer'], [class*='deal'], [class*='promo']").forEach((el) => {
        const titleEl = el.querySelector("h2, h3, h4, .title, [class*='title']");
        const title =
          (titleEl as HTMLElement)?.innerText?.trim() ||
          (el.querySelector("a") as HTMLAnchorElement)?.innerText?.trim() ||
          "";

        if (!title || title.length < 3 || isPlaceholder(title)) return;

        const description = (el.querySelector("p, .desc, [class*='desc']") as HTMLElement)?.innerText?.trim() ?? "";

        const priceEl = (el.querySelector("[class*='price'], .amount, h4.numm") as HTMLElement)?.innerText?.trim() ?? "";
        const priceMatch = priceEl.match(/([\d,\.]+\s*KWD|KWD\s*[\d,\.]+)/i);
        const price = priceMatch?.[0] ?? "";

        const imgEl = el.querySelector("img");
        const styleEl = el.querySelector("[style*='background']");
        const bgMatch = (styleEl as HTMLElement)?.getAttribute("style")?.match(/url\(['"]?([^'"]+)['"]?\)/);
        const image = absImg((imgEl as HTMLImageElement)?.src || bgMatch?.[1]);

        const linkEl = el.querySelector("a[href]") || el.closest("a[href]");
        const link = absUrl((linkEl as HTMLAnchorElement)?.getAttribute("href"));

        if (!results.some((r) => r.title === title)) {
          results.push({ title, description, price, image, link });
        }
      });

      return results;
    });

    // Step 6 — also scrape the holidays/packages listing page for more results
    let moreOffers: OfferCard[] = [];
    if (homepageOffers.length < 6) {
      await page.goto("https://dt-tours.com/index.php/tours/search", {
        waitUntil: "networkidle0",
        timeout: 40_000,
      });
      // Hard 5-second delay for this page too
      await new Promise((r) => setTimeout(r, 5_000));
      // Wait until real (non-placeholder) content appears
      await page
        .waitForFunction(
          () => {
            const PLACEHOLDERS = [
              "top international city", "recommended hotels", "recommended holidays",
              "recommended destination", "top destination", "city name",
              "package name", "hotel name", "destination name",
            ];
            const cards = document.querySelectorAll(".destpack, .package-card, .tour-card");
            if (cards.length === 0) return false;
            return Array.from(cards).some((el) => {
              const text = ((el as HTMLElement).innerText ?? "").trim().toLowerCase();
              return text.length > 3 && !PLACEHOLDERS.some((p) => text.includes(p));
            });
          },
          { timeout: 15_000 }
        )
        .catch(() => {});
      await new Promise((r) => setTimeout(r, 1_000));

      moreOffers = await page.evaluate((): OfferCard[] => {
        const results: OfferCard[] = [];
        const BASE = "https://dt-tours.com";

        const PLACEHOLDERS = [
          "top international city", "recommended hotels", "recommended holidays",
          "recommended destination", "top destination", "city name",
          "package name", "hotel name", "destination name",
        ];
        const isPlaceholder = (text: string) => {
          const t = text.trim().toLowerCase();
          return t.length === 0 || PLACEHOLDERS.some((p) => t.includes(p));
        };

        const absUrl = (href: string | undefined | null): string => {
          if (!href) return BASE;
          return href.startsWith("http") ? href : `${BASE}${href}`;
        };
        const absImg = (src: string | undefined | null): string | undefined => {
          if (!src || src.startsWith("data:")) return undefined;
          return src.startsWith("http") ? src : `${BASE}${src}`;
        };

        document.querySelectorAll(".destpack, .package-card, .tour-card").forEach((el) => {
          const titleEl = el.querySelector(".pname, .package-name, h3, h4, [class*='title']");
          const title = (titleEl as HTMLElement)?.innerText?.trim() ?? "";
          if (!title || title.length < 3 || isPlaceholder(title)) return;
          const priceEl = el.querySelector(".pprice, h4.numm, .price, [class*='price']");
          const priceText = (priceEl as HTMLElement)?.innerText?.trim() ?? "";
          const priceMatch = priceText.match(/([\d,]+\.?\d*)/);
          const price = priceMatch ? `${parseFloat(priceMatch[1].replace(/,/g, "")).toFixed(3)} KWD` : "";
          const imgEl = el.querySelector("img");
          const image = absImg((imgEl as HTMLImageElement)?.src || (imgEl as HTMLImageElement)?.getAttribute("data-src"));
          const linkEl = el.querySelector("a[href*='tours/details'], a[href*='package'], a[href]");
          const link = absUrl((linkEl as HTMLAnchorElement)?.getAttribute("href"));
          results.push({ title, description: "", price, image, link });
        });

        return results;
      });
    }

    // Merge, deduplicate, cap at 8
    const seen = new Set<string>();
    const all: OfferCard[] = [];
    for (const o of [...homepageOffers, ...moreOffers]) {
      if (!seen.has(o.title) && o.title.length > 2) {
        seen.add(o.title);
        all.push(o);
        if (all.length >= 8) break;
      }
    }

    _cache = { offers: all, at: Date.now() };
    return all;
  } finally {
    await page.close().catch(() => {});
  }
}

router.get("/offers", async (req, res) => {
  try {
    const offers = await fetchOffers();
    res.json({ ok: true, offers, count: offers.length });
  } catch (err) {
    req.log.error({ err }, "Offers fetch failed");
    res.status(500).json({ ok: false, error: "Could not fetch offers", offers: [] });
  }
});

router.post("/offers/refresh", async (_req, res) => {
  _cache = null;
  try {
    const offers = await fetchOffers();
    res.json({ ok: true, offers, count: offers.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Refresh failed", offers: [] });
  }
});

export default router;
