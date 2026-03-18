# Phase 3 Expansion Rules and Next Waves

## Purpose

This runbook explains when Phase 3 can expand beyond the initial USCIS six-city wave.

## Expansion prerequisite

Do **not** expand USCIS city population until all of the following are true:

- `coverage_runtime_support_contract` passes
- `coverage_rendering_contract` passes
- sitemap parity passes
- current promoted USCIS cities are visible in the public surface
- runbooks reflect the actual operator workflow

## Expansion model

Phase 3 expands in **waves**, but the phase itself does not change.

- Wave 1 → USCIS
- Wave 2 → TRT + Neuro
- Wave 3 → broader state-anchor and Tier 1 completion

These are execution waves inside Phase 3, not new phases.

## Rule for future promoted cities

A city can be promoted only if:

1. provider dataset exists
2. listing/runtime support exists
3. the city is present in `coverage_targets.csv`
4. the city is enabled in `coverage_promoted.csv`
5. runtime support says `runtime_ready=true`

## Provider matching standard

Provider matching for promoted cities may use **metro-area matching**.

That means a provider can be outside the exact city core if it is reasonably part of the metro area the city page serves.

## What not to do

- do not mass-promote all planned cities
- do not publish cities with missing provider support
- do not add outbound provider links to example-provider sections
- do not create vertical-specific publication shortcuts that bypass the shared city-page builder

## Recommended expansion order after Wave 1

1. expand USCIS beyond the first six promoted cities only after Wave 1 remains stable
2. apply the same city-population machine to TRT
3. apply the same city-population machine to Neuro

## Standard validation commands

```bash
npm run build:all
npm run postbuild
LKG_VALIDATE_DIST=1 npm run validate:all
```


## Wave 2 grouped-provider rule

Wave 2 for TRT and Neuro uses the existing city-page system with grouped provider sections.

TRT requires exactly three grouped sections per promoted city:

- TRT / hormone clinics
- IV hydration / IV therapy
- Hair restoration

Neuro requires exactly two grouped sections per promoted city:

- ADHD evaluation
- Autism evaluation

Rules:

- provider names render as text only
- no outbound provider links
- alphabetical order is enforced within each group
- runtime support can be true only when all required groups exist
- do not create a parallel city-page template
