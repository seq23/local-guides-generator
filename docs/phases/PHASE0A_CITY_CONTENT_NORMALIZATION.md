# Phase 0A — City Content Normalization

## Goal
Normalize `data/city_content` so the repo uses the vertical-scoped contract consistently.

## What changed
- moved root-level PI city enrichment files into `data/city_content/pi/`
- removed loader fallback to `data/city_content/<slug>.json`
- added `validate:phase0a:city-content`
- added a validator that hard-fails if root-level city JSON files reappear

## Files moved
- `data/city_content/atlanta-ga.json` → `data/city_content/pi/atlanta-ga.json`
- `data/city_content/chicago-il.json` → `data/city_content/pi/chicago-il.json`
- `data/city_content/houston-tx.json` → `data/city_content/pi/houston-tx.json`

## Why
The generator/scaffold contract expects `data/city_content/<vertical>/<slug>.json`. Root-level city enrichment files created ambiguity and made the source-of-truth map inconsistent.
