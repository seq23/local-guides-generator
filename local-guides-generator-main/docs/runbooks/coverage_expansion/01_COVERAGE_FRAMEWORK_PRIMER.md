# Coverage Framework Primer

## Purpose

Phase 2 creates a planning layer for weak verticals without publishing new city pages.

This framework exists to answer four questions:

1. Which cities matter next for national footprint?
2. Which target cities already have provider data?
3. Which target cities already have listing runtime support?
4. Which targets are blocked and why?

## Phase boundary

This framework is for:
- `neuro`
- `trt`
- `uscis-medical`

This framework does **not** change:
- `personal-injury`
- `dentistry`

This framework does **not**:
- publish new city pages
- change sitemap output
- change hub rendering
- enforce coverage count quotas

## Authority model

### Active planning files
- `data/research/coverage/coverage_targets.csv`
- `data/research/coverage/coverage_rules.json`

### Passive scaffold
- `data/research/shared/us_city_registry.csv`

The shared city registry is future leverage only. It does not control runtime.

## Validation philosophy

Hard-fail only on planning integrity:
- malformed rows
- duplicate `vertical + city_slug`
- invalid state codes
- invalid tier values
- malformed slugs

Do **not** hard-fail on:
- sparse runtime coverage
- missing state presence in live output
- missing Tier 1 metros in live output
- cities not yet researched

Those are planning/reporting issues until Phase 3 promotes them into runtime expectations.

## Batch outputs

Phase 2 adds:
- coverage planning inventory
- planning rules
- planning contract validation
- coverage reporting
- generator awareness of planning files (read-only)
- runbook/handoff documentation

## What unlocks Phase 3

After Phase 2, the system can tell you:
- which cities are planned
- which are ready now
- which are blocked by missing provider datasets
- which are blocked by missing listing JSON
- which existing provider datasets sit outside the current plan

That is the handoff into actual city population.
