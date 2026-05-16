# Phase 1 — Answer-Shape Externalization

## What this pass does

This pass moves guide opening/enhancement control out of a renderer-only constant and into a data-backed registry.

## Files added

- `data/contracts/guide_enhancement_registry.json`
- `scripts/validation/phase1_answer_shape_registry.js`

## Files changed

- `scripts/build_city_sites.js`
- `package.json`

## Contract

- guide enhancement entries are keyed by normalized guide route
- each entry must include: `heading`, `best`, `key`, `mistake`, `good`, `ask`
- every route present in `guide_answer_shape_contract.json` must also exist in the enhancement registry

## Runtime behavior

- renderer keeps legacy hardcoded enhancements as a compatibility fallback
- external registry now overrides/controls answer-shape opening copy when present
- future improvements should be made in the registry first, not by editing renderer constants directly
