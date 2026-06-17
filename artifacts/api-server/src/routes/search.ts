import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = Router();

export interface PackageResult {
  title: string;
  price: string;
  nights?: string;
  link: string;
}

const SEARCH_URL = "https://dt-tours.com/holidays/index.php/tours/search";
const BOT_UA =
  "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

interface CardInfo {
  name: string;
  link: string;
  mainLink: string;
}

function toMainSiteUrl(holidayUrl: string): string {
  return holidayUrl.replace(
    "https://dt-tours.com/holidays/index.php/tours/details/",
    "https://dt-tours.com/index.php/tours/details/",
  );
}

async function fetchDetailPage(card: CardInfo): Promise<PackageResult | null> {
  try {
    const { data } = await axios.get<string>(card.mainLink, {
      headers: { "User-Agent": BOT_UA },
      timeout: 10000,
    });
    const $d = cheerio.load(data);

    const title =
      $d("h1").first().text().trim() ||
      $d("h2").first().text().trim() ||
      card.name ||
      "Travel Package";

    const priceEl = $d("h4.numm").first().text().trim();
    let price = "Contact for price";
    if (priceEl) {
      const m = priceEl.match(/(\d[\d,\.]+)/);
      if (m) price = `${parseFloat(m[1].replace(/,/g, "")).toFixed(3)} KWD`;
    } else {
      const priceMatch = data.match(/KWD[\s]*([\d,\.]+)/);
      if (priceMatch) {
        const num = parseFloat(priceMatch[1].replace(/,/g, ""));
        if (num > 5 && num < 50000) price = `${num.toFixed(3)} KWD`;
      }
    }

    const nightsMatch = data.match(/(\d+)\s*[Nn]ight/);
    const nights = nightsMatch?.[1];

    return { title, price, nights, link: card.link };
  } catch {
    if (card.name) {
      return { title: card.name, price: "Contact for price", link: card.link };
    }
    return null;
  }
}

export async function scrapeDTToursSearch(destination: string): Promise<PackageResult[]> {
  let searchHtml = "";
  try {
    const { data } = await axios.post<string>(
      SEARCH_URL,
      `holiday_destination=${encodeURIComponent(destination)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: "https://dt-tours.com/holidays/",
          "User-Agent": BOT_UA,
        },
        timeout: 12000,
      },
    );
    searchHtml = data;
  } catch {
    return [];
  }

  const $ = cheerio.load(searchHtml);

  // Extract name+link pairs from the carousel cards inline
  const cards: CardInfo[] = [];
  $(".destpack").each((_, el) => {
    const name = $(el).find(".pname").first().text().trim();
    const link = $(el).find("a.v_det").first().attr("href") || "";
    if (link && link.includes("tours/details")) {
      const seen = cards.some((c) => c.link === link);
      if (!seen) {
        cards.push({ name, link, mainLink: toMainSiteUrl(link) });
      }
    }
  });

  // Fallback: extract links only if no carousel cards found
  if (cards.length === 0) {
    $("a[href*='tours/details']").each((_, el) => {
      const link = $(el).attr("href") || "";
      if (link && !cards.some((c) => c.link === link)) {
        cards.push({ name: "", link, mainLink: toMainSiteUrl(link) });
      }
    });
  }

  if (cards.length === 0) return [];

  const results = await Promise.all(cards.slice(0, 5).map(fetchDetailPage));
  return results.filter(Boolean) as PackageResult[];
}

router.post("/search", async (req, res) => {
  const { destination } = req.body as { destination?: string };
  if (!destination?.trim()) {
    res.status(400).json({ ok: false, error: "destination required" });
    return;
  }
  try {
    const results = await scrapeDTToursSearch(destination.trim());
    res.json({ ok: true, results, destination: destination.trim() });
  } catch (err) {
    req.log.error({ err }, "DTTours search scrape failed");
    res.status(500).json({ ok: false, error: "Search failed" });
  }
});

export default router;
