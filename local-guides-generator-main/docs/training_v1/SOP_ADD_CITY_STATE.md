# SOP — ADD A CITY / STATE
**Status:** IMMUTABLE v1 · READ-ONLY  
**Audience:** 🟡 Technical VA (Supervised)  
**Risk Level:** MEDIUM (Inventory & Coverage)

---

## Purpose

This SOP governs how new cities or states are added **without breaking coverage rules**.

Coverage errors are **SEV-1 failures**.

---

## Before You Start (MANDATORY)

Confirm:
- you are authorized by the Owner
- you understand coverage authority rules
- validation currently passes

If not, stop.

---

## High-Level Flow

1. Identify the authoritative inventory source
2. Add city/state data in the correct location
3. Regenerate affected pages
4. Run validation
5. Escalate results

---

## Rules You Must Not Break

- Never add inventory without updating runtime JSON
- Never assume hubs will auto-correct
- Never skip validation

---

## Completion Criteria

You are done only when:
- validation passes
- pages render correctly
- Owner has been notified

---

**END OF FILE**
