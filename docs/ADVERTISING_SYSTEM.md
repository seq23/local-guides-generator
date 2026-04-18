# Advertising System

## Core products

### City & State Placement
Standard placement means fixed page-level visibility on city and state pages only.

Includes:
- City pages: top + middle + bottom placement
- State pages: top + middle placement

Does not include:
- Homepage placement
- Guide placement
- Site-wide visibility
- CTA conversion buyout rights

### Statewide Buyout
A statewide buyout includes:
- the state page
- up to 10 selected city pages within that state

Additional cities are paid add-ons.
Existing city sponsorship cannot be silently overridden.

Does not include:
- Homepage placement
- Guide placement
- Vertical CTA conversion takeover

### Vertical Buyout
A vertical buyout includes:
- homepage hero placement
- guide visibility
- broader coverage across eligible city and state pages
- sponsor-dominant CTA conversion surfaces

## Homepage rule

The homepage is not part of standard inventory. It becomes an advertising surface only during an active vertical buyout.

## Guide rule

Guide pages are not sold as standalone standard inventory and are not part of statewide buyouts. Guide visibility is reserved for vertical buyouts.

## CTA conversion rule

When a vertical buyout is active, the public CTA system can be bought out at the conversion layer.

This means:
- hero buttons may use a Next Steps CTA
- the button must still flow into the same /next-steps/ route
- request-assistance submissions may route to the active sponsor
- no parallel public sponsor-only route is created

## Ownership rule

- City sponsor wins locally
- Statewide buyout includes only the selected cities in its contract
- Vertical buyout controls guides, homepage, and conversion dominance


## Missing-city workflow
When a sponsor requests a city that does not yet exist, use `data/templates/city_request.template.json`, run `scripts/scaffold_city_from_request.js`, then follow `docs/CITY_ADDITION_RUNBOOK.md`.
