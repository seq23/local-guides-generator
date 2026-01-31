# Cloudflare Bulk Domains + Bulk Redirects (LKG Runbook)

Drop this folder into your repo at:
`docs/runbooks/cloudflare_domains_redirects/`

## What this runbook does (deterministic)
1) Bulk-add domains to Cloudflare (zones)
2) Export per-domain Cloudflare nameservers for Namecheap bulk updates
3) Ensure redirect-only DNS is correct (prevents 522)
4) Generate a single Worker redirector from `inputs/domains.csv`
5) Attach routes for apex + www for every redirect domain
6) Verify DNS + routes + HTTP (PASS/FAIL)

## Quick start (Owner)
```bash
export CF_ACCOUNT_ID="YOUR_ACCOUNT_ID"
export CF_API_TOKEN="YOUR_ACCOUNT_TOKEN"
export CF_WORKER_NAME="lkg-redirector"

mkdir -p outputs

bash scripts/bulk_add_zones.sh inputs/domains.csv outputs/domain_nameservers.csv outputs/zones_with_ids.csv
# (Manual) Namecheap bulk update using outputs/domain_nameservers.csv

bash scripts/ensure_redirect_dns.sh outputs/zones_with_ids.csv
python3 scripts/regen_worker_from_csv.py inputs/domains.csv outputs/lkg_redirector_worker.js
bash scripts/deploy_worker.sh outputs/lkg_redirector_worker.js
bash scripts/attach_routes.sh outputs/zones_with_ids.csv

bash verify/verify_all.sh inputs/domains.csv outputs/zones_with_ids.csv

# Full infra verification (single command; Project 8)
# Includes token verify + per-domain: zone, routes, DNS, HTTP.
CF_WORKER_NAME="$CF_WORKER_NAME" bash scripts/verify_infra_all.sh inputs/domains.csv
```

If anything fails: read `SOP_owner_terminal.md` and `FRICTION_AUDIT.md`.
