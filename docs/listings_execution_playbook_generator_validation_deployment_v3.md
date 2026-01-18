# ============================== EXECUTION GOVERNANCE REFERENCE HEADER (APPLIES TO ALL WORK)

---

## EXECUTION SPINE (AUTHORITATIVE FOR THIS PLAYBOOK)

This is the **only execution spine** for this document. Everything else in this canvas is **supporting reference, appendix, or audit trail**.

If you are executing work, you start at **Step 1** and proceed in order. If a section is not listed here, it is **not part of the spine**.

### EXECUTION SPINE — ORDER OF OPERATIONS

**1. Active Scope — Execution Playbook**  
Defines what is in scope *right now*: active verticals, active system projects, and canonical workstreams.

**2. Active Canonical Workstreams (CFVP Status Register)**  
Establishes which verticals are LOCKED vs IN PROGRESS so execution does not outrun canon.

**3. Execution Map — Active System Projects**  
Concrete execution reality for Projects 1–5: objectives, steps, files touched, and validator expectations.

**4. Repo Architecture & Mental Model**  
Single-repo, multi-pack structure and how generator, data, and validators relate.

**5. Validator Reality, Gaps, and Enforcement**  
What validators do today, what they must catch, and where regressions are blocked.

**6. SOP — Working on System Projects**  
The required flow for starting, scoping, executing, validating, and stopping work.

**7. Release Discipline & Lock Metadata**  
How and when this canvas is locked, exported, and tied to repo state.

---

## TABLE OF CONTENTS

1. [Execution Governance Reference Header](#execution-governance-reference-header-applies-to-all-work)
2. [Execution Spine (Order of Operations)](#execution-spine-authoritative-for-this-playbook)
3. [Quick Start — Where Do I Go Depending on What I’m Doing?](#quick-start--where-do-i-go-depending-on-what-im-doing)
4. [Active Scope — Execution Playbook](#active-scope--execution-playbook)
5. [Active Canonical Workstreams](#active-canonical-workstreams-content--cfvp-governed)
6. [Execution Map — Active System Projects](#execution-map--active-system-projects)
7. [Repo Architecture & Mental Model](#1-repo-architecture--mental-model)
8. [Validator Reality & Gaps](#3-validator-reality-what-exists-today)
9. [SOP — Working on System Projects](#standard-operating-procedure--working-on-system-projects)
10. [Governance Alignment & Traceability](#governance-alignment--traceability)
11. [Lock Metadata Block (For Exports)](#lock-metadata-block-for-exports)
12. [Appendix — Execution Session Checklist](#appendix--execution-session-checklist-one-page)
13. [Appendix — Reference Implementation](#appendix--reference-implementation-non-normative-multi-pack-deployment-from-a-single-generator-repo)
14. [Appendix — CFVP Authoring SOP Extensions (Lessons Learned)](#cfvp-authoring-sop-extensions-lessons-learned)

---

## QUICK START — WHERE DO I GO DEPENDING ON WHAT I’M DOING?

Use this section as the **default entry point** into the Execution Playbook.

### I am about to start working on something

→ Go to **SOP — Working on System Projects**

This section tells you how to:

- declare intent
- lock scope
- choose batch type
- know when to stop

---

### I need to understand what projects are active

→ Go to **Active Scope — Execution Playbook**

This section defines:

- the active vertical
- the active system projects
- constraint-defining (non-executing) verticals

---

### I am working on sponsorship, next-steps, or CTA behavior

→ Go to **Project 1 — Sponsor / Next-Steps Mechanism Generalization**

This section lists:

- what already exists
- what files change
- what must remain invariant
- what validators must catch

---

### I am touching validators or worried about regressions

→ Go to:

- **Project 2 — Validator Overhaul & Page-Contract Enforcement**
- **Addendum A — Validator Reality vs validate\_tbs.js**
- **Addendum C — Golden City Regression Strategy**

These sections explain:

- current validator reality
- enforcement gaps
- regression backstops

---

### I am changing repo structure, build flow, or deployment

→ Go to **Project 3 — Single Generator Repo + Multi-Pack Deployment**

This section explains:

- where config lives
- how packs are selected
- how deployments map to environments

---

### I am unsure whether something is allowed or governed

→ Go to **Governance Alignment & Traceability**

If uncertainty remains after reading it:

- stop execution
- route the issue to a Master Index addendum update

---

### I am preparing to export this playbook

→ Go to:

- **Release Freeze Checklist (Pre-Export)**
- **Lock Metadata Block (For Exports)**

These sections define when and how to lock and export safely.

---



This header applies to **every execution activity governed by this playbook**. It is not optional and does not need to be repeated per task.

**Canonical Publishing Reference:** Canonical guide authoring, QA, locking, and MD → JSON/HTML conversion are governed by the **latest exported Master Index — Post‑Freeze Addendum** (CFVP v1 section). This playbook assumes all canonical inputs are already compliant and locked.

- Governing Authority (Frozen): Master Index v2.1
- Governing Supplements: Master Index — Post‑Freeze Addendums (latest exported version)
- Execution Scope: Active System Projects defined in this playbook only
- Prohibited Actions: Writing, modifying, or interpreting governance
- Escalation Rule: Any governance ambiguity pauses execution and routes to addendum update

\==============================

# Execution Playbook — Generator, Validation & Deployment (v1)

Status: ACTIVE (Execution Reference) — Version: v1

**Document Versioning**
- v1 — Initial consolidated execution playbook (post Master Index v9 alignment)


---

## JURISDICTION & AUTHORITY BOUNDARY (EXECUTION ONLY)

### ⚠️ MAJOR STRUCTURAL CHANGE FLAG (REQUIRED)

Any **non-trivial structural decision** introduced during execution work (examples: vertical grouping, pack identity changes, scope mergers, naming conventions that affect repo behavior or mental model) **must be explicitly flagged at the point of insertion** using the following marker:

**⚠️ MAJOR CHANGE — REVIEW REQUIRED**

The flag must include, inline:

- what changed (one sentence)
- why it changed (one sentence)
- where it impacts execution (files / packs / deployment)

This rule exists to prevent silent mental-model drift. Absence of this flag on a major change is considered an execution error.

---



This canvas operates under **STRICT EXECUTION-ONLY JURISDICTION**.

This document exists to record **how to execute already-locked governance**, not to define, amend, summarize, or reinterpret it.

### Absolute Prohibitions (Hard Fail)

Do NOT:

- Write, modify, summarize, restate, or reinterpret governance
- Add, edit, or propose content for:
  - Frozen Master Index v2.1
  - Master Index Post-Freeze Addendums (any version)
  - Any governance canvas or canonical document
- Create policy language, rules, definitions, phases, or normative statements
- Introduce new constraints, permissions, or prohibitions
- Rewrite language marked LOCKED or CANONICAL elsewhere
- Place governance text inside this Execution Playbook

If a requested action would change governance in any way, stop execution and respond:

“This is a governance change. It must be made in the Master Index addendum, not here.”

No exceptions.

### Source-of-Truth Hierarchy (Non-Negotiable)

1. Frozen Master Index v2.1 (highest authority)
2. Master Index Post-Freeze Addendums (latest exported version)
3. Execution Playbook (this document — lowest authority)

If any conflict exists:

- Governance wins
- Execution adapts
- This document does not resolve conflicts by inventing rules

---

## ACTIVE SCOPE — EXECUTION PLAYBOOK

### Active Verticals (content lifecycle)

All verticals listed below are considered **active** in the content lifecycle. Their execution state differs by canonical status.

- Personal Injury (PI)
- Dentistry
- TRT / Medical Weight Loss / IV Hydration
- Neuro / ADHD / Autism Evaluations
- USCIS Medical

**Note:** “Active” here means the vertical is part of the current production roadmap. Execution eligibility is determined by canonical status below, not by inclusion in this list.

### Active System Projects (cross-vertical execution)

1. Sponsor / Next-Steps mechanism generalization (PI-first, pack-gated, extendable later)

2. Validator overhaul & page-contract enforcement (page types, required zones, sponsor invariants, regression checks)

3. Single generator repo with multi-pack deployment architecture (one repo, many vertical packs, env-selected builds)

4. Canonical Language Registry system integration (enforcement hooks only; no language authored here)

5. Execution Playbook creation and maintenance (this document)

---

## ACTIVE CANONICAL WORKSTREAMS (CONTENT — CFVP-GOVERNED)

> This section is a **status register**, not a process description. It exists to prevent execution from outrunning canonical content.

### New Vertical Introduction (Execution Gate)

Execution may **initiate** a new vertical from within this playbook **only after** its canonical identity (vertical name, hubs, slugs, and per-guide skeleton) has been inserted into the **Master Index — Post-Freeze Addendum** and acknowledged as authoritative.

If a vertical has **no slugs or canonical skeleton defined in the Master Index Addendum**, execution **must pause**. System work may not assume structure that does not yet exist.

Strong default: insert canon → export addendum → upload to project files → proceed with execution.

---



This section tracks **canonical guide authoring work that is actively executed in parallel with system work** and whose completion is a **hard dependency only for downstream conversion, validation, and deployment**.

Canonical content work is governed exclusively by **Master Index Addendum — Canonical First Vertical Publishing (CFVP v1)**. No authoring rules, QA standards, or phase definitions are restated here.

**Status Legend:** `IN PROGRESS` = authoring ongoing; `LOCKED` = canonical complete and execution-ready; `BLOCKED` = cannot proceed due to missing inputs or unresolved governance.

**Current Focus:** Complete canonical guide authoring for **TRT**

Canonical Status: IN PROGRESS — CFVP v1

*Notation:* In the codebase and deployment configuration, this vertical is referred to as \`\`. The `TRT` pack represents the full **TRT / Medical Weight Loss / IV Hydration** decision universe. All pack selection, environment variables, and file names use `TRT` as the canonical identifier.

**Dentistry**\
Canonical Status: LOCKED — CFVP v1

**TRT / Medical Weight Loss / IV Hydration**\
Canonical Status: IN PROGRESS — CFVP v1

**Neuro / ADHD / Autism Evaluations**\
Canonical Status: IN PROGRESS — CFVP v1

**USCIS Medical**\
Canonical Status: IN PROGRESS — CFVP v1

---

### Execution Dependency Rules

- Conversion, validation, and deployment may proceed **only** for verticals marked `LOCKED`
- System projects may proceed across all verticals as long as behavior is pack-gated and non-destructive
- Vertical-specific execution must treat `IN PROGRESS` verticals as content-incomplete

---

### Why This Section Exists

This section prevents premature conversion work, validator assumptions that break on missing content, accidental scope creep into authoring, and confusion between content progress and system readiness. It is a **status register**, not a process description.

Purpose of this section: define what is in execution scope, what is shaping architecture, and what must not be modified during system work.

---

## PURPOSE OF THIS PLAYBOOK

This document exists to:

Translate locked governance into executable reality

Describe what files change, in what order, and why

Capture validator reality vs gaps

Prevent regressions and partial executions

Allow a VA or engineer to execute safely without reinterpretation

This playbook is:

Procedural

Operational

Concrete

This playbook is NOT:

Policy

Law

Canonical governance

STRICT RULES

NO governance language

No “must”, “shall”, or “authoritative”

Only “do”, “check”, “verify”, “update”

NO summaries

Full instructions only

NO assumptions

If repo state matters, ask for the repo or file

NO code without context

Every code snippet must explain:

What file it lives in

Why it exists

What governance rule it satisfies

Everything must map to a file

If something can’t be mapped to a file, script, or validator, flag it as a gap

---

## CANVAS STRUCTURE (LOCKED)

Build the playbook using the following sections, in this order:

0. Playbook Orientation & Safety Rules

What this playbook is

What it is not

How to use it without breaking governance

1. Repo Architecture & Mental Model

Current repo layout

Shared vs vertical‑specific components

Generator vs data vs validator roles

2. Page Types & Contracts (Execution View)

How page types are detected in build output

What files generate each page type

Where regressions usually occur

3. Validator Reality (What Exists Today)

What validate\_tbs.js actually enforces

What it does NOT enforce

Known blind spots

4. Validator Gap List & Required Enhancements

Missing checks (FAQ presence, directory presence, state lookup, etc.)

Golden‑city regression strategy

Failure modes to add

5. Sponsor & Next‑Steps Mechanism (Execution)

How sponsor state is read

How next‑steps pages are created

Where CTA logic lives

What breaks if misconfigured

6. Pack‑Level Sponsorship Config

What belongs in page‑set packs

How vertical behavior is toggled

How PI differs from other verticals

7. Per‑City Data Operations

How to flip a city sponsor live

What fields are required

Common operator mistakes

8. Multi‑Vertical Scaling Strategy

One generator, many packs

How Cloudflare Pages projects map to packs

How to avoid repo duplication

9. Release Discipline & Batch Rules

Validator‑only vs build‑only vs data‑only batches

Source ZIP rules

When NOT to deploy

10. VA Execution SOP (Operational)

What VAs may do

What VAs must never do

Escalation triggers

11. Known Failure Modes & Debugging

Most common regressions

How to detect them early

12. Appendices

Checklists

File maps

Validator pseudo‑specs

---

## 0. PLAYBOOK ORIENTATION & SAFETY RULES

Do orient all work around **system projects** first; treat PI as the forcing case.

Do verify the active pack and vertical before touching any file.

Do isolate changes into a single batch: data‑only, build‑only, or validator‑only.

Do run validators after every batch and stop on the first failure.

Do not modify constrained vertical packs (e.g., Dentistry) during PI‑driven system work.

Do not introduce new routes, tokens, or behaviors without mapping them to pack config and validator checks.

---

## 1. REPO ARCHITECTURE & MENTAL MODEL

- Single repo: `local‑guides‑generator`
- Three roles:
  - **Generator**: build scripts and templates that render pages
  - **Data**: city/vertical JSON inputs
  - **Validator**: structural and invariant checks post‑build

Shared components live once. Vertical behavior lives in **page‑set packs**. Live sponsor state lives in **per‑city data**.

---

## 2. PAGE TYPES & CONTRACTS (EXECUTION VIEW)

Page types are inferred by structure and route patterns produced at build time.

Each page type has required zones (e.g., FAQ, directory, guides block). Missing zones are regression signals.

Common regressions occur when templates drift without corresponding validator updates.

---

## 3. VALIDATOR REALITY (WHAT EXISTS TODAY)

`validate_tbs.js` enforces:

- unresolved token detection
- basic structural assertions

It does not enforce:

- full page‑type contracts
- cross‑file invariants (e.g., sponsor ⇄ next‑steps)
- pack‑aware behavior

Known blind spots include silent loss of required zones and PI‑specific logic leaking into other packs.

---

## 4. VALIDATOR GAP LIST & REQUIRED ENHANCEMENTS

Add checks for:

- FAQ presence where required
- directory presence and integrity
- sponsor ⇄ next‑steps invariants
- golden‑city snapshots to detect regressions

Add explicit failure modes for pack misconfiguration and mixed sponsor states.

---

## 5. SPONSOR & NEXT‑STEPS MECHANISM (EXECUTION)

Sponsor state is read from per‑city JSON.

Next‑steps pages are generated only when sponsor state is live **and** the pack allows it.

CTA logic lives in templates but is governed by pack config.

Misconfiguration breaks builds, produces orphan routes, or violates disclosure proximity.

---

## 6. PACK‑LEVEL SPONSORSHIP CONFIG

Packs define:

- whether next‑steps is enabled
- where CTAs may appear
- copy and disclosure variants

PI enables intake‑adjacent behavior. Other verticals do not unless explicitly toggled.

---

## 7. PER‑CITY DATA OPERATIONS

To flip a city sponsor live:

- update a single city JSON
- set sponsor status and URLs
- rebuild and validate

Common mistakes: partial sponsor objects, mismatched routes, forgetting to rebuild.

---

## 8. MULTI‑VERTICAL SCALING STRATEGY

One generator, many packs.

Each Cloudflare Pages project maps to one pack via build‑time selection.

Avoid repo duplication by keeping all behavior configurable through packs and data.

---

## 9. RELEASE DISCIPLINE & BATCH RULES

Choose one batch type per release.

Do not mix data and validator changes in the same batch.

Do not deploy if any validator fails or if scope changes mid‑batch.

---

## 10. VA EXECUTION SOP (OPERATIONAL)

VAs may:

- edit data files as instructed
- run builds and validators
- report diffs

VAs must not:

- change templates or validators
- reinterpret behavior

Escalate on any failure.

---

## 11. KNOWN FAILURE MODES & DEBUGGING

- missing required zones
- orphan next‑steps routes
- PI logic leaking into non‑PI packs

Detect early via golden‑city comparisons and validator logs.

---

## 12. APPENDICES

- checklists
- file maps
- validator pseudo‑specs



---

## EXECUTION MAP — ACTIVE SYSTEM PROJECTS

This section ties **active system projects** to **concrete execution steps**, **exact files that change**, and **what validation must catch**. This is execution reality only.

---

## PROJECT 1 — Sponsor / Next-Steps Mechanism Generalization

### Objective

Turn the existing PI-only sponsor + next-steps behavior into a **single reusable engine**, enabled per vertical via **pack configuration**, without copy-paste or vertical name branching.

### What Exists Today

- Sponsor live state defined in `data/listings/<city>.json`
- PI-specific sponsor and `/next-steps/` logic embedded in `scripts/build_city_sites.js`
- Partial invariant checks in `scripts/validate_tbs.js`

### Execution Steps

1. Locate PI-specific sponsor and next-steps logic in `scripts/build_city_sites.js`.
2. Extract logic into reusable helpers:
   - `isSponsorLive(cityData)`
   - `isNextStepsEnabled(packConfig)`
   - `shouldRenderNextSteps(packConfig, cityData)`
   - `getSponsorCTAConfig(packConfig)`
3. Create helper module:
   - `scripts/helpers/sponsorship.js`
4. Refactor builder to import helpers and remove all PI name checks.
5. Add a `sponsorship` config block to `data/page_sets/pi_v1.json` (flags only).
6. Keep sponsor live truth exclusively in city-level JSON.

### Files That Change

- `scripts/build_city_sites.js`
- `scripts/helpers/sponsorship.js` (new)
- `data/page_sets/pi_v1.json`

### Validator Coverage Required

- next-steps exists ⇄ sponsor live AND pack allows
- sponsor live + pack enables next-steps → next-steps must exist
- sponsor not live → next-steps must not exist

---

## PROJECT 2 — Validator Overhaul & Page-Contract Enforcement

### Objective

Prevent silent regressions by enforcing **page-type contracts** against built HTML and sponsor invariants.

### Validator Reality (Current)

- `scripts/validate_tbs.js` checks unresolved tokens, markdown fences, and basic build sanity.
- No HTML parsing.
- No page-type awareness.
- No required-zone enforcement.

### Execution Steps

1. Add HTML parsing layer:
   - Create `scripts/validators/htmlScanner.js` to load and parse `/dist` output.
2. Detect page types via structural markers:
   - city hub
   - guide page
   - directory
   - next-steps
3. Define page contracts:
   - Create `scripts/validators/pageContracts.js`.
   - City hub must contain FAQ block, guides block, and (PI) directory block.
   - Next-steps must contain disclosure and sponsor CTA.
4. Enforce sponsor invariants:
   - Create `scripts/validators/sponsorRules.js`.
   - Fail on sponsor/next-steps mismatches.
5. Implement golden-city regression:
   - Select one known-good PI city.
   - Snapshot required zones.
   - Fail on any loss in future builds.

### Files That Change

- `scripts/validate_tbs.js`
- `scripts/validators/htmlScanner.js` (new)
- `scripts/validators/pageContracts.js` (new)
- `scripts/validators/sponsorRules.js` (new)

### Validator Outputs

- Hard fail on missing required zones.
- Hard fail on sponsor/next-steps drift.
- Hard fail on golden-city regression.

---

## PROJECT 3 — Single Generator Repo + Multi-Pack Deployment

### Objective

Deploy multiple verticals from **one generator repo** using pack selection at build time.

### Execution Steps

1. Create site template:
   - `data/site.template.json` (tokens only).
2. Generate site config at build time:
   - Create `scripts/prepare_site.js`.
   - Read env vars and write `data/site.json`.
3. Wire build pipeline:
   - Update `package.json` to run prepare → build → validate.
4. Deploy multiple Cloudflare Pages projects:
   - Same repo.
   - Different env vars per project (`PAGE_SET_FILE`, `BRAND_NAME`, `SITE_URL`).

### Files That Change

- `data/site.template.json` (new)
- `scripts/prepare_site.js` (new)
- `package.json`

### Explicit Non-Changes

- No per-vertical repos.
- No duplicated templates or validators.

---

## PROJECT 4 — Canonical Language Registry (Execution Hooks Only)

### Objective

Ensure renderer **consumes locked language** without redefining or inventing copy.

### Execution Steps

1. Load registry phrases from data files at render time.
2. Remove inline CTA and disclosure strings from templates.
3. Render CTAs and disclosures via registry keys.
4. Optionally add soft validator warnings for unknown CTA strings.

### Files That Change

- `scripts/build_city_sites.js`
- `data/language/*.json` (read-only inputs)

---

## PROJECT 5 — Execution Playbook Consolidation

### Objective

Make this canvas the **single source for execution guidance**.

### Execution Steps

1. Maintain one Execution Playbook canvas.
2. For any new work:
   - Identify system project.
   - List files touched.
   - State validator impact.
3. Prohibit governance, policy, and canonical language from this document.

---

## ROLLOUT & REGRESSION STRATEGY

- Execute projects in order: 1 → 2 → 3 → 4.
- Use PI as the forcing case; do not modify constrained vertical packs.
- Run validators after every batch.
- Stop on first failure.

---

## OPERATOR REALITY CHECK

Execution is complete when:

- PI behavior remains unchanged.
- System logic is pack-gated and reusable.
- Validators fail loudly on regressions.
- Multiple verticals deploy from one repo without duplication.



---







## COMPLETION CRITERIA

Execution hardening is complete when:

- Validator enforces page contracts
- Validator enforces sponsor invariants
- Golden city regressions are caught automatically
- A VA can execute changes without breaking constrained verticals







# ============================== FULL CHAT SWEEP — EXECUTION CONSOLIDATION MANIFEST

This section exists to explicitly confirm that **every execution-relevant concept, instruction set, checklist, and constraint introduced anywhere in this chat** is now anchored inside this Execution Playbook canvas.

If an item appears in this manifest, it is present somewhere above in executable form. Nothing listed here lives only in chat.

---

## A. EXECUTION JURISDICTION & SCOPE

- Execution-only jurisdiction boundary
- Prohibition on writing or modifying governance
- Source-of-truth hierarchy (Master Index v2.1 → Addendums → Execution Playbook)
- Distinction between:
  - Active Verticals
  - Active System Projects
  - Constraint-defining (non-executing) verticals

(Embedded in: **Jurisdiction & Authority Boundary**, **Active Scope — Execution Playbook**)

---

## B. ACTIVE SYSTEM PROJECTS (1–5)

All five system projects discussed in chat are fully represented:

1. Sponsor / Next-Steps mechanism generalization
2. Validator overhaul & page-contract enforcement
3. Single generator repo + multi-pack deployment
4. Canonical Language Registry execution hooks
5. Execution Playbook consolidation and maintenance

Each project includes:

- Objective
- Execution steps
- Files that change
- Validator expectations

(Embedded in: **Execution Map — Active System Projects**, **Projects 1–5**)

---

## C. SPONSOR / NEXT-STEPS MECHANISM DETAILS

- PI-first implementation reality
- Extraction of reusable helpers
- Pack-gated enablement
- City-level sponsor truth
- Explicit file list:
  - `build_city_sites.js`
  - `helpers/sponsorship.js`
  - page-set pack JSON
- Explicit invariants for validation

(Embedded in: **Project 1 — Sponsor / Next-Steps Mechanism Generalization**)

---

## D. VALIDATOR REALITY, GAPS, AND REQUIRED ENFORCEMENT

- What `validate_tbs.js` enforces today
- What it explicitly does not enforce
- Required additions:
  - HTML parsing
  - Page-type detection
  - Required-zone enforcement
  - Sponsor invariants

(Embedded in: **Addendum A — Validator Reality vs validate\_tbs.js** and **Project 2**)

---

## E. GOLDEN CITY REGRESSION STRATEGY

- Purpose and threat model
- Golden city selection criteria
- Snapshot contents
- Comparison mechanics
- Explicit failure conditions

(Embedded in: **Addendum C — Golden City Regression Strategy**)

---

## F. VA-SAFE EXECUTION LAYER

- Pre-flight checks
- Batch discipline
- Validation requirements
- Hard escalation triggers
- Explicit prohibition on reinterpretation

(Embedded in: **Addendum B — VA-Only Execution Checklist**, **VA Execution SOP**)

---

## G. MULTI-REPO ELIMINATION & DEPLOYMENT MODEL

- Single generator repo
- Env-selected page-set packs
- Generated `site.json`
- Cloudflare Pages multi-project deployment
- Explicit non-changes (no forked repos, no duplicated validators)

(Embedded in: **Project 3 — Single Generator Repo + Multi-Pack Deployment**)

---

## H. CANONICAL LANGUAGE REGISTRY (EXECUTION HOOKS ONLY)

- No language authored here
- Renderer consumes locked phrases
- Templates contain no inline copy
- Optional soft validator warnings

(Embedded in: **Project 4 — Canonical Language Registry (Execution Hooks Only)**)

---

## I. RELEASE DISCIPLINE & REGRESSION CONTROL

- Batch-only execution (data-only / build-only / validator-only)
- Stop-on-failure rule
- Order of execution across projects

(Embedded in: **Rollout & Regression Strategy**, **Release Discipline**)

---

## J. OPERATOR COMPLETION CRITERIA

- PI behavior unchanged
- Pack-gated system logic
- Validators fail loudly
- Multi-vertical deployment without duplication

(Embedded in: **Operator Reality Check**, **Completion Criteria**)

---

## SWEEP CONCLUSION

Every execution-relevant instruction, checklist, invariant, and file-level map introduced in this chat is now:

- Present in this canvas
- Named under a stable section header
- Execution-only
- Delegation-safe

No execution-critical content remains only in chat.

# ============================== END FULL CHAT SWEEP



# ============================== LOCK / UNLOCK CONTROL MODEL

This Execution Playbook supports **explicit lock and unlock states**.

### UNLOCKED STATE

- Canvas may be edited, reorganized, or corrected freely
- Content is considered working execution guidance
- Not suitable for export to project files

**Clarification:** UNLOCKED refers **only** to editability of this canvas. It does **not** indicate readiness to execute work.

### READY FOR WORK (OPERATIONAL STATE)

READY FOR WORK is an execution decision made **per work session**, independent of canvas lock state.

Execution is considered READY FOR WORK only after completing the **Execution Session Checklist** and explicitly declaring intent for a specific system project.

### LOCKED STATE

- Canvas content is considered stable for execution reference
- No edits permitted while locked
- Canvas may be exported verbatim into project files
- Locking does NOT make this document governance or canonical law

Locking and unlocking is an **operational control**, not a governance act.

\==============================

---

## AUTO-GENERATED VALIDATOR TODOs (DERIVED FROM THIS PLAYBOOK)

This section enumerates **concrete validator TODOs** that fall directly out of execution requirements documented above.

These TODOs are intended to be transcribed into issues or tasks and implemented incrementally.

### Validator TODO — HTML Parsing Layer

- Implement DOM parsing over `/dist` output
- Expose page-level structural markers to downstream validators

### Validator TODO — Page-Type Detection

- Detect page type:
  - city hub
  - guide page
  - directory page
  - next-steps page
- Fail if page type cannot be confidently identified

### Validator TODO — Page Contracts

- City hub must contain:
  - FAQ block
  - guides block
  - (PI only) directory block
- Next-steps page must contain:
  - disclosure
  - sponsor CTA

### Validator TODO — Sponsor Invariants

- next-steps exists ⇄ sponsor live AND pack allows
- sponsor live + pack enables next-steps → next-steps must exist
- sponsor not live → next-steps must not exist
- Fail on multiple sponsors per city

### Validator TODO — Pack Awareness

- Load active page-set pack
- Apply pack-specific rules without branching on vertical name

### Validator TODO — Golden City Regression

- Snapshot required zones for a known-good PI city
- Compare every future build against snapshot
- Fail on any structural loss or relocation

---

## RELEASE FREEZE CHECKLIST (PRE-EXPORT)

This checklist must be completed before **locking** the canvas and exporting it to project files.

### Pre-Freeze Verification

- All active system projects (1–5) are represented
- Execution steps reference concrete files
- Validator TODOs align with documented execution gaps

### Build & Validation

- Clean build completed
- Validator run completed
- No warnings or failures outstanding

### Regression Safety

- Golden city snapshot exists
- Latest build passes golden city comparison

### Scope Confirmation

- No governance text present
- No canonical language authored
- No constrained vertical packs modified unintentionally

### Freeze Action

- Set canvas state to LOCKED
- Export canvas verbatim
- Commit exported file to project files

---

## READ-ONLY ENGINEER ONBOARDING (EXECUTION CONTEXT)

This section provides **read-only context** for engineers joining the project.

### What This System Is

- A static-site generator supporting multiple verticals
- One generator repo
- Multiple page-set packs
- Pack-selected builds via environment variables

### What Is Actively Being Worked On

- System-level execution projects
- PI as the forcing case
- Validator hardening
- Pack-gated sponsorship mechanisms

### What Engineers Should NOT Do

- Do not modify governance documents
- Do not introduce new copy or language
- Do not hardcode vertical-specific behavior
- Do not bypass validators

### Where to Make Changes

- Generator logic → `scripts/`
- Validation logic → `scripts/validators/`
- Pack behavior → `data/page_sets/`
- City truth → `data/listings/`

### How to Know You’re Done

- Behavior unchanged for PI
- Validators pass
- No regressions in golden city

# ============================== END EXTENSIONS



# ============================== STANDARD OPERATING PROCEDURE — WORKING ON SYSTEM PROJECTS

This SOP defines **exact steps to follow** when:

- starting work on an existing active system project, or
- introducing a new system project into the Execution Playbook

This SOP is execution-only and applies regardless of vertical.

---

## PART A — WHEN STARTING WORK ON AN EXISTING SYSTEM PROJECT

> **Canonical Check (Early Gate):** If the work involves a **new vertical**, **new hubs**, **new slugs**, or **per‑guide skeleton changes**, confirm compliance with the **Canonical Durability Requirement (Execution Gate)** in *Governance Alignment & Traceability* **before proceeding**.

Use this flow every time you sit down to work.

### Step 1 — Declare Intent (Hard Gate)

Before touching any files:

- Identify the **system project number** (1–5)
- State the **specific objective** for this work session
- Confirm whether the session is:
  - data-only
  - build-only
  - validator-only

If this cannot be stated clearly, do not proceed.

---

### Step 2 — Scope Lock

Confirm:

- Active vertical (per Active Canonical Workstreams status)
- Active page-set pack
- Files expected to change (list exact paths)
- Files explicitly out of scope

If scope expands mid-session, stop and re-declare intent.

---

### Step 3 — Read Before Write

Open and review:

- Relevant section of this Execution Playbook
- Current implementation files listed in that section
- Related validator expectations

Do not write code until you can explain how the change maps back to the playbook.

---

### Step 4 — Execute in a Single Batch

Rules:

- Touch only files declared in Step 2
- Do not mix batch types
- Do not partially implement a change

If the work cannot be completed in one batch, stop and plan the next batch explicitly.

---

### Step 5 — Validate Immediately

After changes:

- Run full build
- Run validators

Outcomes:

- If validators pass → continue
- If validators fail → stop and fix or escalate

Do not proceed with additional work until validation is clean.

---

### Step 6 — Record Outcome

Update this Execution Playbook if:

- file paths changed
- validator coverage changed
- new failure modes were discovered

Do not record governance decisions here.

---

## PART B — WHEN ADDING A NEW SYSTEM PROJECT

Use this flow to prevent uncontrolled scope growth.

### Step 1 — Justify the Project

A new system project is valid only if:

- it affects generator, validator, or deployment behavior
- it spans or constrains multiple verticals
- it cannot be cleanly absorbed into an existing project

If not, do not create a new project.

---

### Step 2 — Assign the Next Project Number

- Use the next sequential project number
- Do not rename or reorder existing projects

---

### Step 3 — Create the Project Section

Add a new section containing:

- Objective (execution framing only)
- What exists today
- Execution steps
- Files that will change
- Validator expectations

If any of these cannot be filled in, the project is not ready.

---

### Step 4 — Declare Non-Goals

Explicitly state:

- what this project will not touch
- which verticals are constrained

This prevents accidental bleed.

---

### Step 5 — Integrate with Validator TODOs

Update:

- Auto-generated Validator TODOs section
- Release Freeze Checklist (if applicable)

If validator impact is unknown, stop and investigate before coding.

---

### Step 6 — Announce Project Activation

Once added:

- Treat the project as active
- All future work must reference it explicitly

---

## PART C — FAILURE & ESCALATION RULES

Stop work immediately if:

- scope changes mid-batch
- validator behavior is unclear
- a change appears to require governance

Escalation path:

- Pause execution
- Document the issue
- Route governance changes to the Master Index addendum

---

## PART D — COMPLETION SIGNALS

A work session is complete when:

- declared objective is met
- validators pass
- no undeclared files were touched
- execution notes are updated if required

# ============================== END SOP



# ============================== GOVERNANCE ALIGNMENT & TRACEABILITY

This section exists to **explicitly tie execution work back to frozen governance artifacts** so that all active system projects are executed **in alignment with governing documents**, without rewriting or restating them.

This section is **referential only**. It introduces no new rules, definitions, or policy.

---

## GOVERNING ARTIFACTS (READ‑ONLY)

Execution under this playbook is constrained by the following canonical files:

1. **Master Index v2.1 (Frozen)**

   - Status: Frozen
   - Role: Highest governing authority
   - Scope: Core principles, structural laws, pre‑freeze governance

2. **Master Index — Post‑Freeze Addendums (Latest Exported Version)**

   - Status: Locked / Append‑Only
   - Role: Supplemental governance after freeze
   - Scope: Vertical behavior, monetization models, validator obligations, language registries, phase constraints

The Execution Playbook is subordinate to both.

---

## HOW EXECUTION MAPS TO GOVERNANCE (WITHOUT COPYING IT)

Execution work must always reference governance **by location, not by restatement**.

Use the following pattern:

- Identify the **system project** being worked on
- Identify the **governing section(s)** that constrain that work
- Execute implementation details **without reproducing governance language**

Governance text must never be copied into this playbook.

---

## GOVERNANCE REFERENCE MATRIX (ACTIVE SYSTEM PROJECTS)

This matrix defines **where authority comes from**, not what the rules are.

### Project 1 — Sponsor / Next‑Steps Mechanism Generalization

- Governing sources:

  - Master Index v2.1 — Sponsorship & monetization principles
  - Post‑Freeze Addendum — Personal Injury distribution model & Next‑Steps authorization

- Execution implication:

  - Behavior must be pack‑gated
  - City‑level sponsor truth must remain authoritative

---

### Project 2 — Validator Overhaul & Page‑Contract Enforcement

- Governing sources:

  - Master Index v2.1 — Validation and conversion integrity
  - Post‑Freeze Addendums — Page contracts, sponsor invariants, regression protection

- Execution implication:

  - Validators enforce presence and structure
  - Validators do not invent policy

---

### Project 3 — Single Generator Repo + Multi‑Pack Deployment

- Governing sources:

  - Master Index v2.1 — Content‑before‑code, no forked canon

- Execution implication:

  - One generator
  - No per‑vertical repos

---

### Project 4 — Canonical Language Registry (Execution Hooks Only)

- Governing sources:

  - Post‑Freeze Addendums — Canonical Language Registries (PI, Dentistry, etc.)

- Execution implication:

  - Renderer consumes language
  - Execution does not author language

---

### Project 5 — Execution Playbook Maintenance

- Governing sources:

  - Master Index v2.1 — Governance vs execution separation

- Execution implication:

  - This document remains procedural
  - Governance updates are routed elsewhere

---

## EXECUTION HARD STOP RULE

If execution work requires:

- interpreting governance
- extending governance
- resolving ambiguity between governing documents

Then execution **must pause** and the issue must be routed to a Master Index addendum update.

Execution does not resolve governance conflicts.

---

## OPERATOR CHECK (BEFORE STARTING WORK)

Before executing any system project:

- Confirm latest exported Master Index v2.1 is present in project files
- Confirm latest Post‑Freeze Addendum version is present
- Identify governing sections relevant to the task
- Proceed with execution only

# ============================== LOCK METADATA BLOCK (FOR EXPORTS)

This block is completed **only when the canvas is set to LOCKED** and prepared for export into project files.

---

**Execution Playbook Title:** Execution Playbook — Generator & Validator

**Lock Status:** 🔒 LOCKED

**Lock Date (UTC):** 2026-01-18

**Associated Repo:** local-guides-generator

**Repo Version / Commit Hash:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Active Page-Set Pack(s):** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Validator Version / Commit Hash:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Notes (optional):**

- Scope of changes covered by this export
- Known exclusions or deferred TODOs

---

This metadata block provides **traceability between execution guidance and code state**. It does not confer governance authority.

# ============================== END LOCK METADATA BLOCK

# ============================== END GOVERNANCE TRACEABILITY



# ============================== APPENDIX — EXECUTION SESSION CHECKLIST (ONE-PAGE)

Use this checklist at the start and end of **every execution session**. It is designed to fit on a single printed page.

---

## PRE-SESSION (BEFORE TOUCHING CODE)

- ☐ Execution Playbook is **UNLOCKED**
- ☐ Active system project identified (Project # \_\_\_)
- ☐ Session objective written in one sentence
- ☐ Batch type selected (circle one): data-only / build-only / validator-only
- ☐ Active vertical confirmed (per Active Canonical Workstreams status)
- ☐ Active page-set pack confirmed
- ☐ Files expected to change listed explicitly
- ☐ Files explicitly out of scope listed

---

## READ & ALIGN

- ☐ Relevant project section reviewed
- ☐ Validator expectations reviewed
- ☐ Governance traceability section checked for constraints
- ☐ No governance changes required for this session

---

## EXECUTION (SINGLE BATCH)

- ☐ Only declared files modified
- ☐ No scope expansion mid-session
- ☐ No vertical hardcoding introduced
- ☐ No inline copy or language invented

---

## VALIDATION

- ☐ Clean build completed
- ☐ Validator run completed
- ☐ No warnings or failures
- ☐ Golden city regression check passed (if applicable)

---

## POST-SESSION

- ☐ Objective achieved
- ☐ No undeclared files touched
- ☐ Execution Playbook updated (if file maps or validator coverage changed)
- ☐ Next session planned (if work incomplete)

---

## STOP & ESCALATE IF ANY APPLY

- ☐ Scope changed mid-session
- ☐ Validator behavior unclear or contradictory
- ☐ Implementation requires governance interpretation
- ☐ Required governing artifact missing or outdated

If any box above is checked, stop execution and route the issue to governance.

# ============================== END APPENDIX



# ============================== APPENDIX — REFERENCE IMPLEMENTATION (NON‑NORMATIVE) MULTI‑PACK DEPLOYMENT FROM A SINGLE GENERATOR REPO

This appendix provides a **concrete reference implementation** for deploying multiple verticals from a **single generator repository** using page‑set packs and environment‑selected configuration.

This section is:

- illustrative only
- non‑normative
- safe to change without affecting execution law

It exists to reduce re‑thinking and speed up future execution.

---

## TARGET ARCHITECTURE (REFERENCE)

### Single Generator Repository

The generator repository contains all shared code and layout:

- `/assets/**` — shared CSS and JS
- `/scripts/**` — build and validation logic
- `/data/global_pages/**` — shared global pages
- `/data/page_sets/**` — vertical packs (data only)
- `/data/site.json` — generated at build time

Verticals are isolated **only** through page‑set packs and environment variables.

---

## PAGE‑SET PACK STRUCTURE (REFERENCE)

Each vertical is represented by a data‑only pack file:

- `data/page_sets/pi_v1.json`
- `data/page_sets/dentistry_v1.json`
- `data/page_sets/neuro_v1.json`
- `data/page_sets/trt_v1.json`
- `data/page_sets/uscis_medical_v1.json`

Each pack points to its own global pages directory, for example:

- `data/page_sets/examples/pi_global_pages/*`
- `data/page_sets/examples/dentistry_global_pages/*`

No separate repositories are required per vertical.

---

## BUILD‑TIME SITE CONFIGURATION (REFERENCE)

### `data/site.template.json`

A template file is used instead of editing `site.json` manually:

```json
{
  "brandName": "%%BRAND_NAME%%",
  "siteUrl": "%%SITE_URL%%",
  "pageSetFile": "%%PAGE_SET_FILE%%"
}
```

---

### `scripts/prepare_site.js`

A lightweight prepare script generates `data/site.json` at build time:

```js
import fs from "fs";

const brandName = process.env.BRAND_NAME || "The Accident Guides";
const siteUrl = process.env.SITE_URL || "https://theaccidentguides.com";
const pageSetFile = process.env.PAGE_SET_FILE || "pi_v1.json";

const templatePath = "data/site.template.json";
const outPath = "data/site.json";

let txt = fs.readFileSync(templatePath, "utf8");
txt = txt.replaceAll("%%BRAND_NAME%%", brandName);
txt = txt.replaceAll("%%SITE_URL%%", siteUrl);
txt = txt.replaceAll("%%PAGE_SET_FILE%%", pageSetFile);

fs.writeFileSync(outPath, txt);
console.log(`[prepare_site] Wrote ${outPath} with PAGE_SET_FILE=${pageSetFile}`);
```

This script:

- runs before build
- selects the active vertical via env vars
- avoids manual per‑vertical edits

---

## BUILD PIPELINE WIRING (REFERENCE)

### `package.json`

```json
{
  "scripts": {
    "prepare": "node scripts/prepare_site.js",
    "build": "npm run prepare && node scripts/build_city_sites.js && node scripts/validate_tbs.js"
  }
}
```

Every deployment executes:

1. site preparation
2. build
3. validation

---

## CLOUDFLARE PAGES DEPLOYMENT MODEL (REFERENCE)

Each vertical is deployed as a **separate Cloudflare Pages project** connected to the same GitHub repository and branch.

Example environment configuration:

### Personal Injury Project

- `BRAND_NAME = The Accident Guides`
- `SITE_URL = https://theaccidentguides.com`
- `PAGE_SET_FILE = pi_v1.json`

### Dentistry Project

- `BRAND_NAME = The Dentistry Guides`
- `SITE_URL = https://dentistryguides.com`
- `PAGE_SET_FILE = dentistry_v1.json`

Additional verticals follow the same pattern.

---

## WHY THIS APPENDIX EXISTS

This reference:

- demonstrates the intended architecture end‑to‑end
- reduces future decision fatigue
- prevents re‑litigating repo structure

Execution authority remains in the main body of the playbook.

# ============================== END APPENDIX — REFERENCE IMPLEMENTATION






==============================
EXECUTION MODE SOPs
==============================

Before beginning any workstream, the operator MUST declare the execution mode.
The declared mode determines what may be edited, what is prohibited, which tools may be used, and which validation or lock steps apply.

--------------------------------
MODE A — NEW VERTICAL CREATION
--------------------------------

Allowed:
- New vertical taxonomy and slugs
- New CFVP guides
- New page sets

Prohibited:
- Editing base templates
- Inventing schemas
- Editing validator logic

Required Tooling:
- LLM-assisted authoring is expected
- Batch authoring only (2–3 guides per batch)

Steps:
1. Review Master Index and Addendum (read-only)
2. Define vertical scope and naming
3. Generate slugs only
4. Approve slugs
5. Generate guides in batches
6. Run QA after each batch
7. Lock CFVP
8. Export canonical artifact
9. Proceed to extraction

--------------------------------
MODE B — NEW CITY (EXISTING VERTICAL)
--------------------------------

Allowed:
- City data
- City page generation
- Listings JSON

Prohibited:
- Editing CFVP content
- Rewriting guide copy
- Adding claims

LLM Usage:
- Allowed for data formatting
- Not allowed for content rewriting

Steps:
1. Confirm CFVP is locked
2. Declare city
3. Prepare city inputs
4. Generate city pages
5. Run regression validation
6. Deploy

--------------------------------
MODE C — REPO / GENERATOR REFACTOR
--------------------------------

Allowed:
- Internal refactors
- Performance improvements

Prohibited:
- Output shape changes
- Token or schema changes
- Silent behavior changes

Steps:
1. Declare refactor scope
2. Snapshot outputs
3. Implement changes
4. Run validation
5. Diff outputs
6. Version and approve

--------------------------------
BASELINE LLM BOOTSTRAP PROMPT
--------------------------------

You are an execution agent operating under the Listings Master Index and Execution Playbook.
Treat all governance documents as authoritative.
Do not invent schemas, slugs, claims, or structures.
Execute work only within the declared execution mode.
Generate outputs in batches and pause for approval.
If anything is unclear, stop and request clarification.


==============================
CFVP AUTHORING SOP EXTENSIONS (LESSONS LEARNED)
==============================

These additions are execution-only clarifications intended to eliminate common friction during CFVP authoring and extraction. They do not replace governance; they operationalize it.

--------------------------------
CFVP MODE A — PRE-FLIGHT DECLARATIONS (REQUIRED)
--------------------------------
Before writing any guide text, create / confirm these declarations in the CFVP canvas header:

- Audience & reading level (e.g., ESL 5th–6th grade)
- Language mode (none / summary-only / full translation)
- Compliance mode (standard / elevated / restricted)
- Sensitivity tiering (identify which guides are high-sensitivity; write them last)
- Wordcount range target and tolerance
- Extraction schema benchmark to match (identify the golden JSON example)

--------------------------------
CFVP MODE A — CANVAS ISOLATION RULE
--------------------------------
One CFVP canvas per vertical.
- Never mix verticals in a single CFVP canvas.
- If a vertical must be restarted, create a fresh canvas and re-copy only that vertical’s canon.

--------------------------------
CFVP MODE A — INVENTORY BEFORE AUTHORING
--------------------------------
Before writing:
1. Inventory existing repo guide files for that vertical (slugs from filenames).
2. Compare against Master Index Addendum slugs.
3. If slugs diverge, proceed using the Addendum slugs as benchmark and log the drift for addendum reconciliation immediately after the authoring batch.

--------------------------------
CFVP MODE A — BATCH SIZE & STOP RULE
--------------------------------
Author in batches of 3–5 guides. After each batch:
- Run QA checklist
- Fix issues before starting the next batch

--------------------------------
CFVP MODE A — QA AUTOMATION EXPECTATIONS
--------------------------------
Before any LOCK action, run an automated scan over the CFVP markdown to hard-fail on:
- Blank guides (markers exist but content is empty)
- Missing GUIDE START/END markers
- Missing required section headings
- Wordcount below target (per-guide)
- Forbidden internal/jargon phrases (example: “Reference Anchor” as a label)

--------------------------------
CFVP MODE A — EXTRACTION BENCHMARK GATE
--------------------------------
Extraction to JSON/HTML must match the golden benchmark schema exactly.
- Do not invent new JSON keys.
- Validate one extracted guide against the benchmark before extracting the full set.

--------------------------------
CFVP MODE A — HIGH-RISK TOPICS ORDERING
--------------------------------
Write the following LAST in the batch sequence when present:
- costs / fees
- timelines
- eligibility / exceptions
- legal-sounding topics

Reason: tone calibration and compliance drift control.
