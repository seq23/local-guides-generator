# Phase 4.5 — Multi-vertical named-city enrichment rollout

This pass extends the named-city enrichment pattern beyond USCIS Medical.

## What this phase covers
- PI named-city enrichment
- Dentistry named-city enrichment
- TRT named-city enrichment
- Neuro named-city enrichment

Priority city set in this pass:
- atlanta-ga
- chicago-il
- dallas-tx
- houston-tx
- los-angeles-ca
- miami-fl

## Runtime rule
- `data/city_content/<vertical>/<slug>.json` remains the city-intelligence layer.
- `data/listings/*.json` remains provider and sponsor runtime inventory.
- This phase does not stuff local intelligence into listing inventory.

## Validation
```bash
npm run validate:phase4.5:named-cities
```

## Why this exists
Phase 4 proved the named-city USCIS pattern. Phase 4.5 rolls the same structured local decision-support pattern into the other city-page verticals so the shared renderer has real cross-vertical local intelligence to work with.
