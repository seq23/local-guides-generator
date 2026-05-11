# Phase 3 City Population Handoff

## Purpose

Phase 3 turns the planning framework into actual city expansion work.

This runbook defines what must be true **before** a planned city becomes a publish candidate.

## Phase 3 input requirements

For each city row moving toward publication:

1. Provider dataset exists for the correct vertical and city slug
2. Listing JSON/runtime support exists for the correct vertical and city slug
3. Slugs match planning inventory exactly
4. No conflicting city slug already exists in runtime
5. The city is mapped to the correct state anchor logic

## Promotion states

### `planned`
- target city only
- not publishable

### `blocked`
- target identified
- one or more required assets missing

### `ready`
- provider dataset exists
- listing JSON exists
- safe to move into publication work

## Phase 3 execution sequence

1. choose vertical batch
2. choose ready cities only
3. verify provider dataset paths
4. verify listing JSON/runtime support
5. generate city pages
6. run build + postbuild + validate
7. verify sitemap parity
8. publish snapshot

## What Phase 3 should not do

- do not publish blocked cities
- do not use placeholder providers
- do not create thin “coverage only” pages
- do not bypass sitemap parity

## Commands to run during Phase 3

```bash
node scripts/report_coverage_status.js
npm run build:all
npm run postbuild
LKG_VALIDATE_DIST=1 npm run validate:all
```

## Owner decision gate

Before publishing any new city batch, confirm:
- target vertical
- target cities
- provider dataset completeness
- listing runtime completeness
- snapshot delivery plan
