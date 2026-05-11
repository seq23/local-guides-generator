# SOP — CREATE OR REGENERATE GUIDES
**Status:** IMMUTABLE v1 · READ-ONLY  
**Audience:** 🟢 Standard VA  
**Risk Level:** LOW (Content only)

---

## Purpose

This SOP covers creating or regenerating guides **without altering structure or ads**.

---

## What You May Change

- guide text
- headings
- formatting within allowed blocks

---

## What You May NOT Change

- ad block placement
- compliance language
- page structure

---

## High-Level Steps

1. Identify the guide to update
2. Regenerate content using approved prompts
3. Confirm formatting integrity
4. Run validation

---

## Completion Criteria

- guide renders in blocks (not flat text)
- ads are present
- validation passes

---

**END OF FILE**


## PI guide opening rule

When editing canonical PI guides, the first visible answer surface must contain one of the following before long prose:
- a numbered checklist
- a compact comparison table
- a step-by-step decision framework

This is required so the guide is readable by users and extractable by LLMs.


## Release note for operators

Guide content may be correct while the release artifact is still wrong.

Before delivering any baseline ZIP that includes guide changes:
- run repo validation
- run `node scripts/release_guard.js --pre`
- package the ZIP
- reopen the ZIP in a clean temp folder
- run `node scripts/release_guard.js --post`
- run `node scripts/validate_snapshot_package.js .`
- run `npm run audit:links`

Only the reopened ZIP is considered release-safe.
