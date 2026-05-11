# Guides system — authoring and regeneration runbook

# RULES (AUTHORITATIVE)

These runbooks are **deterministic**. Follow steps in order. Do not improvise.

**NO-TEASING / FULL-DELIVERY STANDARD**
- These docs include the full lifecycle: create → configure → execute → validate → failure modes → recovery → handoff.
- Where terminal steps exist, a manual-only alternative is also included under `docs/runbooks/manual_only/`.

**Safety**
- Never share API tokens in chat logs, screenshots, or tickets.
- Prefer short-lived tokens with least privilege.


## What this covers
- Where guides live
- How to regenerate guides deterministically
- QA gates and how to fix failures
- How to ship changes safely

## Repo locations (current)
- Generated guides: `docs/_generated_guides/`
- Guide sync script: `scripts/sync_guides.js`
- Build + validators: `scripts/validate_tbs.js` (runs during build/postbuild)
- City/site builder: `scripts/build_city_sites.js`

## Prereqs
- Node + npm installed
- Repo cloned locally
- Clean working tree preferred

## Step 0 — Confirm the project scripts you will run
From repo root:

```bash
cat package.json | jq '.scripts'
```

Current scripts (from this repo snapshot):
- `build`: npm run prepare && node scripts/build_city_sites.js
- `validate:all`: node scripts/validate_all_packs.js
- `snapshot:lkg`: node scripts/snapshot_lkg.js
- `postbuild`: node scripts/snapshot_lkg.js && node scripts/validate_tbs.js
- `validate`: node scripts/validate_tbs.js
- `prepare`: node scripts/prepare_site.js
- `sync:guides`: node scripts/sync_guides.js

## Step 1 — Edit / add guide content (authoring)
Guides are stored under `docs/_generated_guides/` as Markdown.

Rules:
- Exactly **one** H1 per guide
- No triple-backtick code fences inside guide files
- Minimum content: validator enforces “not thin” (word count)
- Internal links must resolve to files that exist in `dist` after build

To find a guide to edit:

```bash
ls -la docs/_generated_guides | head
```

## Step 2 — Regenerate / sync guides into runtime
The repo uses `scripts/sync_guides.js` to align guides into the build system.

Run:

```bash
node scripts/sync_guides.js
```

Expected:
- It updates guide indexes and any generated references.
- If it prints errors, stop and fix before building.

## Step 3 — Build + validate (hard gate)
Run:

```bash
npm ci
npm run build
```

This build runs validators (postbuild). You must get a full pass.

### If build fails — common causes + fixes
**A) “No markdown fences in scripts/”**
- You accidentally added ``` inside a JS file. Remove it.

**B) “Internal links resolve” fails**
- Find the broken href in the validator output.
- Fix the link or ensure the target page exists in the relevant pack.

**C) “Guide pages have a single H1” fails**
- Search the guide file for multiple `# ` headings and reduce to one H1.

**D) “Guide canonical parity audit” fails**
- Canonical links are wrong for the pack/domain. Fix `data/site.json` generation inputs or pack configuration.

**E) “Ad tokens resolved” fails**
- You left unresolved `%%AD:...%%` tokens in `dist/`.
- Fix the page templates or token resolver configuration.

## Step 4 — Verification bundle (pass/fail)
After a successful build:

```bash
test -f dist/_lkg_snapshot.json && echo "PASS snapshot" || echo "FAIL snapshot"
test -d dist && echo "PASS dist" || echo "FAIL dist"
```

Optional: sanity-open a generated guide page locally:

```bash
python3 -m http.server 8080 --directory dist
# open http://localhost:8080 in browser
```

## Step 5 — Commit + push (safe release)
```bash
git status
git add -A
git commit -m "guides: update and regen"
git push
```

## Rollback
If something breaks after deploy:
```bash
git log --oneline --max-count=10
# pick last known good commit
git revert <bad_commit_sha>
git push
```

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

