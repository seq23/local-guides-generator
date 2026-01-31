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

---

## What Validation Commonly Catches

- missing ad blocks
- missing inventory
- broken links
- branding violations

These are **not optional fixes**.

---

## If Validation Fails

1. Capture output
2. Screenshot terminal
3. Escalate

Do NOT rerun randomly.

---

**END OF FILE**
