# Releases — LKG Update Runbook (snapshot vs patch)

# RULES (AUTHORITATIVE)

These runbooks are **deterministic**. Follow steps in order. Do not improvise.

**NO-TEASING / FULL-DELIVERY STANDARD**
- These docs include the full lifecycle: create → configure → execute → validate → failure modes → recovery → handoff.
- Where terminal steps exist, a manual-only alternative is also included under `docs/runbooks/manual_only/`.

**Safety**
- Never share API tokens in chat logs, screenshots, or tickets.
- Prefer short-lived tokens with least privilege.


## Purpose
Deterministic, low-surprise repo updates when applying a ZIP update.

## Modes
### Snapshot mode (default)
- ZIP is a **full repo snapshot**
- rsync uses `--delete` (files missing from ZIP will be deleted locally)

### Patch mode
- ZIP is a patch/incremental update
- rsync runs **without** `--delete` to avoid unintended deletions

## Built-in preflight (required)
Before applying changes:
1) Print ZIP manifest
2) rsync dry-run and save report
3) show `git diff --stat` before commit

## One-command script
This project uses an update helper script (place it in your home directory):
- `~/update_lkg_from_zip.sh`

If you don’t have it:
- copy the authoritative script from your OS runbook store into `~/update_lkg_from_zip.sh`

## Execution (non-interactive)
Preferred invocation:
```bash
~/update_lkg_from_zip.sh "<ZIP_FULL_PATH>" "<REPO_PATH>" snapshot
# or
~/update_lkg_from_zip.sh "<ZIP_FULL_PATH>" "<REPO_PATH>" patch
```

## After update
Always run:
```bash
npm ci
npm run validate:all || npm run build
```

## If validation fails
- Check `dist/_broken_links.csv` (if produced)
- `git status` to see what changed
- Restore tracked files if accidental deletions occurred:
```bash
git restore .
```
Then re-run validate/build.

## Rollback
- Use the timestamp tag created by the script
- Or revert commit(s) and push
