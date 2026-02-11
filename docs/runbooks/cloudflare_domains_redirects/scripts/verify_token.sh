#!/usr/bin/env bash
set -euo pipefail
: "${CF_ACCOUNT_ID:?Set CF_ACCOUNT_ID}"
: "${CF_API_TOKEN:?Set CF_API_TOKEN}"
command -v jq >/dev/null || { echo "jq required"; exit 1; }

curl -s "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/tokens/verify" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" | jq .
