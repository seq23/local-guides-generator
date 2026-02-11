# OWNER RELEASE QA CHECKLIST (AUTHORITATIVE)

Run this before tagging/pushing any release.

## 1) Clean state
- Repo clean: `git status` shows no uncommitted changes (except intended).
- Run fresh install:
  - `npm ci`

## 2) Full validation
- `npm run validate:all` → must PASS

## 3) Release QA runner (one command)
- `npm run qa:release` → must PASS
  - validate:all
  - validate:dist:compliance
  - validate:goldens
  - validate:pi:containment
  - audit:links
  - audit:buyouts
  - smoke:buyouts

## 4) Buyout hard-fail test (dummy)
- Add a temporary LIVE buyout record with:
  - `live: true`
  - `startDate` = today
  - `endDate` = today + 1 day
- Intentionally set the pack `educationOnly: true`
- Run `npm run validate:all`
  - Expected: **FAIL** with buyout/educationOnly error
- Revert dummy buyout + restore educationOnly state
- Re-run `npm run validate:all` (PASS)

## 5) Manual spot-click audit (5 minutes)
- For-providers page:
  - each tier button opens the same mailto template
  - phone + how-found-us present
- If any LIVE buyout:
  - Next Steps CTA shows on scoped pages
  - Competing inquiry surfaces are suppressed on scoped pages
  - Next Steps mailto goes to paying provider email

## 6) Record release
- Append entry to `docs/releases/RELEASE_INDEX.md`:
  - tag, date, summary, validator status, buyouts live (usually none)
