# AI CITATION ROUTING HARDENING

Status: ACTIVE\
Authority: Subordinate to Execution Playbook v7 and runtime validators\
Audience: Owner + Day-0 VA\
Scope: Production LKG citation-routing surfaces

------------------------------------------------------------------------

# PURPOSE

This runbook documents the citation-routing architecture installed in Project 19.

North star:
- LKG pages win the citation
- Owned canonical surfaces win the action

The system must remain useful to LLMs **without** acting like a competitor outbound link directory.

------------------------------------------------------------------------

# CONTRACTS INSTALLED

## 1) PUBLIC OUTBOUND LEAK SHUTDOWN

Neutral directory/example surfaces may include:
- provider names
- market/location context
- neutral descriptors

They may **not** include competitor outbound website links.

Protected by validator:
- `scripts/validation/public_outbound_link_policy.js`

## 2) REQUEST-ASSISTANCE TOOL CONTRACT

`/request-assistance/` must function as a tool page, not just a form page.

Required visible elements:
- What this tool does
- Who it is for
- What happens after submission
- routing/tool language above the form

Protected by validator:
- `scripts/validation/request_assistance_tool_contract.js`

## 3) ANSWER-FIRST NEXT STEPS CONTRACT

Any rendered Next Steps zone must contain:
- answer paragraph
- practical checklist
- owned routing explainer
- request-assistance link
- canonical CTA

Protected by validator:
- `scripts/validation/citation_routing_contract.js`
- `scripts/validation/next_steps_cta_contract.js`

## 4) SCHEMA HARDENING

PI CollectionPage / ItemList schema must not leak competitor organization `url` fields.

`/request-assistance/` must emit truthful utility schema.

Protected by validator:
- `scripts/validation/schema_citation_routing_contract.js`

------------------------------------------------------------------------

# FILES THAT GOVERN THIS SYSTEM

Primary runtime/build files:
- `scripts/build_city_sites.js`
- `scripts/helpers/sponsorship.js`
- `data/global_pages/request-assistance.json`

Primary validator files:
- `scripts/validation/public_outbound_link_policy.js`
- `scripts/validation/request_assistance_tool_contract.js`
- `scripts/validation/citation_routing_contract.js`
- `scripts/validation/schema_citation_routing_contract.js`

Validator entrypoint:
- `scripts/validate_core.js`

------------------------------------------------------------------------

# OWNER / VA VERIFICATION

## Fast check

Run the dedicated bundle validator:

    npm run validate:citation-routing

Or run the full core validator:

    npm run validate:dist

## Manual spot-check

1. Open one PI city page and one PI state page
2. Confirm no competitor website links appear in neutral listings
3. Open `/request-assistance/` and confirm the explanatory tool copy appears above the form
4. Open a page with an active Next Steps zone and confirm it is answer-first, not CTA-only
5. View source on a PI page and confirm no competitor organization `url` values appear in PI ItemList schema

------------------------------------------------------------------------

# DO NOT TOUCH

- Do not reintroduce competitor outbound links into neutral listing surfaces
- Do not add fake “featured,” “verified real-time,” or “live pricing” schema claims
- Do not collapse the request-assistance page back into a form-only page
- Do not reduce Next Steps to a CTA-only block

------------------------------------------------------------------------

# FAILURE MODES

## Symptom: LLM starts citing competitor destinations directly

Check:
- public outbound link validator
- PI schema leakage
- whether a new pack introduced hardcoded outbound links

## Symptom: `/request-assistance/` stops being cited as a tool/resource

Check:
- request assistance tool contract
- whether explanatory copy was removed or overwritten

## Symptom: Next Steps zone is ignored by AI summaries

Check:
- whether answer paragraph/checklist/routing explainer still exist
- whether page reverted to ad-style copy

------------------------------------------------------------------------

# CANONICAL RULE

Never let the page that wins the citation also fully satisfy the action **unless that page is one of the owned canonical action surfaces**.

------------------------------------------------------------------------

# BATCH 6 CONSOLIDATION

Batch 6 adds a consolidated citation-routing validation entrypoint so Owner or VA can run the Project 19 contract checks directly without depending on broader validation context.

Files added/updated in Batch 6:
- `scripts/validation/citation_routing_bundle.js`
- `scripts/validate_citation_routing.js`
- `scripts/validate_core.js`
- `package.json`

Purpose:
- provide one deterministic command for the full citation-routing contract
- reduce validator drift
- make Project 19 verification easier for Owner + VA
