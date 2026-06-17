---
name: DTTours Website Scraping
description: How to scrape live package data from dt-tours.com (travelomatix PHP platform)
---

## Search flow
POST `https://dt-tours.com/holidays/index.php/tours/search`
with body `holiday_destination={destination}` (url-encoded, Referer header required).

## Extracting names + links from search results
The results carousel uses `.destpack` cards:
- Name: `.pname` span text
- Link: `a.v_det` href (points to `/holidays/index.php/tours/details/{id}`)

## Extracting price + full title from detail pages
Convert holiday URL to main site URL:
  `/holidays/index.php/tours/details/{id}` → `/index.php/tours/details/{id}`

On the main site detail page:
- Title: `h1` or `h2` (first heading, e.g. "Nature of Almaty in 6 days")
- Price: `h4.numm` text (e.g. "KWD 383.50") — also appears as `KWD (\d+\.\d+)` regex
- Nights: `/(\d+)\s*[Nn]ight/` regex

**Why:** The /holidays/ detail pages have JS-rendered headings (empty in static HTML).
The main site detail pages have static h1/h2 headings and h4.numm prices.

## Note on search filtering
The site returns ALL packages regardless of destination keyword — the dest param
seems to be a soft filter. GPT contextualises the results against the requested destination.
