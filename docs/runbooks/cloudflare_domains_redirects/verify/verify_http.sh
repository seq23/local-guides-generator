#!/usr/bin/env bash
set -euo pipefail
DOMAINS_CSV="${1:?inputs/domains.csv required}"
command -v curl >/dev/null || { echo "curl required"; exit 1; }

echo "== HTTP REDIRECT CHECKS =="
fail=0
TEST_PATH="/__lkg_test__/abc"
TEST_QS="?z=1"

tail -n +2 "$DOMAINS_CSV" | while IFS=, read -r domain canonical vertical is_canonical is_parked notes; do
  domain="$(echo "$domain" | tr -d '\r' | xargs)"
  canonical="$(echo "$canonical" | tr -d '\r' | xargs)"
  is_canonical="$(echo "$is_canonical" | tr -d '\r' | xargs)"
  is_parked="$(echo "$is_parked" | tr -d '\r' | xargs)"

  [[ -z "$domain" ]] && continue
  [[ "$is_parked" == "yes" ]] && continue
  [[ "$is_canonical" == "yes" ]] && continue

  expected="${canonical%/}${TEST_PATH}${TEST_QS}"

  for host in "$domain" "www.$domain"; do
    url="https://${host}${TEST_PATH}${TEST_QS}"
    headers="$(curl -sI "$url" || true)"
    code="$(echo "$headers" | awk 'NR==1{print $2}')"
    loc="$(echo "$headers" | awk -F': ' 'tolower($1)=="location"{print $2}' | tr -d '\r')"

    if [[ "$code" != "301" || "$loc" != "$expected" ]]; then
      echo "FAIL HTTP: $url"
      echo "  got:  code=$code location=$loc"
      echo "  want: code=301 location=$expected"
      fail=1
    else
      echo "PASS HTTP: $url -> $loc"
    fi
  done
done

if [[ "$fail" -ne 0 ]]; then
  echo "HTTP CHECKS FAILED ❌"
  exit 1
fi
echo "HTTP CHECKS PASSED ✅"
