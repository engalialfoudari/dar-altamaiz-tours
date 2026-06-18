import { Router } from "express";
import { getFreshPage, applyStealthOverrides } from "../lib/browser";
import { writeFile } from "node:fs/promises";

const router = Router();

export interface ScrapedFlight {
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

const CARRIER_NAMES: Record<string, string> = {
  KU: "Kuwait Airways", J9: "Jazeera Airways", FZ: "flydubai",
  G9: "Air Arabia", EK: "Emirates", EY: "Etihad Airways",
  QR: "Qatar Airways", GF: "Gulf Air", WY: "Oman Air",
  SV: "Saudia", XY: "flynas", TK: "Turkish Airlines",
  PC: "Pegasus", W6: "Wizz Air", AI: "Air India",
  IX: "Air India Express", "6E": "IndiGo", PK: "PIA",
  UL: "SriLankan Airlines", BG: "Biman Bangladesh",
};

function toDateDDMMYYYY(iso: string): string {
  if (!iso) return "";
  const p = iso.split("-");
  if (p.length !== 3) return iso;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

function parseFlightListHtml(
  html: string,
  from: string,
  to: string,
  depDate: string,
  searchId: string,
): ScrapedFlight[] {
  const results: ScrapedFlight[] = [];
  const bookUrl = `https://dt-tours.com/index.php/flight/search/${searchId}`;

  const cardBoundaries: number[] = [];
  let idx = 0;
  const boundary = 'class="rowresult r-r-i';
  while ((idx = html.indexOf(boundary, idx)) !== -1) {
    cardBoundaries.push(idx);
    idx += boundary.length;
  }
  if (cardBoundaries.length === 0) return results;

  for (let i = 0; i < cardBoundaries.length; i++) {
    const start = cardBoundaries[i];
    const end = i + 1 < cardBoundaries.length ? cardBoundaries[i + 1] : html.length;
    const card = html.slice(start, end);

    const codeM = card.match(/data-code="([A-Z0-9]{2})"/);
    const code = codeM?.[1] ?? "";
    const nameM = card.match(/<span class="a-n"[^>]*>\s*([^<]+)<\/span>/);
    const carrierName = nameM?.[1]?.trim() ?? CARRIER_NAMES[code] ?? code;

    const depM = card.match(/fltime dep_dt[^"]*"[^>]*>(\d{1,2}:\d{2})</);
    const arrM = card.match(/arr_dt[^"]*"[^>]*>(\d{1,2}:\d{2})</);
    const dep = depM?.[1] ?? "";
    const arr = arrM?.[1] ?? "";

    let duration = "";
    const durClassM = card.match(/class="[^"]*(?:total_dur|durtime)[^"]*"[^>]*>([^<]+)</);
    if (durClassM) {
      duration = durClassM[1].trim();
    } else {
      const allTimes = card.match(/\b(\d{1,2}:\d{2})\b/g) ?? [];
      const durCandidate = allTimes.find((t) => t !== dep && t !== arr);
      if (durCandidate) {
        const [h, m] = durCandidate.split(":");
        const hNum = parseInt(h, 10);
        if (hNum >= 0 && hNum <= 30) duration = `${hNum}h ${m}m`;
      }
    }

    const priceAttrM = card.match(/data-price="([\d.]+)"/);
    let price = "";
    if (priceAttrM) {
      price = parseFloat(priceAttrM[1]).toFixed(2);
    } else {
      const priceTextM = card.match(/KWD\s*<\/strong>\s*([\d.,]+)/);
      price = priceTextM?.[1]?.replace(",", "") ?? "";
    }

    const isNonStop = /non[\s-]?stop|0\s*stop/i.test(card);
    const stopsM = card.match(/(\d+)\s*(?:stop|layover)/i);
    const stops = isNonStop ? 0 : stopsM ? parseInt(stopsM[1], 10) : 0;

    if ((dep || arr) && (price || carrierName)) {
      results.push({
        carrier: carrierName || "Airline",
        departure: dep,
        arrival: arr,
        depDate,
        origin: from,
        destination: to,
        stops,
        duration,
        price,
        currency: "KWD",
        bookUrl,
      });
    }
  }

  return results.slice(0, 8);
}

async function lookupAirport(iataCode: string): Promise<{
  id: string; code: string; label: string; category: string;
} | null> {
  try {
    const r = await fetch(
      `https://dt-tours.com/index.php/ajax/get_airport_code_list?term=${encodeURIComponent(iataCode)}&type=international`,
      {
        headers: {
          Referer: "https://dt-tours.com/",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(10_000),
      }
    );
    const data = (await r.json()) as Array<{ id: string; code: string; label: string; category: string }>;
    return data?.[0] ?? null;
  } catch { return null; }
}

async function searchFlightsPuppeteer(params: {
  from: string; to: string;
  fromLabel: string; toLabel: string;
  depDate: string; retDate?: string;
  adults: number;
}): Promise<{ flights: ScrapedFlight[]; fallbackUrl: string }> {
  const { from, to, depDate, retDate, adults } = params;
  const isRoundTrip = !!retDate;
  const depDDMMYYYY = toDateDDMMYYYY(depDate);
  const retDDMMYYYY = retDate ? toDateDDMMYYYY(retDate) : "";
  const DT_HOME = "https://dt-tours.com";

  const [fromLoc, toLoc] = await Promise.all([
    lookupAirport(from),
    lookupAirport(to),
  ]);

  const { page, cleanup } = await getFreshPage();

  let capturedFlightHtml: string | null = null;
  let capturedSearchId: string | null = null;
  let knownSearchUrl: string | null = null;

  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("flight_list")) return;
    const searchIdM = url.match(/search_id=(\d+)/);
    if (!searchIdM) return;
    // As soon as we have a searchId we know the dt-tours results URL
    knownSearchUrl = `${DT_HOME}/index.php/flight/search/${searchIdM[1]}`;
    try {
      const text = await response.text().catch(() => "");
      if (!text) return;
      const parsed = JSON.parse(text) as {
        status: number;
        data: Record<string, Record<string, string>> | [];
      };
      if (parsed.status === 1 && !Array.isArray(parsed.data)) {
        const colX = parsed.data?.col_x;
        if (colX && typeof colX === "object" && Object.keys(colX).length > 0) {
          capturedFlightHtml = Object.values(colX).join("");
          capturedSearchId = searchIdM[1];
        }
      }
    } catch { /* ignore */ }
  });

  try {
    await applyStealthOverrides(page);

    await page.goto("https://dt-tours.com/", { waitUntil: "networkidle0", timeout: 50_000 });
    await new Promise((r) => setTimeout(r, 2_000));

    const opts = {
      roundTrip: isRoundTrip,
      adults,
      fromLabel: fromLoc?.label ?? params.fromLabel,
      fromCode: fromLoc?.code ?? from,
      fromId: fromLoc?.id ?? from,
      fromType: fromLoc?.category ?? "All_data",
      toLabel: toLoc?.label ?? params.toLabel,
      toCode: toLoc?.code ?? to,
      toId: toLoc?.id ?? to,
      toType: toLoc?.category ?? "All_data",
      depDate: depDDMMYYYY,
      retDate: retDDMMYYYY,
    };

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 70_000 }).catch(() => null),
      page.evaluate((o) => {
        const form = document.getElementById("flight_form") as HTMLFormElement | null;
        if (!form) return;

        const set = (name: string, val: string) => {
          const el = form.querySelector(`[name="${name}"]`) as HTMLInputElement | null;
          if (!el) return;
          el.removeAttribute("readonly");
          el.removeAttribute("disabled");
          el.value = val;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        };

        const tripEl = form.querySelector("#trip_type_id") as HTMLInputElement | null;
        if (tripEl) tripEl.value = o.roundTrip ? "circle" : "oneway";
        set("trip_type", o.roundTrip ? "circle" : "oneway");

        const intlRadio = form.querySelector('input[name="sector_type"][value="international"]') as HTMLInputElement | null;
        if (intlRadio) intlRadio.checked = true;

        set("from_label", o.fromLabel);
        set("from", o.fromCode);
        set("from_loc_id", o.fromId);
        set("from_loc_type", o.fromType);
        set("to_label", o.toLabel);
        set("to", o.toCode);
        set("to_loc_id", o.toId);
        set("to_loc_type", o.toType);
        set("adult", String(o.adults));
        set("child", "0");
        set("infant", "0");
        set("v_class", "Economy");

        const $ = (window as unknown as { $?: (s: string) => { datepicker: (c: string, v: Date) => void } }).$;
        const dd = (s: string) => {
          const p = s.split("/");
          return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
        };

        const dep1 = document.getElementById("flight_datepicker1") as HTMLInputElement | null;
        if (dep1) {
          dep1.removeAttribute("readonly");
          dep1.value = o.depDate;
          try { $?.("#flight_datepicker1").datepicker("setDate", dd(o.depDate)); } catch (_) { /**/ }
          dep1.dispatchEvent(new Event("change", { bubbles: true }));
        }

        if (o.retDate) {
          const ret2 = document.getElementById("flight_datepicker2") as HTMLInputElement | null;
          if (ret2) {
            ret2.removeAttribute("readonly");
            ret2.value = o.retDate;
            try { $?.("#flight_datepicker2").datepicker("setDate", dd(o.retDate)); } catch (_) { /**/ }
            ret2.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }

        const btn = form.querySelector('[name="search_flight"]') as HTMLElement | null;
        if (btn) { btn.click(); } else { form.submit(); }
      }, opts),
    ]);

    const TIMEOUT_MS = 75_000;
    const start = Date.now();

    while (Date.now() - start < TIMEOUT_MS) {
      if (capturedFlightHtml && capturedSearchId) {
        const flights = parseFlightListHtml(capturedFlightHtml, from, to, depDate, capturedSearchId);
        if (flights.length > 0) {
          await writeFile("/tmp/dt_flight_results_latest.html", capturedFlightHtml).catch(() => {});
          return {
            flights,
            fallbackUrl: knownSearchUrl ?? `${DT_HOME}/index.php/flight/search/${capturedSearchId}`,
          };
        }
      }

      const currentUrl = page.url();
      const searchIdM = currentUrl.match(/\/flight\/search\/(\d+)/);
      if (searchIdM) {
        const searchId = searchIdM[1];
        // Track the page URL as a known dt-tours search URL
        if (!knownSearchUrl) knownSearchUrl = `${DT_HOME}/index.php/flight/search/${searchId}`;

        const domFlights = await page.evaluate(
          (sid: string, fromCode: string, toCode: string, dep: string) => {
            const cards = document.querySelectorAll(".rowresult.r-r-i");
            const results: Array<{
              carrier: string; departure: string; arrival: string;
              stops: number; duration: string; price: string; currency: string;
              depDate: string; origin: string; destination: string; bookUrl: string;
            }> = [];

            cards.forEach((card) => {
              const codeEl = card.querySelector("[data-code]");
              const code = codeEl?.getAttribute("data-code") ?? "";
              const nameEl = card.querySelector(".a-n");
              const carrier = nameEl?.textContent?.trim() ?? code;

              const depEl = card.querySelector('[class*="dep_dt"]');
              const arrEl = card.querySelector('[class*="arr_dt"]');
              const departure = depEl?.textContent?.trim() ?? "";
              const arrival = arrEl?.textContent?.trim() ?? "";

              const priceEl = card.querySelector("[data-price]");
              const priceAttr = priceEl?.getAttribute("data-price") ?? "";
              const price = priceAttr ? parseFloat(priceAttr).toFixed(2) : "";

              const durEl = card.querySelector('[class*="total_dur"], [class*="durtime"]');
              const duration = durEl?.textContent?.trim() ?? "";

              const nonStop = (card.textContent ?? "").toLowerCase().includes("non-stop");
              const stopsM = (card.textContent ?? "").match(/(\d+)\s*stop/i);
              const stops = nonStop ? 0 : stopsM ? parseInt(stopsM[1], 10) : 0;

              if ((departure || arrival) && (price || carrier)) {
                results.push({
                  carrier: carrier || "Airline",
                  departure, arrival,
                  depDate: dep,
                  origin: fromCode, destination: toCode,
                  stops, duration, price,
                  currency: "KWD",
                  bookUrl: `https://dt-tours.com/index.php/flight/search/${sid}`,
                });
              }
            });

            return results;
          },
          searchId, from, to, depDate,
        ).catch(() => [] as ScrapedFlight[]);

        if (domFlights.length > 0) {
          return {
            flights: domFlights.slice(0, 8),
            fallbackUrl: knownSearchUrl,
          };
        }
      }

      await new Promise((r) => setTimeout(r, 3_000));
    }

    // Timed out — return the dt-tours search URL if puppeteer reached it,
    // otherwise fall back to the homepage so the user can search manually
    return { flights: [], fallbackUrl: knownSearchUrl ?? DT_HOME };
  } finally {
    await cleanup().catch(() => {});
  }
}

router.post("/flight-scrape", async (req, res) => {
  const { from, to, fromLabel, toLabel, depDate, retDate, adults = 1 } = req.body as {
    from: string; to: string; fromLabel?: string; toLabel?: string;
    depDate: string; retDate?: string; adults?: number;
  };

  if (!from || !to || !depDate) {
    res.status(400).json({ ok: false, error: "from, to, depDate required" });
    return;
  }

  try {
    const { flights, fallbackUrl } = await searchFlightsPuppeteer({
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      fromLabel: fromLabel ?? from,
      toLabel: toLabel ?? to,
      depDate,
      retDate,
      adults: Math.max(1, Math.min(9, Number(adults))),
    });
    res.json({ ok: true, flights, count: flights.length, fallbackUrl });
  } catch (err) {
    req.log.error({ err }, "Flight scrape failed");
    res.status(502).json({ ok: false, fallbackUrl: "https://dt-tours.com", error: err instanceof Error ? err.message : "Scrape failed" });
  }
});

export default router;
