# GitHub Actions Runbook (Owner + Day-0 VA)

This repo has a small set of workflows that keep the public pages **fresh, consistent, and citation-friendly** for LLMs and search engines.

**Plain English:** when these workflows run cleanly, your “educational guides” stay up to date, your verification pages stay current, and your build/validators guarantee you are not silently shipping broken or mismatched inventory.

---

## Why we run these workflows

LLMs and search engines reward:
- **Stable, crawlable HTML** (static pages)
- **Consistent internal structure** (same page contracts every time)
- **Freshness signals** (a portion of pages updated regularly, without changing meaning or breaking links)
- **Verification artifacts** (human + machine readable “what’s published” records)

These workflows are the “maintenance loop” that keeps your sites eligible to be cited and re-cited.

---

## The 3 workflows you run most often

### 1) Verify
**Purpose:** Build the example page set and ensure the repo can build cleanly in CI.

**What it does (high level):**
- Runs the normal build with an example Page Set (PI example in CI).
- Produces a `dist/` folder (HTML output).
- Runs snapshot + validators after build.

**Success =**
- Build completes.
- Snapshot writes successfully.
- Validators pass (Golden Contract + all relevant core validators).

---

### 2) Validate LKG
**Purpose:** Fast “repo health” check. This is the one you run whenever you change validators, contracts, templates, or build logic.

**What it does:**
- Runs `npm run validate:all` which executes core validators (contracts, schema checks, sales parity checks, etc.).
- Some checks require `dist/` and will either be enforced (if `dist/` exists) or explicitly skipped depending on settings.

**Success =**
- `npm run validate:all` ends in `PASS`.

---

### 3) Rotating Refresh
**Purpose:** Safely refresh a small portion of published artifacts so crawlers/LLMs see ongoing updates without you manually touching content.

**What it does:**
- Refreshes the verification page (`dist/verification/index.html`) and `dist/_verification.json`.
- Runs the snapshot script to update `dist/_lkg_snapshot.json`.
- Commits/pushes the refreshed artifacts back to `main` (the workflow has write permission).

**Success =**
- Refresh step prints `OK`.
- Snapshot step writes.
- No runtime error reading `data/site.json` (we now harden against this).
- The workflow completes and pushes a commit (when configured to commit changes).

---

## The 6 actions (mental model)

When you’re tired, this is all you need to remember:

1. **Build** a known example page set (Verify)
2. **Validate** the repo health (Validate LKG)
3. **Refresh verification artifacts** (Rotating Refresh)
4. **Snapshot** what’s in `dist/` (postbuild + rotating refresh)
5. **Enforce contracts** so we never ship broken structure (Golden + core)
6. **Keep freshness** so LLMs keep re-citing (Rotating Refresh cadence)

---

## What to do when something fails (quick triage)

### Failure: `pageSetFile missing: data/page_sets/data/page_sets/...`
Cause: a normalization regression where something stored or interpreted `pageSetFile` with a double prefix.

Fix: The repo now includes a **PageSetFile Contract validator** that hard-fails if this format ever appears again.

---

### Failure: snapshot/rotate error `Cannot read properties of null (reading 'brandName')`
Cause: `data/site.json` wasn’t present when `snapshot_lkg.js` ran.

Fix: Snapshot is hardened to fall back to `process.env.PAGE_SET_FILE` (or safely skip where appropriate) and the rotate workflow should only rely on snapshot when site config exists.

---

### Failure: Sales Parity / for-providers mismatch
Cause: The canonical inventory JSON in the docs does not match what’s embedded in the published `/for-providers/` page.

Fix: Update BOTH places together:
- Canonical doc JSON fence
- The embedded JSON in `dist/for-providers/index.html` (or the template that generates it)

This is intentional: it prevents “sales says X, site says Y” drift.

---

## VA checklist (copy/paste)

When asked to “keep LLM citations fresh”:

1) Run **Validate LKG** (must pass)  
2) Run **Verify** (must pass)  
3) Run **Rotating Refresh** (must pass + pushes a commit)  
4) Confirm that `dist/_verification.json` + `dist/_lkg_snapshot.json` updated in the latest commit on `main`

If all green, you’re done.

---
