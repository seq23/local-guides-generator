# SOP — Owner / Head VA / VA Sponsor Go-Live

This SOP is deterministic. Do not improvise.

## Step 1 — create sponsor record
Create:
`data/sponsor_intake/sponsors/<slug>/`

Add:
- `sponsor.json`
- `assets/logo.png`
- `assets/hero.jpg`
- `assets/directory-cta.jpg`

## Step 2 — fill out sponsor.json
Use:
`data/sponsor_intake/sponsors/_TEMPLATE/sponsor.json`

Required fields:
- `slug`
- `display_name`
- `website_url`
- `phone`
- `lead_email`
- all three asset paths

## Step 3 — make the sponsor live
Edit exactly one file:
`data/buyouts.json`

Add one live record for:
- city
- state
- or vertical

## Step 4 — rebuild and validate
Run:
- `node scripts/build_all_packs.js`
- `LKG_VALIDATE_DIST=1 npm run validate:all`

## Step 5 — click audit
Always check:
- affected page
- `/for-providers/`
- `/next-steps/`
- `/request-assistance/`
- CTA above directory if directory is present

## Simple rule
If the sponsor folder is correct and the `data/buyouts.json` entry is correct, the sponsor can go live.
