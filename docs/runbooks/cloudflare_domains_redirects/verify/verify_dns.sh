#!/usr/bin/env bash
set -euo pipefail
DOMAINS_CSV="${1:?inputs/domains.csv required}"
command -v dig >/dev/null || { echo "dig required"; exit 1; }

echo "== DNS CHECKS =="
fail=0
tail -n +2 "$DOMAINS_CSV" | while IFS=, read -r domain canonical vertical is_canonical is_parked notes; do
  domain="$(echo "$domain" | tr -d '\r' | xargs)"
  is_parked="$(echo "$is_parked" | tr -d '\r' | xargs)"
  [[ -z "$domain" ]] && continue
  [[ "$is_parked" == "yes" ]] && continue

  ns="$(dig +short NS "$domain" | tr '\n' ' ')"
  if [[ -z "$ns" ]]; then
    echo "FAIL DNS: $domain (no NS response yet)"
    fail=1
  else
    echo "PASS DNS: $domain NS= $ns"
  fi
done

if [[ "$fail" -ne 0 ]]; then
  echo "DNS CHECKS FAILED ❌"
  exit 1
fi
echo "DNS CHECKS PASSED ✅"
