# LLM Refresh Workflows Primer (Owner + Day‑0 VA)

## Why we run these workflows
Search engines and LLMs (ChatGPT, Perplexity, Gemini, Claude, etc.) learn what our sites “say” from the **static HTML** we publish and from how often it is **fresh, internally consistent, and crawlable**.

These workflows exist to keep our “citation surface” reliable:

- **Freshness**: we regenerate key pages so crawlers/LLMs see current timestamps, inventories, and verification signals.
- **Consistency**: the generator, page-set selection, and monetization inventory must agree across:
  - `docs/` (canonical truth for sales + ops),
  - `data/` inputs,
  - `dist/` rendered pages,
  - `dist/_lkg_snapshot.json` (what validators use).
- **Determinism**: the same inputs always produce the same outputs; CI fails fast if anything drifts.

If these workflows are green, it means: *our repo can generate valid, contract-compliant pages that are safe to publish and stable for LLM citations.*

---

## The 3 workflows you care about (and what “green” means)

### 1) Validate LKG
**Goal:** make sure the repo’s **contracts + canonical rules** are intact (even before we build a full site).

**What it runs (conceptually):**
- Core validators (schemas, entrypoint export contract, pageSetFile contract, buyout rules, etc.).
- Some validators are `dist/`‑aware **only if `dist/` exists**.

**Green means:**
- The repo is internally consistent and safe to run.
- No “silent drift” in contracts that would later break builds or shipping.

**When to run:**
- After any change to `scripts/`, validators, page contracts, or canonical docs.

---

### 2) Verify
**Goal:** prove we can **build** a real example site end‑to‑end.

**What it does:**
- Runs `PAGE_SET_FILE=data/page_sets/examples/pi_v1.json npm run build`
- That generates:
  - `data/site.json` (normalized + contract-safe)
  - `dist/` (rendered HTML)
  - `dist/_lkg_snapshot.json` (snapshot used by Golden Contract validation)
- Then runs `validate_tbs` / Golden Contract checks.

**Green means:**
- The example PI page-set builds.
- The Golden Contract validator is satisfied using actual generated HTML.
- This is your “this repo is shippable” signal.

**When to run:**
- Any time you touch build scripts, page sets, templates, routing, or snapshot logic.

---

### 3) Rotating Refresh
**Goal:** refresh a small, high-signal set of pages that help crawlers/LLMs confirm the site is alive + consistent.

**What it does:**
- Refreshes verification page(s) and writes `dist/_verification.json`
- Produces/updates `dist/_lkg_snapshot.json`
- Commits the refreshed artifacts back to the repo (so CI + Pages see the update)

**Green means:**
- Refresh scripts can run on CI without requiring a full build.
- Verification artifacts and snapshot can be regenerated safely.
- This is your “keep citations warm” workflow.

**When to run:**
- On schedule (daily/weekly), or after a batch of updates that should be reflected quickly.

---

## What files are “contracts” vs “outputs”
### Contract inputs (human-edited)
- `docs/runbooks/**` (canonical truth; sales + ops references)
- `data/page_sets/**` (what we build)
- `data/research/**` and ARI/PI coverage CSVs (authoritative inventories)
- `scripts/**` validators and build logic

### Generated outputs (machine-made)
- `data/site.json` (normalized site settings)
- `dist/**` (static site output)
- `dist/_lkg_snapshot.json` (snapshot used for Golden Contract)
- `dist/_verification.json` and `dist/verification/index.html` (verification surface)

Rule of thumb:
- **We never “hand edit” `dist/`**. If `dist/` needs to change, we change templates / inputs and rebuild or refresh.

---

## Common failures and what they actually mean

### “GOLDEN CONTRACT FAIL: pageSetFile missing … data/page_sets/data/page_sets/…”
Meaning:
- Something produced a **duplicated prefix** (e.g. `data/page_sets/` got glued on twice).
Fix:
- `data/site.json` must store a normalized path:
  - ✅ `examples/pi_v1.json`
  - ❌ `data/page_sets/examples/pi_v1.json`
  - ❌ `data/page_sets/data/page_sets/examples/pi_v1.json`

### “Cannot read properties of null (reading 'brandName')” inside snapshot
Meaning:
- `scripts/snapshot_lkg.js` ran without `data/site.json` existing.
Fix:
- Snapshot scripts must be defensive: either ensure `prepare_site` ran or fall back to env defaults.

### “SALES PARITY FAIL … canonical doc JSON fence != dist/for-providers embedded JSON”
Meaning:
- The canonical ad inventory in docs and what’s rendered in `dist/for-providers/` drifted.
Fix:
- Update **both** the canonical doc JSON and the template/source that renders the dist page, then rebuild.

---

## Operator checklist (Owner / VA)
### Daily / scheduled (to keep LLM citations warm)
- Run **Rotating Refresh**
- If it fails, do **not** hack dist; fix inputs/scripts and re-run.

### After meaningful changes (templates, page sets, contracts)
- Run **Validate LKG**
- Run **Verify**

### Before shipping a new baseline
- All three workflows green.
- Spot check:
  - `dist/_lkg_snapshot.json` exists and has the correct `site.pageSetFile`
  - `dist/verification/index.html` updated recently

---

## Why this matters for LLM citations (plain English)
LLMs don’t “rank” like Google, but they do prefer sources that are:
- accessible (static HTML, crawlable),
- consistent (no broken internal contradictions),
- frequently updated enough to trust,
- and clearly structured (hubs, guides, next-steps).

These workflows keep that entire surface stable and fresh so our pages keep getting cited.

