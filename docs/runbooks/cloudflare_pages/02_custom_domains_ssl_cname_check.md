# Cloudflare Pages — custom domains, CNAME, SSL/TLS verification

# RULES (AUTHORITATIVE)

These runbooks are **deterministic**. Follow steps in order. Do not improvise.

**NO-TEASING / FULL-DELIVERY STANDARD**
- These docs include the full lifecycle: create → configure → execute → validate → failure modes → recovery → handoff.
- Where terminal steps exist, a manual-only alternative is also included under `docs/runbooks/manual_only/`.

**Safety**
- Never share API tokens in chat logs, screenshots, or tickets.
- Prefer short-lived tokens with least privilege.


## Goal
Ensure each canonical domain correctly points to Pages and serves HTTPS without errors.

## Step 1 — Confirm required DNS record
In Cloudflare zone → **DNS**:
- A `CNAME` record for the domain (or `@`) pointing to your Pages hostname (or as Cloudflare instructs)
- Proxy status: typically **Proxied** (orange cloud) for Pages

## Step 2 — Confirm `www` behavior
Decide the standard:
- Either `www` redirects to apex
- Or apex redirects to `www`

For this system, keep it consistent across all domains.

## Step 3 — SSL/TLS mode
Cloudflare zone → **SSL/TLS**:
- For Pages-based sites, Cloudflare-managed cert is typical.
- Ensure Universal SSL is enabled.
- If you see handshake or “Pending validation,” wait and re-check DNS.

## Step 4 — Terminal verification (pass/fail)
Replace with your domain:

```bash
DOMAIN="dentistryguides.com"
dig +short $DOMAIN
dig +short www.$DOMAIN

curl -I "https://$DOMAIN/"
curl -I "https://www.$DOMAIN/"
```

PASS criteria:
- HTTP status `200` for canonical host (or `301` → canonical)
- No `525/526/522` errors

## What 522 means in this system
A 522 is Cloudflare timing out connecting to the origin.
For redirect-only domains, you must ensure:
- Your Worker route is attached for both apex and `www`
- There is a proxied DNS record (`A @` + `CNAME www -> @` proxied) so requests reach Cloudflare

## Fix for 522 (redirect-only domain)
In zone DNS:
- Ensure `A @` exists and is **Proxied**
- Ensure `CNAME www -> @` exists and is **Proxied**
Then confirm Worker routes include:
- `domain.com/*`
- `www.domain.com/*`

Re-test:
```bash
curl -I "https://domain.com/abc?z=1"
curl -I "https://www.domain.com/abc?z=1"
```
