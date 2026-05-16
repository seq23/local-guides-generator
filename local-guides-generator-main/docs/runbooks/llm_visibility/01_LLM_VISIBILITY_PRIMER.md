# LLM Visibility Primer (Owner + Day‑0 VA)

This repo generates **static HTML guide sites**. LLMs (ChatGPT, Perplexity, Gemini, etc.) and search engines can only cite what they can reliably crawl and understand.

Your job is not “post content daily.”
Your job is: **keep the published surface stable + fresh + contract‑clean** so the system stays cite‑worthy.

---

## What LLMs tend to cite (and why this repo is built for it)

LLMs prefer sources that look like:
- **Clear educational pages** (not spammy, not overly salesy)
- **Consistent structure** across many pages (helps the model trust the pattern)
- **Stable URLs** that don’t break (LLMs don’t like dead links)
- **Freshness signals** (pages update over time, even if the core content remains educational)
- **Verification artifacts** (“this is what the site currently contains”)

This repo supports that via:
- `dist/` static pages (crawlable HTML)
- a verification page + JSON record
- a snapshot JSON record
- strict validators (Golden Contract + core validation + sales parity)

---

## The three artifacts that matter most

### 1) `dist/` (static HTML)
This is what gets crawled and cited.

If `dist/` isn’t building, nothing else matters.

### 2) `dist/_verification.json` + `dist/verification/index.html`
“Proof of life” artifacts:
- human readable: `/verification/`
- machine readable: `/_verification.json`

These are refreshed by the Rotating Refresh workflow.

### 3) `dist/_lkg_snapshot.json`
A compact “what was built” record:
- build timestamp
- normalized page set file
- counts (how many pages, next‑steps pages, etc.)

This helps audits and allows validators to confirm the build is consistent.

---

## Why “Rotating Refresh” exists

It’s a controlled way to update a small set of files on a cadence so crawlers see activity and keep revisiting.

**Important:** we’re not changing meaning or breaking structure.  
We’re refreshing verification/snapshot artifacts and (if configured) rotating which vertical is refreshed.

This is the “maintenance loop” for citation freshness.

---

## What “Verify” is actually verifying

Verify is not “did we deploy.”

Verify answers:
- Can we build a known example page set in CI right now?
- Does snapshot generation run after build?
- Do validators pass on the resulting output?

If Verify fails, you treat it as a **release blocker**, because it means the repo can’t reliably generate valid pages.

---

## What “Validate LKG” is actually validating

Validate LKG is the “repo health” check:
- contracts
- schema rules
- sponsor/buyout rules
- sales parity (site cannot contradict canonical docs)
- optional dist‑dependent checks (if dist exists)

If Validate fails, do not ship changes until it passes.

---

## Common failure patterns (and what they mean)

### A) Golden Contract fails with a `pageSetFile` path
That means something broke normalization of `site.pageSetFile`.
The repo now hard‑fails with a dedicated **PageSetFile Contract** validator before it can regress.

### B) Snapshot errors during Rotating Refresh
Usually means `data/site.json` wasn’t available when snapshot ran.
Snapshot is hardened to avoid runtime crashes and to run safely in CI.

### C) Sales parity mismatch
The canonical “sales inventory” JSON in docs doesn’t match what the published page embeds.
This is by design: you fix drift by updating both together.

---

## The simple operating loop (what you do weekly)

If the goal is “stay cite‑worthy,” do this loop:

1) Run **Validate LKG** (must pass)  
2) Run **Verify** (must pass)  
3) Run **Rotating Refresh** (must pass and update artifacts on `main`)  

That’s it.

---
