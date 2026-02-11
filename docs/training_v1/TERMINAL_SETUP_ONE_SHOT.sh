#!/usr/bin/env bash
set -euo pipefail

REPO="/Users/sequoiataylor/Documents/GitHub/local-guides-generator"
HARDENED_SRC="$REPO/docs/runbooks/releases/update_lkg_from_zip_hardened.sh"
TARGET="$HOME/update_lkg_from_zip.sh"

echo "== LKG TERMINAL SETUP (ONE-SHOT) =="

if [ ! -d "$REPO" ]; then
  echo "FAIL: repo not found at $REPO"
  exit 1
fi

cd "$REPO"

# --- Node (Cloudflare parity) via nvm ---
if [ ! -d "$HOME/.nvm" ]; then
  echo "== Installing nvm =="
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "== Ensuring Node 22 =="
nvm install 22
nvm use 22

echo "Node: $(node -v)"
echo "npm:  $(npm -v)"

# --- Install hardened updater (NON-NEGOTIABLE) ---
if [ ! -f "$HARDENED_SRC" ]; then
  echo "FAIL: hardened updater source missing: $HARDENED_SRC"
  exit 1
fi

echo "== Installing hardened update script to $TARGET =="
cp -v "$TARGET" "$TARGET.bak.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
cat "$HARDENED_SRC" > "$TARGET"
chmod +x "$TARGET"

echo "== Verify hardened updater header =="
head -n 25 "$TARGET"

# --- Build + validate ---
echo "== Install deps =="
npm ci

echo "== Build =="
npm run build

echo "== Validate (core) =="
npm run validate:all

echo "DONE ✅"
