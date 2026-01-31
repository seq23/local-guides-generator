# Cloudflare Pages — project setup per vertical (deterministic)

# RULES (AUTHORITATIVE)

These runbooks are **deterministic**. Follow steps in order. Do not improvise.

**NO-TEASING / FULL-DELIVERY STANDARD**
- These docs include the full lifecycle: create → configure → execute → validate → failure modes → recovery → handoff.
- Where terminal steps exist, a manual-only alternative is also included under `docs/runbooks/manual_only/`.

**Safety**
- Never share API tokens in chat logs, screenshots, or tickets.
- Prefer short-lived tokens with least privilege.


## Objective
Create one Cloudflare Pages project per vertical pack, all building from the same repo.

## Inputs
- GitHub repo: `seq23/local-guides-generator`
- Pack file: `examples/<pack>.json` (set via env var)
- Canonical domain for that vertical

## Step 1 — Create the Pages project
Cloudflare Dashboard → **Workers & Pages** → **Pages** → **Create a project** → **Connect to Git** → select repo.

## Step 2 — Build settings (must match repo)
Set:
- Framework preset: **None** (static build)
- Build command: `npm ci && npm run build`
- Build output directory: `dist`

## Step 3 — Environment variables (Production)
Add:
- `PAGE_SET_FILE` = `examples/<pack>.json`
- `BRAND_NAME` = `<Brand>`
- `SITE_URL` = `https://<canonical-domain>` (use the real canonical once verified)

Notes:
- Variable name = the key (e.g., `PAGE_SET_FILE`)
- Value = the exact string (e.g., `examples/uscis_medical_v1.json`)

## Step 4 — Deploy + confirm success
Trigger deploy. Confirm logs show:
- `Wrote data/site.json`
- `Built dist with pageSetFile=...`
- Validator checks all PASS
- “Assets published” success

## Step 5 — Failure recovery
Common failures:
- Wrong `PAGE_SET_FILE` path (must be relative like `examples/...`)
- Wrong build output directory (must be `dist`)
- Node/npm mismatch (Cloudflare chooses versions; you can set `.nvmrc` in repo if needed)

## Step 6 — Add custom domain (canonical)
Pages → project → **Custom domains** → add canonical.
Wait for green + SSL issued.

Proceed to the SSL/CNAME verification runbook next.
