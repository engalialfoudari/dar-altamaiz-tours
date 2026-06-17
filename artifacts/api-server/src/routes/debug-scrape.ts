import { Router } from "express";
import { getFreshPage, applyStealthOverrides } from "../lib/browser";
import { writeFile } from "node:fs/promises";

const router = Router();

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
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137 Safari/537.36",
        },
        signal: AbortSignal.timeout(10_000),
      }
    );
    const data = (await r.json()) as Array<{ id: string; code: string; label: string; category: string }>;
    return data?.[0] ?? null;
  } catch { return null; }
}

/** POST /api/debug-scrape/flight-dump — full puppeteer form-fill + network intercept */
router.post("/debug-scrape/flight-dump", async (req, res) => {
  const {
    from = "KWI", to = "DXB",
    depDate = "10/07/2026", retDate = "15/07/2026",
    adults = 1, roundTrip = true,
  } = req.body as {
    from?: string; to?: string;
    depDate?: string; retDate?: string;
    adults?: number; roundTrip?: boolean;
  };

  const [fromLoc, toLoc] = await Promise.all([
    lookupAirport(from),
    lookupAirport(to),
  ]);

  const { page, cleanup } = await getFreshPage();

  // ── Network interception: capture XHR/fetch responses ─────────────────────
  const capturedRequests: Array<{
    url: string; method: string; resourceType: string;
    status?: number; responseText?: string;
  }> = [];

  page.on("response", async (response) => {
    const url = response.url();
    const resourceType = response.request().resourceType();
    // Only capture XHR/fetch calls (not images, CSS, etc.)
    if (!["xhr", "fetch", "document"].includes(resourceType)) return;
    // Skip static assets
    if (/\.(js|css|png|jpg|gif|ico|woff|svg)(\?|$)/i.test(url)) return;

    try {
      const text = await response.text().catch(() => "");
      capturedRequests.push({
        url,
        method: response.request().method(),
        resourceType,
        status: response.status(),
        responseText: text.slice(0, 2000),
      });
    } catch { /**/ }
  });

  try {
    await applyStealthOverrides(page);

    // Step 1: Load homepage
    await page.goto("https://dt-tours.com/", { waitUntil: "networkidle0", timeout: 50_000 });
    await new Promise((r) => setTimeout(r, 3_000));

    const opts = {
      roundTrip, adults,
      fromLabel: fromLoc?.label ?? from,
      fromCode: fromLoc?.code ?? from,
      fromId: fromLoc?.id ?? from,
      fromType: fromLoc?.category ?? "All_data",
      toLabel: toLoc?.label ?? to,
      toCode: toLoc?.code ?? to,
      toId: toLoc?.id ?? to,
      toType: toLoc?.category ?? "All_data",
      depDate, retDate,
    };

    // Step 2: inject + submit (navigation races)
    const [, submitted] = await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 70_000 }).catch(() => null),
      page.evaluate((o) => {
        const form = document.getElementById("flight_form") as HTMLFormElement | null;
        if (!form) return { ok: false, reason: "form not found" };

        const set = (name: string, val: string) => {
          const el = form.querySelector(`[name="${name}"]`) as HTMLInputElement | null;
          if (!el) return;
          el.removeAttribute("readonly"); el.removeAttribute("disabled");
          el.value = val;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        };

        const tripEl = form.querySelector("#trip_type_id") as HTMLInputElement | null;
        if (tripEl) tripEl.value = o.roundTrip ? "circle" : "oneway";
        set("trip_type", o.roundTrip ? "circle" : "oneway");

        const intlRadio = form.querySelector('input[name="sector_type"][value="international"]') as HTMLInputElement | null;
        if (intlRadio) intlRadio.checked = true;

        set("from_label", o.fromLabel); set("from", o.fromCode);
        set("from_loc_id", o.fromId); set("from_loc_type", o.fromType);
        set("to_label", o.toLabel); set("to", o.toCode);
        set("to_loc_id", o.toId); set("to_loc_type", o.toType);
        set("adult", String(o.adults)); set("child", "0"); set("infant", "0"); set("v_class", "Economy");

        // Dates via jQuery datepicker
        const $ = (window as unknown as { $?: (s: string) => { datepicker: (c: string, v: Date) => void } }).$;
        const dd = (s: string) => {
          const p = s.split("/"); return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
        };
        const dep1 = document.getElementById("flight_datepicker1") as HTMLInputElement | null;
        if (dep1) {
          dep1.removeAttribute("readonly"); dep1.value = o.depDate;
          try { $?.("#flight_datepicker1").datepicker("setDate", dd(o.depDate)); } catch (_) { /**/ }
          dep1.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const ret2 = document.getElementById("flight_datepicker2") as HTMLInputElement | null;
        if (ret2 && o.retDate) {
          ret2.removeAttribute("readonly"); ret2.value = o.retDate;
          try { $?.("#flight_datepicker2").datepicker("setDate", dd(o.retDate)); } catch (_) { /**/ }
          ret2.dispatchEvent(new Event("change", { bubbles: true }));
        }

        const btn = form.querySelector('[name="search_flight"]') as HTMLElement | null;
        if (btn) { btn.click(); return { ok: true, reason: "clicked search_flight" }; }
        form.submit(); return { ok: true, reason: "form.submit() fallback" };
      }, opts),
    ]);

    // Step 3: Wait for pre-loader to clear OR results appear
    await page.waitForFunction(
      () => {
        const preloader = document.querySelector(".result-pre-loader-wrapper") as HTMLElement | null;
        const preloaderGone = !preloader || !preloader.offsetParent;
        const noResults = !!document.querySelector(".noresultfnd");
        return preloaderGone || noResults;
      },
      { timeout: 60_000, polling: 2_000 }
    ).catch(() => {});

    await new Promise((r) => setTimeout(r, 5_000));

    const finalUrl = page.url();
    const html = await page.content();
    await writeFile("/tmp/dt_flight_results.html", html).catch(() => {});

    const domInfo = await page.evaluate(() => {
      const allClasses = new Set<string>();
      document.querySelectorAll("[class]").forEach((el) => {
        (el as HTMLElement).className.split(/\s+/).forEach((c) => { if (c) allClasses.add(c); });
      });
      return {
        isPaymentError: document.body.innerText.includes("payment got failed"),
        noResults: !!document.querySelector(".noresultfnd"),
        htmlLen: document.documentElement.outerHTML.length,
        bodyTextLen: (document.body as HTMLElement).innerText.trim().length,
        bodyText: (document.body as HTMLElement).innerText.slice(0, 3000),
        relevantClasses: [...allClasses]
          .filter((c) => /result|flight|fare|row|price|ticket|airline|depar|arriv|time|dur|stop/i.test(c))
          .slice(0, 60),
        firstResultHtml:
          document.querySelector(".rowputscd, .result_row, [class*='result_item'], .allresult tr")?.outerHTML?.slice(0, 3000) ?? null,
      };
    });

    // Filter captured XHR calls — skip homepage requests, focus on search results
    const xhrCallsAfterSearch = capturedRequests.filter(
      (r) => r.url.includes("dt-tours.com") && (
        r.url.includes("flight") || r.url.includes("ajax") ||
        r.url.includes("search") || r.url.includes("result") ||
        r.url.includes("api") || r.url.includes("fare")
      )
    );

    res.json({
      ok: true, fromLoc, toLoc, submitted, finalUrl, domInfo,
      xhrCalls: capturedRequests
        .filter((r) => r.url.includes("dt-tours.com"))
        .slice(0, 30),
      xhrCallsAfterSearch: xhrCallsAfterSearch.slice(0, 20),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  } finally {
    await cleanup().catch(() => {});
  }
});

/** POST /api/debug-scrape — navigate to a URL and return DOM */
router.post("/debug-scrape", async (req, res) => {
  const { url } = req.body as { url: string };
  if (!url) { res.status(400).json({ ok: false, error: "url required" }); return; }

  const { page, cleanup } = await getFreshPage();
  try {
    await applyStealthOverrides(page);
    await page.goto(url, { waitUntil: "networkidle0", timeout: 50_000 });
    await page.waitForFunction(
      () => (document.body as HTMLElement).innerText.trim().length > 500,
      { timeout: 30_000, polling: 1_500 }
    ).catch(() => {});
    await new Promise((r) => setTimeout(r, 8_000));
    const html = await page.content();
    res.json({ ok: true, html: html.slice(0, 100_000) });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  } finally {
    await cleanup().catch(() => {});
  }
});

export default router;
