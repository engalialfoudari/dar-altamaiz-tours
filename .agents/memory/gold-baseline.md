---
name: Gold Baseline — Dar AlTamaiz Tours
description: User-confirmed working state. Restore here if anything breaks.
---

## Latest Gold Point
`9679cd8f4fff5801ec3206f69d0c357989701902` — "Add AI travel chatbot with floating widget"
**Confirmed working: June 13, 2026**

## Previous Gold Point
`772eea008097c7ab45c9cf5810b8d01469114129` — "Make email submission more robust by handling hotels data reliably"
**Confirmed working: June 13, 2026**

## What is working at this point

### Splash / Welcome screen
- Background rotates through 11 photos
- Logo fades in with shimmer animation
- Two buttons: Log In / تسجيل دخول → login popup; Continue as Guest / الدخول كزائر

### Login popup injection
- `__app=login` URL param → waits for jQuery/Bootstrap → opens `#myModal_new_emp` → switches to `.for_sign_in`

### AI Chatbot — "تميز / Tamaiz" (IN-APP)
- Floating FAB button: Kuwaiti man face (ghitra + iqal SVG), gold border, black bg
- Opens a bottom sheet modal with language picker (Arabic 🇰🇼 / English 🇬🇧) on first open
- After language selection: AI greets in selected language
- Backend: `POST /api/chat/message` (non-streaming, returns full JSON) using gpt-5.1
- Persona: friendly Kuwaiti travel advisor, Kuwaiti dialect Arabic + English
- Escalation: after 8 user messages OR AI detects disengagement → WhatsApp CTA banner shown
- AI appends `[WHATSAPP]` signal when it detects user is wasting time/not interested → inline WhatsApp button shown on that message
- WhatsApp: wa.me/96590087797 (90087797 Kuwait)
- FAB only visible in shell phase (after welcome screen), Android only

### AI Chatbot — Website Widget
- `GET /api/chat-widget.js` — self-contained JS bundle (serve with `<script src="...">`)
- Floating gold chat bubble (bottom-right corner), pulsing badge
- Streams responses via SSE (`POST /api/chat`)
- Auto-detects Arabic/English from page language
- Same Tamaiz persona + WhatsApp escalation

### Special Requests (email)
- `POST /api/requests/submit` — SMTP via Bluehost, end-to-end tested ✅
- Hotels input normalised to array

### WebShell
- Bottom tab bar: Home, Tours, My Booking, Contact, Special Requests
- Back navigation, offline detection, skeleton loader

### Builds at previous gold point
- APK (preview): `443708cc-1e0d-415d-a565-530e7be2a56f`
- AAB (production): `29d1eda8-66c4-47b8-ab1a-5724c49c88ca`
- ⚠️ New build needed to include chatbot in APK/AAB

## Key files
- `artifacts/dar-altamaiz-tours/app/(tabs)/index.tsx` — main screen + chatbot FAB
- `artifacts/dar-altamaiz-tours/components/ChatbotScreen.tsx` — full chatbot modal + KuwaitiManIcon
- `artifacts/api-server/src/routes/chat.ts` — chat endpoints (streaming + sync) + system prompt
- `artifacts/api-server/src/routes/chat-widget.ts` — website widget JS
- `artifacts/dar-altamaiz-tours/eas.json` — preview=APK, production=AAB

## Website embed snippet
```html
<script src="https://[DEPLOYED_API_URL]/api/chat-widget.js" defer></script>
```
Replace `[DEPLOYED_API_URL]` with the permanent API server domain after deploying.

## How to restore to previous gold point
```bash
git --no-optional-locks checkout 772eea008097c7ab45c9cf5810b8d01469114129 -- \
  "artifacts/dar-altamaiz-tours/app/(tabs)/index.tsx" \
  "artifacts/api-server/src/routes/requests.ts"
```
