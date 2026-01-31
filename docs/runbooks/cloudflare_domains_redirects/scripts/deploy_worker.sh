#!/usr/bin/env bash
set -euo pipefail

# Deploy a Worker script (service-worker JS)
#
# Usage:
#   ./deploy_worker.sh <worker_name> <worker_js_path>
#
# Requires:
#   CF_ACCOUNT_ID, CF_API_TOKEN, jq

WORKER_NAME="${1:?worker name required}"
WORKER_JS="${2:?worker js path required}"

: "${CF_ACCOUNT_ID:?Set CF_ACCOUNT_ID}"
: "${CF_API_TOKEN:?Set CF_API_TOKEN}"
command -v jq >/dev/null || { echo "jq required"; exit 1; }

if [[ ! -f "$WORKER_JS" ]]; then
  echo "ERROR: Worker JS not found: $WORKER_JS" >&2
  exit 1
fi

curl -s "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/${WORKER_NAME}" \
  -X PUT \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/javascript" \
  --data-binary "@${WORKER_JS}" | jq .
