---
name: Travelport uAPI Integration
description: Status and lessons from integrating Travelport uAPI live flight search into the Dar AlTamaiz Tours chatbot
---

## Current State (as of June 2026)

Backend endpoint `/api/flight-search` is fully built and registered. The status endpoint `/api/flight-search/status` returns `{configured, hasCredentials, hasPcc}`. The inline `FlightInlineSearch` component in ChatbotScreen.tsx auto-searches when a `[FLIGHT:...]` token is emitted and falls back to the redirect button if unconfigured.

## Credentials

- `FLIGHT_API_USER` — stored in Replit secrets, has zero-width space prefix (U+200B) which is stripped in code via `credentials.ts`
- `FLIGHT_API_PASS` — same invisible-char issue, stripped in code
- `TRAVELPORT_PCC` = `3m3o` — stored in Replit secrets, clean
- Credential cleaning happens in `artifacts/api-server/src/lib/credentials.ts`

**Why:** Copy-pasting from Arabic-language apps/PDFs/WhatsApp injects U+200B zero-width spaces. `credentials.ts` strips them so the app always uses clean values.

## Blocking Issue

Error 76 "Authentication credentials are invalid" on ALL endpoints:
- `https://emea.universal-api.travelport.com/B2BGateway/connect/uAPI/AirService` (production)
- `https://americas.universal-api.travelport.com/...`
- Both `.pp.travelport.com` sandbox equivalents

Password `cP!93&mD}f` is clean ASCII (verified byte-by-byte). Travelport support was contacted June 2026 — they asked "which URL are you using?" suggesting the endpoint may be wrong.

**Next step:** Get the correct endpoint URL from Travelport support. They may use a custom gateway, a different region path, or a versioned path like `/B2BGateway/connect/uAPI/v52_0/AirService`.

## Architecture

- SOAP request built in `flight-search.ts` using `fast-xml-parser` for response parsing
- `buildSoapEnvelope()` takes from, to, depDate, retDate, adults, pcc
- Targets `http://www.travelport.com/schema/common_v52_0` and `air_v52_0` namespaces
- Results parsed by `parseFlightResults()` — handles both old and new Travelport response shapes

## Flight Token Format

`[FLIGHT:KWI|Kuwait|DXB|Dubai|2026-09-01|2026-09-05|1]`
Parts: `[fromIATA, fromLabel, toIATA, toLabel, depDate, retDate, adults]`

## Fallback

When API returns error or PCC/credentials are missing, `FlightInlineSearch` falls back to the gold "✈️ ابحث عن رحلتك الآن" redirect button that auto-submits a POST form to dt-tours.com.
