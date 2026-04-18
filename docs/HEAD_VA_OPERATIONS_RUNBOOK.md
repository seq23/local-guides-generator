# Head VA Operations Runbook

## Purpose

This runbook is for a Head VA managing city creation, sponsor activation, validation, click-audits, and escalation.

It is not the place to learn repo architecture. Read `START_HERE.md` and `REPO_ARCHITECTURE_PRIMER.md` first.

## Authority and scope

A Head VA may:
- use the local city-add path
- use the GitHub Action city-add path
- prepare sponsor changes
- run builds and validators
- review changed files
- perform click-audits
- escalate when authority boundaries are reached

A Head VA may not:
- invent new systems
- change core repo law
- bypass validators
- merge ambiguous sponsor or city states without resolving conflicts

## Allowed execution paths for city creation

### Path A — Local repo path
Use this when the repo is already local and you want direct control.

1. Review `/admin/`
2. Check whether the city already exists or is already reserved
3. Update or generate a request file using `data/templates/city_request.template.json`
4. Run:
   - `node scripts/scaffold_city_from_request.js data/templates/city_request.template.json --apply`
5. Rebuild
6. Run validation
7. Review changed files
8. Click-audit affected pages

### Path B — GitHub Actions path
Use this when you want a guided PR-based flow without local terminal work.

1. Open GitHub → Actions
2. Run **Add City Request**
3. Fill in the structured inputs
4. Let the workflow scaffold the city and create a PR
5. Review the PR
6. Confirm validation passed
7. Merge
8. Click-audit affected pages after merge

## Sponsor activation order

1. Confirm what product is being sold
2. Confirm whether cities already exist
3. Create missing cities if needed
4. Update `data/sponsorships.json`
5. Update `data/buyouts.json` only when the campaign should go live at runtime
6. Rebuild
7. Run validation
8. Click-audit:
   - `/for-providers/`
   - `/next-steps/`
   - `/request-assistance/`
   - affected state page
   - affected city pages
   - `/admin/`

## Escalate immediately if

- a city is already reserved and the new request would conflict
- the sponsor wants homepage or guides without a Vertical Buyout
- lead-routing is missing under CTA buyout
- validation fails and the smallest safe fix is not obvious
- ownership, product scope, or runtime behavior is ambiguous

## Related docs

- `VA_QUICK_SOP.md`
- `CITY_ADDITION_RUNBOOK.md`
- `SPONSOR_ACTIVATION_RUNBOOK.md`
- `SPONSORSHIP_ALLOCATION_RULES.md`
