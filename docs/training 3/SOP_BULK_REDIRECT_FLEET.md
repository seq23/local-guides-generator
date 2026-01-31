# SOP — BULK REDIRECT FLEET (WORKERS)
**Status:** IMMUTABLE v1 · READ-ONLY  
**Audience:** 🟡 Technical VA (Supervised)  
**Risk Level:** VERY HIGH (Traffic at Scale)

---

## Purpose

This SOP governs **large fleets of redirects** using Cloudflare Workers.

Mistakes here affect many domains at once.

---

## Non-Negotiable Rules

- Workers-based redirects only
- No Cloudflare bulk redirect lists
- Path and query must be preserved
- 301 redirects only

---

## Before You Start

Confirm:
- Owner approval
- domain list validated
- rollback plan understood

If any are missing, stop.

---

## High-Level Flow

1. Prepare redirect mapping
2. Update Worker script
3. Attach routes per domain
4. Verify sample redirects
5. Escalate results

---

## Verification

- curl tests for sample domains
- confirm no loops
- confirm correct destination

---

## Completion Criteria

- sample redirects pass
- no unexpected behavior
- Owner notified

---

**END OF FILE**
