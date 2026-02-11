# Sponsor Assets → Ads / Next Steps / Buyouts — Process Map (Owner-friendly)

## What this system does
You (or a VA) can **drop sponsor assets + a tiny JSON file** and run **one command** to:
- copy/normalize assets into a stable public path (`assets/sponsors/<slug>/`)
- generate sponsor config files used by the renderer (`data/sponsors/...`)
- optionally wire **Next Steps** + **directory sponsor blocks** for city/state/site buyouts
- optionally upload assets to **Cloudflare Images** and swap in delivery URLs
- run validation gates that **hard-fail** on missing assets, invalid scope, or broken references

## Core Objects
- **Sponsor** (who): `data/sponsor_intake/sponsors/<sponsor_slug>/sponsor.json`
- **Campaign** (where/when): `data/sponsor_intake/campaigns/<campaign_slug>.json`

## Output Files (generated)
- `assets/sponsors/<sponsor_slug>/*` + `manifest.json`
- `data/sponsors/global.json` (default stacks)
- `data/sponsors/<citySlug>.json` (only when needed)
- optional: updates to `data/listings/<citySlug>.json` sponsor blocks (only when enabled)

## One-command flow (terminal)
1) Add sponsor folder + assets + sponsor.json  
2) Add campaign json  
3) Run:
   - `npm run sponsors:apply`
   - optional Cloudflare Images upload: `npm run sponsors:apply:cf`
4) Verify with:
   - `npm run sponsors:verify`

## Manual fallback (no terminal)
- You can still do this entirely in the UI by editing `data/sponsors/global.json` and dropping images into `assets/…`,
  but **this is only for emergencies**. It is easy to drift and break parity.

## Determinism Rules
- **No hand editing generated files.**
- Sponsor/campaign intake is the source of truth.
- Validation gates must pass before build.
