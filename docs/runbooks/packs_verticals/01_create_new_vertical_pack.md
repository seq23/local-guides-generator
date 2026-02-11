# Packs / verticals — create a new pack (page set) runbook

# RULES (AUTHORITATIVE)

These runbooks are **deterministic**. Follow steps in order. Do not improvise.

**NO-TEASING / FULL-DELIVERY STANDARD**
- These docs include the full lifecycle: create → configure → execute → validate → failure modes → recovery → handoff.
- Where terminal steps exist, a manual-only alternative is also included under `docs/runbooks/manual_only/`.

**Safety**
- Never share API tokens in chat logs, screenshots, or tickets.
- Prefer short-lived tokens with least privilege.


## What this covers
- Creating a new `examples/<pack>.json` page set file
- Wiring Cloudflare Pages env vars to build that pack
- Validation and failure recovery

## Repo locations
- Page sets: `data/page_sets/examples/*.json`
- Site prep: `scripts/prepare_site.js`
- Build: `scripts/build_city_sites.js`
- Licensing lookups (non-PI): `data/licensing_lookup/*.json`

## Step 1 — Clone the closest existing pack
List packs:
```bash
ls -la data/page_sets/examples
```

Clone:
```bash
cp data/page_sets/examples/<closest_pack>.json data/page_sets/examples/<new_pack>.json
```

## Step 2 — Edit pack fields
Rules:
- Keep required global pages present
- Respect “educationOnly” flags: if educationOnly=true, **no next-steps pages/zones** should exist anywhere
- Ensure schema output rules are respected (validators will enforce)

Open and edit:
```bash
nano data/page_sets/examples/<new_pack>.json
```

## Step 3 — Licensing lookup requirements (non-PI)
If this is non-PI and requires licensing references:
- Ensure there is a corresponding file in `data/licensing_lookup/<vertical>.json`
- Ensure every state you support has at least one URL

## Step 4 — Local build + validation
```bash
export PAGE_SET_FILE="examples/<new_pack>.json"
export BRAND_NAME="Your Brand Name"
export SITE_URL="https://example.com"  # placeholder; Pages will set real domain
npm ci
npm run build
```

Expected: validators pass.

## Step 5 — Cloudflare Pages config
In Pages project settings:
- Env var: `PAGE_SET_FILE` value should be `examples/<new_pack>.json` (relative path)
- `BRAND_NAME` and `SITE_URL` must match the canonical domain once live

## Step 6 — Rollback
If deploy breaks:
- Revert pack to last known good commit
- Re-run build
- Re-deploy

## LLM PROMPTS (copy/paste)

### Prompt 1 — Generate/refresh guides from source notes
You are the Local Guides Generator content assistant. Your job is to produce guides that are:
- accurate, non-legal/non-medical advice, informational only
- city-aware but **not** claiming endorsements
- include clear evaluation framework sections
- include ad token placeholders where required (do not resolve tokens)

INPUTS I WILL PROVIDE:
- vertical name + pack file path (examples/*.json)
- target city + state
- sponsor mode flags (education-only vs directory vs buyout)
- any local partner notes

OUTPUT REQUIREMENTS:
- return Markdown only
- include exactly one H1
- 900–1,500 words unless pack requires different
- include FAQ section with 10–12 items (no duplicates)
- do not include markdown fences inside the file
- include internal links using relative paths where applicable

Now generate the guide:
[PASTE INPUTS]

### Prompt 2 — Create a new pack (page set JSON)
You are the generator architect. Create a new page set JSON by cloning the closest existing pack and modifying only what is necessary for the new vertical.
Constraints:
- must include required global pages and required zones (page contracts)
- must set pack flags correctly (educationOnly, nextSteps, directoryAllowed, etc.)
- must include licensing lookup references (non-PI)
- must not add forbidden schema types/fields
Return JSON only.

Inputs:
- closest pack: [PASTE PATH]
- new vertical requirements: [PASTE]

### Prompt 3 — Add a new city runtime listing JSON
You are the runtime inventory assistant. Create a city JSON file consistent with existing runtime listing JSON files in `data/listings/`.
Constraints:
- follow the existing schema conventions
- include required fields and disclosures
- do not invent sponsor/provider endorsements
Return JSON only.
Inputs:
- city/state
- vertical
- partner flags (if any)

