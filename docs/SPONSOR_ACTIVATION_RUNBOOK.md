# Sponsor Activation Runbook

## Purpose

This is the single Day 1 VA-safe runbook for checking inventory, activating a sponsor, validating the build, and click-auditing the affected routes.

## Product definitions

### City & State Placement
- baseline inventory only
- city pages + state pages
- does not include homepage
- does not include guides

### Statewide Buyout
- one state page
- up to 10 base cities in that state
- additional cities are unlimited but must be explicitly declared as extras
- does not include homepage
- does not include guides

### Vertical Buyout
- homepage hero
- guide influence
- CTA conversion dominance
- uses the same public `/next-steps/` and `/request-assistance/` routes

## Files to check before activation

- `data/sponsorships.json`
- `data/buyouts.json`
- `data/global_pages/for-providers.json`
- `data/global_pages/next-steps.json`
- `data/global_pages/request-assistance.json`

## Step-by-step activation

1. Confirm the product being sold.
2. Check whether any city is already reserved in `data/sponsorships.json`.
3. For statewide buyout, confirm the state page, classify up to 10 base cities, and declare any additional cities as extras.
4. For vertical buyout, confirm homepage + guides + CTA conversion dominance.
5. If CTA buyout is active, confirm the sponsor lead target is present.
6. Update `data/sponsorships.json` ownership fields.
7. Update `data/buyouts.json` only when the campaign is meant to be live at runtime.
8. Rebuild the pack.
9. Run validation.
10. Click-audit the affected routes.

## Validation command

```bash
PAGE_SET_FILE=data/page_sets/examples/uscis_medical_v1.json LKG_VALIDATE_DIST=1 npm run validate:all
```

## Click-audit checklist

### Always check
- `/for-providers/`
- `/admin/`
- `/next-steps/`
- `/request-assistance/`

### If statewide buyout is live
- state page
- each included city page
- one excluded city page

### If vertical buyout is live
- homepage
- guides hub
- one guide detail page
- one city page
- `/next-steps/`
- `/request-assistance/`

## Red flags

- city already reserved by a direct sponsor
- statewide buyout exceeds 10 base cities or includes undeclared extras
- missing `lead_target` for a live CTA buyout
- homepage behavior attached to anything other than vertical buyout
- guide behavior attached to anything other than vertical buyout

## Turn off / rollback

1. Disable the campaign in `data/buyouts.json`.
2. Remove or update ownership records in `data/sponsorships.json`.
3. Rebuild.
4. Re-run validation.
5. Re-check `/next-steps/`, `/request-assistance/`, and one affected page.


## Adding missing cities

If a sponsor requests cities that do not yet exist, use `docs/CITY_ADDITION_RUNBOOK.md` and the city request template before activating the sponsorship.


## City creation path options

Head VA may create missing cities either locally with the scaffold script or through GitHub → Actions using the **Add City Request** workflow. Both paths must still pass validation and click-audit before merge/go-live.
