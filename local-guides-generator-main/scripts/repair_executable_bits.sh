#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT_DIR/scripts/validation/executable_files_manifest.json"

if [[ ! -f "$MANIFEST" ]]; then
  echo "ERROR: manifest not found: $MANIFEST" >&2
  exit 1
fi

node -e '
const fs = require("fs");
const p = process.argv[1];
const data = JSON.parse(fs.readFileSync(p, "utf8"));
for (const f of (data.files || [])) console.log(f);
' "$MANIFEST" | while IFS= read -r rel; do
  [[ -z "$rel" ]] && continue
  target="$ROOT_DIR/$rel"
  if [[ ! -e "$target" ]]; then
    echo "WARN: missing executable target: $rel" >&2
    continue
  fi
  chmod +x "$target"
done

echo "Executable bit repair complete."
