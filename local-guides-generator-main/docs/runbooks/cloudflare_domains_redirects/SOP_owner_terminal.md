# SOP (Owner + Terminal): Bulk add domains + bulk redirects

## 0) Preconditions
- You have CF_ACCOUNT_ID + CF_API_TOKEN (account-level) + CF_WORKER_NAME
- CSV filled: `inputs/domains.csv`
- `jq` installed

## 1) Set env vars
```bash
export CF_ACCOUNT_ID="YOUR_ACCOUNT_ID"
export CF_API_TOKEN="YOUR_TOKEN"
export CF_WORKER_NAME="lkg-redirector"
```

Verify:
```bash
bash scripts/verify_token.sh
```

## 2) Bulk add zones + export nameservers
```bash
mkdir -p outputs
bash scripts/bulk_add_zones.sh inputs/domains.csv outputs/domain_nameservers.csv outputs/zones_with_ids.csv
```

## 3) Namecheap bulk update (manual)
Use `outputs/domain_nameservers.csv`. See `SOP_VA_manual.md`.

## 4) Ensure redirect DNS (prevents 522)
```bash
bash scripts/ensure_redirect_dns.sh outputs/zones_with_ids.csv
```

## 5) Generate + deploy Worker
```bash
python3 scripts/regen_worker_from_csv.py inputs/domains.csv outputs/lkg_redirector_worker.js
bash scripts/deploy_worker.sh outputs/lkg_redirector_worker.js
```

## 6) Attach routes for apex + www
```bash
bash scripts/attach_routes.sh outputs/zones_with_ids.csv
```

## 7) Verify pass/fail
```bash
bash verify/verify_all.sh inputs/domains.csv outputs/zones_with_ids.csv
```

## Fast fixes
- 522: rerun DNS + routes; wait 2–5 min.
- www fails: rerun attach_routes.
- $1 appears: regen + redeploy worker.
