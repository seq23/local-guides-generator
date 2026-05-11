# Phase 7 — PR Review and Release Safety Alignment

Phase 7 adds the repo-native review surface for Local Guides Generator.

This phase does **not** add an admin workflow. It adds deterministic artifacts for human repo review before snapshot updates:

- `reports/phase7_pr_review_summary.json`
- `reports/phase7_changed_surfaces_summary.json`
- `reports/phase7_click_audit_targets.json`
- `reports/phase7_snapshot_release_notes.md`
- `docs/releases/CRITICAL_SURFACES.json`

## Purpose

The goal is to make pre-update review easier by showing:

- what layer changed
- which verticals are carrying the current recommendation load
- which surfaces should be clicked first
- which files are treated as release-critical by the release guard

## Contract

Phase 7 is valid only if:

1. the review bundle files exist
2. the active site and active page set are recorded
3. top review buckets are machine-readable
4. click-audit targets are generated
5. the release watchlist exists and is usable by `scripts/release_guard.js`

## Notes

This is a review-safety layer, not a publishing layer.
