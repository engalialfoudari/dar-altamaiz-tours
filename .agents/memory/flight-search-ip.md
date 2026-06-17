---
name: Flight Search IP Restriction
description: dt-tours.com flight GDS ignores searches from non-Kuwait IPs; fix is device-side search from the mobile app
---

## Rule
Never do flight searches from the Replit server. The mobile app itself must make all dt-tours.com flight search requests directly from the user's device.

## Why
dt-tours.com uses a travelomatix CMS that routes GDS queries based on origin IP. Any search submitted from a US/EU IP (Replit servers) returns `{status: 0, data: []}` indefinitely — the GDS simply never processes it. Searches from Kuwait IPs (the user's phone) return `{status: 1, data: {col_x: {...}}}` with real flight cards.

Confirmed: search 17223 submitted by user's real Kuwait browser → returned KU/EY/FZ flights (KWD 71.7+). Our server searches 17225–17228 → always empty after 3+ minutes.

## How to apply
`FlightInlineSearch` in `ChatbotScreen.tsx` calls dt-tours.com **directly from the device**:
1. `GET /index.php/ajax/get_airport_code_list?term={IATA}` — resolve airport IDs
2. `POST /index.php/general/pre_flight_search` — submit search form; follow redirect to get `search_id`
3. Poll `GET /index.php/ajax/flight_list?booking_source=PTBSID0000000016&search_id={id}&op=load` every 3s
4. When `status === 1`, parse `data.col_x` HTML fragments with `parseFlightCards()` regex parser
5. No cookies required — `flight_list` data is publicly accessible once the GDS processes the search

The `flight-scrape` server route still exists but is no longer called by the mobile app.

## Key constants
- booking_source: `PTBSID0000000016`
- Flight list URL: `/index.php/ajax/flight_list`
- Search form action: `/index.php/general/pre_flight_search`
- Date format for form: `DD/MM/YYYY` (note: field name is `depature` — typo in site)
