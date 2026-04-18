# SNAPSHOT ARTIFACT GOVERNANCE ADDENDUM

Artifact is the source of truth.

Working repo is not trusted.

Snapshot ZIP must:
- include required root files
- include dist/
- pass validation when extracted

Snapshot mode:
- rsync --delete
- full replacement

Patch mode:
- restricted
- not default

Deletes must be classified:
- generated vs source-of-truth

Never override deletes on incomplete artifact.

Final rule:
ZIP must prove itself before touching repo.
