# VA Release Card — PI Rendering Batch (Phase-2 Sponsored Directory)

**Date:** 2026-01-17  
**Batch scope:** Rendering-only (PI Phase-2 sponsored directory block + disclosure)

## Inputs received
- Baseline SOURCE ZIP: `pi_phase2_validator_batch.zip`
- Governance: Master Index v2.1 + Post-Freeze Addendums (PI Distribution)

## What changed
- Updated `scripts/build_city_sites.js` to render Phase-2 PI sponsored directory behavior **on the PI /directory/ page only** for cities with `monetization_mode = DISTRIBUTION_SPONSORED_DIRECTORY`:
  - Adds a disclosure block above the sponsored placement (proximate) meeting semantic requirements:
    - paid placement
    - independent educational publisher
    - no outcome guarantees
  - Adds exactly one sponsored placement block at the top of the directory with deterministic markers:
    - `data-sponsored-disclosure="true"`
    - `data-sponsored-placement="true"`
    - `data-sponsored-firm="true"`
  - CTA appears only inside the sponsored placement block.
- Removed provider-update/contact CTAs from the empty-directory state to keep EDUCATION_ONLY PI cities free of CTA/intake signaling.

## Validation
- ✅ `npm run build`: PASS
- ✅ `node scripts/validate_tbs.js`: PASS

## Handoff confirmation
- Only rendering logic was modified in this batch.
- No governance was reinterpreted; Phase-2 behavior is strictly keyed to `monetization_mode`.
