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
