# Phase 9 / Phase 4 — Guide Lock Pass

This pass locks the newly retrofitted Neuro and USCIS guide routes into the canonical guide answer-shape contract and enhancement registry.

## What this pass does
- adds missing guide contract entries for newly retrofitted Neuro and USCIS guide routes
- adds matching enhancement registry entries for those routes
- adds a dedicated Phase 9 guide-lock validator
- promotes the guide-lock validator into the hard-fail tier so future regressions fail deterministically

## Scope
This pass does not introduce new rendering behavior. It only locks the source-of-truth contract layer around the Phase 2 and Phase 3 guide updates.
