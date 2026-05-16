# COMPLEXITY LINT (ANTI-OVERENGINEERING) — CHECKLIST

Goal: bias toward clarity. Day-0 VA must be able to execute without interpretation.

## Hard rules
1. One source of truth per concept (no duplicated configs).
2. Prefer **data → validator → render**. Avoid hidden logic.
3. VA workflows must be **≤ 10 actions** end-to-end.
4. Every new script must include:
   - deterministic inputs
   - deterministic outputs
   - hard-fail on ambiguity
5. If adding a new layer, remove an old one in the same change.

## Before adding anything
- Can this be done by extending an existing file instead?
- Can this be done with one new file (not 3)?
- Will a VA understand it in 5 minutes?

## Red flags (do not ship)
- Multiple inventories for the same concept
- “Helper” files that mirror existing templates
- Optional modes without strict defaults
- Silent fallbacks that hide broken states
