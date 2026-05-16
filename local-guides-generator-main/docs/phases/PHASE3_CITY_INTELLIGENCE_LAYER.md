# PHASE3_CITY_INTELLIGENCE_LAYER.md

Phase 3 upgrades `data/city_content/<vertical>/<slug>.json` from a light optional supplement into the structured city-intelligence layer.

## What changed
- added machine-readable template schema files under `data/templates/`
- required vertical-extension keys for city enrichment files
- upgraded city renderer output so local decision-support modules render with clearer titles and a dedicated city-intelligence marker
- added a hard-fail validator for city-intelligence contracts

## Runtime rule
- `data/listings/*.json` remains provider / sponsor runtime inventory
- `data/city_content/<vertical>/<slug>.json` is the source of truth for local decision-support enrichment

## Phase 3 scope
This phase does not mass-populate every city. It establishes the runtime layer, validator law, and enriched golden examples so future city population can scale without patchwork.
