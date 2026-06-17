import { Router } from "express";

const router = Router();

interface IpApiResponse {
  status: string;
  country?: string;
  countryCode?: string;
  city?: string;
}

// Simple in-process cache to avoid hammering ip-api.com for the same IP
const GEO_CACHE = new Map<string, { data: IpApiResponse; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function lookupIp(ip: string): Promise<IpApiResponse> {
  const cached = GEO_CACHE.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const res = await fetch(
    `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city`,
    { signal: AbortSignal.timeout(5_000) }
  );
  const data = (await res.json()) as IpApiResponse;
  GEO_CACHE.set(ip, { data, ts: Date.now() });
  return data;
}

router.get("/geo", async (req, res) => {
  try {
    // Extract real client IP — Replit proxy forwards via X-Forwarded-For
    const xff = req.headers["x-forwarded-for"] as string | undefined;
    const rawIp = xff ? xff.split(",")[0].trim() : (req.socket.remoteAddress ?? "");
    const ip = rawIp.replace(/^::ffff:/, ""); // strip IPv4-mapped IPv6 prefix

    if (!ip || ip === "127.0.0.1" || ip === "::1") {
      // Localhost / unknown — treat as non-Kuwait
      res.json({ ip, country: "Unknown", countryCode: "XX", city: "", isKuwait: false });
      return;
    }

    const geo = await lookupIp(ip);
    res.json({
      ip,
      country: geo.country ?? "Unknown",
      countryCode: geo.countryCode ?? "XX",
      city: geo.city ?? "",
      isKuwait: geo.countryCode === "KW",
    });
  } catch {
    res.json({ ip: "", country: "Unknown", countryCode: "XX", city: "", isKuwait: false });
  }
});

export default router;
