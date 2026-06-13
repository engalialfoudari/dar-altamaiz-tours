---
name: Gold Baseline — Dar AlTamaiz Tours
description: User-confirmed working state of the app. Restore to this point if anything breaks.
---

## Commit
`3e41bb28158243734e7241b7d12a731c8b5dcd87` — "Improve login popup functionality by using the website's exact JavaScript code"

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

### WebShell
- Bottom tab bar: Home, Tours, My Booking, Contact, Special Requests
- Custom mobile Chrome user agent
- `INJECTED_JS`: fixes `target="_blank"` links, routes `tel:`/`mailto:` to OS
- Hardware back button navigates WebView history
- Offline detection with toast + retry
- Skeleton loader on first page load

### Builds confirmed
- APK (preview profile): `9a10183a-29f8-48f6-986f-43ab6dbfe4d8`
- AAB (production profile): `f1a08e9e-6dc7-4e5c-a3f1-55676cd2e4f8`

## Key files
- `artifacts/dar-altamaiz-tours/app/(tabs)/index.tsx` — main screen (1008 lines at this point)
- `artifacts/dar-altamaiz-tours/eas.json` — preview=APK, production=AAB

## How to restore
```bash
git --no-optional-locks checkout 3e41bb28158243734e7241b7d12a731c8b5dcd87 -- "artifacts/dar-altamaiz-tours/app/(tabs)/index.tsx"
```
Then run typecheck and build.

**Why:** User explicitly confirmed "everything is working fine" at this point.
