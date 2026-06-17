import { Router } from "express";
import https from "https";

const router = Router();

function fmtDate(iso: string): string {
  if (!iso) return "";
  const parts = String(iso).split("-");
  if (parts.length !== 3) return String(iso);
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

router.post("/flight-prepare", async (req, res) => {
  try {
    const {
      from = "KWI",
      fromLabel = "Kuwait",
      fromLocId = "3945",
      fromLocType = "All_data",
      to = "DXB",
      toLabel = "Dubai",
      toLocId = "1921",
      toLocType = "All_data",
      dep = "",
      ret = "",
      adults = 1,
    } = req.body as Record<string, string | number>;

    const formData = new URLSearchParams({
      trip_type: ret ? "circle" : "oneway",
      sector_type: "international",
      from_label: String(fromLabel),
      from: String(from),
      from_loc_id: String(fromLocId),
      from_loc_type: String(fromLocType),
      to_label: String(toLabel),
      to: String(to),
      to_loc_id: String(toLocId),
      to_loc_type: String(toLocType),
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
      request.setTimeout(20_000, () => {
        request.destroy();
        resolve(null);
      });
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
