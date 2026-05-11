Yes. The right move is to create a **generic repo-agnostic snapshot/patch updater** that lives as a Markdown runbook inside any repo, and that can install a local helper script when needed.

Below is a **drop-in Markdown file** you can paste into project docs for future repos.

---

# `docs/runbooks/GENERIC_SNAPSHOT_PATCH_UPDATER.md`

````md
# GENERIC SNAPSHOT / PATCH UPDATER
**Canonical Owner Runbook — Repo-Agnostic**
**Purpose:** Safely apply a full baseline snapshot ZIP or a patch ZIP into an existing Git repo with preflight checks, validation hooks, commit/push, and rollback tags.

---

## 0. What this is for

Use this when you have:

- an existing local Git repo
- a ZIP delivery
- a need to apply that ZIP safely into the repo
- a desire to support both:
  - **snapshot mode** = full repo replacement/sync
  - **patch mode** = additive/non-destructive partial sync

This runbook is **generic** and is meant to be copied into any repo.

---

## 1. Operating model

### Snapshot mode
Use when the ZIP is a **full repo baseline**.

Behavior:
- uses `rsync --delete`
- makes repo match the ZIP contents
- destructive if the ZIP is incomplete

### Patch mode
Use when the ZIP is **partial**.

Behavior:
- uses `rsync` without `--delete`
- merges changes without deleting missing files
- blocked by default unless explicitly allowed

---

## 2. Safety rules

### Always start in repo root
Before doing anything:

```bash
cd /path/to/repo
pwd
git status
````

Expected:

* correct repo root path
* correct branch
* clean working tree

### Never use snapshot mode on a partial ZIP

Snapshot mode is only for a full baseline snapshot.

### Patch mode is opt-in

Patch mode should be blocked unless explicitly enabled with:

```bash
export REPO_ALLOW_PATCH=1
```

### Dirty repo refusal

If the repo has uncommitted changes, stop unless you explicitly override with:

```bash
export REPO_ALLOW_DIRTY=1
```

---

## 3. Naming convention

Recommended snapshot ZIP naming pattern:

```text
<repo-slug>_BASELINE_MM-DD-YY_<sha>.zip
```

Examples:

* `local-guides-generator-main_BASELINE_03-11-26_c52b208.zip`
* `spry-hpc-site_BASELINE_03-11-26_a19fd11.zip`
* `time2read-web_BASELINE_03-11-26_8c03ab4.zip`

Recommended patch ZIP naming pattern:

```text
<repo-slug>_PATCH_MM-DD-YY_<sha>.zip
```

---

## 4. What this script does

1. verifies ZIP exists
2. verifies repo path exists
3. verifies repo path is the actual git repo root
4. verifies branch and clean working tree
5. prints ZIP manifest
6. extracts ZIP into an isolated temp directory
7. detects the real extracted root
8. performs dry-run rsync
9. creates a pre-update rollback tag
10. applies snapshot or patch
11. saves diff reports
12. runs optional validation hook
13. commits and pushes if there are changes
14. creates a post-update tag
15. prints logs and artifact locations

---

## 5. Install the generic updater script

Save this as:

```text
~/update_repo_from_zip_generic.sh
```

Install with:

```bash
cat > ~/update_repo_from_zip_generic.sh <<'BASH'
#!/usr/bin/env bash
set -euo pipefail

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
note() { printf "%s\n" "$*"; }
die()  { printf "ERROR: %s\n" "$*" >&2; exit 1; }

ZIP_PATH="${1:-}"
REPO_PATH="${2:-}"
MODE="${3:-}"
REPO_SLUG="${4:-}"
VALIDATE_CMD="${5:-}"

# Supports either direct args or heredoc/stdin:
# line1 = zip path
# line2 = repo path
# line3 = mode
# line4 = repo slug
# line5 = validate command (optional)
if [[ -z "$ZIP_PATH" || -z "$REPO_PATH" ]]; then
  read -r ZIP_PATH || true
  read -r REPO_PATH || true
  read -r MODE || true
  read -r REPO_SLUG || true
  read -r VALIDATE_CMD || true
fi

MODE="${MODE:-snapshot}"
REPO_SLUG="${REPO_SLUG:-repo}"

ZIP_PATH="${ZIP_PATH/#\~/$HOME}"
REPO_PATH="${REPO_PATH/#\~/$HOME}"

TS="$(date '+%Y%m%d_%H%M%S')"
TMP_DIR="$HOME/tmp/repo_patch_${REPO_SLUG}_${TS}"
EXTRACT_DIR="$TMP_DIR/unzipped"
mkdir -p "$TMP_DIR" "$EXTRACT_DIR"

SNAPSHOT_NAME_REGEX="^${REPO_SLUG}_BASELINE_[0-9]{2}-[0-9]{2}-[0-9]{2}_[A-Za-z0-9._-]{7,64}\\.zip$"

bold "=== GENERIC SNAPSHOT / PATCH UPDATER ==="
note "ZIP         : $ZIP_PATH"
note "REPO        : $REPO_PATH"
note "MODE        : $MODE"
note "REPO SLUG   : $REPO_SLUG"
note "VALIDATE CMD: ${VALIDATE_CMD:-<none>}"
note "TMP         : $TMP_DIR"
echo

[[ -f "$ZIP_PATH" ]] || die "ZIP not found: $ZIP_PATH"
[[ -d "$REPO_PATH" ]] || die "Repo path not found: $REPO_PATH"
[[ "$MODE" == "snapshot" || "$MODE" == "patch" ]] || die "MODE must be snapshot or patch"

ZIP_BASENAME="$(basename "$ZIP_PATH")"

if [[ "$MODE" == "snapshot" ]]; then
  if [[ ! "$ZIP_BASENAME" =~ $SNAPSHOT_NAME_REGEX ]]; then
    die "Snapshot mode requires ZIP name matching: ${REPO_SLUG}_BASELINE_MM-DD-YY_<sha>.zip"
  fi
fi

if [[ "$MODE" == "patch" && "${REPO_ALLOW_PATCH:-0}" != "1" ]]; then
  die "Patch mode is blocked unless REPO_ALLOW_PATCH=1"
fi

tag_exists_anywhere() {
  local repo="$1"
  local tag="$2"
  git -C "$repo" rev-parse -q --verify "refs/tags/$tag" >/dev/null 2>&1 && return 0
  git -C "$repo" ls-remote --tags origin "refs/tags/$tag" | grep -q . && return 0
  return 1
}

make_unique_tag() {
  local repo="$1"
  local base="$2"
  local candidate="$base"
  local i=1
  while tag_exists_anywhere "$repo" "$candidate"; do
    candidate="${base}_$i"
    i=$((i+1))
  done
  printf "%s\n" "$candidate"
}

detect_root() {
  local dir="$1"
  local dcount fcount
  dcount="$(find "$dir" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  fcount="$(find "$dir" -mindepth 1 -maxdepth 1 -type f | wc -l | tr -d ' ')"
  if [[ "$dcount" -eq 1 && "$fcount" -eq 0 ]]; then
    find "$dir" -mindepth 1 -maxdepth 1 -type d | head -n 1
  else
    echo "$dir"
  fi
}

# ------------------------------------------------------------------
# REPO ROOT GUARD
# ------------------------------------------------------------------
bold "-> Verifying repo path"
git -C "$REPO_PATH" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Target path is not a git repo: $REPO_PATH"

ACTUAL_TOP="$(git -C "$REPO_PATH" rev-parse --show-toplevel)"
[[ -n "$ACTUAL_TOP" ]] || die "Could not resolve repo top level"

REQ_TOP="$(cd "$REPO_PATH" && pwd -P)"
ACTUAL_TOP="$(cd "$ACTUAL_TOP" && pwd -P)"

if [[ "$REQ_TOP" != "$ACTUAL_TOP" ]]; then
  die "Repo path is not the repo root.
Requested: $REQ_TOP
Actual:    $ACTUAL_TOP"
fi

REPO_PATH="$ACTUAL_TOP"
note "Verified repo root: $REPO_PATH"
echo

# ------------------------------------------------------------------
# REPO PREFLIGHT
# ------------------------------------------------------------------
bold "-> Repo preflight"
ALLOW_DIRTY="${REPO_ALLOW_DIRTY:-0}"

BRANCH="$(git -C "$REPO_PATH" rev-parse --abbrev-ref HEAD)"
HEADSHA="$(git -C "$REPO_PATH" rev-parse HEAD)"
REMOTEURL="$(git -C "$REPO_PATH" remote get-url origin 2>/dev/null || true)"
STATUS_PORC="$(git -C "$REPO_PATH" status --porcelain)"

printf "%s\n" "$BRANCH"    > "$TMP_DIR/repo_branch.txt"
printf "%s\n" "$HEADSHA"   > "$TMP_DIR/repo_head.txt"
printf "%s\n" "$REMOTEURL" > "$TMP_DIR/repo_origin.txt"
git -C "$REPO_PATH" status > "$TMP_DIR/git_status_full.txt"
printf "%s\n" "$STATUS_PORC" > "$TMP_DIR/git_status_porcelain.txt"

note "Current branch: $BRANCH"
note "Current HEAD  : $HEADSHA"

if [[ "$BRANCH" != "main" ]]; then
  note "WARNING: Branch is not main: $BRANCH"
fi

if [[ -n "$STATUS_PORC" && "$ALLOW_DIRTY" != "1" ]]; then
  die "Repo has uncommitted changes. Commit/stash first or override with REPO_ALLOW_DIRTY=1"
fi
echo

# ------------------------------------------------------------------
# ZIP MANIFEST + UNZIP
# ------------------------------------------------------------------
bold "-> ZIP manifest (top 200 lines)"
unzip -l "$ZIP_PATH" | sed -n '1,200p' | tee "$TMP_DIR/zip_manifest_top.txt"
echo

bold "-> Unzipping"
unzip -q "$ZIP_PATH" -d "$EXTRACT_DIR"

SRC_ROOT="$(detect_root "$EXTRACT_DIR")"
note "Detected ZIP root: $SRC_ROOT"

[[ -d "$SRC_ROOT" ]] || die "Detected ZIP root is not a directory: $SRC_ROOT"
echo

# Snapshot stronger checks
if [[ "$MODE" == "snapshot" ]]; then
  bold "-> Snapshot safety checks"
  missing=()
  for f in ".gitignore" "README.md"; do
    [[ -e "$SRC_ROOT/$f" ]] || missing+=("$f")
  done
  if [[ "${#missing[@]}" -gt 0 ]]; then
    printf "Missing required root files in snapshot ZIP:\n" >&2
    for m in "${missing[@]}"; do
      printf "  - %s\n" "$m" >&2
    done
    exit 2
  fi
  note "Snapshot ZIP root checks passed"
  echo
fi

# ------------------------------------------------------------------
# DRY RUN
# ------------------------------------------------------------------
bold "-> Preflight rsync dry-run"
if [[ "$MODE" == "snapshot" ]]; then
  rsync -avun --delete \
    --exclude ".git" \
    --exclude "node_modules" \
    --exclude "dist" \
    --exclude "build" \
    "$SRC_ROOT/" "$REPO_PATH/" > "$TMP_DIR/rsync_dry_run.txt"
else
  rsync -avun \
    --exclude ".git" \
    --exclude "node_modules" \
    --exclude "dist" \
    --exclude "build" \
    "$SRC_ROOT/" "$REPO_PATH/" > "$TMP_DIR/rsync_dry_run.txt"
fi
note "Saved dry-run: $TMP_DIR/rsync_dry_run.txt"

bold "-> Current git diff --stat"
git -C "$REPO_PATH" diff --stat | tee "$TMP_DIR/pre_apply_git_diff_stat.txt"
echo

# ------------------------------------------------------------------
# PRE-UPDATE TAG
# ------------------------------------------------------------------
PRETAG="$(make_unique_tag "$REPO_PATH" "${REPO_SLUG}_pre_update_${TS}")"
bold "-> Creating pre-update safety tag: $PRETAG"
git -C "$REPO_PATH" tag "$PRETAG"
git -C "$REPO_PATH" push origin "$PRETAG" || true
printf "%s\n" "$PRETAG" > "$TMP_DIR/pre_update_tag.txt"
echo

# ------------------------------------------------------------------
# APPLY
# ------------------------------------------------------------------
bold "-> Applying rsync"
if [[ "$MODE" == "snapshot" ]]; then
  rsync -avu --delete \
    --exclude ".git" \
    --exclude "node_modules" \
    --exclude "dist" \
    --exclude "build" \
    "$SRC_ROOT/" "$REPO_PATH/" | tee "$TMP_DIR/rsync_applied.txt"
else
  rsync -avu \
    --exclude ".git" \
    --exclude "node_modules" \
    --exclude "dist" \
    --exclude "build" \
    "$SRC_ROOT/" "$REPO_PATH/" | tee "$TMP_DIR/rsync_applied.txt"
fi
echo

# ------------------------------------------------------------------
# DIFF REPORTS
# ------------------------------------------------------------------
bold "-> Saving post-apply diff reports"
git -C "$REPO_PATH" diff --stat > "$TMP_DIR/post_apply_git_diff_stat.txt"
git -C "$REPO_PATH" diff > "$TMP_DIR/post_apply_git_diff.patch"
echo

# ------------------------------------------------------------------
# OPTIONAL VALIDATION
# ------------------------------------------------------------------
if [[ -n "${VALIDATE_CMD:-}" ]]; then
  bold "-> Running validation command"
  set +e
  ( cd "$REPO_PATH" && eval "$VALIDATE_CMD" ) 2>&1 | tee "$TMP_DIR/validation.log"
  VALIDATE_EXIT="${PIPESTATUS[0]:-1}"
  set -e
  if [[ "$VALIDATE_EXIT" -ne 0 ]]; then
    die "Validation failed. See:
  $TMP_DIR/validation.log
  $TMP_DIR/post_apply_git_diff_stat.txt
  $TMP_DIR/post_apply_git_diff.patch"
  fi
  echo
fi

# ------------------------------------------------------------------
# COMMIT + PUSH
# ------------------------------------------------------------------
bold "-> Staging changes"
git -C "$REPO_PATH" add -A

if git -C "$REPO_PATH" diff --cached --quiet; then
  bold "-> No changes detected after apply"
  POSTTAG="$(make_unique_tag "$REPO_PATH" "${REPO_SLUG}_post_update_${TS}")"
  bold "-> Creating post-update tag: $POSTTAG"
  git -C "$REPO_PATH" tag "$POSTTAG"
  git -C "$REPO_PATH" push origin "$POSTTAG" || true
  printf "%s\n" "$POSTTAG" > "$TMP_DIR/post_update_tag.txt"
  echo
  bold "DONE ✅ (no-op update)"
  note "Repo root verified : $REPO_PATH"
  note "Pre-update tag     : $PRETAG"
  note "Post-update tag    : $POSTTAG"
  note "Temp folder        : $TMP_DIR"
  exit 0
fi

COMMIT_MSG="Repo ZIP update ${ZIP_BASENAME} (${TS})"
bold "-> Committing: $COMMIT_MSG"
git -C "$REPO_PATH" commit -m "$COMMIT_MSG"

bold "-> Pushing branch"
git -C "$REPO_PATH" push origin "$BRANCH"
echo

# ------------------------------------------------------------------
# POST-UPDATE TAG
# ------------------------------------------------------------------
POSTTAG="$(make_unique_tag "$REPO_PATH" "${REPO_SLUG}_post_update_${TS}")"
bold "-> Creating post-update tag: $POSTTAG"
git -C "$REPO_PATH" tag "$POSTTAG"
git -C "$REPO_PATH" push origin "$POSTTAG" || true
printf "%s\n" "$POSTTAG" > "$TMP_DIR/post_update_tag.txt"
echo

bold "DONE ✅"
note "Repo root verified : $REPO_PATH"
note "Pre-update tag     : $PRETAG"
note "Post-update tag    : $POSTTAG"
note "Temp folder        : $TMP_DIR"
note "Dry-run report     : $TMP_DIR/rsync_dry_run.txt"
note "Applied rsync log  : $TMP_DIR/rsync_applied.txt"
if [[ -n "${VALIDATE_CMD:-}" ]]; then
  note "Validate log       : $TMP_DIR/validation.log"
fi
BASH

chmod +x ~/update_repo_from_zip_generic.sh
echo "Installed: ~/update_repo_from_zip_generic.sh"
```

## Usage

### Snapshot mode

```bash
cd /path/to/repo
~/update_repo_from_zip_generic.sh \
~/Downloads/my-repo_BASELINE_03-11-26_abcd123.zip \
/path/to/repo \
snapshot \
my-repo \
"npm test"
```

### Patch mode

```bash
cd /path/to/repo
export REPO_ALLOW_PATCH=1
~/update_repo_from_zip_generic.sh \
~/Downloads/my-repo_PATCH_03-11-26_abcd123.zip \
/path/to/repo \
patch \
my-repo \
"npm test"
```

### EOF / non-interactive

```bash
cd /path/to/repo
~/update_repo_from_zip_generic.sh <<'EOF'
~/Downloads/my-repo_BASELINE_03-11-26_abcd123.zip
/path/to/repo
snapshot
my-repo
npm test
EOF
```

---

## 6. Repo-specific adaptation checklist

Before using this in a new repo, set:

1. **Repo slug**

   * example: `my-repo`

2. **Validation command**

   * examples:

     * `npm run validate:all`
     * `npm test`
     * `pytest`
     * `make verify`
     * leave blank if no validation exists yet

3. **Optional excludes**

   * if repo has special folders to preserve, adjust `rsync --exclude` rules

4. **Branch policy**

   * script warns if not on `main`
   * if a repo uses `master` or another default branch, that is fine; this script pushes the current branch

---

## 7. Owner workflow

### Snapshot baseline apply

```bash
cd /path/to/repo
pwd
git status

~/update_repo_from_zip_generic.sh \
~/Downloads/<repo-slug>_BASELINE_MM-DD-YY_<sha>.zip \
/path/to/repo \
snapshot \
<repo-slug> \
"<validation-command>"
```

### Patch apply

```bash
cd /path/to/repo
pwd
git status

export REPO_ALLOW_PATCH=1
~/update_repo_from_zip_generic.sh \
~/Downloads/<repo-slug>_PATCH_MM-DD-YY_<sha>.zip \
/path/to/repo \
patch \
<repo-slug> \
"<validation-command>"
```

---

## 8. VA-safe checklist

### Before run

* confirm correct repo root with `pwd`
* confirm clean working tree with `git status`
* confirm ZIP name matches mode
* confirm validation command for this repo

### During run

* do not interrupt unless error
* do not rename ZIP casually
* do not use patch mode without explicit approval

### After run

* confirm commit succeeded
* confirm branch push succeeded
* confirm pre-update tag exists
* confirm post-update tag exists
* confirm validation log exists if a validation command was run

---

## 9. Do NOT touch

* do not run from a nested directory and assume it is safe
* do not use snapshot mode with a partial ZIP
* do not force-push unless you are intentionally rolling back
* do not bypass validation failure without owner approval
* do not assume all repos use the same validation command

---

## 10. Rollback

To roll back to the pre-update tag:

```bash
cd /path/to/repo
git reset --hard <pre-update-tag>
git push --force origin <branch-name>
```

Use force-push only when you intentionally want the remote branch rolled back.

---

## 11. Why this generic version exists

This script gives you one consistent updater pattern across repos, while still letting each repo define:

* its own slug
* its own validation command
* its own snapshot ZIP names
* its own branch policy

That keeps operations standardized without pretending every repo is LKG.

````

---

# Canonical usage summary

For a future repo, you’d only change:

- `REPO_PATH`
- `REPO_SLUG`
- `VALIDATE_CMD`

Example:

```bash
cd /Users/you/Documents/GitHub/spry-hpc-site
~/update_repo_from_zip_generic.sh \
~/Downloads/spry-hpc-site_BASELINE_03-11-26_a19fd11.zip \
/Users/you/Documents/GitHub/spry-hpc-site \
snapshot \
spry-hpc-site \
"npm run validate"
````

# Do NOT touch

* do not hardcode LKG-specific file checks into the generic version
* do not assume `npm ci` is valid for every repo
* do not assume `main` is the only valid branch
* do not use one repo’s exec-bit restore list for all repos

# Recommended naming rule across all repos

Use this universally:

* snapshot: `<repo-slug>_BASELINE_MM-DD-YY_<sha>.zip`
* patch: `<repo-slug>_PATCH_MM-DD-YY_<sha>.zip`

That gives you one clean mental model across repos.

The smart structure is:

* keep **LKG-specific updater** for LKG
* keep **generic updater** for everything else
* store the Markdown runbook above in each project’s source docs when that repo is ready
