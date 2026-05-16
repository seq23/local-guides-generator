# Phase 4 — Named-city enrichment first

This phase enriches the first named-city USCIS medical set so the repo has real local examples for the highest-priority city markets before broader rollout.

Priority set in this pass:
- atlanta-ga
- chicago-il
- dallas-tx
- houston-tx
- los-angeles-ca
- miami-fl

Contract:
- city enrichment stays under `data/city_content/<vertical>/<slug>.json`
- `data/listings/*.json` remains runtime provider and sponsor inventory
- each priority city must have non-empty local decision-support fields rather than placeholder arrays

This pass is intentionally narrow. It creates a golden named-city set that future city expansion can copy.
