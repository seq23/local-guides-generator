#!/usr/bin/env bash
set -euo pipefail

ZIP_PATH="$1"
MODE="${2:-}"

WORKROOT="$HOME/tmp/dentistry_fix_$(date +%s)"
mkdir -p "$WORKROOT"

echo "Unzipping..."
unzip -q "$ZIP_PATH" -d "$WORKROOT"

REPO_DIR=$(find "$WORKROOT" -name package.json | head -n 1 | xargs dirname)
echo "Repo: $REPO_DIR"

echo "Applying dentistry changes..."

mkdir -p "$REPO_DIR/data/page_sets/examples/dentistry_global_pages"

cat > "$REPO_DIR/data/page_sets/examples/dentistry_global_pages/guides_dental-implants.json" <<JSON
{
  "slug": "/guides/dental-implants/",
  "title": "Dental Implants: Cost, Procedure, Recovery",
  "description": "Implant cost, process, recovery, and what to expect.",
  "content": "<section><h2>Short answer</h2><p>Implants cost \$3k–\$6k per tooth.</p></section>"
}
JSON

echo "Files added."

cd "$REPO_DIR"

if [[ "$MODE" == "--build" ]]; then
  echo "Installing + building..."
  npm install
  npm run build:all
  npm run validate:all
fi

echo "Done."
