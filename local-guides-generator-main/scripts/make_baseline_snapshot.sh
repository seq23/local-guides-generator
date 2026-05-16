#!/usr/bin/env bash
set -euo pipefail

INCLUDE_GIT=0
for arg in "$@"; do
  case "$arg" in
    --include-git) INCLUDE_GIT=1 ;;
    -h|--help)
      echo "Usage: bash scripts/make_baseline_snapshot.sh [--include-git]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_NAME="$(basename "$REPO_ROOT")"
DATE_STAMP="$(date +%m-%d-%y)"

cd "$REPO_ROOT"

if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  SHA="$(git rev-parse --short=7 HEAD)"
else
  SHA="$(node -e "const fs=require('fs'),crypto=require('crypto'); const p=['package.json','README.md','SNAPSHOT_METADATA.json'].filter(fs.existsSync); const h=crypto.createHash('sha1'); for (const f of p) h.update(fs.readFileSync(f)); console.log(h.digest('hex').slice(0,7));")"
fi

OUT_PARENT="${SNAPSHOT_OUT_DIR:-$(dirname "$REPO_ROOT")}"
OUT_ZIP="${OUT_PARENT}/${REPO_NAME}_BASELINE_${DATE_STAMP}_${SHA}.zip"

echo "[snapshot] repo: $REPO_NAME"
echo "[snapshot] include .git: $INCLUDE_GIT"
echo "[snapshot] output: $OUT_ZIP"

echo "[snapshot] repairing executable bits"
find scripts distribution_scripts -type f \( -name "*.sh" -o -name "*.js" \) -exec chmod +x {} \; 2>/dev/null || true
find .github/workflows -type f \( -name "*.yml" -o -name "*.yaml" \) -exec chmod 0644 {} \; 2>/dev/null || true

if [ -f package.json ]; then
  if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['build:all'] ? 0 : 1)" >/dev/null 2>&1; then
    echo "[snapshot] running npm run build:all"
    npm run build:all
  elif node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.build ? 0 : 1)" >/dev/null 2>&1; then
    echo "[snapshot] running npm run build"
    npm run build
  else
    echo "[snapshot] no build script found; skipping"
  fi

  if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['validate:all'] ? 0 : 1)" >/dev/null 2>&1; then
    echo "[snapshot] running npm run validate:all"
    npm run validate:all
  elif node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.validate ? 0 : 1)" >/dev/null 2>&1; then
    echo "[snapshot] running npm run validate"
    npm run validate
  else
    echo "[snapshot] no validation script found; skipping"
  fi
fi

echo "[snapshot] packaging"
rm -f "$OUT_ZIP"

EXCLUDES=(
  "*/node_modules/*"
  "*/.DS_Store"
  "*/.cache/*"
  "*/tmp/*"
  "*/logs/*"
  "*.zip"
)

if [ "$INCLUDE_GIT" = "0" ]; then
  EXCLUDES+=("*/.git/*")
fi

if command -v ruby >/dev/null 2>&1 && [ -f scripts/create_store_zip.rb ]; then
  ruby scripts/create_store_zip.rb "$REPO_ROOT" "$OUT_ZIP" "$INCLUDE_GIT"
else
  ZIP_ARGS=()
  for pattern in "${EXCLUDES[@]}"; do ZIP_ARGS+=("-x" "$pattern"); done
  (cd "$REPO_ROOT/.." && zip -0 -rq "$OUT_ZIP" "$REPO_NAME" "${ZIP_ARGS[@]}")
fi

echo "[snapshot] verifying zip"
ZIP_PATH="$OUT_ZIP" REPO_NAME="$REPO_NAME" INCLUDE_GIT="$INCLUDE_GIT" node <<'NODE'
const fs = require('fs');
const { execFileSync } = require('child_process');
const zip = process.env.ZIP_PATH;
const repo = process.env.REPO_NAME;
const includeGit = process.env.INCLUDE_GIT === '1';

if (!fs.existsSync(zip)) throw new Error(`Missing ZIP: ${zip}`);

const listing = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 })
  .split(/\r?\n/).filter(Boolean);

const roots = new Set(listing.map((n) => n.split('/')[0]));
if (roots.size !== 1 || !roots.has(repo)) {
  throw new Error(`ZIP root mismatch: ${Array.from(roots).join(', ')}`);
}

const mustHave = [
  `${repo}/package.json`,
  `${repo}/README.md`,
  `${repo}/.github/workflows/validate.yml`,
  `${repo}/scripts/make_baseline_snapshot.sh`,
];

for (const name of mustHave) {
  if (!listing.includes(name)) throw new Error(`Missing required file: ${name}`);
}

if (!listing.some((n) => n.startsWith(`${repo}/.github/workflows/`))) {
  throw new Error('Workflows missing from baseline ZIP');
}

if (!includeGit && listing.some((n) => n.startsWith(`${repo}/.git/`))) {
  throw new Error('.git included despite default exclude mode');
}

console.log(`[snapshot] verified ${listing.length} entries`);
NODE

echo "[snapshot] done: $OUT_ZIP"
