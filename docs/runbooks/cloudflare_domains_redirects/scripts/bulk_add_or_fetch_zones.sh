#!/usr/bin/env bash
set -euo pipefail

# Add OR fetch zones (Cloudflare)
# - Avoids duplicates by checking existing zones first
# - Writes:
#   1) domain_nameservers.csv: domain,zone_id,ns1,ns2
#   2) zones_with_ids.csv: domain,zone_id
# - Handles common Cloudflare limits:
#   * 25 signups / 10 minutes (1118)
#   * blocked when too many pending (1118)
#
# Usage:
#   ./bulk_add_or_fetch_zones.sh domains.txt out_domain_nameservers.csv out_zones_with_ids.csv

DOMAINS_FILE="${1:?domains file required}"
OUT_NS_CSV="${2:?output nameservers csv required}"
OUT_ZONES_CSV="${3:?output zones csv required}"

: "${CF_ACCOUNT_ID:?Set CF_ACCOUNT_ID}"
: "${CF_API_TOKEN:?Set CF_API_TOKEN}"

# CSV headers
echo "domain,zone_id,ns1,ns2" > "$OUT_NS_CSV"
echo "domain,zone_id" > "$OUT_ZONES_CSV"

# Helper: call CF API
cf() {
  curl -sS "https://api.cloudflare.com/client/v4$1" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    ${2:-}
}

# Backoff when 1118 happens
backoff_1118() {
  local attempt="$1"
  # progressive: 70s, 140s, 210s, max 300s
  local sleep_s=$((attempt * 70))
  if (( sleep_s > 300 )); then sleep_s=300; fi
  echo "  !! Hit add-zone limit (1118). Sleeping ${sleep_s}s then retrying..." >&2
  sleep "$sleep_s"
}

add_zone() {
  local domain="$1"

  # 1) Try to find existing zone by name
  local existing
  existing="$(cf "/zones?name=${domain}&per_page=50" | jq -r '.result[0].id // empty')"
  if [[ -n "$existing" ]]; then
    # Fetch nameservers
    local z
    z="$(cf "/zones/${existing}" )"
    local ns1 ns2
    ns1="$(echo "$z" | jq -r '.result.name_servers[0] // ""')"
    ns2="$(echo "$z" | jq -r '.result.name_servers[1] // ""')"
    echo "${domain},${existing},${ns1},${ns2}" >> "$OUT_NS_CSV"
    echo "${domain},${existing}" >> "$OUT_ZONES_CSV"
    echo "OK (existing): $domain"
    return 0
  fi

  # 2) Create zone (type=full)
  local attempt=1
  while true; do
    local res
    res="$(cf "/zones" --data "{
      \"account\": { \"id\": \"${CF_ACCOUNT_ID}\" },
      \"name\": \"${domain}\",
      \"type\": \"full\"
    }")"

    local success code
    success="$(echo "$res" | jq -r '.success')"
    code="$(echo "$res" | jq -r '.errors[0].code // empty')"

    if [[ "$success" == "true" ]]; then
      local zid ns1 ns2
      zid="$(echo "$res" | jq -r '.result.id')"
      ns1="$(echo "$res" | jq -r '.result.name_servers[0]')"
      ns2="$(echo "$res" | jq -r '.result.name_servers[1]')"
      echo "${domain},${zid},${ns1},${ns2}" >> "$OUT_NS_CSV"
      echo "${domain},${zid}" >> "$OUT_ZONES_CSV"
      echo "OK (created): $domain"
      return 0
    fi

    # Handle 1118 add-zone limit
    if [[ "$code" == "1118" ]]; then
      backoff_1118 "$attempt"
      attempt=$((attempt+1))
      continue
    fi

    echo "FAILED (create): $domain" >&2
    echo "$res" | jq -c '.errors' >&2
    return 1
  done
}

# Read domains, ignore blanks/comments
while IFS= read -r raw; do
  domain="$(echo "$raw" | tr -d '\r' | xargs)"
  [[ -z "$domain" ]] && continue
  [[ "$domain" == \#* ]] && continue
  add_zone "$domain"
done < "$DOMAINS_FILE"

echo "DONE ✅  Wrote: $OUT_NS_CSV and $OUT_ZONES_CSV"
