# Changelog

# 2026-02-14

- Revalidated core contracts and inventories (rotating focus: USCIS Medical).
- Updated Verification & Updates page and machine-readable snapshot.
# 2026-02-13

- Revalidated core contracts and inventories (rotating focus: PI).
- Updated Verification & Updates page and machine-readable snapshot.
# 2026-02-12

- Revalidated core contracts and inventories (rotating focus: Neuro).
- Updated Verification & Updates page and machine-readable snapshot.
- Revalidated core contracts and inventories (rotating focus: Neuro).
- Updated Verification & Updates page and machine-readable snapshot.
# 2026-02-11

- Nightly integrity build: re-ran core validators and refreshed verification metadata.
- Confirmed canonical inventory parity between docs and public surfaces.

# 2026-02-10

- Revalidated core contracts and inventories (rotating focus: TRT).
- Updated Verification & Updates page and machine-readable snapshot.
- Revalidated core contracts and inventories (rotating focus: TRT).
- Updated Verification & Updates page and machine-readable snapshot.
- Nightly integrity build: re-ran core validators and refreshed verification metadata.
- Confirmed canonical inventory parity between docs and public surfaces.

- Nightly integrity build: re-ran core validators and refreshed verification metadata.
- Confirmed canonical inventory parity between docs and public surfaces.

- Nightly integrity build: re-ran core validators and refreshed verification metadata.
- Confirmed canonical inventory parity between docs and public surfaces.

- Nightly integrity build: re-ran core validators and refreshed verification metadata.
- Confirmed canonical inventory parity between docs and public surfaces.

# 2026-02-09

- Nightly integrity build: re-ran core validators and refreshed verification metadata.
- Confirmed canonical inventory parity between docs and public surfaces.

## UX batch — FAQ discoverability + PI directory styling (2026-01-28)

### What changed
- **PI city pages:** the FAQ accordion (`#city-faq`) is now rendered **open** by default so the section is visible on first scroll.
- **FAQ UX:** larger accordion typography + larger chevrons; FAQ question rows have bigger click targets and clearer arrows.
- **FAQ controls:** added an in-panel **Expand all / Collapse all** control (optional; default state remains validator-compliant).
- **PI directory styling:** aligned PI directory table markup with the existing enterprise table styles (class mismatches fixed).
- **PI state pages:** city list now renders in columns so it fits; added a visible FAQ accordion section for state pages.

### Why
To make FAQ and directory content obvious and usable without changing editorial meaning or violating validator rules.

### Files touched
- `assets/styles.css`
- `templates/base.html`
- `scripts/build_city_sites.js`
- `data/page_sets/*.json`
- `data/page_sets/examples/*.json`
- `CHANGELOG.md`

### Validation status
- ✅ npm run validate:all — PASS

---

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
