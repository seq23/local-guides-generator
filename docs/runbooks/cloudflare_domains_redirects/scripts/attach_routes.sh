#!/usr/bin/env bash
set -euo pipefail

# Attach worker routes for EVERY domain listed in zones_with_ids.csv
# - Creates BOTH:
#   domain.com/*  and  www.domain.com/*
# - Skips if route already exists
#
# Usage:
#   ./attach_routes.sh <worker_name> zones_with_ids.csv
#
# Requires:
#   CF_API_TOKEN, jq

WORKER_NAME="${1:?worker name required}"
ZONES_CSV="${2:?zones_with_ids.csv required}"

: "${CF_API_TOKEN:?Set CF_API_TOKEN}"
command -v jq >/dev/null || { echo "jq required"; exit 1; }

if [[ ! -f "$ZONES_CSV" ]]; then
  echo "ERROR: missing $ZONES_CSV" >&2
  exit 1
fi

# Read CSV: domain,zone_id
tail -n +2 "$ZONES_CSV" | while IFS=, read -r DOMAIN ZONE_ID; do
  DOMAIN="$(echo "$DOMAIN" | xargs)"
  ZONE_ID="$(echo "$ZONE_ID" | xargs)"
  [[ -z "$DOMAIN" || -z "$ZONE_ID" ]] && continue

  # Fetch existing route patterns once per zone
  EXISTING="$(curl -s "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/workers/routes" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" | jq -r '.result[]?.pattern')"

  for PATTERN in "${DOMAIN}/*" "www.${DOMAIN}/*"; do
    if echo "$EXISTING" | grep -qx "$PATTERN"; then
      echo "  = Route exists: ${PATTERN}"
      continue
    fi

    echo "  + Attaching route: ${PATTERN}"
    curl -s "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/workers/routes" \
      -X POST \
      -H "Authorization: Bearer ${CF_API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "{
        \"pattern\": \"${PATTERN}\",
        \"script\": \"${WORKER_NAME}\"
      }" | jq .
  done
done
