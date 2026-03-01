# 04 — VALIDATION CORE SOP
**Status:** IMMUTABLE v1 · READ-ONLY  
**Audience:** All VAs  

---

## Why Validation Exists

Validation prevents:
- broken pages
- missing ads
- compliance drift
- silent regressions

If validation fails, **do not continue**.

---

## How to Run Validation

From the repo root:
```
npm run validate:all
```

---

## Interpreting Results

### PASS
- command exits cleanly
- no red errors
- summary indicates success

You may proceed.

### FAIL
- red error output
- explicit failure message

You must stop.

### WARNINGS
Some validators intentionally emit **warnings** that do **not** stop the build.

You must still capture warnings and escalate if they appear unexpected.

---

## What Validation Commonly Catches

- missing ad blocks
- missing inventory
- broken links
- branding violations

These are **not optional fixes**.

---

## Special Contract: Connection Bubble (Request Assistance)

This repo enforces a production contract for the bottom-of-page **Connection Bubble**.

Validator:
- `scripts/validation/connection_bubble_contract.js`

Hard FAIL if:
- bubble is missing on any required page
- bubble appears more than once on any required page

Warning-only if:
- bubble appears on non-required pages

---

## If Validation Fails

1. Capture output
2. Screenshot terminal
3. Escalate

Do NOT rerun randomly.

---

**END OF FILE**
