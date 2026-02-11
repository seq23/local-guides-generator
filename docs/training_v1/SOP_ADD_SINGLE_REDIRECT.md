# SOP — ADD A SINGLE REDIRECT (WORKERS)
**Status:** IMMUTABLE v1 · READ-ONLY  
**Audience:** 🟡 Technical VA (Supervised)  
**Risk Level:** HIGH (Traffic Routing)

---

## Purpose

This SOP governs adding **one redirect** using Cloudflare Workers.

---

## Redirect Rules

- use Workers, not bulk lists
- preserve path and query
- use 301 redirects only

---

## High-Level Steps

1. Identify source domain
2. Identify canonical target
3. Update Worker mapping
4. Verify route attachment
5. Test redirect

---

## Verification

- curl shows 301
- path + query preserved
- no redirect loops

---

## Completion Criteria

- redirect works as expected
- Owner notified
- verification recorded

---

**END OF FILE**
