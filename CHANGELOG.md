# Changelog

## Data batch — PI monetization_mode population (2026-01-17)

### What changed
- Updated `data/page_sets/examples/cities_pi_v1.json` to include a required `monetization_mode` for **every** PI city.
- Set Phase-2 intake-enabled cities to `DISTRIBUTION_SPONSORED_DIRECTORY`:
  - houston-tx, dallas-tx, chicago-il, atlanta-ga, orlando-fl
- Set all other PI cities to `EDUCATION_ONLY`.
- Added missing Phase-2 cities to the PI cities registry (Dallas, Chicago, Atlanta, Orlando).

### Why
Phase-2 PI Distribution Governance requires every PI city to be classified under exactly one monetization mode, with a locked Phase-2 allowlist.

### Files touched
- `data/page_sets/examples/cities_pi_v1.json`
- `CHANGELOG.md`

### Validation status
- ✅ npm run build: PASS
- ✅ node scripts/validate_tbs.js: PASS

---

## Validator batch — PI Phase-2 Distribution enforcement (2026-01-17)

### What changed
- Updated `scripts/validate_tbs.js` to enforce PI Phase-2 Distribution Governance (PI only):
  - Hard-fail if any PI city is missing `monetization_mode` or uses an invalid enum.
  - Phase-2 allowlist enforcement: houston-tx, dallas-tx, chicago-il, atlanta-ga, orlando-fl must be `DISTRIBUTION_SPONSORED_DIRECTORY`; all others must be `EDUCATION_ONLY`.
  - `FULL_SITE_SPONSORSHIP` is recognized but **forbidden by default** (hard fail).
  - EDUCATION_ONLY cities: fail if any sponsorship/disclosure markers or conservative CTA signals are present.
  - Sponsored-directory cities: require directory page, exactly one sponsored placement + firm + disclosure marker, disclosure semantics + vicinity, and CTA zone enforcement.
  - Golden regression checks: houston-tx (sponsored) and denver-co (education-only).

### Why
Phase-2 PI Distribution Governance requires deterministic enforcement that prevents monetization drift and regressions.

### Files touched
- `scripts/validate_tbs.js`
- `CHANGELOG.md`
- `VA_RELEASE_CARD.md`

### Validation status
- ✅ `npm run build`: PASS
- ✅ `node scripts/validate_tbs.js`: PASS

---

## Rendering batch — PI Phase-2 sponsored directory block + disclosure (2026-01-17)

### What changed
- Updated `scripts/build_city_sites.js` to render Phase-2 sponsored directory behavior for PI cities with `monetization_mode = DISTRIBUTION_SPONSORED_DIRECTORY` **on the PI /directory/ page only**:
  - Adds a disclosure block **above** the sponsored placement (proximate), with semantic requirements (paid placement + independent educational publisher + no outcome guarantees).
  - Adds exactly one sponsored placement block at the top of the directory with deterministic markers:
    - `data-sponsored-disclosure="true"`
    - `data-sponsored-placement="true"`
    - `data-sponsored-firm="true"`
  - CTA is present only inside the sponsored placement block.
- Removed provider update/contact CTAs from the empty-directory state to ensure EDUCATION_ONLY PI cities contain no CTA/intake signaling.

### Why
Phase-2 PI Distribution Governance requires a sponsored placement block (one firm) and disclosure for Phase-2 cities while keeping EDUCATION_ONLY cities neutral.

### Files touched
- `scripts/build_city_sites.js`
- `CHANGELOG.md`
- `VA_RELEASE_CARD.md`

### Validation status
- ✅ `npm run build`: PASS
- ✅ `node scripts/validate_tbs.js`: PASS
