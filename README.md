# Glen Ridge Weather Check

A single-page hourly forecast comparison for Glen Ridge, NJ — built to sanity-check
conditions before a drone shoot.

Pick any date and it compares hourly temperature, precipitation chance, and
conditions across 7 independent forecast sources:

- National Weather Service (NDFD)
- Open-Meteo "Best Match" blend
- GFS (NOAA)
- ECMWF
- ICON (DWD)
- UKMO
- GEM (ECCC)

All data is fetched live, client-side, straight from the National Weather Service
and Open-Meteo public APIs on every page load — there's no backend and nothing is
hardcoded or cached server-side.

## Why multiple sources

Most consumer weather apps and sites repackage the same 2-3 underlying models, and
many render forecasts via JavaScript that can't be scraped. This instead queries
the actual models directly for real source diversity, then flags where a model
has no data for the requested date (some only forecast ~7-16 days out, or don't
publish hourly precipitation probability at all).

## Local dev

It's a single static `index.html` with no build step — open it directly in a
browser, or serve it with any static file server.

## Deploy

Deployed on Vercel as a static site (no build command needed).
