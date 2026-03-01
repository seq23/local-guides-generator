# Lead Capture — Request Assistance (Authority-Safe)

Last updated: 2026-03-01

This repo includes an **authority-safe connection layer** designed to support advertiser sales **without** turning the site into an intake portal.

**Core idea:** Educational content stays pure; only core hub pages show a subtle “Request Assistance” module. Requests are stored for later routing **only when** a provider is active.

---

## 1) What ships (runtime surfaces)

### A) Connection Bubble (bottom-of-page module)
A consistent module appears **above the footer** on **required pages only**.

Required pages (enforced by core validation):
- Global home: `/`
- Guides hub: `/guides/`
- City hubs: `/<city>/`
- PI state hubs: `/states/<ST>/`

**It must render exactly once** on each required page.

### B) Request page
- `/request-assistance/`

Form fields:
- Provider type (required)
- Email (required)
- Consent (required)
- Phone (optional)
- ZIP (optional)

**No case details. No free-text message.**

---

## 2) Provider type enum (locked)

The request flow uses a strict, locked enum:

- `Personal Injury Attorney`
- `Dentist (Cosmetic, Implant, or General Care)`
- `Neuro Evaluation Provider`
- `Hormone / Wellness Clinic`
- `USCIS Medical Exam Provider`

If you change these strings, you must update:
- the request page dropdown
- the API allowlist
- any template/provider mapping

---

## 3) Endpoints

### A) Lead submission
`POST /api/request-assistance`

Required:
- `provider_type`
- `email`
- `consent`

Optional:
- `phone`
- `zip`
- `src` (page path)

Anti-spam:
- honeypot field: `website` (must be empty)

### B) Click tracking (non-blocking)
`POST /api/track-connection-click`

This is **best-effort** telemetry. Missing telemetry must never break the site.

---

## 4) Airtable storage (free tier)

This repo is configured to store requests in Airtable.

### Environment variables (Cloudflare Pages)

Required for storing leads:
- `AIRTABLE_API_TOKEN`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_TABLE_NAME`

Optional for click tracking:
- `AIRTABLE_CLICKS_TABLE_NAME`

If the required env vars are missing:
- lead submission returns a friendly `storage_unavailable` error
- build is unaffected

---

## 5) Validation contract

Core validator:
- `scripts/validation/connection_bubble_contract.js`

Hard fail:
- bubble missing on any required page
- bubble duplicated on any required page

Warning-only:
- bubble appears on non-required pages

---

## 6) Manual verification (fast)

After deploy:
1) `/` → bubble appears once
2) `/guides/` → bubble appears once
3) `/<any city>/` → bubble appears once
4) `/states/<ST>/` (PI) → bubble appears once
5) `/request-assistance/` → form loads and submits

Then:
- submit a test request → Airtable row appears
- click bubble → click row appears (if clicks table configured)

