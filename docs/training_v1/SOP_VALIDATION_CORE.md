# SOP — Core Validation (Training v1)

This repo has **one canonical executable validation entrypoint**:

```bash
npm run validate:all
```

That runs `node scripts/validate_core.js` and **nothing else**.

---

## Training pack vs Baseline pack

### Training pack (starter_v1)
Use only for VA practice.

```bash
LKG_ENV=training PAGE_SET_FILE=data/page_sets/starter_v1.json npm run build
npm run validate:all   # SKIPS (non-blocking)
npm run validate       # SKIPS (non-blocking)
```

### Baseline / Production packs (examples/*)
Baseline builds are strict and must pass validation.

```bash
PAGE_SET_FILE=data/page_sets/examples/trt_v1.json npm run build
npm run validate:all
npm run validate
```

Rules:
- `PAGE_SET_FILE` is required (no defaults).
- `starter_v1.json` is TRAINING ONLY and refused for baseline builds.

---

## What `validate:all` enforces (hard-fail)

`validate:all` is the **release gate**.

It hard-fails on:

1) **Buyouts schema** (if any buyouts exist)
2) **Buyout next-steps hardfail** (if any LIVE buyouts exist)
3) **For-providers inquiry contract**
4) **Guides index links**
5) **Footer contract**
6) **Golden major blocks (city pages)**
7) **Link audit**

---

## For-providers inquiry contract (current reality)

File checked:
- `dist/for-providers/index.html`

Hard-fail only on:
- page missing
- no mailto links
- any mailto contains **multiple recipients** (`mailto:a@x.com,b@y.com`)
- more than **4 distinct mailto templates** (regression / drift)

Allowed shape:
- Up to **4** distinct mailto templates (tier-specific CTAs are allowed)
- Subject/body wording can vary

Body capture fields:
- Missing fields (like “How did you hear about us?”) produce **warnings**, not hard-fails.

---

## Golden major blocks — City pages (ads + core sections)

For each city page (`dist/<city>/index.html`), we enforce:

- Exactly **3** sponsored blocks total:
  - `data-sponsored-placement="top"` appears **exactly 1 time**
  - `data-sponsored-placement="mid"` appears **exactly 1 time**
  - `data-sponsored-placement="bottom"` appears **exactly 1 time**

Common required sections:
- Evaluation framework block
- “Start here: Costs • Timeline • Questions to ask • Red flags (educational)” block
- FAQ block
- Guides block marker (`data-guides="true"`)

PI vs non-PI:
- PI city pages must render directory (not example providers) and must **NOT** render state lookup.
- non-PI city pages must render example providers + state lookup.

LLM bait ordering:
- The LLM bait question block must appear **above** providers/directory on ALL city pages.

---

## Quick command cheats

Build a baseline pack:
```bash
PAGE_SET_FILE=data/page_sets/examples/trt_v1.json npm run build
npm run validate:all
```

Build the training pack:
```bash
LKG_ENV=training PAGE_SET_FILE=data/page_sets/starter_v1.json npm run build
npm run validate:all
```
