# Friction Audit: what went wrong today + prevention + fixes

## A) Cloudflare “max zones / activate some zones” (1118)
**Why:** Cloudflare blocks new zone adds when you exceed plan/time limits or too many are pending.  
**Prevent:** Add in batches; after each batch, update Namecheap nameservers so they become Active.  
**Fix:** Wait + retry remaining; or activate some zones first.

## B) Redirect Lists hit account item limits (10020)
**Why:** Redirect Lists have account caps.  
**Prevent:** Don’t use lists. Use **Workers + Routes**.  
**Fix:** Switch to Worker system.

## C) Zone ruleset phase not allowed (“http_request_redirect not allowed at zone level”)
**Why:** Plan/phase limitations.  
**Prevent:** Workers + Routes.  
**Fix:** Stop zone rulesets.

## D) Worker deployment errors
### “Unexpected token export”
**Why:** Module syntax uploaded as non-module.  
**Prevent:** Use service-worker syntax with `addEventListener("fetch", ...)` and deploy as `application/javascript`.  
**Fix:** Regenerate with `scripts/regen_worker_from_csv.py`.

### “No event handlers were registered”
**Why:** Worker has no fetch handler.  
**Fix:** Same as above.

## E) 522 on redirect domains
**Why:** proxied DNS exists but there’s no “origin” and/or route mismatch; missing A @ or www route.  
**Prevent:** Mandatory order:
1) ensure A @ + CNAME www (proxied)
2) deploy worker
3) attach BOTH routes (apex + www)
**Fix:** rerun `ensure_redirect_dns.sh` then `attach_routes.sh`, wait 2–5 minutes, retest.

## F) Literal $1 in Location
**Why:** using redirect-list style targets (capture syntax).  
**Prevent:** Worker generator strips that.
**Fix:** regen + redeploy worker.

## G) Token verify confusion
**Rule:** verify account-level tokens at:
`/client/v4/accounts/$CF_ACCOUNT_ID/tokens/verify`
