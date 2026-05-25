# Phase 7 Release Notes

- Generated: 2026-05-25T18:35:00.747Z
- Active site: https://uscisexam.com
- Active page set: data/page_sets/examples/uscis_medical_v1.json
- Active vertical: uscis_medical

## What this phase adds

- Machine-readable PR review summary for the current repo state.
- Changed-surface summary grouped by layer and vertical.
- Click-audit target list for manual post-build review.
- Release watchlist used by release guard.

## Current structural counts

- Guide registry routes: 57
- City content records: 88
- Recommendation records: 36
- PDFs normalized: 5

## Highest-priority review buckets

- pi · citation-repair-city-content · 12
- dentistry · citation-repair-city-content · 6
- neuro · citation-repair-city-content · 6
- trt · citation-repair-city-content · 6
- uscis_medical · citation-repair-city-content · 6

## Active-vertical batch focus

- citation-repair-city-content: 6 recommended fixes

## Click-audit target count

- 22 targets listed in reports/phase7_click_audit_targets.json

## Release watchlist

- package.json
- data/site.json
- data/contracts/guide_answer_shape_contract.json
- data/contracts/guide_enhancement_registry.json
- data/contracts/layer_source_of_truth_map.json
- reports/phase6_pdf_recommendations.summary.json
- reports/phase6_recommendation_batches.json
- scripts/build_city_sites.js
- scripts/prepare_site.js
- scripts/validate_core.js
- scripts/validate_llm_surface.js
- scripts/validate_coverage_parity.js
- scripts/reference/generate_from_candidates.js
- scripts/release/build_phase7_review_bundle.js
- scripts/release/build_phase7_release_notes.js

