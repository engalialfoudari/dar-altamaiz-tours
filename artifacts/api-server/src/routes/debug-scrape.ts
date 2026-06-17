import { Router } from "express";
import { request as httpsRequest } from "node:https";
import { getFreshPage, applyStealthOverrides } from "../lib/browser";
import { writeFile } from "node:fs/promises";

const router = Router();

function postFlightSearch(formBody: string): Promise<{ searchUrl: string; cookies: Array<{ name: string; value: string }> }> {
  return new Promise((resolve, reject) => {
    const bodyBuf = Buffer.from(formBody, "utf8");
    const req = httpsRequest({
      hostname: "dt-tours.com",
      path: "/index.php/general/pre_flight_search",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": bodyBuf.length,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/137",
        "Referer": "https://dt-tours.com/",
        "Accept": "text/html,*/*;q=0.8",
        "Origin": "https://dt-tours.com",
      }
    }, (res) => {
      const locationHeader = (res.headers["location"] as string | undefined) ?? "";
      const searchUrl = locationHeader.startsWith("http") ? locationHeader : `https://dt-tours.com${locationHeader}`;
      const rawCookies: string[] = Array.isArray(res.headers["set-cookie"]) ? (res.headers["set-cookie"] as string[]) : [];
      const cookieMap = new Map<string, string>();
      for (const raw of rawCookies) {
        const match = raw.match(/^([^=]+)=([^;]*)/);
        if (match) cookieMap.set(match[1], match[2]);
      }
      const cookies = [...cookieMap.entries()].map(([name, value]) => ({ name, value }));
      res.resume();
      resolve({ searchUrl, cookies });
    });
    req.on("error", reject);
    req.setTimeout(25_000, () => { req.destroy(); reject(new Error("POST timeout")); });
    req.write(bodyBuf);
    req.end();
  });
}

router.post("/debug-scrape/flight-dump", async (req, res) => {
  const getAirportId = async (q: string) => {
    try {
      const r = await fetch(`https://dt-tours.com/index.php/ajax/get_airport_code_list?term=${encodeURIComponent(q)}&type=international`, {
        headers: { "Referer": "https://dt-tours.com/", "X-Requested-With": "XMLHttpRequest", "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8_000),
      });
      const data = (await r.json()) as Array<{ id: string; code: string; label: string; category: string }>;
      return data?.[0] ?? null;
    } catch { return null; }
  };

  const [fromLoc, toLoc] = await Promise.all([getAirportId("Kuwait"), getAirportId("Dubai")]);

  const formBody = new URLSearchParams({
    trip_type: "oneway", sector_type: "international",
    from_label: fromLoc?.label ?? "Kuwait", from: fromLoc?.code ?? "KWI",
    from_loc_id: fromLoc?.id ?? "3945", from_loc_type: fromLoc?.category ?? "All_data",
    to_label: toLoc?.label ?? "Dubai", to: toLoc?.code ?? "DXB",
    to_loc_id: toLoc?.id ?? "1921", to_loc_type: toLoc?.category ?? "All_data",
    depature: "01/10/2026", return: "", adult: "1", child: "0", infant: "0",
    v_class: "Economy", search_flight: "Search",
  }).toString();

  let sessionData: { searchUrl: string; cookies: Array<{ name: string; value: string }> };
  try {
    sessionData = await postFlightSearch(formBody);
  } catch (e) {
    res.status(500).json({ ok: false, error: `POST failed: ${e}` }); return;
  }

  const { page, cleanup } = await getFreshPage();
  try {
    await applyStealthOverrides(page);

    if (sessionData.cookies.length > 0) {
      await page.setCookie(...sessionData.cookies.map((c) => ({ name: c.name, value: c.value, domain: "dt-tours.com", path: "/" })));
    }

    await page.goto(sessionData.searchUrl, { waitUntil: "networkidle0", timeout: 60_000 });
    await new Promise((r) => setTimeout(r, 7_000));
    await page.waitForSelector(".result_box, .oneway_result_item, .result-row, [class*='result'], #results", { timeout: 20_000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 3_000));

    const finalUrl = page.url();
    const html = await page.content();
    await writeFile("/tmp/flight_results_debug3.html", html);

    const domInfo = await page.evaluate(() => {
      const all_classes = new Set<string>();
      document.querySelectorAll("[class]").forEach((el) => {
        (el as HTMLElement).className.split(/\s+/).forEach((c) => { if (c) all_classes.add(c); });
      });
      const rel_classes = [...all_classes].filter((c) => /result|flight|fare|item|row|list|card|box|price|ticket|airline|depar|arriv/i.test(c));
      const bodyText = document.body.innerText.slice(0, 3000);
      const priceRe = /(?:KWD|USD|AED)\s*[\d,]+|[\d,]+\s*(?:KWD|USD|AED)/;
      const priceEls: string[] = [];
      document.querySelectorAll("*").forEach((el) => {
        if (el.children.length === 0 && priceRe.test((el as HTMLElement).innerText ?? "")) {
          priceEls.push(`${el.tagName}.${(el as HTMLElement).className.slice(0, 50)}: ${(el as HTMLElement).innerText.trim().slice(0, 80)}`);
        }
      });
      return { rel_classes: rel_classes.slice(0, 60), bodyText, htmlLen: document.documentElement.outerHTML.length, priceEls: priceEls.slice(0, 20) };
    });

    res.json({ ok: true, fromLoc, toLoc, cookies: sessionData.cookies.map((c) => c.name), searchUrl: sessionData.searchUrl, finalUrl, htmlLen: html.length, domInfo });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  } finally {
    await cleanup().catch(() => {});
  }
});

export default router;
