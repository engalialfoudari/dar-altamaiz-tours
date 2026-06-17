import { Router } from "express";

const router = Router();

function toFormDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

function sanitize(val: unknown): string {
  return String(val ?? "").replace(/[<>"'&]/g, "");
}

router.get("/flight-redirect", (req, res) => {
  const from = sanitize(req.query["from"]);
  const fromId = sanitize(req.query["from_id"]);
  const to = sanitize(req.query["to"]);
  const toId = sanitize(req.query["to_id"]);
  const dep = sanitize(req.query["dep"]);
  const ret = sanitize(req.query["ret"]);
  const adults = Math.max(1, parseInt(sanitize(req.query["adults"])) || 1);

  const tripType = ret ? "circle" : "oneway";
  const depFormatted = toFormDate(dep);
  const retFormatted = ret ? toFormDate(ret) : "";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dar AlTamaiz Tours — Flight Search</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#000;color:#D4AF37;font-family:Arial,sans-serif;
         display:flex;align-items:center;justify-content:center;
         min-height:100vh;flex-direction:column;gap:18px;padding:24px;text-align:center}
    .logo{font-size:20px;font-weight:bold;letter-spacing:2px;color:#D4AF37}
    .logo span{color:#fff;font-size:14px;display:block;margin-top:4px;opacity:.6}
    .spinner{width:44px;height:44px;border:3px solid rgba(212,175,55,.2);
             border-top-color:#D4AF37;border-radius:50%;
             animation:spin .9s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    p{font-size:14px;color:rgba(255,255,255,.7);line-height:1.6}
    .route{font-size:16px;color:#D4AF37;font-weight:bold}
  </style>
</head>
<body>
  <div class="logo">دار التميز<span>DAR ALTAMAIZ TOURS</span></div>
  <div class="spinner"></div>
  <p class="route">${from} ✈ ${to}</p>
  <p>جارٍ فتح نتائج الرحلات...<br>Opening flight results on DT-Tours</p>
  <form id="f" method="POST" action="https://dt-tours.com/index.php/general/pre_flight_search" style="display:none">
    <input type="hidden" name="trip_type" value="${tripType}">
    <input type="hidden" name="sector_type" value="international">
    <input type="hidden" name="from_label" value="${from}">
    <input type="hidden" name="from" value="${from}">
    <input type="hidden" name="from_loc_id" value="${fromId}">
    <input type="hidden" name="from_loc_type" value="airport">
    <input type="hidden" name="to_label" value="${to}">
    <input type="hidden" name="to" value="${to}">
    <input type="hidden" name="to_loc_id" value="${toId}">
    <input type="hidden" name="to_loc_type" value="airport">
    <input type="hidden" name="depature" value="${depFormatted}">
    ${ret ? `<input type="hidden" name="return" value="${retFormatted}">` : ""}
    <input type="hidden" name="v_class" value="Economy">
    <input type="hidden" name="adult" value="${adults}">
    <input type="hidden" name="child" value="0">
    <input type="hidden" name="infant" value="0">
    <input type="hidden" name="search_flight" value="Search">
  </form>
  <script>
    setTimeout(function(){ document.getElementById('f').submit(); }, 400);
  </script>
</body>
</html>`);
});

export default router;
