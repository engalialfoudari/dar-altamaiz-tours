import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";

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

const BOT_UA =
  "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

async function fetchOffers(): Promise<OfferCard[]> {
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) {
    return _cache.offers;
  }

  const offers: OfferCard[] = [];

  const urls = [
    "https://dt-tours.com/",
    "https://dt-tours.com/holidays/",
    "https://dt-tours.com/index.php/tours/search",
  ];

  for (const url of urls) {
    try {
      const { data } = await axios.get<string>(url, {
        headers: { "User-Agent": BOT_UA },
        timeout: 10_000,
      });

      const $ = cheerio.load(data);

      $(".offer, .deal, .promo, .banner-offer, .special-offer, .hot-deal, [class*='offer'], [class*='deal'], [class*='promo']").each(
        (_, el) => {
          const title =
            $(el).find("h2, h3, h4, .title, [class*='title']").first().text().trim() ||
            $(el).find("a").first().text().trim();

          const description = $(el).find("p, .desc, [class*='desc']").first().text().trim();

          const priceEl = $(el).find("[class*='price'], .amount, h4.numm").first().text().trim();
          const priceMatch = priceEl.match(/([\d,\.]+\s*KWD|KWD\s*[\d,\.]+)/i);
          const price = priceMatch?.[0] ?? "";

          const img =
            $(el).find("img").first().attr("src") ||
            $(el).find("[style*='background']").first().attr("style")?.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1];

          const link =
            $(el).find("a[href]").first().attr("href") ||
            $(el).closest("a[href]").attr("href") ||
            "https://dt-tours.com";

          if (title) {
            offers.push({
              title,
              description,
              price,
              image: img?.startsWith("http") ? img : img ? `https://dt-tours.com${img}` : undefined,
              link: link.startsWith("http") ? link : `https://dt-tours.com${link}`,
            });
          }
        }
      );

      $(".destpack, .package-card, .tour-card, [class*='package'], [class*='tour-item']").each(
        (_, el) => {
          const title =
            $(el).find(".pname, .package-name, h3, h4").first().text().trim() ||
            $(el).find("a").first().attr("title") ||
            "";

          const priceEl = $(el)
            .find(".pprice, h4.numm, .price, [class*='price']")
            .first()
            .text()
            .trim();
          const priceMatch = priceEl.match(/([\d,\.]+)/);
          const price = priceMatch ? `${parseFloat(priceMatch[1].replace(/,/g, "")).toFixed(3)} KWD` : "";

          const img = $(el).find("img").first().attr("src") ?? "";
          const link =
            $(el).find("a[href*='tours/details'], a[href*='package']").first().attr("href") ||
            $(el).find("a").first().attr("href") ||
            "https://dt-tours.com";

          if (title && !offers.some((o) => o.title === title)) {
            offers.push({
              title,
              description: "",
              price,
              image: img?.startsWith("http") ? img : img ? `https://dt-tours.com${img}` : undefined,
              link: link.startsWith("http") ? link : `https://dt-tours.com${link}`,
            });
          }
        }
      );

      if (offers.length >= 6) break;
    } catch {
      continue;
    }
  }

  const unique = offers
    .filter((o) => o.title.length > 2)
    .slice(0, 8);

  _cache = { offers: unique, at: Date.now() };
  return unique;
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
