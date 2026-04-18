# VA Quick SOP

Read these first:
- `START_HERE.md`
- `LLM_PROMPTS.md`

## Use this when

- a sponsor asks for cities
- you need to know whether a city is free or taken
- you need to add a missing city
- you need to know which workflow to use

This is a short task-flow doc. It is not the architecture primer.

## First stop

Open `/admin/`

Check:
- what product is being sold
- whether the city already exists
- whether the city is reserved
- whether the city should be base included or extra

## Common task flow

### Add a city
1. Check `/admin/`
2. Decide whether to use the local path or GitHub path
3. Add the city through the approved workflow
4. Rebuild
5. Validate
6. Click-audit

### Add or adjust a sponsor
1. Check `/admin/`
2. Confirm product scope
3. Update the correct sponsorship source files
4. Rebuild
5. Validate
6. Click-audit affected pages

### Run an audit
1. Identify the pack you are working on
2. Compare runtime, docs, sales surface, and validator expectations
3. Record any drift
4. Escalate if the drift changes scope or monetization rules

## Two city-add paths

### Local path
1. Update `data/templates/city_request.template.json`
2. Run:
   - `node scripts/scaffold_city_from_request.js data/templates/city_request.template.json --apply`
3. Rebuild
4. Validate
5. Click-audit

### GitHub path
1. Open GitHub → Actions
2. Run **Add City Request**
3. Fill in the form
4. Review the PR it creates
5. Merge after validation passes
6. Click-audit after merge

## Base vs extra rule

- Up to 10 cities can be marked as base included
- Additional cities are allowed, but must be marked as extras
- A city cannot be both

## Escalate immediately if

- a city is already reserved
- the sponsor wants homepage or guides without a Vertical Buyout
- lead-routing is missing under CTA buyout
- validation fails
