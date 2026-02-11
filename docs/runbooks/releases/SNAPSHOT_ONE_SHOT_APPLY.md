# Snapshot Apply — One-Shot (Non-Interactive) — Mac Only

**Purpose:** Apply a ZIP snapshot to the Listings/LKG repo deterministically (unzip → rsync snapshot → npm ci → validate → commit/push/tag).  
**Audience:** Owner only (VAs do not push).  
**Repo path (canonical):** `/Users/sequoiataylor/Documents/GitHub/local-guides-generator`  
**ZIP location (default):** `~/Downloads`

---

## REQUIRED INPUT (edit these 2 lines only)

- `ZIP_NAME="__PUT_ZIP_FILENAME_HERE__.zip"`
- `REPO="/Users/sequoiataylor/Documents/GitHub/local-guides-generator"`

---

## ONE-SHOT SNAPSHOT APPLY (copy/paste)

```bash
set -euo pipefail

REPO="/Users/sequoiataylor/Documents/GitHub/local-guides-generator"
ZIP_NAME="__PUT_ZIP_FILENAME_HERE__.zip"
ZIP="$HOME/Downloads/$ZIP_NAME"

ts="$(date +'%Y-%m-%d_%H%M%S')"
tag="lkg-$ts"
tmp="$HOME/tmp/lkg_patch_$ts"

echo "== PRECHECK =="
[ -d "$REPO/.git" ] || { echo "FAIL: repo not found at $REPO"; exit 1; }
[ -f "$ZIP" ] || { echo "FAIL: zip not found at $ZIP"; exit 1; }

cd "$REPO"
if [ -n "$(git status --porcelain)" ]; then
  echo "FAIL: repo is dirty. Commit/stash first."
  git status --porcelain
  exit 1
fi

echo "== TAG SAFETY POINT (pre-sync) =="
git tag "pre-$tag" || true
git push origin "pre-$tag" || true

echo "== UNZIP -> RSYNC SNAPSHOT (with --delete) =="
rm -rf "$tmp"
mkdir -p "$tmp"
unzip -q "$ZIP" -d "$tmp"

# Locate extracted root (handles zips with/without a top folder)
src_root=""
if [ -d "$tmp/local-guides-generator-main" ]; then
  src_root="$tmp/local-guides-generator-main"
else
  src_root="$(find "$tmp" -maxdepth 2 -type d -name "local-guides-generator-main" -print -quit || true)"
  if [ -z "$src_root" ]; then
    src_root="$(find "$tmp" -maxdepth 2 -type d -mindepth 1 -print -quit)"
  fi
fi

[ -n "$src_root" ] || { echo "FAIL: could not locate extracted repo root"; exit 1; }
echo "SRC_ROOT=$src_root"

# Snapshot sync (delete files missing from zip). Excludes local-only/build outputs.
rsync -a --delete \
  --exclude ".git/" \
  --exclude "node_modules/" \
  --exclude "dist/" \
  --exclude "_lkg_snapshot.json" \
  "$src_root"/ "$REPO"/

echo "== INSTALL + VALIDATE =="
npm ci
npm run validate:all

echo "== COMMIT + PUSH + TAG =="
git add -A
git commit -m "LKG snapshot — snapshot apply ($ts)"
git push origin main
git tag "$tag"
git push origin "$tag"

echo "DONE ✅  SNAPSHOT APPLIED. Tag: $tag"
echo "Temp: $tmp"
```

---

## VALIDATION / VERIFICATION (must do)

1. Confirm tag exists:
   - `git tag | tail -n 5`
2. Confirm GitHub has the tag and commit on `main`.
3. Re-run once (sanity):
   - `npm run validate:all`

---

## FAILURE MODES (what they mean)

### “repo is dirty”
You have uncommitted changes. Stop and clean the repo (commit or `git restore .` if safe).

### rsync deletes unexpected files
Your ZIP was not a full snapshot. Do not continue. Use patch mode via the main runbook.

### validation fails
Stop. Fix the failure. Do not push.

---

## DO NOT TOUCH

- Do not remove `--delete` unless explicitly doing patch mode.
- Do not let VAs run this.
- Do not bypass validation.
