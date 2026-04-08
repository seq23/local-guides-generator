# Guide Rendering and Content Flow

## Source of truth

Guide content is stored as structured JSON under `data/global_pages/` and related folders.

## Flow

1. guide JSON is edited or generated
2. `scripts/sync_guides.js` normalizes filenames and hub relationships
3. `scripts/build_city_sites.js` renders guide pages and hub pages
4. validators check routing, page contracts, and coverage depth

## Do not do this

Do not manually duplicate rendered guide HTML in `dist/`. Edit the source JSON and rebuild.


## Answer Surface Authority Upgrade
All major public surfaces now require a stronger answer-first layer. Existing short-answer / citation-summary surfaces remain the canonical answer zone, but they must now (1) appear before the evaluation framework when present, (2) include explicit decision language, (3) include contrast or tradeoff language, and (4) remain visually dominant over tertiary support rails.
