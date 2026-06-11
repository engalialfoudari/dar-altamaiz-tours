import { Router } from "express";

const router = Router();

interface TickerData {
  usdKwd: string;
  londonTemp: string;
  londonDesc: string;
  fetchedAt: number;
}

let cache: TickerData | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function fetchLiveData(): Promise<TickerData> {
  const [rateResult, weatherResult] = await Promise.allSettled([
    fetch("https://open.er-api.com/v6/latest/USD", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    }),
    fetch("https://wttr.in/London?format=j1", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    }),
  ]);

  let usdKwd = "0.307";
  if (rateResult.status === "fulfilled" && rateResult.value.ok) {
    try {
      const data = (await rateResult.value.json()) as {
        rates?: Record<string, number>;
      };
      if (typeof data.rates?.KWD === "number") {
        usdKwd = data.rates.KWD.toFixed(3);
      }
    } catch {
      /* use fallback */
    }
  }

  let londonTemp = "18°C";
  let londonDesc = "Partly cloudy";
  if (weatherResult.status === "fulfilled" && weatherResult.value.ok) {
    try {
      const data = (await weatherResult.value.json()) as {
        current_condition?: Array<{
          temp_C?: string;
          weatherDesc?: Array<{ value: string }>;
        }>;
      };
      const cond = data.current_condition?.[0];
      if (cond?.temp_C) londonTemp = `${cond.temp_C}°C`;
      if (cond?.weatherDesc?.[0]?.value) londonDesc = cond.weatherDesc[0].value;
    } catch {
      /* use fallback */
    }
  }

  return { usdKwd, londonTemp, londonDesc, fetchedAt: Date.now() };
}

router.get("/ticker-data", async (req, res) => {
  const stale = !cache || Date.now() - cache.fetchedAt > CACHE_TTL_MS;
  if (stale) {
    try {
      cache = await fetchLiveData();
      req.log.info(
        { usdKwd: cache.usdKwd, londonTemp: cache.londonTemp },
        "ticker-data refreshed",
      );
    } catch (err) {
      req.log.warn({ err }, "ticker-data fetch failed — using stale or defaults");
      if (!cache) {
        cache = {
          usdKwd: "0.307",
          londonTemp: "18°C",
          londonDesc: "Partly cloudy",
          fetchedAt: Date.now(),
        };
      }
    }
  }
  const snapshot = cache ?? {
    usdKwd: "0.307",
    londonTemp: "18°C",
    londonDesc: "Partly cloudy",
  };
  res.json({
    ok: true,
    usdKwd: snapshot.usdKwd,
    londonTemp: snapshot.londonTemp,
    londonDesc: snapshot.londonDesc,
  });
});

export default router;
