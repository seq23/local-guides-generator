# Post-Merge Guide Completion Plan

Purpose: turn merged intake-generated draft guide source files into production-shaped canonical guides without writing directly to `main`.

## Lane
1. Merge intake PR into `main`.
2. Detect newly added or modified skeletal promoted guide files under `data/page_sets/examples/*_global_pages/`.
3. Build a completion queue.
4. Complete queued guides into canonical sectioned shape by vertical.
5. Sync guides.
6. Validate the completion lane.
7. Build all packs and run full validation.
8. Restore transient `data/site.json`.
9. Open a follow-up PR for review.

## Safety rules
- No direct writes to `main` in v1.
- No committed `data/site.json` mutation.
- No committed temp queue artifacts.
- Exit cleanly when no promoted drafts require completion.
