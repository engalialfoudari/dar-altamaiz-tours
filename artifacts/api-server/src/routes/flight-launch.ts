import { Router } from "express";

const router = Router();

function fmtDate(iso: string): string {
  if (!iso) return "";
  const p = String(iso).split("-");
  if (p.length !== 3) return String(iso);
  return `${p[2]}/${p[1]}/${p[0]}`;
}

// Returns an HTML page that auto-submits the flight search form to dt-tours.com.
// When opened in the in-app WebView (device IP), GDS returns results normally.
router.get("/flight-launch", (req, res) => {
  const {
    from = "KWI", fromLabel = "Kuwait", fromLocId = "3945",
    to = "DXB", toLabel = "Dubai", toLocId = "1921",
    dep = "", ret = "", adults = "1",
  } = req.query as Record<string, string>;

  const depFmt = fmtDate(dep);
  const retFmt = fmtDate(ret);
  const tripType = ret ? "circle" : "oneway";

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body { background:#000; color:#D4AF37; font-family:sans-serif;
    display:flex; flex-direction:column; align-items:center;
    justify-content:center; min-height:100vh; margin:0; }
  p { font-size:18px; margin-bottom:12px; }
  small { color:#888; font-size:13px; }
</style>
</head>
<body>
<p>✈️ جاري فتح نتائج الطيران…</p>
<small>Opening flight results…</small>
<form id="f" method="POST" action="https://dt-tours.com/index.php/general/pre_flight_search">
  <input name="trip_type"      value="${tripType}"/>
  <input name="sector_type"    value="international"/>
  <input name="from_label"     value="${fromLabel}"/>
  <input name="from"           value="${from}"/>
  <input name="from_loc_id"    value="${fromLocId}"/>
  <input name="from_loc_type"  value="All_data"/>
  <input name="to_label"       value="${toLabel}"/>
  <input name="to"             value="${to}"/>
  <input name="to_loc_id"      value="${toLocId}"/>
  <input name="to_loc_type"    value="All_data"/>
  <input name="depature"       value="${depFmt}"/>
  <input name="return"         value="${retFmt}"/>
  <input name="adult"          value="${adults}"/>
  <input name="child"          value="0"/>
  <input name="infant"         value="0"/>
  <input name="v_class"        value="Economy"/>
  <input name="search_flight"  value="Search"/>
</form>
<script>document.getElementById('f').submit();</script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;
