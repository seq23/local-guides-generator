# LLM Prompt Pack — Sponsor Intake + Campaigns (Business Rules)

## Prompt: Convert sponsor email + assets into intake folder
You are an operator. Create a sponsor intake folder using the repo’s sponsor system.

Inputs:
- sponsor name
- sponsor website
- CTA URL
- images provided (filenames)
- scope requested (site/vertical/state/city)
- vertical

Output required:
1) `data/sponsor_intake/sponsors/<slug>/sponsor.json`
2) `data/sponsor_intake/campaigns/<campaign_slug>.json`
3) a list of asset filenames that must be placed into the sponsor assets folder
4) validation checklist

Rules:
- slugs: lowercase, dash separated
- campaign_slug: sponsor + vertical + scope + date
- do not fabricate URLs
- if any required info missing, output a **single** clarification block at end

## Prompt: Audit sponsor system before deploy
Given the repo tree and sponsor intake files:
- confirm that every referenced asset exists
- confirm that every campaign references a real sponsor_slug
- confirm that scope targets (cities/states) exist in runtime inventory
- output PASS/FAIL + exact file paths + fixes

## Business Rules (hard)
- Canonical domains are the money domains.
- Redirect/vanity domains may have sponsor assets or CTAs, but they must redirect to canonical.
- Sponsor disclosure must be present wherever sponsor content appears.
- Generated files are never edited manually.
