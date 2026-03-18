# Phase 3 Wave 1 — USCIS Execution Runbook

## Purpose

This runbook documents the first real coverage-population wave for `uscis-medical`.

Wave 1 is the proof that the planning framework can be converted into real runtime coverage without introducing a parallel city-page system.

## Authoritative inputs

Wave 1 depends on these files:

- `data/research/coverage/coverage_promoted.csv`
- `data/research/coverage/coverage_runtime_support.csv`
- `data/example_providers/uscis_medical/*.json`
- `data/listings/*.json`

## Current promoted Wave 1 cities

- `houston-tx`
- `miami-fl`
- `chicago-il`
- `atlanta-ga`
- `phoenix-az`
- `seattle-wa`

## Core rule

These cities must render through the **existing city-page generator path**.

Do not:
- create a special Phase 3 template
- create “light” city pages
- bypass existing page blocks
- add provider links to the example-providers block

## Required Wave 1 contracts

For each promoted city:

1. provider dataset exists
2. listing/runtime support exists
3. city page renders at `dist/<city-slug>/index.html`
4. page appears in `dist/sitemap.xml`
5. page is linked from the existing hub/home surface
6. example providers render as text only (zero outbound provider links)
7. the current city-page blocks remain present:
   - FAQ block
   - state lookup block
   - request-assistance CTA

## Standard commands

```bash
npm run build:all
npm run postbuild
LKG_VALIDATE_DIST=1 npm run validate:all
```

## Batch sequence for this wave

### Batch 1 — promotion layer
Declare promoted USCIS cities in `coverage_promoted.csv`.

### Batch 2 — provider layer
Add provider datasets.

### Batch 2A — provider realism pass
Replace synthetic or placeholder names with real providers.

### Batch 3 — runtime support layer
Bind promoted cities to provider + listing artifacts in `coverage_runtime_support.csv`.

### Batch 4 — publication
Publish promoted cities through the existing city generator.

### Batch 5 — runtime parity validator
Hard-fail on missing pages, missing sitemap entries, missing hub visibility, or linked provider leakage.

### Batch 6 — runbooks and handoff
Document the execution path and expansion rules before broader scale-up.

## Owner sign-off rule

Do not begin broader USCIS expansion until Wave 1 passes all current validators cleanly.
