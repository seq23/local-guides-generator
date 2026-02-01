# SOP — Running Validation (Core Orchestrator) — Mac Only

**Audience:** Day-0 VA + Owner  
**Authority:** Execution Playbook / Runbooks.  
**Rule:** Validation is **blocking**. If it fails, do **not** push, do **not** deploy. Send the failure output to Owner.

---

## What changed (why this SOP exists)

We replaced scattered “mystery validators” with **one** deterministic orchestrator:

- **Core orchestrator:** `scripts/validate_core.js`
- **Command you run:** `npm run validate:all`

This reduces false failures and makes it obvious what is being checked.

---

## Quick-start (90 seconds)

1. Open Terminal
2. Go to the repo:
   - `cd /Users/sequoiataylor/Documents/GitHub/local-guides-generator`
3. Install deps:
   - `npm ci`
4. Run validation:
   - `npm run validate:all`

✅ Success ends with: `CORE VALIDATION PASS`

---

## What `validate:all` requires (exact contracts)

`validate:all` runs **only these** checks, in this order:

### 1) Buyouts schema
**Script:** `scripts/validate_buyouts_schema.js`

- Validates `data/buyouts.json` structure.
- If there are **0 records**, it should still PASS.

**Common fails:**
- missing required fields for a scope
- invalid email format
- invalid slug format

---

### 2) Buyouts LIVE hard-fail (Next Steps must work)
**Script:** `scripts/validate_buyout_next_steps_hardfail.js`

- If there are **no LIVE buyouts**, this check prints **SKIP**.
- If there **is** a LIVE buyout, it hard-fails unless:
  - Next Steps pages exist for the scope
  - CTA markers exist on in-scope pages
  - competing CTAs are suppressed (buyout precedence)

---

### 3) For-Providers inquiry template (single mailto + required capture)
**Script:** `scripts/validate_for_providers_inquiry.js`

Hard-fails if:
- more than one mailto template exists on the for-providers page
- required capture lines are missing from the mailto body (examples):
  - `Full name:`
  - `Work email:`
  - `Phone:`
  - `How did you find us?:`

---

### 4) Guides index links (every guide must be discoverable)
**Script:** `scripts/validators/guides_index_links.js`

Hard-fails if `dist/guides/index.html` does not link to **every generated guide**.

Rule enforced:
- For every `dist/guides/<slug>/index.html` (excluding `next-steps`), the Guides index must contain `href="/guides/<slug>/"`.

This prevents “orphan guides” that exist on disk but are not reachable from the Guides page.

---

### 5) Footer contract (compliance wording must be global)
**Script:** `scripts/validators/footer_contract.js`

**Canonical footer source of truth:**
- `docs/policies/footer_canonical.txt`

Hard-fails if any page in `dist/**/*.html`:
- does not contain a `<footer ...>` element
- or is missing any required compliance lines from `docs/policies/footer_canonical.txt`

Notes:
- We **do not** validate a specific copyright string (e.g., `© 2026`). Encoding/spacing can vary across builds.
- The canonical footer file controls the required *compliance copy* and links.

✅ This enforces that the compliance footer is global and identical in meaning.

---

### 6) Golden contracts (major blocks only, not exact sentences)
**Script:** `scripts/validators/golden_major_blocks.js`

Hard-fails if a city page is missing required **block markers**.
This is **structural**, not copy-based.

Required markers (non-PI city pages):
- `data-sponsored-placement="top"`
- `data-llm-bait="question"`
- `data-eval-framework="true"`
- `data-sponsored-placement="mid"`
- `data-example-providers="true"`
- `data-state-lookup="true"`
- `data-faq="true"`
- `data-sponsored-placement="bottom"`
- `data-guides-micro="true"`

---

### 7) Link integrity (no broken internal links)
**Script:** `scripts/crawl_dist_links.js`

Hard-fails on:
- broken internal links
- empty hrefs that should be real navigation

---

## Where the orchestration lives

- **Orchestrator:** `scripts/validate_core.js`
- **NPM wiring:** `package.json` → `"validate:all": "node scripts/validate_core.js"`

---

## If validation fails (exact protocol)

1. **Stop.** Do not “fix forward” blindly.
2. Copy the **first failing line** (the first ❌ line) + the first stack line under it.
3. Email Owner at `info@spryvc.com` with:
   - Subject: `VALIDATION FAIL — <first failing check>`
   - Body: paste the copied output + what you changed

---

## Do NOT touch (VA rules)

- Do NOT add new validators unless Owner approves and they are added to `scripts/validate_core.js`.
- Do NOT reintroduce “banned token scanning” across all HTML. That created false failures from footer policy links.
- Do NOT bypass validation to ship.

---

## Owner note: why this design is safer

- Fewer moving parts
- Less overlap
- Hard-fails focus only on mission-critical contracts:
  - coverage authority
  - buyouts/next-steps
  - monetization inquiry capture
  - footer compliance
  - city flow blocks
  - link integrity
