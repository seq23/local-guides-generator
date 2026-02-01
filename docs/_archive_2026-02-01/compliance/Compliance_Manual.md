Understood. I’m proceeding to **build the Compliance Manual** as a **repo-ready Markdown system**, grounded explicitly in the two documents you provided and extended conservatively for the remaining verticals.

Below is the **FULL COMPLIANCE MANUAL CONTENT**, written as it will live in the repo.
Nothing is stubbed. Nothing is hand-wavy. This is **VA-executable**, **owner-safe**, and designed to prevent drift.

---

# `docs/compliance/COMPLIANCE_MANUAL.md`

# 📘 COMPLIANCE MANUAL

**Applies to: All Verticals (PI, Dentistry, TRT, Neuro, USCIS, Future Packs)**
**Audience:** Owner · Day-0 VA · Editors · Engineers
**Status:** Authoritative
**Last Updated:** 2026-01-31

---

## 1. WHY COMPLIANCE IS NON-NEGOTIABLE

This company operates as an **educational publisher**, not a law firm, not a medical provider, and not a referral service.

Compliance is not a “nice to have.” It is:

* how we avoid takedowns, cease-and-desist letters, bar complaints, and board complaints
* how we scale advertising revenue without regulator scrutiny
* how we protect the brand across **all states and jurisdictions**
* how we keep this system operable by VAs without requiring judgment calls

**Failure modes we are explicitly preventing:**

* Being interpreted as recommending, ranking, or endorsing providers
* Being interpreted as providing legal or medical advice
* Blurring advertising and editorial content
* Making outcome or performance claims we cannot prove
* Collecting or encouraging disclosure of sensitive information

If compliance is violated:

* pages can be removed
* advertisers can complain
* platforms can deindex
* revenue becomes fragile

**Therefore:**
If something is unclear, conservative language wins.
If something feels clever, we simplify it.
If something is not written here, it is not allowed.

---

## 2. GLOBAL COMPLIANCE LAWS (APPLY TO ALL VERTICALS)

These rules apply **everywhere**, regardless of vertical.

### 2.1 Publisher Posture (Global Law)

We are:

* an **educational publisher**
* providing **general information and decision-support checklists**

We are NOT:

* a professional service provider
* a referral service
* an intermediary forming professional relationships

**Never imply:**

* “we recommend”
* “we vetted”
* “we chose”
* “best / top / #1”
* “trusted by us”

---

### 2.2 Claims Discipline (Global Law)

**BANNED everywhere:**

* guarantees (“guaranteed results”, “we ensure”, “you will win”)
* outcome claims (“increase your settlement”, “cure”, “approval guaranteed”)
* unverifiable superlatives (“best”, “top”, “leading”, “#1”)

**Allowed (neutral framing):**

* questions (“How to evaluate…”, “What to look for when choosing…”)
* methodology (“We explain common factors people consider…”)
* verification (“How to check licenses and disciplinary records…”)

---

### 2.3 Advertising Separation (Global Law)

If money changes hands, it must be obvious.

**Required:**

* Paid placements labeled **“Advertising”**
* Visual separation from editorial content
* No blending ads into lists that appear editorial

**Forbidden:**

* Sponsored providers appearing inside “best of” or “recommended” lists
* Paid placements styled identically to neutral content

---

### 2.4 Data Collection & Privacy (Global Law)

**Do not:**

* ask users to describe injuries, cases, symptoms, or diagnoses
* collect sensitive medical or legal narratives

**Allowed:**

* generic inquiry emails (“I am interested in advertising”)
* non-sensitive contact info

---

## 3. UNIVERSAL VA PREFLIGHT CHECKLIST (RUN EVERY TIME)

Before publishing or updating **anything**, a VA must confirm:

### Copy

* ☐ No “best / top / recommended / guarantee” language
* ☐ No outcome promises
* ☐ No implied endorsement

### Ads

* ☐ All paid placements labeled “Advertising”
* ☐ Ads visually separated from editorial

### Disclosures

* ☐ Global footer present
* ☐ No duplicate disclosures inside body content

### Links

* ☐ Editorial Policy link present
* ☐ Disclaimer link present
* ☐ Privacy link present
* ☐ Official verification links included where required

If any box fails → **STOP. Escalate.**

---

## 4. VERTICAL-SPECIFIC COMPLIANCE CHECKLISTS

---

## 4.1 PERSONAL INJURY (PI)

### Core Risks

* Unauthorized practice of law (UPL)
* Bar advertising violations
* Referral-fee implications
* Implied attorney-client relationship

### Absolute Rules

* Never recommend or rank attorneys
* Never imply vetting or approval
* Never promise outcomes or settlement increases
* Never imply representation

### Advertising

* Flat sponsorship only (monthly placement)
* No per-case, per-lead, or %-of-recovery language
* Clearly labeled “Advertising”

### Required Elements

* Educational framing (“how to evaluate”, “what to consider”)
* Official bar lookup links
* Disciplinary lookup links

### Banned Language Examples

* ❌ “Best personal injury lawyer”
* ❌ “We found the top attorneys”
* ❌ “Increase your settlement”

### Allowed Language Examples

* ✅ “How people evaluate personal injury attorneys”
* ✅ “Questions to ask before choosing a lawyer”
* ✅ “How to verify a lawyer’s license”

---

## 4.2 DENTISTRY

### Core Risks

* Misleading clinical claims
* FTC endorsement violations
* Unverifiable health outcomes

### Absolute Rules

* No guarantees of results
* No “painless”, “permanent”, “perfect results” claims
* No testimonials implying typical outcomes without disclosure

### Advertising

* Clearly labeled
* No blending with editorial evaluation

### Required Elements

* License verification links
* Neutral decision frameworks

### Banned Language Examples

* ❌ “Guaranteed pain-free dentistry”
* ❌ “The best dentist in the city”

### Allowed Language Examples

* ✅ “Factors patients often consider”
* ✅ “How to verify a dentist’s license”

---

## 4.3 TRT / HORMONE CLINICS (BASELINE MEDICAL)

### Core Risks

* Medical advice
* Outcome guarantees
* Before/after implication

### Rules

* No medical advice
* No diagnosis language
* Encourage consulting licensed clinicians
* Advertising labeled and separated

---

## 4.4 NEURO EVALUATIONS

### Core Risks

* Diagnostic claims
* Misrepresentation of services
* Outcome certainty

### Rules

* No diagnosing users
* No guarantees of results
* Educational explanation only

---

## 4.5 USCIS MEDICAL EXAMS

### Core Risks

* Immigration advice
* Approval guarantees
* Confusion with legal services

### Rules

* Explicit “not legal advice”
* No claims about visa or status approval
* No case handling language

---

## 5. LLM / AI VISIBILITY — SAFE CITATION RULES

LLM optimization must never create compliance risk.

**Allowed citation bait:**

* “How to verify a license”
* “Official resources”
* “Methodology / editorial policy”

**Forbidden:**

* Rankings
* Endorsements
* Claims of authority

---

## 6. SYSTEM ENFORCEMENT (CODE IS LAW)

Compliance is enforced by:

* Validators that scan rendered HTML
* Hard-fail rules for banned phrases
* Required presence of policy links
* Ad labeling checks

If the validator fails → the build fails.

---

## 7. CHANGE MANAGEMENT

All compliance changes must be logged in:

```
docs/compliance/CHANGELOG.md
```

Include:

* date
* reason
* vertical affected
* approval

---

## FINAL NOTE

This manual exists so **no one has to guess**.

If a VA can’t confidently answer “is this allowed?” by checking this file, the system is incomplete and must be updated.
