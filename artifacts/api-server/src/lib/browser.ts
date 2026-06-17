import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { execSync } from "node:child_process";
import type { Browser, BrowserContext, Page } from "puppeteer";

puppeteerExtra.use(StealthPlugin());

function findChromium(): string {
  const candidates: Array<string | null | undefined> = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    tryWhich("chromium"),
    tryWhich("chromium-browser"),
    tryWhich("google-chrome-stable"),
    tryWhich("google-chrome"),
    "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
  ];
  for (const c of candidates) {
    if (c) return c;
  }
  throw new Error("No Chromium/Chrome executable found. Install chromium system dependency.");
}

function tryWhich(name: string): string | null {
  try {
    const p = execSync(`which ${name} 2>/dev/null`, { timeout: 3000 }).toString().trim();
    return p || null;
  } catch {
    return null;
  }
}

let _execPath: string | null = null;
function getExecPath(): string {
  if (!_execPath) _execPath = findChromium();
  return _execPath;
}

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-software-rasterizer",
  "--no-first-run",
  "--no-zygote",
  "--single-process",
  "--disable-blink-features=AutomationControlled",
  "--disable-features=IsolateOrigins,site-per-process",
  "--disable-site-isolation-trials",
  "--disable-web-security",
  "--allow-running-insecure-content",
  "--disable-extensions",
  "--disable-default-apps",
  "--disable-popup-blocking",
  "--disable-translate",
  "--disable-sync",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--window-size=1440,900",
  "--lang=en-US,en",
  "--accept-lang=en-US,en;q=0.9",
];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
];

export function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function applyStealthOverrides(page: Page, ua?: string): Promise<void> {
  const agent = ua ?? randomUA();
  await page.setUserAgent(agent);
  await page.setViewport({
    width: 1440 + Math.floor(Math.random() * 80),
    height: 900 + Math.floor(Math.random() * 60),
    deviceScaleFactor: 1,
    hasTouch: false,
    isLandscape: true,
    isMobile: false,
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", {
      get: () => [
        { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer", description: "Portable Document Format" },
        { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", description: "" },
        { name: "Native Client", filename: "internal-nacl-plugin", description: "" },
      ],
    });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en", "ar"] });
    Object.defineProperty(navigator, "platform", { get: () => "Win32" });
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
    Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });

    (window as Record<string, unknown>).chrome = {
      runtime: {},
      loadTimes: () => ({}),
      csi: () => ({}),
      app: {},
    };

    const origQuery = (window.navigator as Record<string, unknown>).permissions?.query;
    if (typeof origQuery === "function") {
      (window.navigator as Record<string, unknown>).permissions = {
        query: (parameters: { name: string }) =>
          parameters.name === "notifications"
            ? Promise.resolve({ state: Notification.permission })
            : (origQuery as (p: unknown) => Promise<unknown>)(parameters),
      };
    }

    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 0 });

    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter) {
      if (parameter === 37445) return "Intel Inc.";
      if (parameter === 37446) return "Intel Iris OpenGL Engine";
      return getParameter.call(this, parameter);
    };
  });

  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
  });
}

export function humanDelay(minMs = 400, maxMs = 900): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs));
  return new Promise((r) => setTimeout(r, ms));
}

let _browser: Browser | null = null;
let _launching = false;
const _waiters: Array<(b: Browser) => void> = [];

export async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;

  if (_launching) {
    return new Promise<Browser>((resolve) => {
      _waiters.push(resolve);
    });
  }

  _launching = true;
  try {
    _browser = await (puppeteerExtra as unknown as typeof import("puppeteer")).launch({
      headless: true,
      executablePath: getExecPath(),
      args: LAUNCH_ARGS,
      timeout: 30_000,
      ignoreHTTPSErrors: true,
    } as Parameters<typeof import("puppeteer").launch>[0]);

    _browser.on("disconnected", () => {
      _browser = null;
    });

    const b = _browser;
    for (const w of _waiters) w(b);
    _waiters.length = 0;
    return b;
  } finally {
    _launching = false;
  }
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}

/**
 * Create a page with a clean cookie slate for each scrape request.
 * createBrowserContext() crashes with --single-process Chromium, so we clear
 * cookies via CDP instead. This prevents stale travelomatix session cookies from
 * showing the payment page instead of search results.
 * Callers MUST call cleanup() in their finally block.
 */
export async function getFreshPage(): Promise<{ page: Page; context: BrowserContext; cleanup: () => Promise<void> }> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  // Clear all cookies so previous PHP sessions don't interfere
  try {
    const cdp = await page.createCDPSession();
    await cdp.send("Network.clearBrowserCookies");
    await cdp.detach();
  } catch { /* ignore — not fatal */ }

  return {
    page,
    context: browser.defaultBrowserContext(),
    cleanup: async () => { await page.close().catch(() => {}); },
  };
}
