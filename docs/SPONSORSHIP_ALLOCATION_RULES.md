# Sponsorship Allocation Rules

## Source of truth
- `data/buyouts.json` = live runtime activation windows
- `data/sponsorships.json` = ownership, included cities, and sellability rules

## Allocation rules

1. City shared placement exists and is stacked.
2. City buyout exists and is exclusive at the city level.
3. State shared placement does not exist.
4. State Buyout (PI only) is the only state-level product.
5. A State Buyout may expand to additional cities within the same state upon request, subject to hierarchy and conflict rules.
6. A State Buyout cannot silently consume a city that already has a city sponsor.
7. Guides do not have standalone sponsorship tiers. Guide-related conversion surfaces only appear through Vertical Buyout behavior.
8. Only a Vertical Buyout can control CTA conversion surfaces across eligible pages.

See `docs/SPONSOR_ACTIVATION_RUNBOOK.md` for the single step-by-step operator flow.


## Missing-city workflow
Use `docs/CITY_ADDITION_RUNBOOK.md` with `data/templates/city_request.template.json` when a sponsor requests cities that are not yet in the system.
