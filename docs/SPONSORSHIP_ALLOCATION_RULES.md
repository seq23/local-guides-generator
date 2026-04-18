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

## Sponsor-facing /for-providers page requirements

The public-facing /for-providers/ page must present:

### Public-facing products
- City — Shared Placement (Stacked)
- City — Buyout (Exclusive)
- State Buyout (PI only)
- Vertical Pack (total website) Buyout

### Runtime placement surfaces
- City pages
- Guide pages
- State pages (PI only)
- Vertical hub / home pages

### Required visual examples
- Shared city placement
- Shared state placement
- City buyout hero
- State buyout hero
- Guide-page buyout hero
- Vertical hub / home-page buyout hero
- Sponsor lead form example with note that leads go to sponsor

The public-facing page must not present:
- Guide Buyout
- Guide Shared Placement
- State Shared Placement
- internal contract / runtime enforcement language as sponsor-facing copy
