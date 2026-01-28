LISTINGS TBS — MASTER INDEX (SINGLE SOURCE

OF TRUTH)

Name: LISTINGS-TBS-MASTER-INDEX-1-16-26v2.1

Status: AUTHORITATIVE · LOCKED · NON-COMPRESSIBLE

Effective date: 2026-01-16



v2.1 AMENDMENT NOTE (AUTHORITATIVE)
This release incorporates the previously missing v1.8 content (Appendix P — VA Operations & Certification Law) without removing or compressing any prior content.
Status: FROZEN SPEC. Changes allowed only via explicit amendments.

🔒 NEW CHAT BOOTSTRAP PROMPT — LISTINGS TBS (v1.3)

READ CAREFULLY. THIS PROMPT OVERRIDES ALL DEFAULT CHAT BEHAVIOR.

You   are   operating   on   the  LISTINGS   TBS   MASTER   INDEX,   the  single   source   of   truth  for   the   Listings

Template-Based System.

1. CANONICAL BASELINE REQUIREMENT (NON-NEGOTIABLE)

Before doing anything else, the user must upload the latest Master Index as a PDF. The uploaded PDF is the

immutable baseline for this session. Memory, summaries, or prior chats are invalid. If the PDF is missing,

stop and request it.

2. ABSOLUTE CANVAS SAFETY LAW (PERMANENT)

You are forbidden from rewriting, reorganizing, consolidating, or cleaning up this document unless ALL of

the following occur first: 1) Export the current canvas to a downloadable file (PDF preferred) generated in

this chat and containing the full document verbatim. 2) Post the download link in chat before any rewrite,
merge, or version change. 3) Only after the export may edits occur.

Skipping this sequence is a system failure.

3. ZERO-COMPRESSION RULE (ABSOLUTE)

You   may   not   remove   sections,   summarize   content,   replace   procedures   with   prose,   collapse   tables   into

paragraphs, or tighten language by deleting operational detail. Reorganization is allowed; compression is

forbidden.

1

4. 🔒 ARTIFACT COMPLETENESS LAW (PERMANENT)

If the Master Index governs, constrains, or enforces a behavior, the full executable artifact for that behavior

must   exist   verbatim   inside   this   document.   Forbidden:   principles-only   rules,   summaries,   references,   or

implied implementation.

Required standard:  For every rule, embed at least one of the following in full: step-by-step SOP, registry

table, verbatim template/snippet, failure decision tree, or checklist/runbook. If none exist, the rule is invalid.

Artifact-first order:  (1) Define the artifact, (2) define the rule, (3) define enforcement. Any other order is

invalid.

Mandatory check: Before any version bump or rewrite, ask: “For every rule here, is there a concrete artifact

a trained VA could execute without questions?” If no, stop and add the artifact.

5. VERSION CONTROL RULE (USER-OWNED)

Versioning is controlled only by the user. No version bumps unless explicitly instructed. Major: vX→vX+1.
Date+version: MM-DD-26 vX. Every change must appear in the header.

6. MASTER INDEX AUTHORITY RULE

This document overrides all prompts, repo comments, SOPs, ChatGPT instructions, and memory. If it’s not

written here, it does not exist.

7. CONTENT-BEFORE-CODE LAW (ENFORCED)

Guides are written in full plain text first; content locks before JSON; JSON locks before generator; generator

locks before deployment. Code without content lock is invalid.

8. AUTOMATION & VALIDATION LAW

No hardcoded inventories. Guides hubs use %%GUIDE_CARDS%%. City pages use %%CITY_GUIDE_BLOCK%

%. New tokens require template insertion, build injection, and validator enforcement in the same change.

Validators evolve with system changes. No validator pass = no delivery.

9. DELIVERY SAFETY RULE

No   files,   ZIPs,   or   code   intended   for   GitHub   may   be   delivered   unless   syntax-checked,   sanity-checked,

validator-compatible, free of unresolved tokens, and safe for direct paste.

2

10. OPERATING MODE

Work   in   explicit   stages,   stage   additions   before   merging,   ask   before   destructive   edits,   never   assume

approval, never hallucinate missing material. When unsure, stop and ask.

Final lock: This document is a constitution and an operations manual. Rules without artifacts

are invalid. Preservation precedes improvement.

GOVERNING AUTHORITY

GOVERNING AUTHORITY

This document is the highest governing authority for the Listings Template-Based System (TBS).

If any other artifact conflicts with this document — including: - prior Master Index versions - SOPs - prompts

- repo comments - ChatGPT instructions - verbal agreements

THIS DOCUMENT WINS.

No section may be summarized, paraphrased, or selectively applied.

0. SYSTEM DEFINITION (IMMUTABLE)

What this system is

Listings   TBS   is   a  template-based   static   publishing   system  for   producing  neutral,   educational,   non-

endorsement decision-support guides across multiple verticals and cities.

The system exists to: - help readers understand complex decisions - reduce risk through verification and

preparation - provide structured questions and next actions

What this system is NOT

This system does  not: - rank providers - recommend providers - sell leads - collect referral fees - provide

legal or medical advice - operate as a marketplace

1. BUSINESS & MONETIZATION LAW (LOCKED)

1.1 Monetization model

• 

Ads-only monetization on canonical sites

3

• 

Ads are:

• 

clearly labeled

• 

visually separated

• 

editorially neutral

1.2 Prohibited monetization

The following are permanently prohibited: - sponsored directory listings - pay-to-play rankings - featured

provider endorsements - lead resale

1.3 Directory exception (PI only)

Directories are allowed only in the Personal Injury vertical.

Rules: - exactly 5 firms per city - alphabetical order - real firms only - official website link only - no phone,

address, email - Morgan & Morgan is prohibited

2. ACTIVE VERTICALS (AUTHORITATIVE)

Only the verticals listed here are active. Ownership of a domain does NOT activate a vertical.

2.1 Personal Injury (pi)

• 

directory: ALLOWED

• 

guides: REQUIRED

• 

city pages: REQUIRED

2.2 Dentistry (dentistry)

• 

directory: FORBIDDEN

• 

state lookup: REQUIRED on all guides + city pages

2.3 Neuro Evaluations (neuro)

NEURO IS A SINGLE VERTICAL.

ADHD and Autism are subtopics, not verticals.

• 

directory: FORBIDDEN

• 

state lookup: REQUIRED

2.4 USCIS Medical (uscis)

• 

directory: FORBIDDEN

• 

state lookup: REQUIRED

4

3. DOMAIN & BRAND ARCHITECTURE (LOCKED)

3.1 Canonical rule

Each vertical has exactly one canonical domain.

All other domains are: - redirects - defensive - wedges

They never define structure.

3.2 Known canonical mappings

• 

PI: theaccidentguides.com

• 

Dentistry: dentistryguides.com

• 
• 

Neuro: neuroevaluationguides.com
USCIS: city-domain only (no canonical declared yet)

4. REPO & GENERATOR CONTRACT (IMMUTABLE)

4.1 Canonical starting point rule

ALL WORK MUST BEGIN FROM:

THE LATEST DEPLOYED SITE SOURCE ZIP

This ZIP is the only canonical truth.

Local copies, memory, or partial zips are invalid.

5. RELEASE GATES (NON-NEGOTIABLE)

5.1 Syntax Gate

No file may be delivered unless: - valid JavaScript - executable under Node - no malformed template strings

5.2 Build + Validator Gate

• 

npm run build must succeed

• 

node scripts/validate_tbs.js must pass

• 

validator updates must ship with system changes

5.3 No-Markdown Fence Gate

• 

no triple backticks in scripts/

5

• 

validator enforces

FAIL ANY GATE → DO NOT DELIVER

6. CANONICAL CONTENT INVENTORY LAW

Hardcoding inventories is forbidden.

Applies to: - guides lists - FAQ lists - city guide blocks

Rules: - canonical JSON only - placeholders only in HTML - build injects everything

7. TOKEN LIFECYCLE PROTOCOL (SCHEMA LAW)

A token is valid ONLY if: 1. appears in template 2. injected by build 3. enforced by validator

Missing any → INVALID CHANGE

8. GUIDES SYSTEM LAW (LOCKED)

8.1 Guides Hub ownership

• 

exactly one /guides/ route per vertical

• 

must live in page set

• 

never global pages

8.2 Auto-update requirement

• 

%%GUIDE_CARDS%% is mandatory

• 

no hardcoded links

8.3 City guide block

• 

%%CITY_GUIDE_BLOCK%% required

• 

injected by build

• 

validator enforced

9. TAXONOMY LAW (LOCKED)

9.1 Canonical taxonomy

Each vertical has exactly one taxonomy file: - data/taxonomy/<vertical>_taxonomy.json

6

9.2 Slug law

• 

routes MUST match taxonomy slugs exactly

• 

no variants

• 

no -guide suffixes

10. TAXONOMY CHANGE PROTOCOL (FULL)

Add guide

• 

add to taxonomy

• 

add to example pack

• 

verify hub + city blocks

Rename title

• 

slug unchanged

• 

update taxonomy + guide JSON

Rename slug

• 
• 

HIGH RISK
requires redirect plan

Remove guide

• 

remove taxonomy

• 

remove JSON

• 

validate

11. UNIVERSAL GUIDE JSON STANDARD (LOCKED)

Guides MUST: - be written in plain text first - approved - converted to JSON

Required structure: - authority note - if you only read one thing - hero - ads - decision guidance - verification

- scenarios - simple plan - reference anchor

12. PERSONAL INJURY GUIDE LAW (FULL)

PI guides MUST include: - immediate steps (now / 24h / week) - lawyer selection primary focus - verification

section - scenarios - simple plan

No exceptions.

7

13. ARCHITECTURE LOCK SEQUENCE

1. 

architecture

2. 

then content

Never reversed.

14. SOP — VA EXECUTION (FULL, NON-COMPRESSIBLE)

This section defines step-by-step, VA-safe operating procedures. Deviation is not allowed.

14.1 SOP — ADD NEW CITY (VERTICAL EXPANSION)

Purpose: Safely add a new city without breaking routing, guides, or validation.

Inputs   (ALL   REQUIRED):  -   Latest   deployed   SOURCE   ZIP   (mandatory   baseline)   -   Target   vertical   (pi   /

dentistry / neuro / uscis) - City slug (kebab-case, lowercase) - City display name

Procedure (DO NOT SKIP STEPS): 1. Unzip the latest SOURCE ZIP into a clean working directory. 2. Confirm
/data/cities/<vertical>_cities.json  exists. 3. Add new city entry: - slug: must be unique - name:
human-readable city + state 4. Confirm no duplicate slugs across the file. 5. Run local build ( npm run  
build ). 6. Confirm generated city page exists at:  /dist/<city-slug>/index.html  7. Open generated
city page and confirm: -  %%CITY_GUIDE_BLOCK%%  was injected - Ads resolved - City FAQ rendered 8. Run
validator ( node scripts/validate_tbs.js ).

Failure Handling: - If build fails → STOP, fix error, restart from Step 5. - If validator fails → STOP, do not zip.

Output: - New SOURCE ZIP with city added

14.2 SOP — ADD NEW GUIDE (EXISTING VERTICAL)

Purpose: Add a guide without breaking taxonomy, hubs, or city blocks.

Inputs: - Latest SOURCE ZIP - Approved plain-text guide (Phase 1 complete) - Vertical name - Guide slug +

title

Procedure:  1.   Confirm   guide   content   is   approved   in   plain   text.   2.   Open   data/taxonomy/
<vertical>_taxonomy.json . 3. Append new guide slug + title. 4. Open   data/page_sets/examples/
<vertical>_v1.json .  5.  Insert  full  guide  JSON  using  the  Universal  Guide  Template.  6.  Confirm  route

matches taxonomy slug exactly. 7. Run build. 8. Confirm: - Guide page exists - Guide appears automatically
in  /guides/  - Guide appears automatically in city pages 9. Run validator.

8

Failure Handling: - Any missing appearance = INVALID

14.3 SOP — PERSONAL INJURY DIRECTORY OPERATIONS

Purpose: Maintain compliant PI directories.

Rules (REPEAT, NO EXCEPTIONS): - Exactly 5 firms per city - Alphabetical by firm name - Official website link

only - No phone, address, tracking, or CTAs - Morgan & Morgan is prohibited

Procedure: 1. Verify firm exists and practices PI law. 2. Verify official website domain. 3. Insert firm into PI

directory data file. 4. Alphabetize list. 5. Re-count firms (must equal 5). 6. Run build. 7. Manually inspect city

directory page. 8. Run validator.

Failure Handling: - Less than 5 firms → HOLD city - More than 5 firms → REMOVE excess

16. RELEASE DISCIPLINE & ENFORCEMENT (LOCKED)

16.1 ZIP NAMING & VERSIONING RULE

All   deliverables   must   be   shipped   as  source-only   ZIPs  (never   include   dist/ )   using   the   exact   naming

pattern:

local-guides-generator-canonical-build_<VERSION>_<BATCH>.zip

Rules: - VERSION increments only when the user explicitly instructs a version bump - BATCH letters advance

sequentially (A, B, C…) - Reusing a batch letter is forbidden - Each ZIP must be independently buildable from

a clean directory

Any ZIP that violates this naming or structure is invalid.

16.2 BATCH DISCIPLINE RULE

Each batch ZIP may contain only one class of change: - architecture - content - taxonomy - directory data -

validator rules

Mixed-change batches are forbidden.

16.3 CHANGELOG REQUIREMENT

Every batch ZIP must include a  CHANGELOG.md  at the repo root containing: - what changed (explicit) - why

it changed - files touched - validation status (build + validator)

9

A ZIP without a changelog is invalid and must not be delivered.

16.4 RELEASE CHECKLIST (MANDATORY GATE)

Before any ZIP is delivered, all of the following must pass:

• 
☐ Syntax gate passed
☐ Build succeeded ( npm run build )
• 
☐ Validator passed ( node scripts/validate_tbs.js )
• 
☐ No unresolved  %%TOKEN%%  strings
• 
• 
☐ Guides hub auto-updates correctly
• 
☐ City guide blocks present on all city pages
• 
☐ FAQ rules enforced (10–12, no duplicates, default closed)
• 
☐ Ads resolved

Failure on any item blocks delivery.

16.5 ROLLBACK PROTOCOL (NO HOTFIXING)

If a regression is discovered:

1. 

Immediately halt further changes

2. 

Identify the last known-good SOURCE ZIP

3. 

Restore that ZIP as the working baseline

4. 

Re-apply changes as a new batch

Hotfixing on top of a broken state is forbidden.

16.6 MASTER INDEX UPDATE ENFORCEMENT

Any   system-level   change   (tokens,   automation,   validation,   structure)   requires:   -   an   explicit   Master   Index

update - correct version notation in the header - changelog entry

Unrecorded system changes are invalid.

16.7 PRINTABLE VA RELEASE CARD (REQUIRED)

Every release must be accompanied by a one-page VA release card documenting: - inputs received - batch

scope - validation results - ZIP filename - handoff confirmation

This card is required for auditability and handoff discipline.

10

APPENDIX A — FULL TAXONOMY TABLES (VERBATIM)

A.1 Personal Injury (PI)

slug

title

route

appears_in_hub

appears_on_city_pages

car-accidents

Car accidents

/guides/car-

accidents/

truck-accidents

Truck

accidents

/guides/truck-

accidents/

motorcycle-

accidents

Motorcycle

accidents

/guides/

motorcycle-

accidents/

slip-and-fall

Slip and fall

/guides/slip-and-

injuries

fall/

wrongful-death

Wrongful

death

/guides/wrongful-

death/

yes

yes

yes

yes

yes

yes

yes

yes

yes

yes

A.2 Dentistry

slug

title

route

appears_in_hub

appears_on_city_pages

clear-aligners

Clear aligners

cosmetic-

dentistry

sedation-

dentistry

Cosmetic

dentistry

Sedation

dentistry

/guides/clear-

aligners/

/guides/cosmetic-

dentistry/

/guides/sedation-

dentistry/

tooth-

Tooth

/guides/tooth-

extractions

extractions

extractions/

yes

yes

yes

yes

yes

yes

yes

yes

A.3 Neuro Evaluations

slug

title

route

appears_in_hub

appears_on_city_pages

adult-adhd-

evaluation-

process

Adult ADHD

evaluation

process

/guides/adult-

adhd-evaluation-

yes

yes

process/

11

slug

title

route

appears_in_hub

appears_on_city_pages

autism-

Autism

evaluation-

evaluation for

adults

adults

/guides/autism-

evaluation-adults/

yes

neuropsych-

Neuropsych

/guides/

testing-

overview

testing

overview

neuropsych-

yes

testing-overview/

yes

yes

A.4 USCIS Medical

slug

title

route

appears_in_hub

appears_on_city_pages

uscis-medical-

USCIS medical

exam-overview

exam overview

/guides/uscis-
medical-exam-

overview/

yes

i-693-medical-

I-693 medical

/guides/i-693-

exam-

exam

medical-exam-

yes

requirements

requirements

requirements/

yes

yes

APPENDIX B — TOKEN REGISTRY (LOCKED)

token

appears_in

injected_by

validator_rule

%%GUIDE_CARDS%%

guides hub

build_city_sites.js must not remain unresolved

%%CITY_GUIDE_BLOCK%%

city pages

build_city_sites.js must exist on all city pages

%%FAQ_ITEMS_GLOBAL%%

global FAQ

build_city_sites.js

10–12 items enforced

%%FAQ_ITEMS_CITY%%

city FAQ

build_city_sites.js

10–12 items enforced

%%AD:*%%

pages with ads

ad injector

no unresolved ad tokens

APPENDIX C — RELEASE ARTIFACT REGISTRY

artifact

required

description

SOURCE ZIP

yes

canonical working baseline

CHANGELOG.md

yes

batch-level change record

VA Release Card

yes

handoff + validation proof

12

artifact

required

description

Master Index PDF

yes

immutable snapshot

APPENDIX D — VERTICAL CAPABILITY MATRIX

vertical

directory

guides

city pages

state lookup

PI

yes

Dentistry

no

Neuro

USCIS

no

no

yes

yes

yes

yes

yes

yes

yes

yes

no

yes

yes

yes

APPENDIX E — MASTER INDEX VERSION HISTORY

version

date

scope

notes

v1.0

v1.1

v1.2

2026-01-16

initial consolidation

first locked constitution

2026-01-16

SOP expansion

VA-safe procedures

2026-01-16

release discipline + appendices

full system closure

APPENDIX F — GLOBAL SLUG REGISTRY (LOCKED)

This registry lists all guide slugs across all verticals. Slugs must be unique system-wide.

vertical

slug

route

pi

pi

pi

pi

pi

car-accidents

/guides/car-accidents/

truck-accidents

/guides/truck-accidents/

motorcycle-accidents

/guides/motorcycle-accidents/

slip-and-fall

/guides/slip-and-fall/

wrongful-death

/guides/wrongful-death/

dentistry

clear-aligners

/guides/clear-aligners/

dentistry

cosmetic-dentistry

/guides/cosmetic-dentistry/

13

vertical

slug

route

dentistry

sedation-dentistry

/guides/sedation-dentistry/

dentistry

tooth-extractions

/guides/tooth-extractions/

neuro

adult-adhd-evaluation-process

/guides/adult-adhd-evaluation-process/

neuro

autism-evaluation-adults

/guides/autism-evaluation-adults/

neuro

neuropsych-testing-overview

/guides/neuropsych-testing-overview/

uscis

uscis

uscis-medical-exam-overview

/guides/uscis-medical-exam-overview/

i-693-medical-exam-requirements

/guides/i-693-medical-exam-requirements/

APPENDIX G — RESERVED ROUTES REGISTRY (LOCKED)

The following routes are reserved and may never be used as guide or city slugs:

• 

/guides/

• 

/about/

• 

/contact/

• 

/privacy/

• 

/disclaimer/

• 

/editorial-policy/

• 

/for-providers/

Validator must fail if any taxonomy slug collides with these routes.

APPENDIX H — TAXONOMY PREFLIGHT CHECKLIST (MANDATORY)

Before adding or modifying any taxonomy entry:

• 
☐ Slug is not present in Global Slug Registry
• 
☐ Slug does not collide with Reserved Routes
• 
☐ Slug is kebab-case, lowercase
• 
☐ Slug appears in exactly one vertical taxonomy
• 
☐ Guide exists in example pack
• 
☐ Guides hub auto-updates
• 
☐ City guide blocks auto-update

Failure on any item blocks the change.

14

APPENDIX I — GUIDE QA → VALIDATOR ENFORCEMENT MAP
(LOCKED)

This   appendix   maps  human   Guide   QA   requirements  to  machine-enforceable   validator   checks.   Any

guide failing an enforced item is invalid and must not ship.

QA Requirement

Enforcement Type

Validator Behavior

Authority Note present

Enforced

Fail if missing first section

“If You Only Read One Thing” present

Enforced

Fail if missing callout

Hero section with disclaimer

Enforced

Fail if missing disclaimer text

Questions to Ask Providers section

Enforced

Fail if missing or empty

Reference Anchor present

Global disclaimers present

Enforced

Enforced

Fail if missing quotable sentence

Fail if missing disclaimer block

No rankings / endorsements

Human + Audit

Manual audit only

No hardcoded cities/states

Enforced

Fail if city/state tokens detected

Plain-text approval before JSON

Human

Approval gate only

APPENDIX J — SHELL GUIDE DETECTION RULES (LOCKED)

A guide is considered a shell and invalid if any of the following are true:

• 

The guide title question is not directly answered in the body

• 

The guide contains only lists of questions without explanatory context

• 

Sections describe what will be covered but never provide content

• 

The guide can be summarized as generic advice without topic specificity

Validator   Requirement:  -   Fail   build   if   required   sections   are   present   but   contain   fewer   than   minimum

substantive elements (lists, paragraphs, steps)

APPENDIX K — GUIDE QA SIGN-OFF RECORD (MANDATORY)

Before JSON conversion, each guide must have a recorded QA sign-off.

Required   fields:  -   Guide   title   -   Guide   slug   -   Vertical   -   Reviewer   name   -   Date   approved   -   Checklist

confirmation (all items passed)

JSON conversion without a completed sign-off record is invalid.

15

APPENDIX L — CANONICAL CITY PAGE SKELETON (LOCKED)

All city overview pages must follow this structure and order. Content may vary by vertical, but the structural

blocks and token placements are invariant.

Required order: 1. Authority Note (callout) 2. Hero 3. City Context (neutral, factual) 4.  %%AD:city_top%%
5. City Guides Block ( %%CITY_GUIDE_BLOCK%% ) 6.  %%AD:city_mid%%  7. City FAQ ( %%FAQ_ITEMS_CITY%
% ) 8.  %%AD:city_bottom%%  9. Why this matters 10. Disclaimers

Canonical HTML snippet (verbatim placeholder structure):

<section class="callout authority"> <strong>Authority note:</strong> In general, licensed providers follow

similar   baseline   practices.   This   page   summarizes   commonly   accepted   approaches   and   uses   a   neutral

decision framework so readers can compare options safely without rankings or endorsements. </section>

<section   class="hero">   <p   class="kicker">City   guide</p>   <h1><CITY   NAME>   Guides</h1>   <p

class="muted">Neutral checklists and comparison frameworks. Educational only; not professional advice.</

p> </section>

<section class="section"> <h2>City context</h2> <p><Neutral, factual context for this city and vertical. No

marketing language.></p> </section>

%%AD:city_top%%

<section class="section"> <h2>Start with these guides</h2> %%CITY_GUIDE_BLOCK%% </section>

%%AD:city_mid%%

<section class="section"> <h2>FAQ</h2> %%FAQ_ITEMS_CITY%% </section>

%%AD:city_bottom%%

<p   class="why"><strong>Why   this   matters:</strong>   clarifying   expectations   early   reduces

misunderstandings, delays, and unnecessary costs later.</p>

<section class="disclaimer"> <p><strong>Educational only.</strong> This site provides general information

and   decision-support   checklists.   It   is   not   legal,   medical,   or   professional   advice.</p>   <p><strong>No

endorsements.</strong>   We   do   not   recommend   or   rank   providers.   Advertising   is   clearly   labeled   and

separated from editorial content.</p> </section>

16

APPENDIX M — CITY PAGE VALIDATOR EXPECTATIONS (LOCKED)

Validator   must   fail   if   any   city   page:   -   is   missing   %%CITY_GUIDE_BLOCK%%   injection   -   is   missing   %
%FAQ_ITEMS_CITY%%   rendering   -   contains   unresolved   tokens   -   violates   FAQ   constraints   (10–12,   no

duplicates, default closed) - has hardcoded guide inventories

APPENDIX N — ADS & MONETIZATION OPERATIONS (LOCKED)

This   appendix   governs   all   advertising   and   monetization   activity   to   protect   editorial   integrity   and

compliance.

N.1 AD SLOT INVENTORY REGISTRY (LOCKED)

All ad placements are defined centrally and may not be invented ad‑hoc.

slot_key

page_types

description

global_guides_top

guides hub / guides

Top banner on guide pages

global_guides_bottom guides hub / guides

Bottom banner on guide pages

city_top

city_mid

city pages

Top banner on city pages

city pages

Mid‑page banner on city pages

city_bottom

city pages

Bottom banner on city pages

state_lookup_cta

non‑PI guides

CTA near state lookup tool

Validator must fail if any ad slot is referenced outside this registry.

N.2 ADVERTISER INTAKE SOP (MANDATORY)

Inputs required: - Advertiser legal business name - Official website URL - Vertical(s) requested - Desired ad

slot(s) - Campaign start and end dates

Procedure:  1.   Verify   advertiser   operates   in   the   requested   vertical.   2.   Confirm   official   website   domain

ownership. 3. Confirm advertiser understands: - Ads confer no endorsement - Ads do not affect editorial

content 4. Record advertiser in intake log. 5. Assign approved ad slots only from registry.

17

N.3 PRICING CHANGE PROTOCOL (LOCKED)

Pricing changes must follow this sequence: 1. Document proposed price change and rationale. 2. Update

pricing   reference   (no   retroactive   changes).   3.   Notify   affected   advertisers.   4.   Apply   pricing   only   to   new

contracts.

Unauthorized pricing changes are forbidden.

N.4 EDITORIAL FIREWALL ENFORCEMENT (NON‑NEGOTIABLE)

Advertisers: - may not influence guide content - may not request copy changes - may not appear in editorial

sections

Violations require immediate ad suspension.

N.5 AD COMPLIANCE CHECKLIST

Before any ad goes live: - ☐ Slot exists in registry - ☐ Slot injected by build system - ☐ Ad clearly labeled - ☐
No overlap with editorial content

Failure blocks deployment.

APPENDIX O — AUDIT, ROLLBACK & INCIDENT RESPONSE (LOCKED)

This appendix defines how the system detects, classifies, responds to, and recovers from failures. These

procedures override all delivery timelines.

O.1 INCIDENT CLASSIFICATION (MANDATORY)

All incidents must be classified immediately.

severity

definition

examples

required action

P0

P1

P2

P3

Production

breakage

Structural

regression

Content

regression

build fails, site down, unresolved tokens

Halt all work, rollback

in dist

immediately

missing guide block, broken hub,

Halt batch, rollback, root

validator false-pass

cause

missing section, shell guide detected

Fix before next release

Cosmetic

spacing, copy typos

Log and batch later

18

O.2 IMMEDIATE HALT RULE (NON-NEGOTIABLE)

If a P0 or P1 incident is detected: - Stop all in-progress changes - Do not attempt hotfixes - Do not continue

batching

Failure to halt escalates severity.

O.3 ROLLBACK DECISION TREE (LOCKED)

1. 

Identify last known-good SOURCE ZIP

2. 

Restore it as working baseline

3. 

Confirm build + validator pass

4. 

Re-apply changes as a new batch

Skipping any step is forbidden.

O.4 INCIDENT LOGGING REQUIREMENT

Every incident must be logged with: - date/time - severity - description - affected components - resolution

steps - preventive action

Unlogged incidents are treated as unresolved.

O.5 POST-INCIDENT REVIEW (MANDATORY)

After resolving any P0 or P1 incident: 1. Update Master Index if a rule was missing 2. Update validator if

enforcement was missing 3. Add checklist item if gap identified

Failure to perform review is a governance violation.

END OF MASTER INDEX

19



APPENDIX P — VA OPERATIONS & CERTIFICATION LAW (LOCKED)

v1.8 adds a human execution layer that is just as strict as the technical one.

1. VA ROLE DEFINITION (NON-NEGOTIABLE)

VAs are operators, not architects.

VAs MAY:
- add cities using the City Add SOP
- add guides only after content approval
- update directories only under PI rules
- run builds and validators
- prepare SOURCE ZIPs for review

VAs MAY NOT:
- change taxonomy structure
- rename slugs
- introduce tokens
- modify validators
- touch build scripts
- reorganize page sets
- rewrite guides
- make judgment calls

If a task is not explicitly allowed, it is forbidden.

2. VA ACCESS BOUNDARIES (LOCKED)

Allowed directories:
- /data/cities/
- /data/page_sets/examples/
- /data/taxonomy/
- /data/directories/ (PI only)

Forbidden directories:
- /scripts/
- /assets/js/
- /assets/css/
- /global-pages/
- any validator or build logic

Violations invalidate the work.

3. VA EXECUTION CHECKLIST (MANDATORY)

Before delivering anything, a VA must confirm:
- Started from latest SOURCE ZIP
- Followed exact SOP steps
- Did not skip validation
- Ran npm run build
- Ran node scripts/validate_tbs.js
- Confirmed guide hub auto-updated
- Confirmed city guide block rendered
- No unresolved tokens

Checklist must be attached to delivery.

4. VA CERTIFICATION REQUIREMENT (PASS / FAIL)

No VA may touch production work until certified.

Certification tasks:
1. Add a test city (dummy vertical)
2. Add a test guide (dummy content)
3. Trigger validator intentionally (to show understanding)
4. Fix the failure correctly
5. Produce a clean SOURCE ZIP

Evaluation:
- Any deviation = FAIL
- No partial credit
- Certification is binary

5. REVOCATION RULE

VA access is revoked immediately if:
- SOP steps are skipped
- rules are argued with
- undocumented changes appear
- files are modified outside scope

Re-certification required to resume.

6. ESCALATION PROTOCOL

If a VA encounters:
- missing rule
- unclear SOP
- validator ambiguity

They must:
1. STOP work
2. Log the issue
3. Escalate to system owner
4. Await instruction

Continuing anyway = violation.

