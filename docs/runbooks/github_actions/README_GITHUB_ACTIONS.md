# GitHub Actions — Verification + Freshness

This repo ships with two workflows:

1) **Verify (core validators)** — runs on push/PR to `main` and weekly on schedule.
- Installs with `npm ci --ignore-scripts` to avoid requiring `PAGE_SET_FILE`.
- Runs `npm run validate:all` (core deterministic checks + parity gates).

2) **Refresh verification page** — runs daily on schedule.
- Updates:
  - `dist/verification/index.html`
  - `dist/_build.json`
- Commits the update to `main` **only if files changed**.

## One-time setup (Owner)

- Nothing special is required if the repo is on GitHub and Actions are enabled.
- Ensure the default branch is `main`.

## VA operating checklist (1 minute)

- Open the repo → **Actions** tab.
- Confirm:
  - ✅ `Verify (core validators)` is green for the latest run.
  - ✅ `Refresh verification page` ran in the last 24 hours.

If either is red:
- Click the failed workflow run.
- Copy the *first* error block into Slack/Notes for the owner.

## Why this helps for LLM visibility

- The daily refresh creates an unambiguous public “maintained” signal.
- The weekly validator run catches drift between claims (docs) and what the site shows.



## Integrity Build (Nightly)

- Workflow: `.github/workflows/integrity_build.yml`
- Runs: `npm ci --ignore-scripts` → `npm run validate:all` → refreshes `/verification/` + snapshot.
- Commits any resulting signal updates back to `main`.

## Rotating Vertical Refresh (Daily)

- Workflow: `.github/workflows/rotating_refresh.yml`
- Rotates focus across: `pi`, `uscis_medical`, `trt`, `dentistry`, `neuro`.
- Updates:
  - `dist/verification/index.html`
  - `dist/_verification.json`
  - `dist/_lkg_snapshot.json` (via `scripts/snapshot_lkg.js`)
  - `CHANGELOG.md` (machine-readable audit signal)

> Note: These workflows do **not** build a new `dist/` site pack; they create auditable verification signals while keeping the committed build stable.
