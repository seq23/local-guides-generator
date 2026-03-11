#!/usr/bin/env bash
set -euo pipefail
ZONES_CSV="${1:?outputs/zones_with_ids.csv required}"
: "${CF_API_TOKEN:?Set CF_API_TOKEN}"
: "${CF_WORKER_NAME:?Set CF_WORKER_NAME}"
command -v jq >/dev/null || { echo "jq required"; exit 1; }

echo "== WORKER ROUTES CHECKS =="
fail=0
tail -n +2 "$ZONES_CSV" | while IFS=, read -r domain zone_id; do
  domain="$(echo "$domain" | tr -d '\r' | xargs)"
  zone_id="$(echo "$zone_id" | tr -d '\r' | xargs)"
  [[ -z "$domain" || -z "$zone_id" ]] && continue

  res="$(curl -s "https://api.cloudflare.com/client/v4/zones/${zone_id}/workers/routes" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json")"

  ok="$(echo "$res" | jq -r '.success')"
  if [[ "$ok" != "true" ]]; then
    echo "FAIL ROUTES API: $domain"
    echo "$res" | jq .
    fail=1
    continue
  fi

  apex="${domain}/*"
  www="www.${domain}/*"

  apex_ok="$(echo "$res" | jq -r --arg p "$apex" --arg s "$CF_WORKER_NAME" 'any(.result[]?; .pattern==$p and .script==$s)')"
  www_ok="$(echo "$res" | jq -r --arg p "$www" --arg s "$CF_WORKER_NAME" 'any(.result[]?; .pattern==$p and .script==$s)')"

  if [[ "$apex_ok" != "true" || "$www_ok" != "true" ]]; then
    echo "FAIL ROUTES: $domain"
    fail=1
  else
    echo "PASS ROUTES: $domain"
  fi
done

if [[ "$fail" -ne 0 ]]; then
  echo "ROUTES CHECKS FAILED ❌"
  exit 1
fi
echo "ROUTES CHECKS PASSED ✅"
