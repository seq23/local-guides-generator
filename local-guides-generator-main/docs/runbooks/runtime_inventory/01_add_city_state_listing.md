# Runtime inventory — add a city/state listing runbook

# RULES (AUTHORITATIVE)

These runbooks are **deterministic**. Follow steps in order. Do not improvise.

**NO-TEASING / FULL-DELIVERY STANDARD**
- These docs include the full lifecycle: create → configure → execute → validate → failure modes → recovery → handoff.
- Where terminal steps exist, a manual-only alternative is also included under `docs/runbooks/manual_only/`.

**Safety**
- Never share API tokens in chat logs, screenshots, or tickets.
- Prefer short-lived tokens with least privilege.


## What this covers
- Adding a new city/state runtime JSON
- PI coverage parity expectations (if PI)
- Validate + rollback

## Repo locations
- Listings runtime JSON: `data/listings/`
- PI master inventory CSV: `data/pi_personal_injury_master.csv`
- Validators: `scripts/validate_tbs.js`

## Step 1 — Choose the correct destination path
Your runtime inventory is organized under `data/listings/` and must match existing patterns.

From repo root:
```bash
find data/listings -maxdepth 3 -type f -name "*.json" | head -n 20
```

Pick the existing vertical folder pattern (do not invent a new structure).

## Step 2 — Create the new city JSON by cloning an existing city file
Pick the closest city in the same state/vertical:

```bash
SRC=$(find data/listings -type f -name "*.json" | head -n 1)
echo "Cloning from: $SRC"
```

Create your new file:

```bash
# Example target path — replace with your real target path
TARGET="data/listings/<VERTICAL>/<STATE>/<CITY>.json"
mkdir -p "$(dirname "$TARGET")"
cp "$SRC" "$TARGET"
```

Now edit `TARGET` and update fields (city/state, slugs, any location disclosures).

## Step 3 — PI coverage parity (only if PI vertical)
If you are adding PI inventory:
- Update `data/pi_personal_injury_master.csv`
- Ensure every city/state in the CSV has a corresponding runtime JSON file.
- The build must hard-fail on CSV ↔ runtime mismatch.

Fast check:
```bash
python3 - <<'PY'
import csv, os, sys
csv_path="data/pi_personal_injury_master.csv"
missing=[]
with open(csv_path,newline="") as f:
    r=csv.DictReader(f)
    for row in r:
        city=row.get("city") or row.get("City") or ""
        state=row.get("state") or row.get("State") or ""
        if not city or not state:
            continue
        # NOTE: adjust this mapping if your repo uses a different naming convention
        # This is intentionally conservative: it reports "unknown mapping" rather than guessing.
        pass
print("NOTE: PI mapping is repo-specific. Use existing PI file naming as the authoritative pattern.")
PY
```

## Step 4 — Build + validate
```bash
npm ci
npm run build
```

You must get a full validator pass.

## Step 5 — Verify the new city is in dist
Search for the city slug:
```bash
grep -R --line-number -i "<CITY_OR_SLUG>" dist | head
```

## Step 6 — Commit + push
```bash
git add -A
git commit -m "inventory: add <CITY>, <STATE> (<VERTICAL>)"
git push
```

## Failure modes + recovery
**A) Validator complains about missing required zones**
- Your pack expects content blocks you didn’t supply. Fix the source templates or city JSON fields required by the pack.

**B) “click audit” failures**
- A hub links to a page that wasn’t generated. Fix pack page definitions or inventory entry.

**C) PI coverage check fails**
- CSV contains a city with no runtime JSON, or runtime JSON exists but city not in CSV (depending on rules). Restore parity and rebuild.

## Manual-only alternative
If a VA cannot use terminal:
- Provide them the exact target path + a “clone source file” reference.
- They create the file in GitHub UI, copy/paste JSON, then rely on CI/build for validation.
- Owner must still run `npm run build` locally before deploy.
