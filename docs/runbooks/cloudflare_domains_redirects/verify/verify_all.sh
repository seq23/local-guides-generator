#!/usr/bin/env bash
set -euo pipefail
DOMAINS_CSV="${1:?inputs/domains.csv required}"
ZONES_CSV="${2:?outputs/zones_with_ids.csv required}"

bash "$(dirname "$0")/verify_dns.sh" "$DOMAINS_CSV"
bash "$(dirname "$0")/verify_http.sh" "$DOMAINS_CSV"
bash "$(dirname "$0")/verify_routes.sh" "$ZONES_CSV"

echo "ALL CHECKS COMPLETE ✅"
