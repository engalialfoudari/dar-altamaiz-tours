/**
 * Production server for Dar AlTamaiz Tours.
 *
 * Serves the Expo web build (web-dist/) as a full PWA with iOS meta tag
 * injection.  Native OTA manifest requests (expo-platform header) are still
 * routed to the legacy static bundle directory if present.
 *
 * Routes:
 *   /manifest.json          → web-dist/manifest.json  (PWA web manifest)
 *   /sw.js                  → web-dist/sw.js           (service worker)
 *   /icons/*                → web-dist/icons/
 *   /favicon.ico            → web-dist/favicon.ico
 *   /_expo/*, /assets/*     → web-dist/ static assets
 *   /robots.txt             → generated
 *   /sitemap.xml            → generated
 *   /llms.txt               → generated
 *   / or /manifest + expo-platform header → native OTA manifest
 *   /app and /app/          → web-dist/index.html  (Expo web app)
 *   /app/<asset>            → matching web-dist asset or static route
 *   everything else         → web-dist route or a true 404 page
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const WEB_ROOT       = path.resolve(__dirname, "..", "web-dist");
const OTA_ROOT       = path.resolve(__dirname, "..", "dist");
const TEMPLATES_ROOT = path.resolve(__dirname, "templates");
const basePath       = (process.env.BASE_PATH || "/").replace(/\/+$/, "");
const APP_ROUTE_PATH = "/app";
const WEB_APP_TITLE  = "DT Tours App - Your next trip starts here !";

// Expo Go deep link for the published project (owner/slug from app.json)
const EXPO_GO_PATH = "exp.host/@engalialfoudari/dttours";

// iOS / Android PWA meta tags injected into every HTML response.
//
// All hrefs are built from the request's mount prefix, not hardcoded to
// domain root. In production this service is only reachable at specific
// path prefixes (e.g. /app/, /mobile/) — everything outside those prefixes
// belongs to a different artifact. A root-absolute href like "/manifest.json"
// would silently resolve against that OTHER artifact's root and serve its
// (wrong) manifest/icons instead of ours, which is what caused iOS "Add to
// Home Screen" shortcuts to pick up the wrong icon.
function buildIosMeta(mountPrefix) {
  return [
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    `<meta name="apple-mobile-web-app-title" content="${WEB_APP_TITLE}">`,
    `<link rel="apple-touch-icon" href="${mountPrefix}/icons/icon-192.png">`,
    `<link rel="apple-touch-icon" sizes="512x512" href="${mountPrefix}/icons/icon-512.png">`,
    `<link rel="manifest" href="${mountPrefix}/manifest.json">`,
    '<meta name="theme-color" content="#0A1628">',
  ].join("\n  ");
}

function buildIosInstallPrompt(mountPrefix) {
  return `
<div id="dt-ios-install-prompt" class="dt-ios-install-prompt" hidden role="dialog" aria-modal="true" aria-labelledby="dt-ios-install-title">
  <div class="dt-ios-install-card">
    <button id="dt-ios-install-close" class="dt-ios-install-close" type="button" aria-label="Close / إغلاق">&times;</button>
    <img class="dt-ios-install-icon" src="${mountPrefix}/icons/icon-192.png" alt="">
    <h2 id="dt-ios-install-title">
      <span>Add D.T. Tours to your iPhone</span>
      <span class="dt-ios-install-arabic" lang="ar" dir="rtl">أضف D.T. Tours إلى جهاز iPhone</span>
    </h2>
    <p class="dt-ios-install-copy">
      <span>Keep D.T. Tours one tap away by adding a shortcut to your Home Screen.</span>
      <span class="dt-ios-install-arabic" lang="ar" dir="rtl">اجعل D.T. Tours في متناول يدك بإضافة اختصار إلى الشاشة الرئيسية.</span>
    </p>
    <div id="dt-ios-install-steps" class="dt-ios-install-steps" hidden>
      <p><strong>1.</strong> Tap the <strong>Share</strong> button in Safari.<br><span class="dt-ios-install-arabic" lang="ar" dir="rtl"><strong>١.</strong> اضغط زر <strong>المشاركة</strong> في Safari.</span></p>
      <p><strong>2.</strong> Choose <strong>Add to Home Screen</strong>.<br><span class="dt-ios-install-arabic" lang="ar" dir="rtl"><strong>٢.</strong> اختر <strong>إضافة إلى الشاشة الرئيسية</strong>.</span></p>
      <p><strong>3.</strong> Tap <strong>Add</strong>.<br><span class="dt-ios-install-arabic" lang="ar" dir="rtl"><strong>٣.</strong> اضغط <strong>إضافة</strong>.</span></p>
    </div>
    <button id="dt-ios-install-action" class="dt-ios-install-action" type="button">Show me how / أرني الطريقة</button>
  </div>
</div>
<style>
  .dt-ios-install-prompt {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: max(22px, env(safe-area-inset-top)) 22px max(22px, env(safe-area-inset-bottom));
    background: rgba(3, 12, 27, .76);
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .dt-ios-install-prompt[hidden] { display: none !important; }
  .dt-ios-install-card {
    position: relative;
    box-sizing: border-box;
    width: min(100%, 360px);
    padding: 28px 24px 24px;
    border: 1px solid rgba(207, 173, 96, .45);
    border-radius: 24px;
    background: #0a1628;
    box-shadow: 0 24px 70px rgba(0, 0, 0, .42);
    color: #fff;
    text-align: center;
  }
  .dt-ios-install-close {
    position: absolute;
    top: 10px;
    right: 12px;
    width: 36px;
    height: 36px;
    border: 0;
    background: transparent;
    color: rgba(255, 255, 255, .78);
    font-size: 28px;
    line-height: 34px;
  }
  .dt-ios-install-icon {
    width: 78px;
    height: 78px;
    border-radius: 18px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, .28);
  }
  .dt-ios-install-card h2 {
    margin: 16px 20px 8px;
    color: #fff;
    font-size: 22px;
    line-height: 1.25;
  }
  .dt-ios-install-arabic {
    display: block;
    margin-top: 4px;
    font-weight: 400;
  }
  .dt-ios-install-copy {
    margin: 0;
    color: rgba(255, 255, 255, .76);
    font-size: 15px;
    line-height: 1.5;
  }
  .dt-ios-install-copy .dt-ios-install-arabic {
    margin-top: 5px;
  }
  .dt-ios-install-steps {
    margin: 18px 0 0;
    padding: 14px 16px;
    border-radius: 14px;
    background: rgba(255, 255, 255, .07);
    text-align: left;
  }
  .dt-ios-install-steps p {
    margin: 7px 0;
    color: rgba(255, 255, 255, .9);
    font-size: 14px;
    line-height: 1.4;
  }
  .dt-ios-install-steps .dt-ios-install-arabic {
    margin-top: 3px;
  }
  .dt-ios-install-action {
    width: 100%;
    min-height: 48px;
    margin-top: 20px;
    border: 0;
    border-radius: 14px;
    background: #cfad60;
    color: #0a1628;
    font-size: 16px;
    font-weight: 700;
  }
</style>
<script>
  (function () {
    var ua = navigator.userAgent || "";
    var isIphoneOrIpad = /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var isStandalone = window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    if (!isIphoneOrIpad || isStandalone) return;

    var prompt = document.getElementById("dt-ios-install-prompt");
    var action = document.getElementById("dt-ios-install-action");
    var steps = document.getElementById("dt-ios-install-steps");
    var close = document.getElementById("dt-ios-install-close");
    if (!prompt || !action || !steps || !close) return;

    function dismiss() { prompt.hidden = true; }
    close.addEventListener("click", dismiss);
    action.addEventListener("click", function () {
      if (!steps.hidden) return dismiss();
      steps.hidden = false;
      action.textContent = "Got it / فهمت";
    });
    window.setTimeout(function () { prompt.hidden = false; }, 700);
  }());
</script>`;
}

const MIME_TYPES = {
  ".html":        "text/html; charset=utf-8",
  ".js":          "application/javascript; charset=utf-8",
  ".mjs":         "application/javascript; charset=utf-8",
  ".json":        "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".css":         "text/css; charset=utf-8",
  ".png":         "image/png",
  ".jpg":         "image/jpeg",
  ".jpeg":        "image/jpeg",
  ".gif":         "image/gif",
  ".svg":         "image/svg+xml",
  ".ico":         "image/x-icon",
  ".woff":        "font/woff",
  ".woff2":       "font/woff2",
  ".ttf":         "font/ttf",
  ".otf":         "font/otf",
  ".map":         "application/json",
};

function getAppName() {
  try {
    const appJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "app.json"), "utf-8"));
    return appJson.expo?.name || "D.T. Tours";
  } catch {
    return "D.T. Tours";
  }
}

/** Serve a raw binary/text file with correct content-type. */
function serveFile(filePath, res, extraHeaders = {}) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "content-type": contentType, ...extraHeaders });
  res.end(content);
}

/**
 * Serve an HTML file with iOS PWA meta tags injected immediately after <head>.
 * Falls back to web-dist/index.html if the file is missing.
 * @param {number} [statusCode=200] HTTP status to use for the response.
 */
function prefixAppAssetUrls(content) {
  return content
    .replace(/(["'])\/_expo\//g, "$1/app/_expo/")
    .replace(/(["'])\/assets\//g, "$1/app/assets/")
    .replace(/(["'])\/favicon\.ico/g, "$1/app/favicon.ico");
}

function serveHtml(filePath, res, statusCode = 200, appScoped = false, mountPrefix = "") {
  const target = fs.existsSync(filePath) ? filePath : path.join(WEB_ROOT, "index.html");
  try {
    let content = fs.readFileSync(target, "utf-8");
    content = content.replace(
      /<title(?:\s[^>]*)?>[\s\S]*?<\/title>/i,
      `<title>${WEB_APP_TITLE}</title>`
    );
    // Inject after the opening <head> tag (handles attributes like <head lang="en">)
    content = content.replace(/(<head(?:\s[^>]*)?>)/i, `$1\n  ${buildIosMeta(mountPrefix)}\n`);
    // Replace Expo's default viewport meta with one that prevents auto-zoom on
    // input focus and pinch-to-zoom (keeps layout stable when typing).
    content = content.replace(
      /<meta name="viewport"[^>]*>/i,
      '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">'
    );
    if (appScoped) {
      content = prefixAppAssetUrls(content);
      if (statusCode === 200) {
        content = content.replace(/<\/body>/i, `${buildIosInstallPrompt(mountPrefix)}\n</body>`);
      }
    }
    res.writeHead(statusCode, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, no-cache",
      "x-content-type-options": "nosniff",
    });
    res.end(content);
  } catch {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("Internal Server Error");
  }
}

/**
 * Serve a file from web-dist.
 *
 * Routing rules:
 *   - Existing file  → serve it (HTML with meta injection; assets with cache headers).
 *   - Directory      → serve the index.html inside it if present (Expo static export),
 *                      otherwise fall through to the 404 page.
 *   - Unknown path   → serve +not-found.html with a true HTTP 404 status so crawlers
 *                      never treat broken URLs as successful pages.
 */
function serveWebApp(pathname, res, appScoped = false, mountPrefix = "") {
  const safe = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(WEB_ROOT, safe);

  if (!filePath.startsWith(WEB_ROOT)) {
    res.writeHead(403, { "content-type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  const exists = fs.existsSync(filePath);
  const isDir  = exists && fs.statSync(filePath).isDirectory();

  if (isDir) {
    // Expo Router static export places each route's HTML at <route>/index.html.
    const indexInDir = path.join(filePath, "index.html");
    if (fs.existsSync(indexInDir)) {
      serveHtml(indexInDir, res, 200, appScoped, mountPrefix);
    } else {
      serveHtml(path.join(WEB_ROOT, "+not-found.html"), res, 404, appScoped, mountPrefix);
    }
    return;
  }

  if (!exists) {
    // Unknown path — true 404 using the pre-rendered not-found page.
    serveHtml(path.join(WEB_ROOT, "+not-found.html"), res, 404, appScoped, mountPrefix);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") {
    serveHtml(filePath, res, 200, appScoped, mountPrefix);
    return;
  }

  // Static asset — long-lived cache for hashed filenames
  if (appScoped && ext === ".js") {
    const content = prefixAppAssetUrls(fs.readFileSync(filePath, "utf-8"));
    res.writeHead(200, {
      "content-type": MIME_TYPES[ext],
      "cache-control": "no-cache",
    });
    res.end(content);
    return;
  }

  const isHashed = /[a-f0-9]{8,}/.test(path.basename(filePath));
  const cacheControl = isHashed
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600";

  serveFile(filePath, res, { "cache-control": cacheControl });
}

/**
 * Serve the static landing-page.html template for the public root (/),
 * substituting runtime placeholders for canonical URL and Expo deep link.
 * This gives crawlers (Googlebot, GPTBot, social previews, etc.) real
 * first-response HTML with a title, meta description, canonical tag,
 * Open Graph / Twitter Card tags, and visible H1 / body copy — without
 * depending on the JavaScript bundle to hydrate.
 */
function serveLandingPage(req, res, mountPrefix = "") {
  const templatePath = path.join(TEMPLATES_ROOT, "landing-page.html");
  if (!fs.existsSync(templatePath)) {
    // Graceful fallback: serve the SPA shell if the template is missing.
    serveHtml(path.join(WEB_ROOT, "index.html"), res, 200, false, mountPrefix);
    return;
  }
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const canonicalRoot = `${baseUrl}${basePath}/`;
    let content = fs.readFileSync(templatePath, "utf-8");
    content = content.replace(/BASE_URL_PLACEHOLDER\//g, canonicalRoot);
    content = content.replace(/BASE_URL_PLACEHOLDER/g, baseUrl + basePath);
    content = content.replace(/EXPS_URL_PLACEHOLDER/g, EXPO_GO_PATH);
    // Same rationale as buildIosMeta(): this page can be served from a mount
    // prefix (e.g. /mobile/) that this service doesn't otherwise own at
    // domain root, so manifest/icon/service-worker URLs must stay under it.
    content = content.replace(/ASSET_BASE_PLACEHOLDER/g, mountPrefix);
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, no-cache",
      "x-content-type-options": "nosniff",
    });
    res.end(content);
  } catch {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("Internal Server Error");
  }
}

/** Serve the native OTA update manifest (for expo-platform requests). */
function serveOtaManifest(platform, res) {
  const manifestPath = path.join(OTA_ROOT, platform, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `Manifest not found for platform: ${platform}` }));
    return;
  }
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.writeHead(200, {
    "content-type": "application/json",
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
  });
  res.end(manifest);
}

/**
 * Returns the canonical base URL for the site.
 *
 * In production, SITE_ORIGIN is set to the single authoritative domain
 * (e.g. "https://dar-altamaiz-tours.com") so canonical tags, sitemap <loc>
 * entries, and llms.txt links always point at one stable origin regardless of
 * which host (preview, staging, alternate) sent the request.
 *
 * In local development (no SITE_ORIGIN), we fall back to the incoming host
 * so the server still produces valid, clickable URLs.
 */
function getCanonicalBaseUrl(req) {
  if (process.env.SITE_ORIGIN) {
    return process.env.SITE_ORIGIN.replace(/\/+$/, "");
  }
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host  = req.headers["x-forwarded-host"] || req.headers["host"];
  return `${proto}://${host}`;
}

function serveRobotsTxt(req, res) {
  const baseUrl    = getCanonicalBaseUrl(req);
  const sitemapUrl = `${baseUrl}${basePath}/sitemap.xml`;
  const body = ["User-agent: *", "Allow: /", "", `Sitemap: ${sitemapUrl}`].join("\n");
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end(body);
}

function serveSitemapXml(req, res) {
  const baseUrl    = getCanonicalBaseUrl(req);
  const landingUrl = `${baseUrl}${basePath}/`;
  const now        = new Date().toISOString().split("T")[0];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "  <url>",
    `    <loc>${landingUrl}</loc>`,
    `    <lastmod>${now}</lastmod>`,
    "    <changefreq>monthly</changefreq>",
    "    <priority>1.0</priority>",
    "  </url>",
    "</urlset>",
  ].join("\n");
  res.writeHead(200, { "content-type": "application/xml; charset=utf-8" });
  res.end(body);
}

function serveLlmsTxt(req, res) {
  const baseUrl    = getCanonicalBaseUrl(req);
  const landingUrl = `${baseUrl}${basePath}/`;
  const body = [
    "# D.T. Tours",
    "",
    "> A premium mobile travel app for booking curated tours and travel experiences.",
    "",
    "D.T. Tours is a mobile application available on iOS and Android",
    "that lets travellers discover and book high-quality guided tours and travel packages.",
    "",
    "## Public pages",
    "",
    `- [App](${landingUrl}): Installable PWA and native app.`,
  ].join("\n");
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end(body);
}

// ─── Main request handler ──────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url         = new URL(req.url || "/", `http://${req.headers.host}`);
  const rawPathname = url.pathname;
  let pathname      = rawPathname;
  const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLowerCase();

  // The public production site must not be embedded by unrelated websites.
  // Keep Replit's development preview frameable so the workspace preview
  // continues to work while production receives strict anti-clickjacking
  // headers.
  if (forwardedHost === "dt-tour.com" || forwardedHost === "www.dt-tour.com") {
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
  }

  // This service can be reached at more than one external mount prefix in
  // production (e.g. /mobile/ via BASE_PATH-stripping below, and /app/ via
  // the explicit route further down) — or at true domain root in an
  // isolated deployment. mountPrefix records which one so every emitted
  // manifest/icon/service-worker URL can be built back under the SAME
  // prefix the browser is actually using, instead of a root-absolute path
  // that would escape to whatever other artifact owns "/".
  let mountPrefix = "";

  // Strip base path prefix (e.g. /dar-altamaiz-tours → /)
  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
    mountPrefix = basePath;
  } else if (rawPathname === APP_ROUTE_PATH || rawPathname.startsWith(`${APP_ROUTE_PATH}/`)) {
    mountPrefix = APP_ROUTE_PATH;
  }

  // ── Health check ───────────────────────────────────────────────────────
  if (pathname === "/status") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // ── Utility routes ─────────────────────────────────────────────────────
  if (pathname === "/robots.txt")  return serveRobotsTxt(req, res);
  if (pathname === "/sitemap.xml") return serveSitemapXml(req, res);
  if (pathname === "/llms.txt")    return serveLlmsTxt(req, res);

  // ── PWA manifest (serves web-dist/manifest.json) ───────────────────────
  if (pathname === "/manifest.json" || pathname === "/manifest.webmanifest") {
    return serveFile(path.join(WEB_ROOT, "manifest.json"), res, {
      "cache-control": "public, max-age=86400",
      "access-control-allow-origin": "*",
    });
  }

  // ── Service worker ─────────────────────────────────────────────────────
  if (pathname === "/sw.js") {
    return serveFile(path.join(WEB_ROOT, "sw.js"), res, {
      "cache-control": "no-cache, no-store",
      "service-worker-allowed": "/",
    });
  }

  // ── PWA icons ──────────────────────────────────────────────────────────
  if (pathname.startsWith("/icons/")) {
    const iconName = path.basename(pathname);
    const iconPath = path.join(WEB_ROOT, "icons", iconName);
    return serveFile(iconPath, res, { "cache-control": "public, max-age=604800" });
  }

  // ── Favicon ────────────────────────────────────────────────────────────
  if (pathname === "/favicon.ico") {
    return serveFile(path.join(WEB_ROOT, "favicon.ico"), res, {
      "cache-control": "public, max-age=86400",
    });
  }

  // ── Native OTA manifest (expo-platform header) ─────────────────────────
  if (pathname === "/" || pathname === "/manifest") {
    const platform = req.headers["expo-platform"];
    if (platform === "ios" || platform === "android") {
      return serveOtaManifest(platform, res);
    }
  }

  // ── Public root — same crawlable landing page for all visitors ──────────
  // Serving identical HTML to browsers and crawlers avoids split-delivery
  // fragility (fragile UA regex, Googlebot misses, 2 MB+ JS bundle fallback)
  // and lets the root build first-party search equity on this domain.
  //
  // The landing-page.html is also the full PWA shell: it has its own
  // standalone-mode branch (shows the navigation cards when launched from the
  // iOS Home Screen), iOS PWA meta tags, a web-app manifest link, and a
  // service-worker registration — so existing PWA installs continue to work.
  //
  // Users who want the Expo web app directly can reach it at /app.
  if (pathname === "/") {
    return serveLandingPage(req, res, mountPrefix);
  }

  // ── /app — Expo web app ─────────────────────────────────────────────────
  // Keep the public landing page at / while making both /app and /app/
  // valid entry points for the Expo web build. Assets and pre-rendered routes
  // beneath /app resolve against web-dist without leaking the /app prefix into
  // the filesystem lookup.
  if (pathname === APP_ROUTE_PATH || pathname.startsWith(`${APP_ROUTE_PATH}/`)) {
    const appPathname = pathname.slice(APP_ROUTE_PATH.length) || "/";
    if (appPathname === "/") {
      return serveHtml(path.join(WEB_ROOT, "index.html"), res, 200, true, mountPrefix);
    }
    return serveWebApp(appPathname, res, true, mountPrefix);
  }

  // ── Web app (all other browser requests) ──────────────────────────────
  serveWebApp(pathname, res);
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`Serving D.T. Tours PWA on port ${port}`);
});
