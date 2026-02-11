# SOP — Add Sponsor Assets + Turn On Ads / Next Steps / Buyouts (Owner + Day‑0 VA)

This SOP is **deterministic**. Follow it exactly. Do not improvise.

---

## 0) Preconditions
- You have repo access.
- You have Cloudflare token **if using optional Cloudflare Images upload**.
- You know the target **scope**:
  - `site` (entire build)
  - `vertical` (one vertical build)
  - `state` (specific states)
  - `city` (specific city slugs)

---

## 1) Create the Sponsor Intake Folder

Create:
`data/sponsor_intake/sponsors/<SPONSOR_SLUG>/`

Inside it create:
- `sponsor.json`
- `assets/` folder with images

### 1.1 Sponsor slug rules
- lowercase
- letters/numbers/dashes only
- example: `acme-law`

---

## 2) Drop assets into the sponsor folder

Put sponsor files into:
`data/sponsor_intake/sponsors/<SPONSOR_SLUG>/assets/`

Recommended:
- logo: `logo.png`
- hero: `hero.jpg`
- ad sizes: `ad_300x250.png`, `ad_728x90.png`, etc.

---

## 3) Create sponsor.json (copy/paste template)

Path:
`data/sponsor_intake/sponsors/<SPONSOR_SLUG>/sponsor.json`

Template:
```json
{
  "sponsor_slug": "acme-law",
  "display_name": "ACME Law",
  "website": "https://acmelaw.com",
  "contact_email": "ops@acmelaw.com",
  "phone": "+1-555-555-5555",
  "cta_text": "Call for a consultation",
  "cta_url": "https://acmelaw.com/consult",
  "disclosure": "Sponsored listing.",
  "assets": {
    "logo": "assets/logo.png",
    "hero": "assets/hero.jpg",
    "ad_300x250": "assets/ad_300x250.png",
    "ad_728x90": "assets/ad_728x90.png"
  }
}
```

**Rules**
- The paths in `assets` must match real files you dropped.
- If you don’t have a size, delete the key (don’t leave blank).

---

## 4) Create a Campaign file

Create:
`data/sponsor_intake/campaigns/<CAMPAIGN_SLUG>.json`

### 4.1 Campaign template (site buyout example)
```json
{
  "campaign_slug": "acme-law-pi-buyout-q1",
  "vertical": "pi",
  "scope": { "type": "site" },
  "starts_on": "2026-01-30",
  "ends_on": null,
  "sponsor_slug": "acme-law",
  "placements": {
    "ads": {
      "header_leaderboard": true,
      "sidebar_300x250": true,
      "in_content": true
    },
    "next_steps": { "enabled": true },
    "listings": { "enabled": false }
  }
}
```

### 4.2 City scope example
```json
"scope": { "type": "city", "cities": ["phoenix-az", "austin-tx"] }
```

### 4.3 State scope example
```json
"scope": { "type": "state", "states": ["az", "tx"] }
```

---

## 5) Run the generator (terminal)

From repo root:

### 5.1 Local-only assets mode (default)
```bash
npm run sponsors:apply
```

### 5.2 Optional Cloudflare Images upload mode (recommended once stable)
```bash
export CF_ACCOUNT_ID="YOUR_ACCOUNT_ID"
export CF_API_TOKEN="YOUR_API_TOKEN"
npm run sponsors:apply:cf
```

Outputs will be generated under:
- `assets/sponsors/<slug>/...`
- `data/sponsors/...`
- optional: listings sponsor blocks updated

---

## 6) Verify (terminal)

```bash
npm run sponsors:verify
```

This produces pass/fail output:
- missing assets
- missing sponsor/campaign references
- invalid scope targets
- unresolved sponsor tokens (if you run a build)

---

## 7) Commit
```bash
git add -A
git commit -m "Sponsor intake + campaigns (auto-generated configs)"
git push
```

---

# Manual fallback SOP (if VA cannot use terminal)

**Only do this if terminal is unavailable.** This is more error-prone.

1) Put sponsor images into:
`assets/sponsors/<slug>/`

2) Edit:
`data/sponsors/global.json`

3) Add sponsor block into the correct stacks:
- header leaderboard
- sidebar 300x250
- in-content

4) If it’s a city/state buyout, create:
`data/sponsors/<citySlug>.json`  
and put the same sponsor block + `nextStepsSponsor`.

5) Hard verify by opening built pages and ensuring:
- sponsor images load
- CTAs click through
- Next Steps renders correctly

**Do not do manual edits twice. The next terminal run will overwrite you.**
