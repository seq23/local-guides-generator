# Phase 5 — Validator uplift

Goal: extend the existing validator surface without creating a second competing validator system.

This phase adds precise validators around the new structured layers created in Phases 0A through 4.5:

- `city_content_schema_contract.js`
- `city_content_location_contract.js`
- `city_market_depth_contract.js`
- `guide_answer_shape_contract.js`
- `guide_family_shape_contract.js`
- `guide_enhancement_registry_contract.js`

Enforcement split:

- hard-fail for structural/runtime integrity
- audit/report output for broad retrofit visibility

This phase is intended to keep source-of-truth drift from re-entering the repo while avoiding random patch-loop behavior.
