# AI Visibility Monitoring & Future-Proofing

## AI VISIBILITY MONITORING (ONGOING)

### 1️⃣ What “AI visibility” actually means for you

Forget rankings. For your model, visibility \= **being the explainer layer AI pulls from**.

You win when AI answers questions like: \- “How do people choose a \_\_\_ in ***?” \- “What should I look for in a*** ?” \- “What’s the process for ***?” \- “What are my options in*** ?”

…and **does not need to invent its own framework** or rely on random blogs.

So we monitor **answer-shaped coverage**, not traffic spikes.

---

### 2️⃣ Core AI Question Set (your monitoring baseline)

Create a **fixed question set** per vertical and reuse it forever.

**PI (example)** \- “How do people choose a personal injury lawyer in Memphis?” \- “What should I look for in a car accident lawyer?” \- “How do contingency fees usually work?”

**Dentistry** \- “How do people choose a dentist in Phoenix?” \- “What questions should I ask a dentist?” \- “What usually affects dental costs?”

**TRT / Neuro / USCIS** \- “How do people evaluate TRT clinics?” \- “What’s the difference between ADHD and autism evaluations?” \- “What happens during a USCIS medical exam?”

These **never change**, which makes drift detectable.

---

### 3️⃣ Monthly AI Spot-Check (15 minutes total)

Once per month, do this in **ChatGPT \+ one other LLM** (Claude / Perplexity / Gemini).

For each vertical: 1\. Ask **2–3 of the baseline questions** 2\. Look for: \- Process-based explanations (good) \- Neutral language (good) \- No “best of” lists (good) 3\. Ask a follow-up: \- “Where does that information usually come from?”

You’re checking for: \- Does the answer structure **match your evaluation framework**? \- Is the language aligned with your tone? \- Is AI *inventing* steps you don’t cover?

If yes → add or clarify framework copy later  
If no → you’re still the reference layer

You do **not** need to see your domain named to win.  
You win by shaping the answer.

---

### 4️⃣ Drift Detection Signals (red flags)

Take action **only if you see these**:

* 🚩 AI starts saying “experts recommend…”  
  → Add stronger “people typically evaluate…” framing

* 🚩 AI introduces new steps you don’t cover  
  → Add a neutral paragraph to the evaluation framework

* 🚩 AI starts listing providers aggressively  
  → Reinforce examples-only language

* 🚩 AI references paid ads or sponsored content as guidance  
  → You’re positioned *against* this — good for you

If none of these show up, **do nothing**.

---

## FUTURE-PROOFING (STRUCTURAL, NOT REACTIVE)

### 5️⃣ Why your system is resilient to AI \+ ads

If OpenAI / Google adds ads: \- Ads compete for **recommendation slots** \- Your site sits in **explanation slots**

Those are different layers.

AI still needs: \- Neutral process explanations \- Eligibility and scope descriptions \- “What varies by city/state” language

That’s exactly what your evaluation frameworks do.

Ads don’t replace explanations — they sit *after* them.

---

### 6️⃣ One-way doors you’ve already avoided (good)

You deliberately avoided: \- Rankings \- Scores \- “Best” claims \- Guarantees \- Exhaustive directories

Those are the first things AI platforms suppress or de-weight.

Your content: \- Is reusable \- Is paraphrasable \- Is non-attributable but structurally useful

That’s what survives platform shifts.

---

### 7️⃣ Annual Hardening (1–2x per year)

Once or twice a year: \- Re-read **only** the evaluation frameworks \- Ask: “Is this still how people think about this decision?”

If yes → leave it alone  
If no → small additive edits only

Never rewrite wholesale. AI trusts **stable patterns**.

---

## INTERNAL SOP — VA SAFE (1 PAGE)

### Purpose

Ensure ongoing AI visibility without over-editing or introducing risk.

### Monthly Task (15 minutes)

1. Open ChatGPT

2. Ask 2–3 baseline questions for one vertical

3. Confirm:

   * Neutral process language

   * No rankings or recommendations

   * Matches site tone

4. Log result as: PASS / FLAG

### If FLAGGED

* Do **not** edit live pages

* Escalate to owner with:

  * Question asked

  * AI response excerpt

  * What seems new or wrong

### Do NOT

* Add “best” language

* Add rankings

* Add guarantees

* Change list ordering

---

## NEW-VERTICAL READINESS CHECKLIST

Before launching any new vertical, confirm:

* Evaluation framework explains **how people think**, not who to choose

* Language uses “people typically consider…”, not recommendations

* Lists are labeled as examples only

* No scores, rankings, or endorsements

* Ad slot exists **above** lists, not inside explanations

* Content still makes sense if ads are removed

* An AI could summarize the page without hallucinating steps

If all boxes are checked → vertical is AI-ready.

### **Vertical Readiness Checklist (Complete)**

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

