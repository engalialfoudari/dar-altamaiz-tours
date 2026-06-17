import { Router } from "express";

const router = Router();

const DT_BASE = "https://dt-tours.com";

const CARRIER_NAMES: Record<string, string> = {
  KU: "Kuwait Airways", J9: "Jazeera Airways", FZ: "flydubai",
  G9: "Air Arabia", EK: "Emirates", EY: "Etihad Airways",
  QR: "Qatar Airways", GF: "Gulf Air", WY: "Oman Air",
  SV: "Saudia", XY: "flynas", TK: "Turkish Airlines",
  PC: "Pegasus", W6: "Wizz Air", AI: "Air India",
  IX: "Air India Express", "6E": "IndiGo", PK: "PIA",
  UL: "SriLankan Airlines", BG: "Biman Bangladesh",
};

interface FlightResult {
  carrier: string;
  departure: string;
  arrival: string;
  depDate: string;
  origin: string;
  destination: string;
  stops: number;
  duration: string;
  price: string;
  currency: string;
  bookUrl: string;
}

function parseFlightCards(html: string, from: string, to: string, depDate: string, searchId: string): FlightResult[] {
  const results: FlightResult[] = [];
  const bookUrl = `${DT_BASE}/index.php/flight/search/${searchId}`;
  const boundary = 'class="rowresult r-r-i';
  const positions: number[] = [];
  let i = 0;
  while ((i = html.indexOf(boundary, i)) !== -1) { positions.push(i); i += boundary.length; }
  if (positions.length === 0) return results;

  for (let n = 0; n < positions.length; n++) {
    const card = html.slice(positions[n], n + 1 < positions.length ? positions[n + 1] : html.length);
    const codeM = card.match(/data-code="([A-Z0-9]{2})"/);
    const code = codeM?.[1] ?? "";
    const nameM = card.match(/<span class="a-n"[^>]*>\s*([^<]+)<\/span>/);
    const carrier = nameM?.[1]?.trim() ?? (CARRIER_NAMES[code] ?? code);
    const depM = card.match(/fltime dep_dt[^"]*"[^>]*>(\d{1,2}:\d{2})</);
    const arrM = card.match(/arr_dt[^"]*"[^>]*>(\d{1,2}:\d{2})</);
    const dep_ = depM?.[1] ?? "";
    const arr_ = arrM?.[1] ?? "";
    const priceM = card.match(/data-price="([\d.]+)"/);
    const price = priceM ? parseFloat(priceM[1]).toFixed(2) : "";
    const durM = card.match(/class="[^"]*(?:total_dur|durtime)[^"]*"[^>]*>([^<]+)</);
    const duration = durM ? durM[1].trim() : "";
    const isNonStop = /non[\s-]?stop|0\s*stop/i.test(card);
    const stopsM = card.match(/(\d+)\s*(?:stop|layover)/i);
    const stops = isNonStop ? 0 : stopsM ? parseInt(stopsM[1], 10) : 0;
    if ((dep_ || arr_) && (price || carrier)) {
      results.push({
        carrier: carrier || "Airline", departure: dep_, arrival: arr_,
        depDate, origin: from, destination: to, stops, duration, price,
        currency: "KWD", bookUrl,
      });
    }
  }
  return results;
}

router.get("/flight-results", async (req, res) => {
  try {
    const { searchId, from = "KWI", to = "DXB", dep = "" } = req.query as Record<string, string>;
    if (!searchId) { res.json({ ok: false, error: "Missing searchId" }); return; }

    const listRes = await fetch(
      `${DT_BASE}/index.php/ajax/flight_list?booking_source=PTBSID0000000016&search_id=${searchId}&op=load`,
      {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "Referer": `${DT_BASE}/index.php/flight/search/${searchId}`,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        },
      }
    );

    const data = await listRes.json() as { status: number; data: Record<string, Record<string, string>> | [] };

    if (data.status === 1 && !Array.isArray(data.data)) {
      const colX = data.data?.col_x;
      if (colX && typeof colX === "object") {
        const html = Object.values(colX).join("");
        const flights = parseFlightCards(html, from, to, dep, searchId);
        if (flights.length > 0) {
          res.json({ ok: true, ready: true, flights: flights.slice(0, 5) });
          return;
        }
      }
    }

    res.json({ ok: true, ready: false });
  } catch {
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
