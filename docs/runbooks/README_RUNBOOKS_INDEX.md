# Runbooks index

This folder contains deterministic operational runbooks for the Local Guides Generator system.

## Sections
- `cloudflare_domains_redirects/` — domains onboarding + redirects (already shipped separately)
- `cloudflare_pages/` — Pages setup + custom domain verification
- `guides_system/` — guide authoring + regeneration
- `runtime_inventory/` — add city/state runtime JSON
- `packs_verticals/` — create new vertical pack (page set)
- `monetization_ads/` — ad tokens and validation
- `releases/` — update and rollback
- `manual_only/` — no-terminal SOPs

## Standard validation commands
From repo root:
```bash
npm ci
npm run build
```

## Releases

- [Snapshot Apply — One-Shot (Non-Interactive)](releases/SNAPSHOT_ONE_SHOT_APPLY.md)
