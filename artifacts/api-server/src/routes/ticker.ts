import { Router } from "express";

const router = Router();

interface TickerData {
  usdKwd: string;
  eurKwd: string;
  fetchedAt: number;
}

let cache: TickerData | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

async function fetchLiveData(): Promise<TickerData> {
  const [usdResult, eurResult] = await Promise.allSettled([
    fetch("https://open.er-api.com/v6/latest/USD", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    }),
    fetch("https://open.er-api.com/v6/latest/EUR", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    }),
  ]);

  let usdKwd = "0.307";
  if (usdResult.status === "fulfilled" && usdResult.value.ok) {
    try {
      const data = (await usdResult.value.json()) as {
        rates?: Record<string, number>;
      };
      if (typeof data.rates?.KWD === "number") {
        usdKwd = data.rates.KWD.toFixed(3);
      }
    } catch {
      /* use fallback */
    }
  }

  let eurKwd = "0.334";
  if (eurResult.status === "fulfilled" && eurResult.value.ok) {
    try {
      const data = (await eurResult.value.json()) as {
        rates?: Record<string, number>;
      };
      if (typeof data.rates?.KWD === "number") {
        eurKwd = data.rates.KWD.toFixed(3);
      }
    } catch {
      /* use fallback */
    }
  }

  return { usdKwd, eurKwd, fetchedAt: Date.now() };
}

router.get("/ticker-data", async (req, res) => {
  const stale = !cache || Date.now() - cache.fetchedAt > CACHE_TTL_MS;
  if (stale) {
    try {
      cache = await fetchLiveData();
      req.log.info(
        { usdKwd: cache.usdKwd, eurKwd: cache.eurKwd },
        "ticker-data refreshed",
      );
    } catch (err) {
      req.log.warn({ err }, "ticker-data fetch failed — using stale or defaults");
      if (!cache) {
        cache = { usdKwd: "0.307", eurKwd: "0.334", fetchedAt: Date.now() };
      }
    }
  }
  const snapshot = cache ?? { usdKwd: "0.307", eurKwd: "0.334" };
  res.json({ ok: true, usdKwd: snapshot.usdKwd, eurKwd: snapshot.eurKwd });
});

export default router;
