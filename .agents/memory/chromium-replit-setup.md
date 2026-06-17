---
name: Chromium in Replit (puppeteer)
description: How to get puppeteer + headless Chrome working in the Replit container environment
---

## Rule
Use system Chromium installed via Nix + `PUPPETEER_SKIP_DOWNLOAD=true` — never rely on puppeteer's auto-download.

## Why
Puppeteer's postinstall script fails to download Chrome in Replit because:
1. `unzip` is not in the default PATH (required for `.zip` extraction of Chrome)
2. Google CDN downloads may be blocked from the container

## How to apply

1. Add to `pnpm-workspace.yaml` → `onlyBuiltDependencies: [puppeteer]`
2. Install system deps via `installSystemDependencies({ packages: ["chromium", "unzip"] })`
3. Add to root `.npmrc`:
   ```
   PUPPETEER_SKIP_DOWNLOAD=true
   PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
   ```
4. In `browser.ts`, use `executablePath` pointing to system Chromium:
   - `execSync("which chromium 2>/dev/null")` to discover the path at runtime
   - Fallback: `/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium` (may change with nix updates)
5. Launch args must include `--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --single-process`

## dt-tours.com form fields (for reference)

**Flight form** (`id="flight_form"`, action=`/index.php/general/pre_flight_search`):
- `#from` (name=`from_label`), `#from_val` (name=`from`), `#from_loc_id`, `#from_loc_type`
- `#to` (name=`to_label`), `#to_val` (name=`to`), `#to_loc_id`, `#to_loc_type`
- `#flight_datepicker1` (name=`depature` — typo), `#flight_datepicker2` (name=`return`) — both readonly; remove attr before set
- Date format: `DD/MM/YYYY`; `#trip_type_id` values: `"circle"` / `"oneway"`

**Hotel form** (`id="hotel_search"`, action=`/index.php/general/pre_hotel_search`):
- `#hotel_destination_search_name` (name=`city`), `#hot_id_dest` (name=`hotel_destination`)
- `#hotel_checkin`, `#hotel_checkout` — readonly; date format `DD-MM-YYYY`

## Scraping strategy
Use direct JS injection (`page.evaluate(...)`) to set all form field values — do NOT interact with autocomplete dropdowns. Submit via `form.submit()`. Both approaches are more reliable than simulating UI interaction in headless mode.
