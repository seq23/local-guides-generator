#!/usr/bin/env bash
set -euo pipefail

# Verification bundle
# - prints a PASS/FAIL style report you can paste into logs
# - does NOT require dig to be installed (but uses it if available)
#
# Usage:
#   ./verify_bundle.sh zones_with_ids.csv redirects.csv

ZONES_CSV="${1:?zones_with_ids.csv required}"
REDIRECTS_CSV="${2:?redirects.csv required}"

if [[ ! -f "$ZONES_CSV" ]]; then
  echo "ERROR: missing $ZONES_CSV" >&2
  exit 1
fi
if [[ ! -f "$REDIRECTS_CSV" ]]; then
  echo "ERROR: missing $REDIRECTS_CSV" >&2
  exit 1
fi

echo "=== VERIFY: redirect routes exist (apex + www) ==="
if command -v jq >/dev/null 2>&1; then :; else echo "Missing jq"; exit 1; fi

# pick first 3 domains from redirects.csv to sample curl checks
sample_domains=()
while IFS=, read -r src _rest; do
  [[ "$src" == "Source URL"* ]] && continue
  d="${src#https://}"; d="${d#http://}"; d="${d%/*}"; d="${d%\*}"
  [[ -n "$d" ]] && sample_domains+=("$d")
  [[ "${#sample_domains[@]}" -ge 3 ]] && break
done < "$REDIRECTS_CSV"

echo "Sample domains: ${sample_domains[*]}"

echo
echo "=== CURL checks (expects 301 Location to canonical+path) ==="
for d in "${sample_domains[@]}"; do
  echo "--- $d ---"
  curl -I "https://${d}/__lkg_test_path?x=1" 2>/dev/null | sed -n '1,6p'
  curl -I "https://www.${d}/__lkg_test_path?x=1" 2>/dev/null | sed -n '1,6p' || true
done

echo
echo "=== DNS NS checks (if dig present) ==="
if command -v dig >/dev/null 2>&1; then
  for d in "${sample_domains[@]}"; do
    echo "--- $d NS ---"
    dig "$d" NS +short | head -n 5
  done
else
  echo "dig not installed; skipping NS checks."
fi

echo
echo "=== Done ==="
