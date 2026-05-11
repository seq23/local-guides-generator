# Phase 8 — Validator Tiering and Final Check

This pass simplifies validator execution into three practical tiers:

- hard fail: structural/runtime integrity and release-blocking contract checks
- warning: quality/shape checks that should inform improvements without blocking deploy
- developer: maintainer-facing diagnostics that should not surface as client-facing release blockers

## What changed

- Added `data/contracts/validator_tiering_policy.json`
- Added validator inventory generation
- Added tier runner for hard-fail, warning, and developer execution
- Updated `validate:all` to run the Phase 8 tier contract and hard-fail tier only
- Added separate scripts for warnings, developer checks, and final QA

## Intent

The goal is to stop validator hell without removing structural protection.
Release blocking stays strict. Quality guidance remains visible. Developer diagnostics are preserved but separated.
