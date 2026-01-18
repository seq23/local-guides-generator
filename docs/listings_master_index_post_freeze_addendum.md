# 🔐 VERSION CONTROL & CHANGE AUTHORITY

**Document:** LISTINGS — Master Index Post-Freeze Addendum  
**Status:** UNLOCKED (Clean Rewrite)  
**Current Version:** v8  
**Effective Date:** 1-16-2026

---

## Versioning Rules

1. This document is a **single, living post-freeze addendum** to the frozen Master Index v2.1.
2. The version number MUST be incremented whenever:
   - New governance is added
   - Existing governance is clarified, expanded, or reorganized
   - Any rule affecting canonical content, validation, monetization, page contracts, or vertical behavior is introduced or modified
3. Versioning applies to the **entire document**, not individual sections.
4. Upon export, this document **supersedes all prior addendum versions**.

---

## Lock / Unlock Semantics

- **LOCKED** — The document is authoritative, enforceable, and safe to execute against.
- **UNLOCKED** — The document may be edited, but changes have no force until:
  - The version number is incremented
  - The document is re-exported
  - The project file is replaced

---

## Enforcement Rule

All execution, validation, and repository work MUST target the **highest exported version** of this addendum.  
If execution references an older version, work MUST pause.

---

## Governance Principles

- Governance lives in canvases
- Execution lives in chats and playbooks
- Canon lives in project files
- Nothing important lives only in chat

---

# Table of Contents

- [1. Preamble & Authority](#1-preamble--authority)
- [2. Canonical Content Governance](#2-canonical-content-governance)
- [3. Guide Identity, Slugs & Structure](#3-guide-identity-slugs--structure)
- [4. QA, Locking & Canon Approval](#4-qa-locking--canon-approval)
- [5. Conversion & Validation Governance](#5-conversion--validation-governance)
- [6. Vertical-Specific Governance](#6-vertical-specific-governance)
  - [6.1 Personal Injury (PI)](#61-personal-injury-pi)
  - [6.2 Testosterone Replacement Therapy (TRT)](#62-testosterone-replacement-therapy-trt)
  - [6.3 Dentistry (Reference)](#63-dentistry-reference)
  - [6.4 Neuro / ADHD / Autism Evaluations (Reference)](#64-neuro--adhd--autism-evaluations-reference)
  - [6.5 USCIS Medical (Reference)](#65-uscis-medical-reference)
- [7. Canonical Language Registry Governance](#7-canonical-language-registry-governance)
- [8. Sponsorship & Next-Steps Governance](#8-sponsorship--next-steps-governance)
- [9. VA Authority & Operating Boundaries](#9-va-authority--operating-boundaries)
- [10. Definitions & Interpretation](#10-definitions--interpretation)
- [11. Validator Mapping & Regression Protection](#11-validator-mapping--regression-protection)

---

# 1. PREAMBLE & AUTHORITY

This document inherits the **Master Index v2.1 preamble** as superior governing law.

- Master Index v2.1 is frozen and cannot be modified.
- This addendum supplements v2.1 only.
- In the event of conflict, **v2.1 prevails**.

This document defines **state-based governance only**. It contains no procedural instructions, no implementation steps, no code, and no execution guidance.

---

# 2. CANONICAL CONTENT GOVERNANCE

## Canonical First Vertical Publishing (CFVP v1)

All guide authoring, QA, locking, and conversion across all verticals follows **Canonical First Vertical Publishing (CFVP v1)**.

CFVP v1 defines:
- a single canonical authoring surface per vertical
- immutable guide slugs as identity
- machine-only markers for lossless conversion
- QA gates prior to locking
- lock-before-conversion discipline

CFVP v1 is governed entirely within this addendum. No separate CFVP document exists or should be referenced elsewhere.


## Canonical Definition

Canonical content is fully self-contained, approved, immutable text that is losslessly convertible into machine-readable and human-readable formats.

## Canonical Artifact Completeness Rule (Hard Fail)

Any document marked Canonical must:
- Contain no placeholders, stubs, shorthand, or editor notes
- Contain no references such as “unchanged,” “same as above,” or “TBD”
- Be complete without reliance on prior approvals

Violation blocks locking and conversion.

## Machine-Only Marker & Convertibility Rule (Hard Fail)

All canonical guides must:
- Contain valid machine-only start/end markers per guide
- Use a numbered section structure convertible to JSON and HTML
- Render each numbered section as a discrete accordion panel

Malformed or missing markers constitute a hard fail.

---

# 3. GUIDE IDENTITY, SLUGS & STRUCTURE

## Slugs as Identity

- Slugs are immutable identifiers
- Slug lists define the identity of a vertical’s guide corpus
- Renaming or deleting a slug requires a new addendum

## Guide Structure Requirements

Each guide must:
- Answer one primary user question
- Use a consistent numbered section structure
- Remain self-contained and decision-complete

### Per-Vertical Section Layout Flexibility

Each vertical MAY define its own canonical per-guide section layout.
That layout MUST be consistent within the vertical once defined.

---

# 4. QA, LOCKING & CANON APPROVAL

## QA Gate (All Must Pass)

1. Structural integrity (markers, sections, ordering)
2. Primary question realism
3. Decision completeness (right/wrong/forks/delay/regret)
4. Situational specificity
5. LLM extractability (quotable, declarative answers)
6. Human helpfulness
7. Authority-appropriate depth

## Locking Semantics

- Guides may be marked LOCKED only after all QA layers pass
- Once LOCKED, no authorship is permitted
- Conversion may only occur from LOCKED canonical content

---

# 5. CONVERSION & VALIDATION GOVERNANCE

- Conversion is mechanical only
- Canonical MD is immutable input
- Output formats include JSON and HTML
- Any structural loss or drift is a validation failure

---

# 6. VERTICAL-SPECIFIC GOVERNANCE

## 6.1 Personal Injury (PI)

PI is a **Distribution Vertical**. Monetization is governed by explicit phase and mode declarations. Distribution behavior is non-transferable to other verticals without addendum update.

## 6.2 Testosterone Replacement Therapy (TRT)

**Vertical Identifier:** TRT

TRT is the umbrella decision domain. Medical Weight Loss and IV Hydration are **decision clusters within TRT**, not standalone verticals.

### TRT Guides Hub Sections (Canonical)

1. Getting Oriented: Is TRT Right for Me?
2. Symptoms, Fatigue & Root Causes
3. TRT vs Medical Weight Loss Decisions
4. TRT vs IV Hydration & Temporary Fixes
5. Risks, Side Effects & Long-Term Tradeoffs
6. Labs, Monitoring & What Actually Matters
7. Choosing a TRT Clinic & Avoiding Traps
8. Costs, Pricing & Commitment Reality

### TRT Canonical Guide Slugs (Immutable)

- trt-is-it-right-for-me
- trt-vs-medical-weight-loss
- trt-vs-iv-hydration
- trt-side-effects-and-risks
- trt-fertility-and-family-planning
- trt-labs-and-monitoring
- choosing-a-trt-clinic
- trt-red-flags-and-safety
- trt-costs-and-pricing-clarity

## 6.3 Dentistry (Reference)

Dentistry is an authority-based, non-intake vertical. Language, CTAs, and monetization behavior are constrained accordingly.

## 6.4 Neuro / ADHD / Autism Evaluations (Reference)

Neuro, ADHD, and Autism evaluation content is governed as an authority-based, non-intake decision vertical. Intake-adjacent mechanisms, urgency framing, and comparative ranking are prohibited unless explicitly authorized by addendum.

## 6.5 USCIS Medical (Reference)

USCIS Medical content is governed as a procedural, compliance-first vertical. Language, structure, and conversion behavior must remain informational and non-advisory.


---

# 7. CANONICAL LANGUAGE REGISTRY GOVERNANCE

Each vertical must maintain a language registry defining:
- Tone
- Publisher position
- Allowed and disallowed phrases
- CTA class
- Enforcement rules

Registries prevent cross-vertical language drift.

---

# 8. SPONSORSHIP & NEXT-STEPS GOVERNANCE

Sponsor-gated mechanisms:
- Require explicit sponsor live state
- Permit at most one sponsor per city
- Require disclosure proximity

Unauthorized extension to other verticals is prohibited without addendum update.

---

# 9. VA AUTHORITY & OPERATING BOUNDARIES

VAs may execute data and build tasks when instructed. They may not edit governance, introduce new mechanisms, or reinterpret policy.

---

# 10. DEFINITIONS & INTERPRETATION

- **Canonical:** Approved, immutable, losslessly convertible
- **Conversion:** Mechanical transform only
- **Delivery:** Conversion plus validation pass

If documents conflict, Master Index v2.1 prevails.

---

# 11. VALIDATOR MAPPING & REGRESSION PROTECTION

Validators enforce:
- Structural presence
- Page-type contracts
- Sponsor invariants
- Regression protection against prior known-good states

Loss of required structure is a catastrophic failure.

