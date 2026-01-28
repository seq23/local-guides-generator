### **New-Vertical Readiness Checklist (Complete)**

**Use this checklist before launching any new vertical (pack). If any item fails, do not ship.**

#### **A) Pack Definition**

* Vertical key defined (e.g., `dentistry`, `trt`, `neuro`, `uscis_medical`) and matches repo naming conventions

* Pack intent is clear: education-only vs sponsor-live (default: education-only)

* Service scope locked (what is IN/OUT). No ambiguous services

* Sub-industries decided (single list vs multi-sub-industry lists). If multi, enumerate each sublist

#### **B) Evaluation Framework (Non-negotiable)**

* City hub includes exactly **one** evaluation framework section

* Neutral language: “people typically consider…”, “often varies by…”

* No recommendation language: no “best/top”, “we recommend”, “choose/hire”

* Framework covers the decision process end-to-end at a high level:

  * What the service is (plain English)

  * Who it’s for (eligibility/fit)

  * Typical intake steps

  * What varies by city/state (rules, licensing, timelines)

  * What questions people usually ask

  * Costs/fees described neutrally (no promises)

  * Red flags (neutral)

* Explicit boundary included: educational only / not a recommendation / no guarantees

#### **C) Examples / Directory Lists**

* Every city in the pack renders a list section (examples list or directory)

* If examples lists:

  * Files exist for every city: `data/example_providers/<vertical>/...`

  * Each entry has `name` \+ `official_site_url`

  * URLs are official sites (no Yelp/Justia/Healthgrades/etc as “official”)

  * “Examples only” label present (no endorsement implied)

  * Consistent list length policy (e.g., 3/5/10) across cities

* If directory model (PI-style):

  * Files exist for every city: `data/listings/<city>.json`

  * No rankings/scores; framed neutrally

#### **D) Monetization Placement (Sponsor-ready)**

* `%%AD:city_hub_top%%` exists in the top zone

* `%%AD:city_hub_mid%%` exists **immediately above** the list section

* No ad tokens inside evaluation framework or FAQs

* Sponsor-live rules are not accidentally enabled in edu-only packs

#### **E) Compliance & Safety**

* Global pages exist: About, Contact, Disclaimer, Editorial Policy, Privacy, Methodology, For Providers, Guides

* Disclaimer covers: educational use, no endorsements, no guarantees, not professional advice (as applicable)

* No regulated claims (medical/legal outcomes, guarantees)

* No “do this now” prescriptive advice unless clearly informational and neutral

#### **F) Licensing Lookup (If applicable)**

* `data/licensing_lookup/<vertical>.json` exists (if the vertical involves licensing)

* Every state has at least one valid verification URL (validator passes)

#### **G) Guides \+ FAQs (Answer-shaped coverage)**

* City pages include the guides block

* Guides exist and match user intent (process, cost, questions to ask, what to expect)

* FAQs per city pass: 10–12 items, no duplicates, default closed

* Coverage includes these prompts:

  * “How do I find a \[provider\] in \[city/state\]?”

  * “What should I ask?”

  * “What does it cost?” (neutral)

  * “What happens during the process?”

#### **H) Validation & Ship Gate (Do not skip)**

* `npm run validate:all` passes

* No unresolved tokens in `dist/`

* JSON-LD parses; no forbidden fields/types

* Page contracts pass (required zones enforced)

* Spot-check one city page in `dist/`:

  * framework present once

  * ads above list

  * list renders

  * no duplicate sections / weird spacing

✅ If all boxes are checked → vertical is ready to launch.

Perfect — using **your checklist as the canonical standard**, here is a **VA-SAFE, FILE-PATH-EXPLICIT NEW VERTICAL LAUNCH SOP**.

This is written so a **new VA can execute it end-to-end without knowing the system**, and so **you can audit it line-by-line**.

---

# **🧩 NEW VERTICAL LAUNCH SOP (VA-SAFE, CANONICAL)**

**Audience:** New VA or junior operator  
**Goal:** Launch a *new vertical pack* safely and correctly  
**Rule:** Follow steps in order. **Do not skip. Do not improvise.**

If anything is unclear → **STOP AND ESCALATE**

---

## **BEFORE YOU START (HARD GATE)**

1. Confirm repo is clean:

npm install  
npm run validate:all

2. If validation fails → **STOP**  
3. Confirm this is a **new vertical**, not a new city.

---

## **STEP 1 — Define the Vertical (NO FILES YET)**

You must know **before touching the repo**:

* Vertical key (example: `dentistry`, `trt`, `neuro`, `uscis_medical`)  
* Is it **education-only**? (default \= YES)  
* What services are **IN scope**  
* What services are **OUT of scope**  
* Are there **sub-industries**?

❌ If any of the above is unclear → STOP

---

## **STEP 2 — Create the Page Set File (Pack Definition)**

### **File to create:**

data/page\_sets/examples/\<vertical\>\_v1.json

Example:

data/page\_sets/examples/dermatology\_v1.json

This file defines:

* pack name  
* enabled cities  
* pack flags (educationOnly)  
* required sections

Rules:

* Copy structure from an existing pack (e.g. `dentistry_v1.json`)  
* Do **not** invent new fields  
* Do **not** enable sponsor-live logic

---

## **STEP 3 — Create Licensing Lookup (If Applicable)**

If the vertical involves **licensed professionals**:

### **File to create:**

data/licensing\_lookup/\<vertical\>.json

Rules:

* Every U.S. state must have **at least one** authoritative URL  
* URLs must be government or regulatory bodies  
* Validator must pass

❌ If licensing is unclear → STOP

---

## **STEP 4 — Create Example Provider Folder**

### **Folder:**

data/example\_providers/\<vertical\>/

Inside this folder:

* One file **per city**, OR  
* Multiple files per city if sub-industries exist

---

### **If SINGLE LIST per city:**

data/example\_providers/\<vertical\>/memphis-tn.json

### **If MULTI-SUB-INDUSTRY (required):**

data/example\_providers/\<vertical\>/memphis-tn\_\_subindustry.json

Examples:

memphis-tn\_\_adhd\_eval.json  
memphis-tn\_\_autism\_eval.json  
memphis-tn\_\_trt.json  
memphis-tn\_\_iv\_hydration.json

Rules for all lists:

* Real providers only  
* Provider name \+ official website only  
* Label clearly: **“Examples only”**  
* No rankings, stars, pricing, outcomes

---

## **STEP 5 — Evaluation Framework (NON-NEGOTIABLE)**

### **Where it renders from:**

Defined in the vertical page set \+ templates (already wired)

### **What you must ensure:**

* Framework exists **once per city hub**  
* Appears **above provider lists**  
* Uses neutral language only

Framework MUST cover:

* What the service is  
* Who it’s for  
* Typical intake steps  
* City/state variation  
* Costs (neutral)  
* Questions people ask  
* Red flags  
* Explicit educational / no guarantees boundary

❌ If framework is missing or duplicated → STOP

---

## **STEP 6 — Ad Slot Verification (Do NOT Edit Ads)**

You must **confirm presence**, not add logic.

Required tokens:

%%AD:city\_hub\_top%%  
%%AD:city\_hub\_mid%%

Rules:

* Top slot near page start  
* Mid slot **directly above example list**  
* No ads inside framework or FAQs

Do NOT edit:

data/ad\_placements.json  
scripts/sponsorship.js

---

## **STEP 7 — Guides & FAQs**

### **Guides (must exist):**

data/page\_sets/examples/\<vertical\>\_global\_pages/

Required:

* home.json  
* faq.json  
* guides.json  
* methodology.json  
* disclaimer.json  
* editorial-policy.json  
* privacy.json  
* for-providers.json

### **FAQs:**

* 10–12 per city  
* Default closed  
* Answer real user questions:  
  * “How do I find a \_\_\_ in \_\_\_?”  
  * “What should I ask?”  
  * “What does it cost?”  
  * “What happens during the process?”

---

## **STEP 8 — Add Cities to the Vertical**

### **File:**

data/page\_sets/examples/\<vertical\>\_v1.json

Add city slugs:

"cities": \[  
  "memphis-tn",  
  "chicago-il"  
\]

Rules:

* City must already exist in `data/cities.json`  
* Do not add cities that lack example lists

---

## **STEP 9 — Validation (HARD STOP)**

Run:

npm run validate:all

Validation must confirm:

* Framework present  
* Ads resolved  
* Lists render  
* Licensing checks pass  
* FAQs valid  
* No unresolved tokens

❌ Any failure → STOP and report exact error

---

## **STEP 10 — Visual Spot Check (MANDATORY)**

Open one city page:

dist/\<city\>/index.html

Confirm:

* Framework appears once  
* Ads appear above lists  
* Lists render correctly  
* No duplicated sections  
* No weird spacing or broken flow

---

## **STEP 11 — Commit & Ship**

git status  
git add .  
git commit \-m "Launch vertical: \<vertical\>"  
git push origin main

---

## **🚨 ABSOLUTE RULES FOR VAs**

* ❌ Never invent providers  
* ❌ Never add rankings or “best” language  
* ❌ Never enable sponsor-live mode  
* ❌ Never skip validation  
* ❌ Never ship partial verticals

---

## **WHEN TO ESCALATE**

Escalate immediately if:

* Licensing rules are unclear  
* Providers are hard to verify  
* Validation errors appear  
* You are unsure whether a service belongs in scope

---

## **WHAT “DONE” LOOKS LIKE**

* Vertical pack exists  
* Cities render correctly  
* Framework present  
* Lists present  
* Ads structurally ready  
* Validation passes  
* No legal or tone issues

---

### **Final rule (non-negotiable)**

If **any checklist item fails**:

**❌ VERTICAL DOES NOT SHIP**

---

