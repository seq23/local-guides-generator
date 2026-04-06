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
