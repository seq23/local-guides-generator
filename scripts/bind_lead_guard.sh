#!/usr/bin/env bash
# Bind the lead gate (lib/lead_guard.mjs) to every Pages project that serves a lead form:
# the LEAD_LIMITS KV namespace (local-guides-lead-limits) and the Turnstile secret
# LOCAL_GUIDES_TURNSTILE_SECRET_KEY, production and preview. Idempotent; PATCH merges,
# so other bindings and vars are untouched. Run from boss-os so the vault injects both:
#   cd ~/GitHub/boss-os && npm run -s vault:run -- bash ~/GitHub/local-guides-generator/scripts/bind_lead_guard.sh
# The Turnstile widget is "local-guides-leads" (site key in assets/lead-guard.js); its
# hostnames are the six guide domains, memphisseniorcarehomes.com and theindustryguides.com.
set -euo pipefail
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN missing (vault)}"
: "${LOCAL_GUIDES_TURNSTILE_SECRET_KEY:?LOCAL_GUIDES_TURNSTILE_SECRET_KEY missing (vault)}"
export ACCOUNT=8d147e242033699dd37c6f5a451f48d2
export KV_ID=230f27631c07480a8a2b7b11362f53f7
python3 - <<'PY'
import json, os, sys, urllib.request
A, T, S, KV = os.environ['ACCOUNT'], os.environ['CLOUDFLARE_API_TOKEN'], os.environ['LOCAL_GUIDES_TURNSTILE_SECRET_KEY'], os.environ['KV_ID']
projects = ['local-guides-generator-pi', 'local-guides-generator-dentistry', 'local-guides-generator-neuro', 'local-guides-generator-trt',
            'local-guides-generator-uscis-medical', 'local-guides-generator-senior-living', 'local-guides-citation-velocity']
cfg = {"kv_namespaces": {"LEAD_LIMITS": {"namespace_id": KV}}, "env_vars": {"LOCAL_GUIDES_TURNSTILE_SECRET_KEY": {"type": "secret_text", "value": S}}}
bad = 0
for p in projects:
    req = urllib.request.Request(f"https://api.cloudflare.com/client/v4/accounts/{A}/pages/projects/{p}", method='PATCH',
                                 data=json.dumps({"deployment_configs": {"production": cfg, "preview": cfg}}).encode(),
                                 headers={'Authorization': 'Bearer ' + T, 'content-type': 'application/json'})
    d = json.load(urllib.request.urlopen(req))
    c = d['result']['deployment_configs']
    ok = d['success'] and all('LEAD_LIMITS' in (c[e].get('kv_namespaces') or {}) and 'LOCAL_GUIDES_TURNSTILE_SECRET_KEY' in (c[e].get('env_vars') or {}) for e in ('production', 'preview'))
    print(p, 'ok' if ok else 'FAILED')
    bad += 0 if ok else 1
sys.exit(1 if bad else 0)
PY
