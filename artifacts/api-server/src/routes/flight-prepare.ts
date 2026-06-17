import { Router } from "express";
import https from "https";

const router = Router();

const AIRPORT_CACHE: Record<string, { id: string; label: string; category: string }> = {
  KWI: { id: "3945", label: "Kuwait", category: "All_data" },
  DXB: { id: "1921", label: "Dubai", category: "All_data" },
};

function fmtDate(iso: string): string {
  if (!iso) return "";
  const parts = String(iso).split("-");
  if (parts.length !== 3) return String(iso);
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

async function lookupAirport(iata: string): Promise<{ id: string; label: string; category: string } | null> {
  if (AIRPORT_CACHE[iata]) return AIRPORT_CACHE[iata];
  try {
    const res = await fetch(
      `https://dt-tours.com/index.php/ajax/get_airport_code_list?term=${encodeURIComponent(iata)}&type=international`,
      { headers: { "X-Requested-With": "XMLHttpRequest", "Referer": "https://dt-tours.com/" } }
    );
    const data = await res.json() as Array<{ id: string; code: string; label: string; category: string }>;
    const match = data.find((a) => a.code === iata && a.category === "All_data") ?? data[0] ?? null;
    if (match) AIRPORT_CACHE[iata] = { id: match.id, label: match.label, category: match.category };
    return match ? AIRPORT_CACHE[iata] : null;
  } catch {
    return null;
  }
}

router.post("/flight-prepare", async (req, res) => {
  try {
    const {
      from = "KWI",
      to = "DXB",
      dep = "",
      ret = "",
      adults = 1,
    } = req.body as Record<string, string | number>;

    const fromIata = String(from).toUpperCase();
    const toIata = String(to).toUpperCase();

    const [fromLoc, toLoc] = await Promise.all([
      lookupAirport(fromIata),
      lookupAirport(toIata),
    ]);

    const formData = new URLSearchParams({
      trip_type: ret ? "circle" : "oneway",
      sector_type: "international",
      from_label: fromLoc?.label ?? fromIata,
      from: fromIata,
      from_loc_id: fromLoc?.id ?? fromIata,
      from_loc_type: fromLoc?.category ?? "All_data",
      to_label: toLoc?.label ?? toIata,
      to: toIata,
      to_loc_id: toLoc?.id ?? toIata,
      to_loc_type: toLoc?.category ?? "All_data",
      depature: fmtDate(String(dep)),
      return: ret ? fmtDate(String(ret)) : "",
      adult: String(adults),
      child: "0",
      infant: "0",
      v_class: "Economy",
      search_flight: "Search",
    });

    const postBody = formData.toString();

    const searchId = await new Promise<string | null>((resolve) => {
      const options: https.RequestOptions = {
        hostname: "dt-tours.com",
        path: "/index.php/general/pre_flight_search",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postBody),
          "Referer": "https://dt-tours.com/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ar-KW,ar;q=0.9,en;q=0.8",
        },
      };

      const request = https.request(options, (response) => {
        const loc = response.headers.location ?? "";
        const m = loc.match(/\/flight\/search\/(\d+)/);
        response.resume();
        resolve(m ? m[1] : null);
      });

      request.on("error", () => resolve(null));
      request.setTimeout(20_000, () => { request.destroy(); resolve(null); });
      request.write(postBody);
      request.end();
    });

    if (!searchId) {
      res.json({ ok: false, error: "Search initiation failed" });
      return;
    }

    res.json({ ok: true, searchId });
  } catch {
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
