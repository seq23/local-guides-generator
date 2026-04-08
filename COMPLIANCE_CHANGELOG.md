# COMPLIANCE_CHANGELOG.md

## Scope
Executed the approved cumulative hierarchy pass on top of the ADA-compliant baseline ZIP `local-guides-generator-main_BASELINE_04-07-26_9926d35.zip`.

## Preserved zones
- Advertising inventory blocks preserved in place.
- `/for-providers/` sales-page contract block preserved structurally.
- Page-contract ordering preserved.

## Shared hierarchy system
- Added a cumulative shared hierarchy pass in `assets/styles.css`.
- Reduced repeated equal-weight card behavior.
- Increased section rhythm and spacing between primary blocks.
- Kept navigation quieter than primary page content.
- Preserved ADA focus and keyboard behavior from the approved baseline.

## City and state page weighting
- Strengthened the visual role of decision-support sections.
- Elevated provider/example sections with scanable structured item styling.
- Elevated PI directory container styling so it reads as a primary decision surface.
- Elevated non-PI state lookup so it reads as a verification tool rather than buried utility.
- De-emphasized FAQ blocks so they act as support rather than primary content.

## Accordion default-state changes
- Non-PI state lookup accordions now render open by default.
- City FAQ accordions now render collapsed by default across PI and non-PI city templates.
- PI state FAQ accordion now renders collapsed by default.

## Example provider sections
- Reworked example provider rendering in `scripts/build_city_sites.js`.
- Added stronger framing and a structured provider list with provider-name and provider-meta hierarchy.
- Preserved neutrality and non-ranking behavior.

## PI directory section
- Updated PI city page framing in `data/page_sets/examples/pi_v1.json`.
- Directory section now reads as a stronger local comparison surface without changing ordering or monetization logic.

## State lookup section
- Reworked state lookup CTA rendering in `scripts/build_city_sites.js`.
- Added stronger action framing, verification-first copy, and tool-style presentation.
- Preserved functional official-database behavior.

## Request assistance page
- Softened the hero treatment and reduced visual shininess in `data/global_pages/request-assistance.json`.
- Preserved explicit labels, validation/error accessibility work, and production contract strings.
- Kept the form as the dominant action surface.

## For-providers page
- Added stronger hierarchy framing in `data/global_pages/for-providers.json`.
- Introduced clearer section grouping for overview, commercial selection, mechanics, and inquiry.
- Preserved the contractual sales-page block and canonical inventory JSON.

## Files changed
- `assets/styles.css`
- `scripts/build_city_sites.js`
- `data/page_sets/examples/pi_v1.json`
- `data/page_sets/examples/dentistry_v1.json`
- `data/page_sets/examples/trt_v1.json`
- `data/page_sets/examples/neuro_v1.json`
- `data/page_sets/examples/uscis_medical_v1.json`
- `data/page_sets/starter_v1.json`
- `data/global_pages/request-assistance.json`
- `data/global_pages/for-providers.json`

## Validation
- `npm run build:all` → PASS
- `LKG_VALIDATE_DIST=1 npm run validate:all` → PASS

## Packaging
- Packaged as a full baseline snapshot ZIP from repo root.

- Reduced fanout/deployment telemetry leakage in user-facing UI: removed visible "Local routing layer" city lists from the rendered priority block, kept city links only in hidden contract markup, moved "Recently refreshed" to the end of the page flow, and reduced its visual weight so it behaves like tertiary support instead of a primary content block.

## 2026-04-08 — Answer Surface Authority Upgrade
- strengthened existing answer surfaces instead of adding redundant blocks
- upgraded evaluation frameworks with decision-weighting and common-mistake language
- added localized conclusion layer on city pages and stronger authority framing on state pages
- added comparison blocks and stronger guides/home answer hierarchy
- added answer-block strength validation to keep the new surfaces from regressing
