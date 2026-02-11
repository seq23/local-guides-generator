# Monetization — ad tokens inventory + validation runbook

# RULES (AUTHORITATIVE)

These runbooks are **deterministic**. Follow steps in order. Do not improvise.

**NO-TEASING / FULL-DELIVERY STANDARD**
- These docs include the full lifecycle: create → configure → execute → validate → failure modes → recovery → handoff.
- Where terminal steps exist, a manual-only alternative is also included under `docs/runbooks/manual_only/`.

**Safety**
- Never share API tokens in chat logs, screenshots, or tickets.
- Prefer short-lived tokens with least privilege.


## Goal
All canonical domains must render with ads. The build must fail if ad tokens are left unresolved.

## Repo signals
During build/validation you should see:
- `OK: Ad tokens resolved (no %%AD:...%% in dist)`

## Step 1 — Find ad token placeholders
From repo root:

```bash
grep -R --line-number "%%AD:" -n . | head -n 50
```

Document where tokens appear (templates/components).

## Step 2 — Identify token resolver
Search for the resolver logic:

```bash
grep -R --line-number "AD:" scripts data | head -n 50
```

## Step 3 — Build and confirm tokens resolved
```bash
npm ci
npm run build
```

Then confirm:
```bash
! grep -R "%%AD:" -n dist || (echo "FAIL: unresolved ad tokens in dist" && exit 1)
echo "PASS: no unresolved ad tokens"
```

## Step 4 — If unresolved tokens remain (fix)
- Ensure the ad inventory configuration exists for the pack
- Ensure the templates use correct token names
- Rebuild

## Rollback
If ads break production:
- revert the commit that changed ad template/token resolution
- rebuild and redeploy
