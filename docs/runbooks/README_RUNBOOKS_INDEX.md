# Runbooks index

This folder contains deterministic operational runbooks for the Local Guides Generator system.

## Sections
- [Lead Capture — Request Assistance](lead_capture_request_assistance.md) — request assistance lead capture + storage
- `cloudflare_domains_redirects/` — domains onboarding + redirects (already shipped separately)
- `cloudflare_pages/` — Pages setup + custom domain verification
- `guides_system/` — guide authoring + regeneration
- `runtime_inventory/` — add city/state runtime JSON
- `packs_verticals/` — create new vertical pack (page set)
- `monetization_ads/` — ad tokens and validation
- `releases/` — update and rollback
- `manual_only/` — no-terminal SOPs
- `llm_visibility/` — crawl parity, schema, IndexNow, request-assistance guardrails, and Phase 1 hardening summary
- `coverage_expansion/` — planning framework, owner/VA SOP, Phase 3 handoff, USCIS Wave 1 execution, and expansion rules

## Standard validation commands
From repo root:
```bash
npm ci
npm run build:all
npm run postbuild
LKG_VALIDATE_DIST=1 npm run validate:all
```

### Production guardrail smoke (required before production deploys)
```bash
LKG_DEPLOY_ENV=production AIRTABLE_API_TOKEN=test AIRTABLE_BASE_ID=test AIRTABLE_TABLE_NAME=test LKG_VALIDATE_DIST=1 npm run validate:all
```

## Releases
- [Snapshot Apply — One-Shot (Non-Interactive)](releases/SNAPSHOT_ONE_SHOT_APPLY.md)
- [LKG Update Runbook](releases/01_lkg_update_runbook.md)
- [Executable Bit Restore and Verification](releases/02_EXECUTABLE_BIT_RESTORE_AND_VERIFICATION.md)

## LLM visibility
- [01 — LLM Visibility Primer](llm_visibility/01_LLM_VISIBILITY_PRIMER.md)
- [02 — AI Citation Routing Hardening](llm_visibility/02_AI_CITATION_ROUTING_HARDENING.md)
- [03 — Sitemap Crawl Parity](llm_visibility/03_SITEMAP_CRAWL_PARITY.md)
- [04 — Homepage Schema Contract](llm_visibility/04_HOMEPAGE_SCHEMA_CONTRACT.md)
- [05 — IndexNow and LLM Surface](llm_visibility/05_INDEXNOW_AND_LLM_SURFACE.md)
- [06 — Request Assistance Production Guardrail](llm_visibility/06_REQUEST_ASSISTANCE_PRODUCTION_GUARDRAIL.md)
- [07 — Phase 1 System Hardening Summary](llm_visibility/07_PHASE1_SYSTEM_HARDENING_SUMMARY.md)
- [08 — Citation Probe and Answer Shape](llm_visibility/08_CITATION_PROBE_AND_ANSWER_SHAPE.md)


## Coverage expansion
- [01 — Coverage Framework Primer](coverage_expansion/01_COVERAGE_FRAMEWORK_PRIMER.md)
- [02 — Owner + VA Coverage Planning SOP](coverage_expansion/02_OWNER_VA_COVERAGE_PLANNING_SOP.md)
- [03 — Phase 3 City Population Handoff](coverage_expansion/03_PHASE3_CITY_POPULATION_HANDOFF.md)
- [04 — Phase 3 Wave 1 USCIS Execution](coverage_expansion/04_PHASE3_WAVE1_USCIS_EXECUTION.md)
- [05 — Phase 3 Expansion Rules and Next Waves](coverage_expansion/05_PHASE3_EXPANSION_RULES_AND_NEXT_WAVES.md)

- coverage_expansion/06_PHASE3_WAVE2_TRT_NEURO_EXECUTION.md
- `coverage_expansion/07_PHASE3_WAVE3_STATE_COMPLETION.md` — shared 50-state completion matrix for USCIS, TRT, and Neuro.
