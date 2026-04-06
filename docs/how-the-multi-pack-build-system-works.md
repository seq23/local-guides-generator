# How the Multi-Pack Build System Works

## Core idea

This repo supports multiple vertical packs from one shared generator. A pack is selected through `PAGE_SET_FILE`, resolved into active site state by `scripts/prepare_site.js`, and then rendered by `scripts/build_city_sites.js`.

## Build sequence

1. select a page set
2. write active site state to `data/site.json`
3. build the active site into `dist/`
4. emit sitemap, llms.txt, redirects, and IndexNow artifacts
5. validate page contracts, routing, and release rules

## Cross-pack build

`npm run build:all` builds the supported packs in a deterministic sequence. `dist/` is intentionally overwritten during each pass so pack-specific breakage is surfaced instead of hidden.
