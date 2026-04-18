# Sponsor Activation Runbook (Simple Live Model)

## Purpose

This is the canonical VA-safe runbook for making a sponsor live using the simplified buyout model.

The live system has only two moving parts:

1. **Sponsor record** — static sponsor identity, assets, and destinations
2. **Activation file** — one live buyout entry that turns the sponsor on

## Source of truth

### Sponsor record
`data/sponsor_intake/sponsors/<sponsor_slug>/sponsor.json`

### Sponsor assets
`data/sponsor_intake/sponsors/<sponsor_slug>/assets/`

### Live activation file
`data/buyouts.json`

VAs should not need to edit `data/sponsorships.json` to make a sponsor live. That file is legacy/supporting metadata only.

---

## Products

### City Buyout
- one city page
- sponsor owns the CTA layer on that city page
- sponsor owns lead routing for that city page

### State Buyout
- one state page
- sponsor owns the CTA layer on that state page
- sponsor owns lead routing for that state page

### Vertical Buyout
- homepage
- all guide pages
- up to 10 cities by default
- corresponding states
- additional cities can be added as extras

### Important constraints
- guide pages are controlled only through vertical buyout
- PI has no city pages in runtime
- CTA above a directory becomes the sponsor feature surface when directory CTA takeover is enabled

---

## Required sponsor fields

Each sponsor record must include:
- `slug`
- `display_name`
- `website_url`
- `phone`
- `lead_email`
- `assets.logo`
- `assets.top_cta_image`
- `assets.mid_cta_image`
- `assets.bottom_cta_image`
- `assets.directory_cta_image`

Optional but recommended:
- `short_label`
- `cta_label`
- `tagline`

---

## Day-0 VA go-live steps

### Step 1 — create the sponsor folder
Create:
`data/sponsor_intake/sponsors/<sponsor_slug>/`

Inside it create:
- `sponsor.json`
- `assets/`

### Step 2 — add assets
Drop in:
- `logo.png`
- `top-cta.jpg`
- `mid-cta.jpg`
- `bottom-cta.jpg`
- `directory-cta.jpg`

### Step 3 — fill out sponsor.json
Use the template in:
`data/sponsor_intake/sponsors/_TEMPLATE/sponsor.json`

### Step 4 — add one live entry to data/buyouts.json
A VA makes a sponsor live by adding **one entry** to `data/buyouts.json`.

### Step 5 — rebuild and validate
Run:
- `node scripts/build_all_packs.js`
- `LKG_VALIDATE_DIST=1 npm run validate:all`

### Step 6 — click audit
Always check:
- affected page
- `/for-providers/`
- `/next-steps/`
- `/request-assistance/`
- CTA above directory if the page contains a directory

---

## Simple live examples

### City Buyout
```json
{
  "id": "acme-law-austin-city",
  "sponsor_slug": "acme-law",
  "type": "city",
  "vertical": "dentistry",
  "state": "TX",
  "cities": ["austin-tx"],
  "cta_takeover": true,
  "directory_cta_takeover": true,
  "status": "live",
  "start_at": "2026-04-20",
  "end_at": "2099-12-31"
}
```

### State Buyout
```json
{
  "id": "acme-law-delaware-state",
  "sponsor_slug": "acme-law",
  "type": "state",
  "vertical": "pi",
  "state": "DE",
  "cities": [],
  "cta_takeover": true,
  "directory_cta_takeover": true,
  "status": "live",
  "start_at": "2026-04-20",
  "end_at": "2099-12-31"
}
```

### Vertical Buyout
```json
{
  "id": "acme-law-pi-vertical",
  "sponsor_slug": "acme-law",
  "type": "vertical",
  "vertical": "pi",
  "homepage": true,
  "guides": true,
  "states": ["DE", "PA"],
  "cities": [],
  "included_city_limit": 10,
  "extra_cities": [],
  "cta_takeover": true,
  "directory_cta_takeover": true,
  "status": "live",
  "start_at": "2026-04-20",
  "end_at": "2099-12-31"
}
```

---

## Red flags
- sponsor folder exists but asset file paths are wrong
- sponsor is live in `data/buyouts.json` but the sponsor record is missing
- `cta_takeover` is true but `lead_email` is missing
- `directory_cta_takeover` is true on a page type that has no directory
- a vertical buyout claims PI city coverage

## Rollback
1. Set the buyout record `status` to `paused` or remove the record from `data/buyouts.json`
2. Rebuild
3. Re-run validation
4. Re-check the affected routes

## CTA hero rule
When a sponsor is live on a covered page, the top CTA upgrades into the hero sponsor surface for that page. The CTA directly above a directory keeps its special sponsor-feature behavior when `directory_cta_takeover` is enabled.
