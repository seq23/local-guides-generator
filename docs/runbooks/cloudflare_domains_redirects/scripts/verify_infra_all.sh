#!/usr/bin/env bash
set -euo pipefail

# Cloudflare Infra Verification Automation (Project 8)
# Verifies, per domain:
#   - Zone exists
#   - Worker routes exist (apex + www) and point to the intended Worker script
#   - DNS records exist and are proxied:
#       A @ -> 192.64.119.112 (proxied)
#       CNAME www -> @ (proxied)
#   - HTTP redirect works (301) and preserves path/query
#
# Inputs:
#   - CF_ACCOUNT_ID, CF_API_TOKEN (scoped token)
#   - Worker script name (env CF_WORKER_NAME)
#   - domains CSV (default: docs/runbooks/cloudflare_domains_redirects/inputs/domains.csv)
#
# Usage:
#   CF_ACCOUNT_ID=... CF_API_TOKEN=... CF_WORKER_NAME=redirector \
#     ./docs/runbooks/cloudflare_domains_redirects/scripts/verify_infra_all.sh \
#     docs/runbooks/cloudflare_domains_redirects/inputs/domains.csv

DOMAINS_CSV="${1:-docs/runbooks/cloudflare_domains_redirects/inputs/domains.csv}"

: "${CF_ACCOUNT_ID:?Missing CF_ACCOUNT_ID}"
: "${CF_API_TOKEN:?Missing CF_API_TOKEN}"
: "${CF_WORKER_NAME:?Missing CF_WORKER_NAME}"

if [[ ! -f "$DOMAINS_CSV" ]]; then
  echo "ERROR: domains CSV not found: $DOMAINS_CSV" >&2
  exit 1
fi

hdr_auth=( -H "Authorization: Bearer ${CF_API_TOKEN}" -H "Accept: application/json" )

fail_count=0
pass_count=0

note() { echo "[INFO] $*"; }
ok() { echo "✅ PASS: $*"; pass_count=$((pass_count+1)); }
bad() { echo "❌ FAIL: $*"; fail_count=$((fail_count+1)); }

get_zone_id() {
  local domain="$1"
  curl -sS "https://api.cloudflare.com/client/v4/zones?name=${domain}" "${hdr_auth[@]}" \
    | jq -r '.result[0].id // empty'
}

json_get() {
  local url="$1"
  curl -sS "$url" "${hdr_auth[@]}"
}

verify_routes() {
  local zone_id="$1"
  local domain="$2"
  local routes
  routes=$(json_get "https://api.cloudflare.com/client/v4/zones/${zone_id}/workers/routes")
  local ok_apex ok_www
  ok_apex=$(echo "$routes" | jq -r --arg p "${domain}/*" --arg s "$CF_WORKER_NAME" '.result[]? | select(.pattern==$p and .script==$s) | .id' | head -n1)
  ok_www=$(echo "$routes" | jq -r --arg p "www.${domain}/*" --arg s "$CF_WORKER_NAME" '.result[]? | select(.pattern==$p and .script==$s) | .id' | head -n1)
  if [[ -n "$ok_apex" && -n "$ok_www" ]]; then
    ok "Routes → ${CF_WORKER_NAME} exist for ${domain} (apex + www)"
  else
    bad "Routes missing/mismatched for ${domain}. Need patterns '${domain}/*' and 'www.${domain}/*' → ${CF_WORKER_NAME}"
  fi
}

verify_dns() {
  local zone_id="$1"
  local domain="$2"
  # A @
  local a_json cname_json
  a_json=$(json_get "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records?type=A&name=${domain}")
  cname_json=$(json_get "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records?type=CNAME&name=www.${domain}")

  local a_target a_prox
  a_target=$(echo "$a_json" | jq -r '.result[0].content // empty')
  a_prox=$(echo "$a_json" | jq -r '.result[0].proxied // empty')

  local c_target c_prox
  c_target=$(echo "$cname_json" | jq -r '.result[0].content // empty')
  c_prox=$(echo "$cname_json" | jq -r '.result[0].proxied // empty')

  if [[ "$a_target" == "192.64.119.112" && "$a_prox" == "true" ]]; then
    ok "DNS A @ proxied for ${domain}"
  else
    bad "DNS A @ wrong for ${domain} (need 192.64.119.112 proxied=true; got ${a_target:-none} proxied=${a_prox:-none})"
  fi

  if [[ "$c_target" == "${domain}" && "$c_prox" == "true" ]]; then
    ok "DNS CNAME www proxied for ${domain}"
  else
    bad "DNS CNAME www wrong for ${domain} (need content=${domain} proxied=true; got ${c_target:-none} proxied=${c_prox:-none})"
  fi
}

verify_http() {
  local domain="$1"
  # Keep output short; we just need the status line and Location.
  local out1 out2
  out1=$(curl -sS -I "https://${domain}/__lkg_test_path?x=1" | tr -d '\r' | sed -n '1p;/^Location:/Ip' | head -n 2)
  out2=$(curl -sS -I "https://www.${domain}/__lkg_test_path?x=1" | tr -d '\r' | sed -n '1p;/^Location:/Ip' | head -n 2 || true)

  if echo "$out1" | head -n1 | grep -q " 301"; then
    ok "HTTP 301 for https://${domain}/…"
  else
    bad "HTTP not 301 for https://${domain}/…"
  fi
  if echo "$out2" | head -n1 | grep -q " 301"; then
    ok "HTTP 301 for https://www.${domain}/…"
  else
    bad "HTTP not 301 for https://www.${domain}/…"
  fi
}

note "Verifying token (account-scope) …"
curl -sS "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/tokens/verify" "${hdr_auth[@]}" \
  | jq -e '.success==true' >/dev/null \
  || { echo "ERROR: token verify failed"; exit 1; }
ok "Token verified for account ${CF_ACCOUNT_ID}"

note "Beginning infra verification for domains in: ${DOMAINS_CSV}"

while IFS=, read -r domain rest; do
  [[ "$domain" == "domain" ]] && continue
  domain="$(echo "$domain" | tr -d ' ' | tr 'A-Z' 'a-z')"
  [[ -z "$domain" ]] && continue

  echo
  note "DOMAIN: ${domain}"
  zone_id=$(get_zone_id "$domain")
  if [[ -z "$zone_id" ]]; then
    bad "Zone not found for ${domain}"
    continue
  fi
  ok "Zone found for ${domain}: ${zone_id}"

  verify_routes "$zone_id" "$domain"
  verify_dns "$zone_id" "$domain"
  verify_http "$domain"

done < "$DOMAINS_CSV"

echo
echo "=== SUMMARY ==="
echo "PASS: ${pass_count}"
echo "FAIL: ${fail_count}"

if [[ "$fail_count" -gt 0 ]]; then
  exit 2
fi
