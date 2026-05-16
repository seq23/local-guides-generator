# SOP — ADD A SINGLE DOMAIN (CLOUDFLARE)
**Status:** IMMUTABLE v1 · READ-ONLY  
**Audience:** 🟡 Technical VA (Supervised)  
**Risk Level:** HIGH (DNS / Availability)

---

## Purpose

This SOP governs adding **one new domain** to Cloudflare safely.

A mistake here can cause downtime.

---

## Before You Start (MANDATORY)

Confirm:
- Owner has approved domain addition
- You have Cloudflare access
- You understand DNS propagation delays

If any item is missing, stop.

---

## High-Level Steps

1. Add domain to Cloudflare
2. Verify nameservers
3. Apply required DNS records
4. Confirm proxy status
5. Verify resolution

---

## DNS Requirements (NON-NEGOTIABLE)

Each domain must have:
- `A @ → 192.64.119.112` (proxied)
- `CNAME www → @` (proxied)

---

## Verification

- `dig` confirms DNS
- browser resolves domain
- no Cloudflare errors

---

## Completion Criteria

- domain resolves
- DNS records correct
- Owner notified

---

**END OF FILE**
