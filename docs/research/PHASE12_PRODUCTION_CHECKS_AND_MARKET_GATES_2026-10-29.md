# Phase 1 live verification checklist and Phase 2 decision gates

Updated 2026-10-29. This document distinguishes actions already checked from external proof still required. All existing nationwide state/city pages remain unchanged; Memphis Senior Care remains Memphis-metro only.

## Baseline verified in repository
- Source generation and routing live in `seq23/local-guides-generator`. Existing pages and nation-wide states were **not** deleted, redirected, or set to noindex by this research-only PR.
- `functions/api/request-assistance.js`: validates consent and contact data, attempts Airtable write, and sends Resend notification or fallback. A successful response is **not** a proven downstream delivery receipt.
- The host-authoritative vertical attribution fix was merged in PR #115 with passing CI.
- `seq23/local-guides-citation-velocity` is a separate non-local educational citation router with frozen accepted pages. It should be audited without republishing frozen output.

## Blocking external verification
| Check | Required evidence | Current finding |
|---|---|---|
| Production deployed commit | Cloudflare project deployment ID and SHA for each of 6 canonical sites and Velocity | NOT VERIFIED from connected Cloudflare |
| HTTP page status and canonical | Reachable GET from controlled external runner, canonical/robots/sitemap response evidence | NOT VERIFIED; prior container network errors are not site outages |
| Google indexing | Recent Search Console URL inspection and coverage for each canonical site; per-guide query data | NOT VERIFIED; older repository snapshot is not current |
| CRM receipt | Approved synthetic record with test-only email/phone, Airtable record ID and sanitized attribution | NOT TESTED in production |
| Resend delivery | Controlled recipient message ID and delivery event, not merely HTTP acceptance | NOT TESTED in production |
| Provider fulfillment | Active opt-in provider roster, approved territory, assignment and accepted/contacted callback proof | NOT VERIFIED |
| Monetization | Invoice/accepted-lead schedule and settled revenue attributable to market | NOT VERIFIED |

**Safety:** No real user lead or fake provider callback should be created solely to pass these checks. Require designated test recipient and explicit test isolation before live integration testing.

## Phase 2: what changed in evidence
### Ocala dentistry — source-rich but competition unknown
- LivHealthy advertises a $99 uninsured new-patient exam with X-rays, excluding cleaning from the written offer: https://livhealthydental.com/
- Pruitt advertises a $99 exam/cleaning/X-rays for qualifying new uninsured patients without periodontal disease: https://pruittdentistry.com/
- Harbour's $99 urgent dental appointment includes exam, X-ray and temporary pain relief; not a routine cleaning: https://harbourdental.care/ocala/99-new-patient-special/
- Advanced Dental Care Ocala at 34482 advertises a $99 limited problem-focused exam and necessary X-rays, no cleaning: https://www.adc-fl.com/dentist-office/ocala-fl-34482/payment-options/special-offers
- Advanced Dental Care South Ocala at 34471 lists a separate $59 limited problem-focused exam and necessary X-rays: https://www.adc-fl.com/dentist-office/south-ocala-fl-34471/payment-options/special-offers

This is a credible **comparison need**, not proof of low organic competition or high ROI. At least four clinic websites already market offers directly.

### Fresno USCIS — directly itemized primary source
AFC Urgent Care Fresno publishes $750 for an I-693 exam (adult or child), plus separate lab and vaccine items, including RPR $46, gonorrhea $90, TB QuantiFERON $100 and indicated chest X-ray $90. The clinic says two visits at minimum. This does not mean every applicant needs every listed service. Clinic source: https://www.afcurgentcare.com/fresno/patient-services/immigration-physicals/. Physician designation must still be independently checked in the official USCIS finder.

## Quantitative market-ranking gate
Scoring weights remain buyer demand 25, organic/AI competition gap 25, provider monetization 25, documented content opportunity 15, execution cost 10. **Do not assign numerical scores** until each of these has provenance:
1. Five locally targeted transactional query observations with date, device and market and cited top-ranking competitors.
2. Demand estimates / GSC query impressions with market and time-window labels.
3. Named service providers and verifiable scope, offer exclusions and link to primary source.
4. At least one real qualified-lead buyer contract / approved monetization channel and actual eligibility.
5. Estimated build/verification costs and ongoing source-refresh schedule.

Until then decisions remain `research`, `hold` or `pilot_measure`. No market is certified “blue ocean” by number of offers, crash incidents, or population growth alone.

## Handoff to Velocity
Velocity should audit general, non-geographic topic coverage and route to five national canonical brands; explicit local SERP competition belongs to canonical market research, not auto-generated Velocity city slugs. No frozen route mutations authorized here.
