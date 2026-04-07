# Reference Layer Status and Deferred Artifacts

## Status

This repository includes the hidden-ingestion framework for Repo 2 → Repo 3 promotion flow:

- `scripts/reference/pull_velocity_candidates.js`
- `scripts/reference/generate_from_candidates.js`
- `scripts/reference/guard_visible_surfaces.js`
- `.github/workflows/ingestion_sync.yml`
- `.github/workflows/promote_reference.yml`

## Intentionally Deferred Artifacts

The following reference-layer artifacts are intentionally deferred until the first successful ingestion run produces real candidate output:

- committed `reference/<vertical>/<candidate>/index.html` surfaces
- committed `/_reference_index/` browse/index surfaces
- committed `sitemaps/sitemap_reference.xml`

These surfaces are not omitted by accident. They are deferred to avoid shipping placeholder reference inventory without real candidate data.

## Production Rule

Production readiness for this repository means the framework, validators, and promotion lane exist and are safe. The reference-layer content artifacts are created when real candidate manifests are pulled and generated.

## Operator Guidance

Do not manually create placeholder reference pages just to satisfy structure. Run the ingestion flow with a valid candidate contract, generate real hidden reference pages, and then allow the standard build/validation/distribution path to emit the derived reference artifacts.
