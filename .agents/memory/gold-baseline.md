---
name: Gold Baseline — Dar AlTamaiz Tours
description: User-confirmed working state. Restore here if anything breaks.
---

## Latest Gold Point
`772eea008097c7ab45c9cf5810b8d01469114129` — "Make email submission more robust by handling hotels data reliably"
**Confirmed working: June 13, 2026**

## Previous Gold Point
`3e41bb28158243734e7241b7d12a731c8b5dcd87` — "Improve login popup functionality using the website's exact JavaScript code"
**Confirmed working: June 12, 2026**

## What is working at this point

### Splash / Welcome screen
- Background rotates through 11 photos (`bg-01.jpg` … `bg-11.jpg`)
- Logo fades in with shimmer animation
- Two buttons:
  - **Log In / تسجيل دخول** → loads `https://dt-tours.com/?__app=login`, JS injection opens `#myModal_new_emp` and switches to the login panel (`.for_sign_in`)
  - **Continue as Guest / الدخول كزائر** → loads the home tab URL directly

### Login popup injection
- URL param `__app=login` triggers the injection (one-shot, URL cleaned immediately)
- Waits up to 6s for jQuery + Bootstrap to be ready (15 retries × 400ms)
- Uses the site's exact jQuery calls:
  ```javascript
  $('#myModal_new_emp').modal('show');
  $('.for_sign_up, .for_forgot').hide();
  $('.for_sign_in').show();
  $('.mysign').removeClass('max_wdth');
  ```
- Site: Bootstrap 3 + jQuery, server-rendered PHP (CodeIgniter). Modal id: `#myModal_new_emp`

### Special Requests (email)
- Endpoint: `POST /api/requests/submit`
- SMTP: Bluehost — all 5 env vars confirmed set (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_TO)
- End-to-end test passed: email delivered with messageId confirmed
- `hotels` input now safely normalised to array before `.map()` (bug fix in this gold point)
- ⚠️ API URL is dev (`sisko.replit.dev`) — works only while workspace is running. Deploy API server for 24/7 reliability.

### WebShell
- Bottom tab bar: Home, Tours, My Booking, Contact, Special Requests
- Custom mobile Chrome user agent
- `INJECTED_JS`: fixes `target="_blank"` links, routes `tel:`/`mailto:` to OS
- Hardware back button navigates WebView history
- Offline detection with toast + retry
- Skeleton loader on first page load

### Builds at this gold point
- APK (preview): `443708cc-1e0d-415d-a565-530e7be2a56f`
- AAB (production): `29d1eda8-66c4-47b8-ab1a-5724c49c88ca`

## Key files
- `artifacts/dar-altamaiz-tours/app/(tabs)/index.tsx` — main screen
- `artifacts/dar-altamaiz-tours/eas.json` — preview=APK, production=AAB
- `artifacts/dar-altamaiz-tours/components/SpecialRequestsScreen.tsx` — email form
- `artifacts/api-server/src/routes/requests.ts` — email API route

## How to restore
```bash
git --no-optional-locks checkout 772eea008097c7ab45c9cf5810b8d01469114129 -- \
  "artifacts/dar-altamaiz-tours/app/(tabs)/index.tsx" \
  "artifacts/api-server/src/routes/requests.ts"
```
Then run typecheck and build.

**Why:** User explicitly confirmed "everything is working fine" at both gold points.
