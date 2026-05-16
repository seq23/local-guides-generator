# Phase 1 System Hardening Summary

Audience: Owner + Day-0 VA

This runbook summarizes the Phase 1 hardening work completed before coverage expansion and Reddit-driven publishing.

## Phase 1 scope closed

1. Request Assistance UX hardening
2. Sitemap crawl parity hard-fail
3. Existing-surface LLM hardening
4. Request Assistance production guardrail
5. Executable bit deterministic restore
6. Homepage schema hard-fail

## Why this phase exists

Phase 1 protects trust, crawlability, money flow, and release integrity on the **existing public surface**.

It does **not** expand coverage, add new city pages, or publish Reddit-driven content.

## Contracts now in force

### Request Assistance
- form-first page structure
- layout validated structurally, not by brittle hardcoded copy
- production deploys must not ship with a dead Airtable path

### Crawl / sitemap integrity
- every crawlable built page in `dist/` must exist in `dist/sitemap.xml`
- every sitemap URL must resolve to a real crawlable page in `dist/`

### LLM / machine-readable integrity
- homepage schema contract requires `Organization`, `WebSite`, and `WebPage`
- `llms.txt` is emitted during postbuild
- IndexNow submission prefers the current built public surface from `dist/sitemap.xml`
- sitemap emits `lastmod`

### Release integrity
- executable scripts are tracked by canonical manifest
- executable bits can be restored deterministically
- executable-bit drift fails validation

## Required verification loop

### Standard repo verification
```bash
npm ci
npm run build:all
npm run postbuild
LKG_VALIDATE_DIST=1 npm run validate:all
```

### Production lead-capture smoke
```bash
LKG_DEPLOY_ENV=production AIRTABLE_API_TOKEN=test AIRTABLE_BASE_ID=test AIRTABLE_TABLE_NAME=test LKG_VALIDATE_DIST=1 npm run validate:all
```

### Negative guardrail smoke
```bash
LKG_DEPLOY_ENV=production LKG_VALIDATE_DIST=1 npm run validate:all
```
Expected result: build fails on missing Airtable production env.

## Owner checklist
- Request Assistance page shows form first
- `dist/sitemap.xml` exists after postbuild
- `dist/llms.txt` exists after postbuild
- `npm run validate:all` passes with `LKG_VALIDATE_DIST=1`
- production guardrail smoke passes with envs present
- negative guardrail smoke fails without envs

## VA checklist
- do not rewrite validator copy checks back into brittle literal-string enforcement
- do not bypass `npm run postbuild` before dist validation
- do not ship if sitemap parity or executable bits fail
- do not treat future coverage goals as current hard-fail validators

## Failure modes

### Request Assistance validator fails
- inspect `data/global_pages/request-assistance.json`
- confirm form section is first and contract keys are still present

### Sitemap parity fails
- run `npm run postbuild`
- inspect `dist/sitemap.xml`
- compare crawlable pages in `dist/` to sitemap URLs

### Homepage schema contract fails
- inspect built home page JSON-LD in `dist/index.html`
- confirm required types still exist

### Executable bits contract fails
- run:
```bash
bash scripts/repair_executable_bits.sh
```
- rerun validation

### Airtable production guardrail fails
- set required production env vars:
  - `AIRTABLE_API_TOKEN`
  - `AIRTABLE_BASE_ID`
  - `AIRTABLE_TABLE_NAME`
- rerun validation in production mode

## What comes after Phase 1
- Phase 2: coverage expansion framework
- Phase 3: coverage population
- Phase 4: Reddit query compiler
- Phase 5: Reddit findings intake and clustering
- Phase 6: Reddit-driven guide / FAQ expansion
