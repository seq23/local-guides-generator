# PI State-Only Hardening + VA QA

Audience: Owner + Day-0 VA
Status: ACTIVE
Scope: Personal Injury (`pi_v1`) only

## Purpose
This runbook prevents city-era PI UI from leaking back into the state-only PI system.

## Canonical PI state-only rules
PI must now behave as a state-only surface.

Required:
- PI state pages stay live
- PI state pages include the firm directory
- PI state pages include attorney discipline lookup
- PI firm directory must render **before** attorney discipline lookup
- legacy PI city URLs must redirect to the matching state page

Forbidden:
- `Cities we cover in [State]`
- `Don't see your city yet?`
- `Request your city`
- direct PI city links from PI homepage or PI state pages
- PI city pages emitted in `dist/`
- city-by-city PI copy on the homepage

## Owner release commands
Run from repo root:

```bash
PAGE_SET_FILE=data/page_sets/examples/pi_v1.json npm run build
LKG_VALIDATE_DIST=1 npm run validate:all
npm run validate:goldens
npm run audit:pi:click
```

Optional packaged-artifact truth check:

```bash
node scripts/validate_packaged_zip.js /full/path/to/local-guides-generator-main_BASELINE_MM-DD-YY_<sha>.zip
```

## VA post-build checklist
Open these built files in `dist/`:
- `dist/index.html`
- `dist/states/TN/index.html`
- `dist/states/TX/index.html`
- `dist/states/MA/index.html`
- `dist/_redirects`

Confirm:
1. Homepage has no PI city-by-city copy
2. State pages do not show `Cities we cover`
3. State pages do not show `Request your city`
4. `Firms listed for [State]` appears before `Attorney discipline & license lookup`
5. `_redirects` contains PI city -> state redirects for root, directory, faq, and next-steps

## Escalate immediately if any of these happen
- PI city page exists in `dist/<city>/index.html`
- PI state page contains a city chip/grid
- PI state page links directly to `/memphis-tn/`, `/nashville-tn/`, or other PI city pages
- directory appears after discipline lookup
- packaged ZIP fails `validate_packaged_zip`

## Do not touch
VA must not edit:
- `scripts/build_city_sites.js`
- `scripts/validation/*.js`
- `scripts/redirects_emit.js`

VA may only run checks and report failures with raw output.
