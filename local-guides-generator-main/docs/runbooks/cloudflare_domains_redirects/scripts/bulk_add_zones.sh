#!/usr/bin/env bash
set -euo pipefail
DOMAINS_CSV="${1:?inputs/domains.csv required}"
OUT_NS="${2:?outputs/domain_nameservers.csv required}"
OUT_ZONES="${3:?outputs/zones_with_ids.csv required}"

: "${CF_ACCOUNT_ID:?Set CF_ACCOUNT_ID}"
: "${CF_API_TOKEN:?Set CF_API_TOKEN}"
command -v jq >/dev/null || { echo "jq required"; exit 1; }

mkdir -p "$(dirname "$OUT_NS")" "$(dirname "$OUT_ZONES")"
echo "domain,zone_id,ns1,ns2" > "$OUT_NS"
echo "domain,zone_id" > "$OUT_ZONES"

get_zone_id() {
  local domain="$1"
  curl -s "https://api.cloudflare.com/client/v4/zones?name=${domain}" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" | jq -r '.result[0].id // empty'
}

create_zone() {
  local domain="$1"
  curl -s "https://api.cloudflare.com/client/v4/zones" \
    -X POST \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{
      \"account\": { \"id\": \"${CF_ACCOUNT_ID}\" },
      \"name\": \"${domain}\",
      \"type\": \"full\"
    }"
}

tail -n +2 "$DOMAINS_CSV" | while IFS=, read -r domain canonical vertical is_canonical is_parked notes; do
  domain="$(echo "$domain" | tr -d '\r' | xargs)"
  is_parked="$(echo "$is_parked" | tr -d '\r' | xargs)"
  [[ -z "$domain" ]] && continue
  [[ "$is_parked" == "yes" ]] && { echo "SKIP parked: $domain"; continue; }

  zid="$(get_zone_id "$domain" || true)"
  if [[ -n "$zid" ]]; then
    echo "OK (existing): $domain"
    zres="$(curl -s "https://api.cloudflare.com/client/v4/zones/${zid}" \
      -H "Authorization: Bearer ${CF_API_TOKEN}" \
      -H "Content-Type: application/json")"
  else
    echo "Creating zone: $domain"
    zres="$(create_zone "$domain")"
    if [[ "$(echo "$zres" | jq -r '.success')" != "true" ]]; then
      echo "FAILED create: $domain"
      echo "$zres" | jq .
      continue
    fi
    zid="$(echo "$zres" | jq -r '.result.id')"
    zres="$(curl -s "https://api.cloudflare.com/client/v4/zones/${zid}" \
      -H "Authorization: Bearer ${CF_API_TOKEN}" \
      -H "Content-Type: application/json")"
  fi

  ns1="$(echo "$zres" | jq -r '.result.name_servers[0] // empty')"
  ns2="$(echo "$zres" | jq -r '.result.name_servers[1] // empty')"
  echo "${domain},${zid},${ns1},${ns2}" >> "$OUT_NS"
  echo "${domain},${zid}" >> "$OUT_ZONES"
done

echo "DONE ✅ wrote $OUT_NS and $OUT_ZONES"
