# Docs — Canonical Locations (Single Source of Truth)

This repo treats docs as **two canonical roots**:

1) `docs/runbooks/` — operational SOPs, deployment, governance, validators, release discipline
2) `docs/training_v1/` — Day-0 VA training + setup + execution drills

Everything else that used to live under `docs/` has been moved into:

- `docs/_archive_2026-02-01/` (historical / legacy / sandbox / generated)

References that must remain available (but not clutter the top-level) live in:

- `docs/runbooks/_references/`

Policy:
- **Do not** add new top-level folders under `docs/`.
- If something doesn’t belong in `runbooks/` or `training_v1/`, it goes into `runbooks/_references/` or the next dated `_archive_*` folder.

## VA training additions

- `training_v1/VA_GUIDE_UPDATES.md` — how to add/edit guide JSONs safely (no template edits)
