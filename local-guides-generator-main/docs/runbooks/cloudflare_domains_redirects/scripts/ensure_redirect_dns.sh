#!/usr/bin/env bash
set -euo pipefail
ZONES_CSV="${1:?outputs/zones_with_ids.csv required}"
: "${CF_API_TOKEN:?Set CF_API_TOKEN}"
command -v jq >/dev/null || { echo "jq required"; exit 1; }

ANYCAST_IP="192.64.119.112"

list_records() {
  local zone_id="$1"; local type="$2"; local name="$3"
  curl -s "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records?type=${type}&name=${name}" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json"
}

create_record() {
  local zone_id="$1"; local type="$2"; local name="$3"; local content="$4"; local proxied="$5"
  curl -s "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records" \
    -X POST \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{
      \"type\": \"${type}\",
      \"name\": \"${name}\",
      \"content\": \"${content}\",
      \"proxied\": ${proxied}
    }"
}

update_record() {
  local zone_id="$1"; local rec_id="$2"; local type="$3"; local name="$4"; local content="$5"; local proxied="$6"
  curl -s "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records/${rec_id}" \
    -X PUT \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{
      \"type\": \"${type}\",
      \"name\": \"${name}\",
      \"content\": \"${content}\",
      \"proxied\": ${proxied}
    }"
}

tail -n +2 "$ZONES_CSV" | while IFS=, read -r domain zone_id; do
  domain="$(echo "$domain" | tr -d '\r' | xargs)"
  zone_id="$(echo "$zone_id" | tr -d '\r' | xargs)"
  [[ -z "$domain" || -z "$zone_id" ]] && continue

  echo "==> $domain"

  # A @
  a_res="$(list_records "$zone_id" "A" "$domain")"
  a_id="$(echo "$a_res" | jq -r '.result[0].id // empty')"
  a_ip="$(echo "$a_res" | jq -r '.result[0].content // empty')"
  a_px="$(echo "$a_res" | jq -r '.result[0].proxied // empty')"

  if [[ -z "$a_id" ]]; then
    cres="$(create_record "$zone_id" "A" "$domain" "$ANYCAST_IP" "true")"
    [[ "$(echo "$cres" | jq -r '.success')" == "true" ]] && echo "  + Created A @ (${ANYCAST_IP}, proxied)" || { echo "  !! Failed A @"; echo "$cres" | jq .; continue; }
  else
    if [[ "$a_ip" != "$ANYCAST_IP" || "$a_px" != "true" ]]; then
      ures="$(update_record "$zone_id" "$a_id" "A" "$domain" "$ANYCAST_IP" "true")"
      [[ "$(echo "$ures" | jq -r '.success')" == "true" ]] && echo "  ~ Updated A @ to ${ANYCAST_IP} (proxied)" || { echo "  !! Failed update A @"; echo "$ures" | jq .; continue; }
    else
      echo "  = A @ exists + correct (${ANYCAST_IP})"
    fi
  fi

  # CNAME www -> @
  cname="www.${domain}"
  c_res="$(list_records "$zone_id" "CNAME" "$cname")"
  c_id="$(echo "$c_res" | jq -r '.result[0].id // empty')"
  c_ct="$(echo "$c_res" | jq -r '.result[0].content // empty')"
  c_px="$(echo "$c_res" | jq -r '.result[0].proxied // empty')"

  if [[ -z "$c_id" ]]; then
    cres="$(create_record "$zone_id" "CNAME" "$cname" "$domain" "true")"
    [[ "$(echo "$cres" | jq -r '.success')" == "true" ]] && echo "  + Created CNAME www -> @ (proxied)" || { echo "  !! Failed CNAME www"; echo "$cres" | jq .; continue; }
  else
    if [[ "$c_ct" != "$domain" || "$c_px" != "true" ]]; then
      ures="$(update_record "$zone_id" "$c_id" "CNAME" "$cname" "$domain" "true")"
      [[ "$(echo "$ures" | jq -r '.success')" == "true" ]] && echo "  ~ Updated CNAME www -> @ (proxied)" || { echo "  !! Failed update CNAME"; echo "$ures" | jq .; continue; }
    else
      echo "  = CNAME www exists + correct"
    fi
  fi
done

echo "DONE ✅"
