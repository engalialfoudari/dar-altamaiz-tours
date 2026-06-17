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
const BASE = "https://dt-tours.com";

function absUrl(href: string | undefined): string {
  if (!href) return BASE;
  return href.startsWith("http") ? href : `${BASE}${href}`;
}

function absImg(src: string | undefined): string | undefined {
  if (!src || src.startsWith("data:") || src.startsWith("//") && !src.startsWith("http")) return undefined;
  if (src.startsWith("//")) return `https:${src}`;
  return src.startsWith("http") ? src : `${BASE}${src}`;
}

const PLACEHOLDERS = [
  "top international city", "recommended hotels", "recommended holidays",
  "recommended destination", "top destination", "city name",
  "package name", "hotel name", "destination name", "your destination",
  "tour name", "package title",
];

function isPlaceholder(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t.length < 3 || PLACEHOLDERS.some((p) => t.includes(p));
}

async function fetchDetailPrice(link: string): Promise<string> {
  try {
    const { data } = await axios.get<string>(link, {
      headers: { "User-Agent": BOT_UA },
      timeout: 8_000,
    });
    const $ = cheerio.load(data);
    const priceText = $("h4.numm").first().text().trim();
    if (priceText) {
      const m = priceText.match(/([\d,]+\.?\d*)/);
      if (m) return `${parseFloat(m[1].replace(/,/g, "")).toFixed(3)} KWD`;
    }
    const inlineMatch = data.match(/KWD[\s]*([\d,\.]+)/);
    if (inlineMatch) {
      const n = parseFloat(inlineMatch[1].replace(/,/g, ""));
      if (n > 5 && n < 50_000) return `${n.toFixed(3)} KWD`;
    }
  } catch { /* ignore */ }
  return "";
}

async function fetchOffers(): Promise<OfferCard[]> {
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) {
    return _cache.offers;
  }

  const urls = [
    `${BASE}/index.php/tours/search`,
    `${BASE}/holidays/index.php/tours/search`,
    `${BASE}/index.php/tours/list`,
  ];

  let html = "";
  for (const url of urls) {
    try {
      const { data } = await axios.get<string>(url, {
        headers: {
          "User-Agent": BOT_UA,
          "Referer": `${BASE}/`,
          "Accept": "text/html,application/xhtml+xml,*/*",
        },
        timeout: 12_000,
      });
      if (data && data.length > 500) {
        html = data;
        break;
      }
    } catch { /* try next */ }
  }

  if (!html) {
    _cache = { offers: [], at: Date.now() };
    return [];
  }

  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const cards: Array<{ title: string; link: string; image?: string; description: string }> = [];

  $(".destpack, .package-card, .tour-card").each((_, el) => {
    const title =
      $(el).find(".pname, .package-name, h3, h4").first().text().trim();
    if (!title || isPlaceholder(title)) return;

    const href =
      $(el).find("a[href*='tours/details'], a[href*='package'], a[href*='holiday'], a[href]").first().attr("href");
    const link = absUrl(href);
    if (seen.has(title)) return;
    seen.add(title);

    const imgSrc =
      $(el).find("img").first().attr("src") ||
      $(el).find("img").first().attr("data-src");
    const image = absImg(imgSrc);

    const description = $(el).find("p, .desc").first().text().trim().slice(0, 120);

    cards.push({ title, link, image, description });
    if (cards.length >= 8) return false;
  });

  // Fetch prices in parallel (up to 8)
  const withPrices = await Promise.all(
    cards.slice(0, 8).map(async (c) => {
      const price = await fetchDetailPrice(c.link);
      return { ...c, price } satisfies OfferCard;
    })
  );

  const results = withPrices.filter((c) => c.title.length > 2);
  _cache = { offers: results, at: Date.now() };
  return results;
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

// Pre-warm cache on startup so first user never waits
fetchOffers().catch(() => {});

export default router;
