# Manual-only — redirects (few domains only)

# RULES (AUTHORITATIVE)

These runbooks are **deterministic**. Follow steps in order. Do not improvise.

**NO-TEASING / FULL-DELIVERY STANDARD**
- These docs include the full lifecycle: create → configure → execute → validate → failure modes → recovery → handoff.
- Where terminal steps exist, a manual-only alternative is also included under `docs/runbooks/manual_only/`.

**Safety**
- Never share API tokens in chat logs, screenshots, or tickets.
- Prefer short-lived tokens with least privilege.


## Warning
Manual UI redirects are only acceptable for a small number of domains. For bulk, use the Worker-based redirect system.

## Option A — Single Redirect Rule per domain (UI)
Zone → **Rules** → **Redirect Rules** (or Bulk Redirects if available):
- Source: `*` (or `/*`)
- Target: `https://CANONICAL/$1`
- Status: `301`
- Preserve query string: Yes

Repeat for each domain.

## Verification
```bash
curl -I "https://domain.com/test/path?x=1"
```
PASS if it returns `301` and Location points to canonical + same path/query.
