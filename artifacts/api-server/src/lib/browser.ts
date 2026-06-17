import puppeteer, { type Browser } from "puppeteer";
import { execSync } from "node:child_process";

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
    const p = execSync(`which ${name} 2>/dev/null`).toString().trim();
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
  "--disable-extensions",
  "--disable-default-apps",
  "--disable-translate",
  "--disable-sync",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--window-size=1280,900",
];

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
    _browser = await puppeteer.launch({
      headless: true,
      executablePath: getExecPath(),
      args: LAUNCH_ARGS,
      timeout: 30_000,
    });

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
