# REPO IDENTITY — LOCAL GUIDES GENERATOR

## CLASSIFICATION
Generator Repository

## CANONICAL UPDATER
~/update_lkg_from_zip.sh

## SNAPSHOT RULE
Snapshot mode ONLY.
Patch mode is forbidden unless explicitly unlocked.

## SNAPSHOT ZIP PATTERN
local-guides-generator-main_BASELINE_MM-DD-YY_<sha>.zip

## OUTPUT REQUIREMENTS
- dist/ must exist
- _lkg_snapshot.json must exist
- full validator pass required

## ROLE IN SYSTEM
Generates all downstream artifact repos including velocity repo.

## CRITICAL RULE
Artifact (ZIP) is source of truth — not working directory.

## FORBIDDEN
- Using generic updater
- Manual editing of dist/
- Partial snapshot updates

## TRIGGER PHRASE
LKG UPDATE RUNBOOK → ~/update_lkg_from_zip.sh

## DOMAINS THIS REPOSITORY OWNS

These are the five canonical hosts this generator builds, taken from `distribution.config.json`
(`indexnow.hosts`, and the same five again under `gsc.sites`) — not from a name that resembles a
domain.

- uscisexam.com
- theaccidentguides.com
- dentistryguides.com
- hormonesivhair.com
- neuroevalguides.com

### Why this section exists

Ahrefs Site Audit runs against these hosts as separate projects, and the repair duty in Boss OS
(`duty_site_audit_repair`) maps an audit finding onto a repository by searching `REPO_IDENTITY.md`
files for the domain — deliberately, so a mapping is evidence rather than resemblance. On
17 September 2026 that search returned nothing for uscisexam.com, so three confirmed errors were
recorded as `no_repo` and nothing was fixed. The generator was the right answer the whole time; it
simply never said so in the file the search reads.

This is the SOURCE repository for those sites, which is where a fix belongs. `dist/` is generated
and must not be hand-edited, per FORBIDDEN above.

### NOT `local-guides-citation-velocity`

That is a different repository with an adjacent name, it is **off limits to the automatic fixer**,
and it is a different property: its own canonical is `theindustryguides.com`. It mentions the five
hosts above thousands of times because it CITES them — that is what a citation-velocity site does —
and a file count is not ownership. Anyone reading a large grep result here should stop and check the
canonical before concluding the two repositories overlap.
