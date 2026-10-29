# Phases 1–2: Verified execution baseline — October 29, 2026

## Non-regression scope

All pre-existing state, city, and nationwide pages in the five national guides stay in place. This research change does not delete, redirect, noindex, unpublish or change any canonical page. Memphis Senior Care stays focused on Memphis metropolitan coverage and is excluded from national opportunity rankings.

## Phase 1 — production and business-system baseline

| Work item | Evidence | Current state | Follow-up required |
|---|---|---|---|
| Canonical generation and release | `local-guides-generator` README and merged PRs 103–115 | Six packs exist including Memphis; recent content/attribution PRs merged with CI | Inspect the exact deployed Cloudflare commit and run current production page status checks |
| Velocity boundary and release process | `local-guides-citation-velocity` README, SOURCE_AUTHORITY, PAGE_RELEASE_LAW, DAY_0_OPERATOR_GUIDE | Separate short, non-geographic query router; admitted pages frozen, no autonomous bulk publishing | Inventory query coverage and the frozen/admission registries before changes |
| Public availability of pilot URLs | The five user-facing URLs were requested via public web retrieval | This retrieval channel reported inaccessible, which is **not** proof of an HTTP 404 or site outage | Run authenticated/external HTTP checks from a reachable runner; collect status, canonical, robots and sitemap |
| Indexing | Prior GitHub Search Console inspection snapshot for 2026-09-28 through 2026-10-25: Memphis 189/193; dentistry 36/64; PI 63/263; neuro 32/201; USCIS 27/183; hormones 27/approx. 206 pages; most national sites had significant indexation gaps | Snapshot is historical and should not be presented as current Google coverage | Fetch latest GSC coverage, query impressions and per-page URL inspection through authorized data access |
| Airtable intake | `functions/api/request-assistance.js` writes to Airtable and falls back to Resend notification; missing env returns 503 when both stores fail | Code and regression logic confirmed; production secrets and real stored records not checked | Authorized synthetic test with approved recipient, then verify record ID and delivery in controlled target |
| Lead attribution | PR #115 changed known canonical host to win over posted vertical field | Code merged and CI passed | Verify deployed function version and synthetic record attribution |
| Fulfillment | No provider acceptance roster or signed routing contract verified | Unproven; do not suggest listed clinics receive our leads | Inventory genuine partners, covered geography, consent, legal rules, acknowledgment and lead status |
| Monetization | No collected lead revenue nor accepted-lead amounts verified for target markets | Unknown | Build revenue and cost model using actual CRM accounting records |

## Phase 1 priority defects and controls

1. **Production observability:** no fresh accessible proof of deployed commit, crawlable local URLs or Google indexing during this run.
2. **Lead-delivery integration:** API source is reviewable; live Airtable and Resend receipt are not, and fake submissions must not be sent without controlled test routing.
3. **Provider supply:** directory listing is not a contract or permission to send contact details.
4. **Nationwide indexation:** retain the whole nationwide footprint; diagnose site-specific crawl, quality, duplicate and link-access problems before adding mass local landing pages.

## Phase 2 evidence architecture

Source of truth: `data/research/markets/phase2_fifteen_cluster_evidence_2026-10-29.json`, separate from the previously committed geographic priority queue. Includes five national verticals x three metro clusters, provider and official source references, caveats, candidate decisions and null fields for genuinely missing demand/competition/revenue numbers.

**Initial stronger evidence-to-research candidates:**
- **Ocala dentistry:** LivHealthy $99 exam and X-rays, Harbour $99 new-patient exam/X-rays (special emergency wording on another page), Pruitt $99 cleaning/exam/X-ray for qualifying uninsured patients, and Advanced Dental Care South Ocala $59 focused exam/X-rays with restrictions. Different offers require service-scope normalization before publication. Sources: https://livhealthydental.com/ ; https://harbourdental.care/ocala/ ; https://pruittdentistry.com/ ; https://www.adc-fl.com/dentist-office/south-ocala-fl-34471/payment-options/special-offers
- **Fayetteville neuro:** UAMS Northwest publishes a local ADHD evaluation provider resource list and advises about potential out-of-pocket costs. Midtown Counseling describes a complete ADHD assessment battery without quoting a price; Arkansas Clinic for Stress & Anxiety publishes a $360 90-minute diagnostic evaluation, not established to be equivalent to ADHD testing. Sources: https://nwa.uams.edu/uams-northwest-student-wellness-programs-adhd-services/ ; https://www.midtown-counseling.com/about-montauk ; https://www.arkansasclinic.org/
- **Fresno USCIS:** AFC Urgent Care Fresno publishes a $750 I-693 base exam price and separate itemized test costs, making a source-based total-fee comparison feasible. Verify physician designation and exclusions before a page. Source: https://www.afcurgentcare.com/fresno/patient-services/immigration-physicals/
- **Midland–Odessa PI:** Odessa Police gives an official crash-report access process, limitations under Texas law and a $6 fee. This is a direct user problem but not proof of personal-injury leads or low keyword difficulty. Source: https://www.odessa-tx.gov/911/Obtaining-a-Police-Report-or-Record
- **Laredo USCIS:** easyIME lists several exam prices but obscures clinic identities prior to booking; it is a **marketplace**, not confirmation from the physicians. Market remains blocked for all-in clinic-fee claims. Source: https://www.easyime.com/uscis-immigration-doctors-laredo-tx

## Go/no-go for actual publication and scaling

- Publishing requires a distinctive local customer question, a current attributable primary source for material facts, no doorway-style duplication, a useful independent answer and existing-page cannibalization review.
- Scaling requires localized demand/competition observations, indexing and clicks, qualified lead outcomes, an authorized recipient, and realized or contractually supported revenue economics.
- Source availability is NOT SEO difficulty; number of clinics is NOT keyword demand; population growth is NOT ROI. All missing quantitative fields remain null.

## Immediate next implementation queue

1. Attach up-to-date GSC export and Cloudflare deployment proof.
2. Perform controlled Airtable/Resend test only when safe, explicitly approved routing is available.
3. Extend Ocala dental competitive SERP/source research and Fresno medical fee comparison; test other alternative metros beyond the starting fifteen.
4. Audit Velocity query-family-to-canonical map without altering frozen pages.
5. Publish only when evidence plus deployment plus lead route readiness justify each new page.
