#!/usr/bin/env bash
# Bind the senior-leads D1 database (SENIOR_DB) and the plain lead vars to the
# local-guides-generator-senior-living Pages project, production and preview.
# Idempotent: re-running re-applies the same values. Bindings live on the project,
# not in a root wrangler.toml, so the other five guides projects are untouched.
# Token: CLOUDFLARE_API_TOKEN if set, else the logged-in wrangler session's token.
set -euo pipefail
ACCOUNT=8d147e242033699dd37c6f5a451f48d2
PROJECT=local-guides-generator-senior-living
D1_ID=e36cb56a-6d35-400c-b28f-cd0a148d2e83           # senior-leads (production: the invoice evidence)
D1_PREVIEW_ID=c9e70112-d6ef-44f4-ad5b-5b33e1bbba31   # senior-leads-preview (branch previews never touch real evidence)
LEAD_TO=hello@theindustryguides.com
TOKEN="${CLOUDFLARE_API_TOKEN:-$(npx wrangler auth token 2>/dev/null | tail -1)}"
[ -n "$TOKEN" ] || { echo "no Cloudflare token (wrangler login, or CLOUDFLARE_API_TOKEN)" >&2; exit 2; }
cfg() { printf '{"d1_databases":{"SENIOR_DB":{"id":"%s"}},"env_vars":{"LEAD_TO":{"type":"plain_text","value":"%s"}}}' "$1" "$LEAD_TO"; }
body=$(printf '{"deployment_configs":{"production":%s,"preview":%s}}' "$(cfg "$D1_ID")" "$(cfg "$D1_PREVIEW_ID")")
curl -sS -X PATCH -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/pages/projects/$PROJECT" --data "$body" |
  python3 -c "import json,sys;d=json.load(sys.stdin);ok=d.get('success');c=(d.get('result') or {}).get('deployment_configs',{});print('success',ok,{e:(c.get(e,{}).get('d1_databases'),sorted((c.get(e,{}).get('env_vars') or {}).keys())) for e in ('production','preview')});sys.exit(0 if ok else 1)"
