# Weather Check

A hourly-forecast comparison tool, originally built to sanity-check conditions
before a drone shoot. Defaults to the device's location (falls back to Glen
Ridge, NJ) and today's date; pick any other location/date instead.

## Pages

- **`index.html`** (home) — "Most likely forecast": the per-hour median across
  the 6 Open-Meteo model sources, with a shaded min–max spread band showing how
  much the models disagree, plus a 4-part-of-day summary.
- **`models.html`** — full side-by-side comparison of all 7 individual sources
  (temperature, precipitation chance, wind speed/gusts, UV index, cloud cover):
  - National Weather Service (NDFD)
  - Open-Meteo "Best Match" blend
  - GFS (NOAA)
  - ECMWF
  - ICON (DWD)
  - UKMO
  - GEM (ECCC)

All data is fetched live, client-side, straight from the National Weather Service
and Open-Meteo public APIs on every page load — there's no backend and nothing is
hardcoded or cached server-side (results are cached in the browser via
`sessionStorage` for 10 minutes so switching dates or pages stays snappy).

## Why multiple sources

Most consumer weather apps and sites repackage the same 2-3 underlying models, and
many render forecasts via JavaScript that can't be scraped. This instead queries
the actual models directly for real source diversity, then flags where a model
has no data for the requested date/location (some only forecast ~7-16 days out,
don't cover locations outside the US, or don't publish certain variables like
hourly precipitation probability or UV index at all).

## Files

- `index.html`, `models.html` — the two pages, sharing `style.css` and `weather-core.js`
- `weather-core.js` — fetch/consensus/geocoding logic and the location+date control wiring, shared by both pages
- `style.css` — shared styles (light/dark theme, responsive layout for mobile/tablet/desktop)
- `favicon.svg` / `favicon.ico` / `apple-touch-icon.png` — site icon

## Local dev

Static files with no build step — open `index.html` directly in a browser, or
serve the directory with any static file server.

## Deploy

Deployed on Vercel as a static site (no build command needed).
