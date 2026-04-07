#!/usr/bin/env bash
set -euo pipefail

# Usage:
# ./distribution_scripts/deploy_distribution.sh \
#   example.com \
#   YOUR_INDEXNOW_KEY \
#   service-account.json \
#   "sc-domain:example.com"

HOST="${1:?Missing host}"
INDEXNOW_KEY="${2:?Missing IndexNow key}"
GSC_CREDS="${3:?Missing service account json path}"
GSC_SITE_URL="${4:?Missing GSC siteUrl, e.g. sc-domain:example.com}"

echo "== 1) Submit Google sitemaps =="
python3 distribution_scripts/gsc_submit_sitemaps.py \
  "$GSC_CREDS" \
  "$GSC_SITE_URL" \
  "https://${HOST}/sitemap.xml" \
  "https://${HOST}/sitemap-fresh.xml"

echo
echo "== 2) Submit IndexNow priority URLs =="
./distribution_scripts/indexnow_submit.sh \
  "$HOST" \
  "$INDEXNOW_KEY" \
  "dist/indexnow-priority.txt"

echo
echo "== 3) Submit IndexNow batch URLs =="
./distribution_scripts/indexnow_submit.sh \
  "$HOST" \
  "$INDEXNOW_KEY" \
  "dist/indexnow-batch.txt"

echo
echo "== 4) Inspect priority URLs in GSC API =="
python3 distribution_scripts/gsc_inspect_urls.py \
  "$GSC_CREDS" \
  "$GSC_SITE_URL" \
  "dist/indexnow-priority.txt" \
  "dist/inspection-results.json"

echo
echo "Done."
echo
echo "IMPORTANT:"
echo "- Google 'Request indexing' is still manual in Search Console UI."
echo "- After this script finishes, open GSC and manually request indexing for 5-10 top URLs."
