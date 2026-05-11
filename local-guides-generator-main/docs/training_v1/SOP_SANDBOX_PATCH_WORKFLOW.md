# SOP — SANDBOX PATCH WORKFLOW (VA → OWNER)

This workflow avoids PRs and avoids VA pushes.

## VA deliverable (email to info@spryvc.com)
Send:
- a ZIP named: `PATCH_<shortdesc>_<YYYY-MM-DD>.zip`
- includes only changed files (keep paths intact)
- include a short bullet list:
  - what changed
  - which pages to verify

## Owner apply (canonical)
Use the LKG Update Runbook in **patch mode** (no --delete) unless the ZIP is a full snapshot.

## Owner verification
Run:
- npm ci
- npm run validate:all
- npm run qa:release

If FAIL:
- do not push
- reply to VA with exact failing file + remediation
