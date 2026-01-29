# Local Guides Generator — Canonical Base (v7)

This repo generates static “Template-Backed Sites (TBS)” for multiple verticals using a **pack** system.

## How it works

- `templates/` — canonical layouts (engine)
- `assets/` — canonical CSS/JS (engine)
- `scripts/` — build engine + validator
- `data/` — base content + packs + cities + taxonomy + advertising config
- `dist/` — build output (never hand-edit)

### Engine vs. packs

- **Engine:** templates + scripts + shared global pages (the default starter site)
- **Packs:** JSON page sets that define a vertical: routes, taxonomy, FAQs, city nav, and optional per-vertical global pages
- **Examples:** deploy-ready packs under `data/page_sets/examples/` (PI, dentistry, neuro, TRT, USCIS medical)

## Build and validate

1) Build:

  npm run build

2) Validate (postbuild, checks `dist/`):

  npm run validate

## Switching packs

The active pack is selected by `data/site.json`:

- `data/site.json.pageSetFile` controls which pack builds.
- By default this repo ships with:
  - `starter_v1.json` (safe, industry-agnostic)

Examples you can build by setting `pageSetFile`:

- `pi_v1.json`
- `dentistry_v1.json`
- `neuro_v1.json`
- `trt_v1.json`
- `uscis_medical_v1.json`

Pack resolution order is:

- `data/page_sets/<pageSetFile>`
- fallback: `data/page_sets/examples/<pageSetFile>`

## Advertising

- Source of truth: `data/ad_placements.json`
- Pages place ads via tokens like: `%%AD:global_home_hero%%`
- The build injects canonical sponsor-stack blocks and labels them “Advertising”.

Sponsor data lives in:

- `data/sponsors/global.json`
- `data/sponsors/<city-slug>.json`

## No-drift rules

- SOP: `docs/TBS_SOP.md`
- Master addendum: `docs/MASTER_INDEX_ADDENDUM_NO_DRIFT.md`
- v7 locks: `docs/V7_LOCK_SHEET.md`
- v7 validation gates: `docs/V7_VALIDATION_GATES.md`
