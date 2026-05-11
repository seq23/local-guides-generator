# Owner + VA Coverage Planning SOP

## Goal

Maintain a clean expansion queue for `neuro`, `trt`, and `uscis-medical` without accidentally publishing thin pages.

## Files used

- `data/research/coverage/coverage_targets.csv`
- `data/research/coverage/coverage_rules.json`
- `data/research/shared/us_city_registry.csv`
- `scripts/report_coverage_status.js`

## Workflow

### 1. Update the plan
Edit `coverage_targets.csv` only.

Each row must include:
- `vertical`
- `city_slug`
- `city_name`
- `state_code`
- `state_name`
- `tier`
- `priority`
- `required_provider_dataset`
- `required_listing_json`
- `status`
- `notes`

### 2. Keep status honest
Use:
- `planned` — target exists but is not ready
- `ready` — provider dataset and listing JSON both exist
- `blocked` — one or both inputs missing

Do not mark a city `ready` unless both runtime supports actually exist.

### 3. Validate the plan
Run:

```bash
node scripts/validation/coverage_plan_contract.js
```

This must pass before the plan is considered clean.

### 4. Generate the coverage report
Run:

```bash
node scripts/report_coverage_status.js
```

Use the report to identify:
- missing state/DC anchors
- missing Tier 1 metros
- cities ready now
- blocked cities
- provider datasets outside the current plan

### 5. Do not publish from the plan
Phase 2 planning files do not create pages.

Do not:
- add cities directly to sitemap
- add cities directly to hubs
- assume plan rows are publishable

## VA checklist

- row added to `coverage_targets.csv`
- slug matches file naming conventions
- state code valid
- tier valid
- status honest
- plan contract passes
- report reviewed

## Red flags

Stop and escalate if:
- the same `vertical + city_slug` appears twice
- provider data exists under a different slug pattern than the plan expects
- listing JSON and provider dataset disagree on city slug/state
- a city appears runtime-ready but is missing from the plan
