# City Addition Runbook

## Purpose

Use this runbook when a sponsor requests cities that are not yet in the system or when operations needs to classify statewide buyout cities as base vs extra.

## Core statewide rule

- Base package: up to 10 cities
- Extra cities: unlimited, but must be explicitly declared
- Every requested city must be classified as:
  - base included
  - extra city

## Files used

- `data/templates/city_request.template.json`
- `data/sponsorships.json`
- `scripts/scaffold_city_from_request.js`
- `docs/SPONSOR_ACTIVATION_RUNBOOK.md`

## Step-by-step

A Head VA may use either the local scaffold path or the GitHub **Add City Request** workflow.

1. Open `/admin/` and check whether the city already exists.
2. If the city already exists:
   - do not scaffold it again
   - classify it as base or extra in the statewide buyout record
3. If the city does not exist:
   - duplicate the request entry in `data/templates/city_request.template.json`
   - fill in the real city fields
4. Run the scaffold script:
   - `node scripts/scaffold_city_from_request.js data/templates/city_request.template.json --apply`
5. Confirm the new city was added to the vertical city file.
6. Update `data/sponsorships.json`:
   - add the city to `cities_included` if base
   - add the city to `extra_cities` if extra
7. Rebuild and validate.
8. Click-audit the state page, included city pages, and one excluded city page.

## Red flags

- City slug does not match the state suffix
- City is marked both base and extra
- City is marked neither base nor extra
- More than 10 cities appear in `cities_included`
- Extra cities are present without explicit contract scope
- City is already reserved by another sponsor

## Validation command

`PAGE_SET_FILE=data/page_sets/examples/uscis_medical_v1.json LKG_VALIDATE_DIST=1 npm run validate:all`


## GitHub workflow path

1. Open GitHub → Actions
2. Run **Add City Request**
3. Fill in the structured inputs
4. Review the generated PR
5. Merge only after validation passes
