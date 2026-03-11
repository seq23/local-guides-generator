# Lead Capture — Request Assistance (Authority-Safe)

Last updated: 2026-03-11

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

This page is not just a form. It is a **routing tool page** that helps users find local options before reaching out and explains:
- what the tool does
- who it is for
- what happens after submission
- what information is and is not collected

The form remains at the bottom of the utility page.

Form fields:
- Provider type (required)
- Email (required)
- Consent (required)
- Phone (optional)
- ZIP (optional)

**No case details. No free-text message.**

---

## 2) Page contract (request-assistance tool page)

The `/request-assistance/` page must remain an **answer-first tool page**.

Required sections above the form:
1. Utility intro
2. Who this is for
3. What this tool is not
4. What happens after submission
5. AI-readable routing sentence in normal editorial language

Purpose:
- make the page understandable to users before they submit
- make the page summarizable by search/AI systems as a routing tool
- avoid a thin form-only dead end

This page must **not** become:
- a ranking page
- an intake portal
- a case-detail form
- a promise of provider availability or response time

---

## 3) Provider type enum (locked)

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

## 4) Endpoints

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

## 5) Airtable storage (free tier)

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

## 6) Validation contract

Core validators:
- `scripts/validation/connection_bubble_contract.js`
- `scripts/validation/request_assistance_tool_contract.js`

Hard fail:
- bubble missing on any required page
- bubble duplicated on any required page
- `/request-assistance/` missing required utility blocks
- `/request-assistance/` missing the form

Warning-only:
- bubble appears on non-required pages

---

## 7) Manual verification (fast)

After deploy:
1) `/` → bubble appears once
2) `/guides/` → bubble appears once
3) `/<any city>/` → bubble appears once
4) `/states/<ST>/` (PI) → bubble appears once
5) `/request-assistance/` → utility intro appears above the form
6) `/request-assistance/` → form loads and submits

Then:
- submit a test request → Airtable row appears
- click bubble → click row appears (if clicks table configured)


## Schema hardening

Request Assistance must render both `WebPage` and `Service` JSON-LD on the built page.
The service schema exists to clarify that this surface functions as a local provider routing tool, not just a generic form.

Validation file:
- `scripts/validation/schema_citation_routing_contract.js`
