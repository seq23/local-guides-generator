# Releases — LKG Update Runbook (snapshot vs patch)

# RULES (AUTHORITATIVE)

These runbooks are **deterministic**. Follow steps in order. Do not improvise.

**NO-TEASING / FULL-DELIVERY STANDARD**
- These docs include the full lifecycle: create → configure → execute → validate → failure modes → recovery → handoff.
- Where terminal steps exist, a manual-only alternative is also included under `docs/runbooks/manual_only/`.

**Safety**
- Never share API tokens in chat logs, screenshots, or tickets.
- Prefer short-lived tokens with least privilege.


## Purpose
Deterministic, low-surprise repo updates when applying a ZIP update.

## Modes
### Snapshot mode (default)
- ZIP is a **full repo snapshot**
- rsync uses `--delete` (files missing from ZIP will be deleted locally)

### Patch mode
- ZIP is a patch/incremental update
- rsync runs **without** `--delete` to avoid unintended deletions

## Built-in preflight (required)
Before applying changes:
1) Print ZIP manifest
2) rsync dry-run and save report
3) show `git diff --stat` before commit

## One-command script
This project uses an update helper script (place it in your home directory):
- `~/update_lkg_from_zip.sh`

If you don’t have it:
- copy the authoritative script from your OS runbook store into `~/update_lkg_from_zip.sh`

## Execution (non-interactive)
Preferred invocation:
```bash
~/update_lkg_from_zip.sh "<ZIP_FULL_PATH>" "<REPO_PATH>" snapshot
# or
~/update_lkg_from_zip.sh "<ZIP_FULL_PATH>" "<REPO_PATH>" patch
```

## After update
Always run:
```bash
npm ci
npm run validate:all || npm run build
```

## If validation fails
- Check `dist/_broken_links.csv` (if produced)
- `git status` to see what changed
- Restore tracked files if accidental deletions occurred:
```bash
git restore .
```
Then re-run validate/build.

## Rollback
- Use the timestamp tag created by the script
- Or revert commit(s) and push

---

## Repo-safe zip packaging (never again)

**Problem:** Finder/GUI zip tools on macOS often inject `__MACOSX/` and `._*` AppleDouble files, and it’s easy to accidentally zip a parent folder containing other snapshots.

**Rule:** Always zip from the repo root using the command below. It excludes macOS metadata and common build junk.

### Canonical command
```bash
# Run from the repo root
REPO_NAME="local-guides-generator-main"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
ZIP_NAME="${REPO_NAME}-packaged_${STAMP}.zip"

# Create zip of the CURRENT repo folder (no nested snapshots)
cd ..
zip -r "${ZIP_NAME}" "${REPO_NAME}" \
  -x "*/__MACOSX/*" "*/._*" "*/.DS_Store" \
  -x "*/node_modules/*" "*/dist/*" "*/.git/*"

echo "Wrote: ${ZIP_NAME}"
```

### Quick preflight checks
```bash
# 1) Ensure no macOS artifact folders are present
find . -name "__MACOSX" -o -name "._*" -o -name ".DS_Store"

# 2) Ensure you are zipping the repo folder itself, not its parent
pwd
ls -la
```

---


---

## REPO-SAFE ZIP PACKAGING (NO __MACOSX, NO NESTED SNAPSHOTS)

### What this prevents
- `__MACOSX/` and `._*` AppleDouble artifacts from macOS Finder
- `.DS_Store` junk
- Accidentally zipping a parent folder that contains a *nested repo snapshot* (e.g., `local-guides-generator-...-355pm/`)
- Shipping build artifacts (`dist/`) or dependencies (`node_modules/`) as if they were source

### Hard rule
**All update ZIPs must be created from the repo root using the canonical command below.**
Do **not** use Finder “Compress”.

### Canonical command (interactive)
Run this from the repo root (the folder that contains `package.json`, `data/`, `scripts/`, `templates/`):

```bash
cd /Users/sequoiataylor/Documents/GitHub/local-guides-generator

STAMP=$(date +"%Y-%m-%d_%H%M%S")
OUT=~/Downloads/local-guides-generator-snapshot_${STAMP}.zip

# Create a clean source snapshot ZIP
zip -r "$OUT" . \
  -x "**/__MACOSX/**" \
  -x "**/.DS_Store" \
  -x "**/._*" \
  -x "**/node_modules/**" \
  -x "**/dist/**" \
  -x "**/.git/**" \
  -x "**/.idea/**" \
  -x "**/.vscode/**" \
  -x "**/*-DOMAINS-INTEGRATED-*/*" \
  -x "**/local-guides-generator-*-*pm/*"

echo "Wrote: $OUT"
```

### Canonical command (non-interactive)
Useful for VA execution / scripts:

```bash
cd /Users/sequoiataylor/Documents/GitHub/local-guides-generator
STAMP=$(date +"%Y-%m-%d_%H%M%S")
OUT=~/Downloads/local-guides-generator-snapshot_${STAMP}.zip
zip -r "$OUT" . -x "**/__MACOSX/**" "**/.DS_Store" "**/._*" "**/node_modules/**" "**/dist/**" "**/.git/**" "**/.idea/**" "**/.vscode/**" "**/*-DOMAINS-INTEGRATED-*/*" "**/local-guides-generator-*-*pm/*"
echo "Wrote: $OUT"
```

### Validation check (required)
After zipping:

```bash
unzip -l "$OUT" | egrep -i "__MACOSX|\.DS_Store|\._" && echo "❌ BAD ZIP" && exit 1 || echo "✅ ZIP CLEAN"
```

### If a bad ZIP already happened
If the repo has `__MACOSX/` or a nested snapshot folder inside it:

```bash
cd /Users/sequoiataylor/Documents/GitHub/local-guides-generator
rm -rf __MACOSX
rm -rf local-guides-generator-*-*pm
rm -rf *-DOMAINS-INTEGRATED-*
```
Then re-run:
- `npm run validate:all`
- the canonical zip command above

---

## Release Artifact Index (Project 9)

## Hub Render Contract Snapshots (Project 7)

**Purpose:** Detect hub/template drift and universal-hub omissions by snapshotting stable markers from rendered city hub pages.

**Artifacts written per pack build:**
- `dist/_hub_contracts_snapshot.json` (current build artifact)
- `releases/hub_contracts/..._hub_contracts.json` (archived per-run artifact)

**What it contains:**
- First 50 city hub pages sampled (deterministic)
- Marker index positions for:
  - `city_hub_top`, `city_hub_mid`, `city_hub_bottom`
  - eval framework / AI visibility / start-here
  - example providers / state lookup / FAQ / guides

**Hard gate:** `npm run validate:all` fails if `dist/_hub_contracts_snapshot.json` is missing or empty.

## Coverage Diff & Drift Reporter (Project 6)

**Purpose:** Make coverage omissions impossible to miss by emitting a diff artifact between the current run and the most recent prior run for the same pack.

**Artifact written when a prior snapshot exists:**
- `releases/diffs/..._diff.json`

**What it reports:**
- deltas in counts (`htmlFiles`, `guidePages`, `cityHubPages`)
- sampled hub pages with missing markers delta

**Notes:**
- Diff generation is best-effort; it is skipped when no prior release entry exists for the same `pageSetFile`.

Every build writes a deterministic pack snapshot (`dist/_lkg_snapshot.json`) and also appends a compact entry to:

```
releases/releases_index.json
```

### What gets recorded
- timestamp
- optional `releaseTag` (if available)
- git commit + branch (if the repo has git metadata available)
- pageSetFile, brandName, siteUrl
- headline counts (html, guides, city hubs, next-steps)

### How the tag is set
On build, `scripts/snapshot_lkg.js` will use the first available value:
1) `LKG_RELEASE_TAG` env var
2) `RELEASE_TAG` env var
3) `git describe --tags --exact-match` (if present)

### Recommended usage
When running production releases, set a tag explicitly:

```bash
LKG_RELEASE_TAG="lkg-$(date +%Y-%m-%d_%H%M%S)" npm run build
```

This produces:
- `dist/_lkg_snapshot.json`
- `_lkg_snapshot.json` (repo root)
- `releases/releases_index.json` (append-only index)
