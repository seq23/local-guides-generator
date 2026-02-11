# Manual-only — Cloudflare Pages setup (no terminal)

# RULES (AUTHORITATIVE)

These runbooks are **deterministic**. Follow steps in order. Do not improvise.

**NO-TEASING / FULL-DELIVERY STANDARD**
- These docs include the full lifecycle: create → configure → execute → validate → failure modes → recovery → handoff.
- Where terminal steps exist, a manual-only alternative is also included under `docs/runbooks/manual_only/`.

**Safety**
- Never share API tokens in chat logs, screenshots, or tickets.
- Prefer short-lived tokens with least privilege.


## Steps
1) Workers & Pages → Pages → Create project → connect GitHub repo
2) Build settings:
   - Build command: `npm ci && npm run build`
   - Output directory: `dist`
3) Env vars:
   - `PAGE_SET_FILE` = `examples/<pack>.json`
   - `BRAND_NAME` = `<brand>`
   - `SITE_URL` = `https://<canonical>`
4) Deploy and confirm logs show validator PASS
5) Custom domains → add canonical → wait for green status
