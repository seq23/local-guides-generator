# Manual-only — add multiple domains to Cloudflare (no terminal)

# RULES (AUTHORITATIVE)

These runbooks are **deterministic**. Follow steps in order. Do not improvise.

**NO-TEASING / FULL-DELIVERY STANDARD**
- These docs include the full lifecycle: create → configure → execute → validate → failure modes → recovery → handoff.
- Where terminal steps exist, a manual-only alternative is also included under `docs/runbooks/manual_only/`.

**Safety**
- Never share API tokens in chat logs, screenshots, or tickets.
- Prefer short-lived tokens with least privilege.


## Goal
Add many domains as zones in Cloudflare (pending/active depending on nameservers).

## Steps
1) Cloudflare dashboard → **Add a site**
2) Enter domain → continue
3) Choose plan (Free is fine unless you need paid features)
4) Cloudflare shows assigned nameservers
5) In Namecheap:
   - Domain List → check the domain(s)
   - Change Nameservers → **Custom DNS**
   - Paste the two Cloudflare nameservers exactly
6) Wait for Cloudflare to show the zone as Active.

## VA checklist
- Confirm the domain shows “Active” in Cloudflare
- Confirm NS records in terminal (if allowed):
  - `dig domain.com NS +short`

## Red flags
- Do not enable DNSSEC unless owner instructs
- Do not change SSL mode without owner approval
