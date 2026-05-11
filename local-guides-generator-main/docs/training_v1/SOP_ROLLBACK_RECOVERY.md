# 🔴 SOP — ROLLBACK & RECOVERY
**Status:** IMMUTABLE v1 · READ-ONLY  
**Audience:** OWNER ONLY  
**Risk Level:** CRITICAL

---

## Purpose

This SOP exists to recover from mistakes safely.

Only the Owner executes this SOP.

---

## When to Roll Back

- traffic loss
- validation failure after release
- broken pages in production

---

## High-Level Recovery Flow

1. Identify last known good tag
2. Restore snapshot
3. Re-run validation
4. Verify production behavior

---

## Rules

- never panic
- never guess
- never skip validation

---

## Completion Criteria

- system stable
- issue documented
- root cause noted

---

**END OF FILE**
