# AI Visibility Upgrade — Canonical Evaluation Framework (v1)

Purpose: Ensure each city hub page satisfies the "how people typically evaluate providers" layer in an AI-safe, non-promotional way (no recommendations, rankings, reviews, or outcomes claims).

This repo now supports a single token on city hub pages:

- %%EVAL_FRAMEWORK%%

The build injects a vertical-specific framework section with marker:

- data-eval-framework="true"

## Canonical copy (exact)

The canonical copy is implemented in:

- scripts/build_city_sites.js -> renderEvalFrameworkHtml(...)

Vertical variants:
- PI (personal injury)
- Dentistry
- TRT

## Flow adjustments made

1) City hub templates (all packs) now include %%EVAL_FRAMEWORK%% immediately after %%AD:city_hub_top%% so the framework appears before directory / state lookup / FAQ.

2) Example provider lists (non-PI) now use a stronger, explicit non-exhaustive "examples only" statement.

3) PI directory header now explicitly states entries are examples only and not a recommendation, ranking, or endorsement.

## Validator enforcement

Validator now requires the marker on every city hub page:

- scripts/validate_tbs.js -> assertCityHubHasEvalFramework()

If a city hub is missing the marker, validate fails.
