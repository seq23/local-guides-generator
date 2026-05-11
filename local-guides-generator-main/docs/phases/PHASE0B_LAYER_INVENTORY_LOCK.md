# Phase 0B — Layer Inventory Lock

Date: 2026-04-30

## Purpose

Phase 0B locks the source-of-truth map before any deeper answer-shape retrofit work.

This phase does **not** redesign guide rendering or city modules yet.
It creates a hard-fail inventory contract so the repo cannot drift across the wrong layers.

## What this phase enforces

- `data/page_sets/examples/*_global_pages/*.json` remains the pack-specific guide source layer.
- `data/global_pages/*.json` remains the shared global-page layer.
- `data/listings/*.json` remains runtime provider and sponsor inventory.
- `data/city_content/<vertical>/<slug>.json` remains the city enrichment layer.
- `data/city_content/*.json` root drift is forbidden.
- city enrichment keys must not be added directly to `data/listings/*.json`.
- example provider datasets remain vertically scoped under `data/example_providers/<vertical>/`.

## Files added in Phase 0B

- `data/contracts/layer_source_of_truth_map.json`
- `scripts/validation/phase0b_layer_inventory_contract.js`

## Validation entrypoint

```bash
npm run validate:phase0b:layers
```

## Notes

This phase is intentionally narrow.
It is a boundary-lock pass, not the answer-shape or city intelligence implementation pass.
