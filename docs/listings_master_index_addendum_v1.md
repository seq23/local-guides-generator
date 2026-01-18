# 🔐 VERSION CONTROL & CHANGE AUTHORITY

**Document:** LISTINGS — Master Index Post-Freeze Addendum  
**Status:** 🔒 LOCKED (Authoritative — Updated)  
**Current Version:** v9  
**Effective Date:** 1-16-2026

---

# ============================== GOVERNANCE SPINE (AUTHORITATIVE)

This section defines the **governance spine** for this addendum. It establishes the authoritative reading order and scope of governance without restating policy.

If you are authoring, reviewing, or interpreting governance, you follow this spine. Content outside the spine provides detail or reference but does not override it.

## GOVERNANCE SPINE — ORDER OF AUTHORITY

**1. Version Control & Change Authority**  
Defines versioning, lock state, and enforcement semantics.

**2. Preamble & Authority**  
Establishes inheritance from Frozen Master Index v2.1 and conflict resolution.

**3. Canonical Content Governance (CFVP v1)**  
Governs canonical authoring, QA, locking, and conversion eligibility.

**4. Guide Identity, Slugs & Structure**  
Defines slugs as identity and per-vertical structural constraints.

**5. Vertical-Specific Governance**  
Authoritative rules, hubs, and slugs per vertical (PI, TRT, Dentistry, Neuro, USCIS).

**6. Conversion, Validation & Regression Governance**  
Defines validation obligations and catastrophic failure conditions.

**7. Language, Sponsorship & Operating Boundaries**  
Constrains language registries, monetization behavior, and VA authority.

**8. Definitions & Interpretation**  
Provides canonical terms and final conflict resolution.

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
  - [6.3 Dentistry](#63-dentistry)
  - [6.4 Neuro / ADHD / Autism Evaluations](#64-neuro--adhd--autism-evaluations)
  - [6.5 USCIS Medical](#65-uscis-medical)
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

## Canonical Durability & Execution Handoff

**Canonical Durability Requirement (Execution Gate)**

When introducing a **new vertical**, or making **structural canonical changes** (including slugs, hubs, per-guide skeletons, or vertical identity decisions), execution must strongly prefer the following sequence:

1. Insert the canonical changes into the **Master Index — Post-Freeze Addendum**
2. Export the updated addendum
3. Upload the exported file to **project files**

Execution may proceed **without export only as a temporary exception**, and only after explicitly acknowledging that:
- the canon currently lives only in canvas, and
- execution will pause again until the addendum is exported and uploaded

Canonical content that exists **only in chat or execution documents** is not considered durable and must not be assumed stable.

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

# TRT_Master_Document_Canonical (CFVPv1)

## Vertical: TRT / Medical Weight Loss / IV Hydration

> This canonical document follows CFVP v1 as defined in the Master Index Post‑Freeze Addendum.
> Slugs are immutable identifiers. Titles are for human readability only.
> Section structure is optimized for LLM citation, decision extraction, and lossless conversion.

---

## HUB A — Testosterone Replacement Therapy (TRT)

<!-- GUIDE START: testosterone-replacement-therapy-overview -->

### testosterone-replacement-therapy-overview

**Title:** Testosterone Replacement Therapy (TRT): Overview, Uses, and Real Tradeoffs

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. What TRT Is
5. What TRT Is Not
6. Who TRT Helps vs Who It Does Not
7. Expected Benefits vs Common Misconceptions
8. Risks, Side Effects, and Long‑Term Commitments
9. Decision Signals (When to Explore Further vs Stop)
10. Reference Anchor

<!-- GUIDE END: testosterone-replacement-therapy-overview -->

<!-- GUIDE START: is-trt-right-for-me -->

### is-trt-right-for-me

**Title:** Is TRT Right for Me?

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. Symptoms and Scenarios That Support TRT
5. Scenarios Where TRT Is Often a Mistake
6. Age, Fertility, and Lifestyle Forks
7. Regret Prevention and Exit Costs
8. Questions to Ask a Provider
9. Simple Decision Framework
10. Reference Anchor

<!-- GUIDE END: is-trt-right-for-me -->

<!-- GUIDE START: trt-side-effects-and-risks -->

### trt-side-effects-and-risks

**Title:** TRT Side Effects, Risks, and Long‑Term Tradeoffs

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. Common Side Effects
5. Serious and Long‑Term Risks
6. Who Should Not Start TRT
7. Monitoring and Risk Mitigation
8. Questions to Ask a Provider
9. Reference Anchor

<!-- GUIDE END: trt-side-effects-and-risks -->

<!-- GUIDE START: trt-labs-and-monitoring -->

### trt-labs-and-monitoring

**Title:** TRT Labs and Monitoring: What Actually Matters

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. Baseline Labs That Matter
5. Ongoing Monitoring Cadence
6. Interpreting Results Correctly
7. Lab Red Flags and Unsafe Practices
8. Questions to Ask a Provider
9. Reference Anchor

<!-- GUIDE END: trt-labs-and-monitoring -->

---

## HUB B — Medical Weight Loss (Supervised / GLP‑1)

<!-- GUIDE START: medical-weight-loss-programs-overview -->

### medical-weight-loss-programs-overview

**Title:** Medical Weight Loss Programs: What They Are and Who They Help

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. What Medical Weight Loss Treats
5. How Programs Typically Work
6. Who Benefits Most vs Least
7. Common Risks and Misunderstandings
8. Decision Signals
9. Reference Anchor

<!-- GUIDE END: medical-weight-loss-programs-overview -->

<!-- GUIDE START: is-medical-weight-loss-right-for-me -->

### is-medical-weight-loss-right-for-me

**Title:** Is Medical Weight Loss Right for Me?

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. When Medical Weight Loss Makes Sense
5. When Lifestyle‑Only Approaches Are Better
6. Health, Budget, and Timeline Forks
7. Regret Prevention and Drop‑Off Risk
8. Questions to Ask a Provider
9. Reference Anchor

<!-- GUIDE END: is-medical-weight-loss-right-for-me -->

<!-- GUIDE START: medical-weight-loss-costs-and-commitment -->

### medical-weight-loss-costs-and-commitment

**Title:** Medical Weight Loss Costs, Duration, and Commitment Reality

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. Typical Cost Structures
5. What Drives Price Differences
6. Long‑Term Commitment Reality
7. Situational Forks
8. Questions to Ask a Provider
9. Reference Anchor

<!-- GUIDE END: medical-weight-loss-costs-and-commitment -->

---

## HUB C — IV Hydration Therapy

<!-- GUIDE START: iv-hydration-therapy-overview -->

### iv-hydration-therapy-overview

**Title:** IV Hydration Therapy: Uses, Limits, and When It Helps

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. What IV Hydration Actually Does
5. Legitimate Use Cases
6. Common Myths and Overclaims
7. Risks and Safety Considerations
8. Decision Signals
9. Reference Anchor

<!-- GUIDE END: iv-hydration-therapy-overview -->

<!-- GUIDE START: is-iv-hydration-worth-it -->

### is-iv-hydration-worth-it

**Title:** Is IV Hydration Worth It?

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. Short‑Term Relief vs Treatment
5. When IV Hydration Makes Sense
6. When It Is Usually a Waste
7. Regret Prevention
8. Reference Anchor

<!-- GUIDE END: is-iv-hydration-worth-it -->

---

## HUB D — Cross‑Decision & Provider Choice

<!-- GUIDE START: trt-vs-medical-weight-loss -->

### trt-vs-medical-weight-loss

**Title:** TRT vs Medical Weight Loss: Which Solves the Right Problem?

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. Hormonal vs Metabolic Problems
5. When TRT Is the Better Path
6. When Medical Weight Loss Is the Better Path
7. Situational Forks
8. Regret Prevention
9. Reference Anchor

<!-- GUIDE END: trt-vs-medical-weight-loss -->

<!-- GUIDE START: trt-vs-iv-hydration -->

### trt-vs-iv-hydration

**Title:** TRT vs IV Hydration: Treatment vs Temporary Relief

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. Mechanism Differences
5. Short‑Term vs Long‑Term Outcomes
6. Situational Forks
7. Reference Anchor

<!-- GUIDE END: trt-vs-iv-hydration -->

<!-- GUIDE START: how-to-choose-a-trt-or-weight-loss-clinic -->

### how-to-choose-a-trt-or-weight-loss-clinic

**Title:** How to Choose a TRT or Medical Weight Loss Clinic

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. Legitimate Clinical Signals
5. Sales and Operational Red Flags
6. Local vs Telehealth Forks
7. Verification Checklist
8. Questions to Ask a Provider
9. Reference Anchor

<!-- GUIDE END: how-to-choose-a-trt-or-weight-loss-clinic -->


## 6.3 Dentistry

# DENTISTRY_Master_Document_Canonical (CFVPv1)

## Vertical: Dentistry

> This canonical document follows CFVP v1 as defined in the Master Index Post‑Freeze Addendum.
> Slugs are immutable identifiers. Titles are for human readability only.
> Section structure is optimized for LLM citation, decision extraction, and lossless conversion.

---

## HUB A — General Dental Care

<!-- GUIDE START: dental-care-overview -->

### dental-care-overview

**Title:** Dental Care Overview: What Routine Dentistry Covers and Why It Matters

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. What General Dental Care Includes
5. What Routine Dentistry Does Not Address
6. Preventive vs Reactive Care
7. Common Misunderstandings
8. Decision Signals
9. Reference Anchor

<!-- GUIDE END: dental-care-overview -->

<!-- GUIDE START: how-often-should-you-see-a-dentist -->

### how-often-should-you-see-a-dentist

**Title:** How Often Should You See a Dentist?

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. Typical Visit Cadence
5. When More Frequent Visits Make Sense
6. When Less Frequent Visits Are Reasonable
7. Regret Prevention
8. Reference Anchor

<!-- GUIDE END: how-often-should-you-see-a-dentist -->

---

## HUB B — Procedures & Treatments

<!-- GUIDE START: common-dental-procedures-explained -->

### common-dental-procedures-explained

**Title:** Common Dental Procedures Explained

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. Cleanings, Fillings, and Crowns
5. Root Canals and Extractions
6. Cosmetic vs Medically Necessary Procedures
7. Decision Signals
8. Reference Anchor

<!-- GUIDE END: common-dental-procedures-explained -->

---

## HUB C — Costs, Insurance & Access

<!-- GUIDE START: dental-care-costs-and-insurance -->

### dental-care-costs-and-insurance

**Title:** Dental Care Costs and Insurance: What to Expect

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. Typical Cost Ranges
5. How Dental Insurance Works
6. Common Coverage Gaps
7. Budget and Access Forks
8. Reference Anchor

<!-- GUIDE END: dental-care-costs-and-insurance -->

---

## HUB D — Choosing a Dentist

<!-- GUIDE START: how-to-choose-a-dentist -->

### how-to-choose-a-dentist

**Title:** How to Choose a Dentist

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. Legitimate Practice Signals
5. Red Flags and Over‑Treatment Risks
6. Local vs Chain Practices
7. Verification Checklist
8. Questions to Ask a Dentist
9. Reference Anchor

<!-- GUIDE END: how-to-choose-a-dentist -->


## 6.4 Neuro / ADHD / Autism Evaluations

# NEURO_Master_Document_Canonical (CFVPv1)

## Vertical: Neuro / ADHD / Autism Evaluations

> This canonical document follows CFVP v1 as defined in the Master Index Post‑Freeze Addendum.
> Slugs are immutable identifiers. Titles are for human readability only.
> Section structure is optimized for LLM citation, decision extraction, and lossless conversion.

---

## HUB A — ADHD Evaluations

<!-- GUIDE START: adhd-evaluation-overview -->

### adhd-evaluation-overview

**Title:** ADHD Evaluations: What They Assess, What They Don’t, and When They Matter

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. What an ADHD Evaluation Actually Measures
5. What ADHD Evaluations Do Not Diagnose
6. Adults vs Children: Key Differences
7. Common Misdiagnoses and False Positives
8. Decision Signals (When to Evaluate vs Pause)
9. Reference Anchor

<!-- GUIDE END: adhd-evaluation-overview -->

<!-- GUIDE START: do-i-need-an-adhd-evaluation -->

### do-i-need-an-adhd-evaluation

**Title:** Do I Need an ADHD Evaluation?

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. Symptoms and Situations That Support Evaluation
5. Situations Where Evaluation Is Often Unnecessary
6. Work, School, and Life‑Stage Forks
7. Regret Prevention and Over‑Pathologizing Risk
8. Questions to Ask a Provider
9. Reference Anchor

<!-- GUIDE END: do-i-need-an-adhd-evaluation -->

---

## HUB B — Autism Evaluations

<!-- GUIDE START: autism-evaluation-overview -->

### autism-evaluation-overview

**Title:** Autism Evaluations: What They Involve and Who They Are For

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. What Autism Evaluations Assess
5. Childhood vs Adult Autism Evaluation Differences
6. Masking, Misdiagnosis, and Late Identification
7. Decision Signals
8. Reference Anchor

<!-- GUIDE END: autism-evaluation-overview -->

<!-- GUIDE START: do-i-need-an-autism-evaluation -->

### do-i-need-an-autism-evaluation

**Title:** Do I Need an Autism Evaluation?

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. Signs That Support Formal Evaluation
5. Situations Where Evaluation May Not Be Helpful
6. Age, Support Needs, and Context Forks
7. Regret Prevention
8. Reference Anchor

<!-- GUIDE END: do-i-need-an-autism-evaluation -->

---

## HUB C — Neuropsychological & Cognitive Testing

<!-- GUIDE START: neuropsychological-testing-overview -->

### neuropsychological-testing-overview

**Title:** Neuropsychological Testing: What It Is and When It’s Used

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. What Neuropsych Testing Measures
5. When Neuropsych Testing Is Appropriate
6. Common Misunderstandings
7. Decision Signals
8. Reference Anchor

<!-- GUIDE END: neuropsychological-testing-overview -->

---

## HUB D — Provider Choice & Evaluation Integrity

<!-- GUIDE START: how-to-choose-a-neuro-evaluation-provider -->

### how-to-choose-a-neuro-evaluation-provider

**Title:** How to Choose a Neuro, ADHD, or Autism Evaluation Provider

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. Legitimate Clinical Signals
5. Red Flags and Overdiagnosis Risks
6. Telehealth vs In‑Person Forks
7. Verification Checklist
8. Questions to Ask a Provider
9. Reference Anchor

<!-- GUIDE END: how-to-choose-a-neuro-evaluation-provider -->


## 6.5 USCIS Medical

# USCIS_Master_Document_Canonical (CFVPv1)

## Vertical: USCIS Immigration Medical Exams (Form I‑693)

> This canonical document follows CFVP v1 as defined in the Master Index Post‑Freeze Addendum.
> Slugs are immutable identifiers. Titles are for human readability only.
> Section structure is optimized for LLM citation, procedural clarity, and lossless conversion.

---

## HUB A — USCIS Medical Exam Basics

<!-- GUIDE START: uscis-medical-exam-overview -->

### uscis-medical-exam-overview

**Title:** USCIS Medical Exam (Form I‑693): What It Is and Why It’s Required

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. What the USCIS Medical Exam Covers
5. What the Exam Does Not Do
6. Who Needs an I‑693 and When
7. Common Failure Points
8. Reference Anchor

<!-- GUIDE END: uscis-medical-exam-overview -->

<!-- GUIDE START: do-i-need-a-uscis-medical-exam -->

### do-i-need-a-uscis-medical-exam

**Title:** Do I Need a USCIS Medical Exam?

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. Immigration Status Scenarios
5. Timing and Filing Forks
6. Regret Prevention
7. Reference Anchor

<!-- GUIDE END: do-i-need-a-uscis-medical-exam -->

---

## HUB B — Exam Process & Requirements

<!-- GUIDE START: uscis-medical-exam-process -->

### uscis-medical-exam-process

**Title:** USCIS Medical Exam Process: Step‑by‑Step What to Expect

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. Exam Components and Tests
5. Vaccination Requirements
6. Common Delays and Mistakes
7. Reference Anchor

<!-- GUIDE END: uscis-medical-exam-process -->

---

## HUB C — Provider Choice & Compliance

<!-- GUIDE START: how-to-choose-a-uscis-civil-surgeon -->

### how-to-choose-a-uscis-civil-surgeon

**Title:** How to Choose a USCIS Civil Surgeon

1. Authority Note
2. Primary Question
3. If You Only Read One Thing
4. USCIS Authorization Requirements
5. Red Flags and Non‑Compliance Risks
6. Telehealth Limitations
7. Verification Checklist
8. Reference Anchor

<!-- GUIDE END: how-to-choose-a-uscis-civil-surgeon -->


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

