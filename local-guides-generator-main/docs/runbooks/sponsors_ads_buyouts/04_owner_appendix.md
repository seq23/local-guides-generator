# Owner Appendix — Architecture + Rules (Sponsor System)

## Source of truth
- Sponsor intake: `data/sponsor_intake/sponsors/*/sponsor.json`
- Campaign intake: `data/sponsor_intake/campaigns/*.json`

Generated outputs are **derived** and should be considered disposable.

## Integration points (current repo expectations)
This implementation is designed to work with:
- `data/sponsors/global.json`
- `data/sponsors/<citySlug>.json`
- optional sponsor blocks in `data/listings/<citySlug>.json`
- next steps sponsor wiring where `loadNextStepsSponsor()` prefers:
  - listings sponsor (if present)
  - `nextStepsSponsor` in sponsor config (if present)

## Scopes
- site: apply sponsor everywhere
- vertical: apply to builds for a vertical (if you run per-vertical builds)
- state: apply to all city/state pages that match those states
- city: apply to explicit city slugs

## Date handling
- `starts_on`/`ends_on` are used to determine active campaigns.
- Expired campaigns are excluded on apply.

## Optional Cloudflare Images mode
- The upload script is **opt-in** and safe by default:
  - deduped by content hash
  - never deletes from Cloudflare
  - does not overwrite an existing mapping unless `--force`

## Guardrails
- Generated files include an AUTO-GENERATED header.
- Validation fails hard if:
  - sponsor references missing
  - assets missing
  - invalid scope targets
  - duplicate sponsor_slug collisions
