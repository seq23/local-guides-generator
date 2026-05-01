# Phase 2 Guide-Family Retrofit

This pass completes the Phase 2 guide-family retrofit against the cumulative-through-Phase-1 baseline.

Included in this pass:
- expanded route-level guide answer-shape contract coverage
- renderer support for contract-driven above-the-fold top modules
- active-pack rendered-output validation for contracted guide routes
- cumulative preservation of Phase 0A, 0B, and Phase 1 layers

What this changes:
- guide pages no longer rely only on generic opening + legacy custom core blocks
- contracted guide routes now render a shape-matched first-screen module
- the module type is driven by the route contract rather than hardcoded page-by-page renderer edits

What this does not do:
- rewrite every guide source JSON
- hand-edit dist output
- redesign page sets
