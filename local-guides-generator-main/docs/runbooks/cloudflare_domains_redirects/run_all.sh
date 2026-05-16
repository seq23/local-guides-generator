#!/usr/bin/env bash
set -euo pipefail

# LKG Cloudflare Domains + Redirects — one-command runner
#
# Requires:
#   export CF_ACCOUNT_ID="..."
#   export CF_API_TOKEN="..."
# Optional:
#   export CF_WORKER_NAME="lkg-redirector"   (default below)
#
# Usage:
#   ./run_all.sh domains.txt redirects.csv
#
# Outputs:
#   out/domain_nameservers.csv
#   out/zones_with_ids.csv
#   out/worker_generated.js
#   out/verify_report.txt

DOMAINS_FILE="${1:-domains.txt}"
REDIRECTS_CSV="${2:-redirects.csv}"

if [[ ! -f "$DOMAINS_FILE" ]]; then
  echo "ERROR: domains file not found: $DOMAINS_FILE" >&2
  exit 1
fi
if [[ ! -f "$REDIRECTS_CSV" ]]; then
  echo "ERROR: redirects csv not found: $REDIRECTS_CSV" >&2
  exit 1
fi

: "${CF_ACCOUNT_ID:?Set CF_ACCOUNT_ID}"
: "${CF_API_TOKEN:?Set CF_API_TOKEN}"

CF_WORKER_NAME="${CF_WORKER_NAME:-lkg-redirector}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$ROOT_DIR/scripts"
OUT_DIR="$ROOT_DIR/out"
mkdir -p "$OUT_DIR"

echo "== Phase A: Verify token (account-scope verify endpoint) =="
bash "$SCRIPTS_DIR/verify_token.sh" > "$OUT_DIR/token_verify.json"
jq . "$OUT_DIR/token_verify.json" >/dev/null

echo "== Phase B: Add OR fetch zones (handles duplicates + rate limits) =="
bash "$SCRIPTS_DIR/bulk_add_or_fetch_zones.sh" "$DOMAINS_FILE" "$OUT_DIR/domain_nameservers.csv" "$OUT_DIR/zones_with_ids.csv"

echo "== Phase C: Ensure redirect DNS baseline (A @ + CNAME www -> @, proxied) =="
bash "$SCRIPTS_DIR/ensure_redirect_dns.sh" "$OUT_DIR/zones_with_ids.csv" | tee "$OUT_DIR/ensure_dns.log"

echo "== Phase D: Generate Worker from redirects.csv =="
python3 "$SCRIPTS_DIR/regen_worker_from_csv.py" "$REDIRECTS_CSV" "$OUT_DIR/worker_generated.js"

echo "== Phase E: Deploy Worker script to Cloudflare (service-worker JS) =="
bash "$SCRIPTS_DIR/deploy_worker.sh" "$CF_WORKER_NAME" "$OUT_DIR/worker_generated.js" | tee "$OUT_DIR/deploy_worker.json"

echo "== Phase F: Attach Worker routes for EVERY redirect domain (apex + www) =="
bash "$SCRIPTS_DIR/attach_routes.sh" "$CF_WORKER_NAME" "$OUT_DIR/zones_with_ids.csv" | tee "$OUT_DIR/attach_routes.log"

echo "== Phase G: Verification bundle (curl + dig hints) =="
bash "$SCRIPTS_DIR/verify_bundle.sh" "$OUT_DIR/zones_with_ids.csv" "$REDIRECTS_CSV" | tee "$OUT_DIR/verify_report.txt"

echo "DONE ✅  Outputs in: $OUT_DIR"
