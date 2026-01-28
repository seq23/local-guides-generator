# Master VA Training Doc — Listings System (Repo + Execution)

**Audience:** Brand-new VA with zero context  
**Purpose:** Teach you how our Listings system works, how to make safe changes, and how to ship without breaking anything.  
**Non‑negotiable rule:** If you are unsure about *anything*, you **STOP** and escalate. No guessing.

---

## 0) The Big Picture (What This Business Is)

We run a **city-by-city, vertical-by-vertical educational guides platform**.

- Each **vertical** = a category of service (example: Personal Injury, Dentistry, TRT, Neuro evaluations, USCIS medical exams)
- Each **city** = a location hub (example: `memphis-tn`)
- Our pages are designed to be:
  - **Educational** (neutral, accurate, non-promotional)
  - **AI-safe** (usable by LLMs without looking like ads, endorsements, or rankings)
  - **Sponsor-ready** (ad slots exist structurally even when no sponsor is live)

We do **not** rank providers, do **not** claim “best”, and do **not** guarantee outcomes.

---

## 1) Your Job (What You Will Do)

As a VA, you help with execution work such as:

- Adding new cities to existing verticals
- Building/maintaining **example provider lists** (examples only)
- Checking for completeness and professionalism
- Running validation and reporting failures
- Following SOPs exactly

You do **not**:

- Invent providers
- Add rankings, scores, or “best” language
- Make legal/medical recommendations
- Change core templates or scripts unless instructed
- Ship anything without passing `validate:all`

---

## 2) The Canonical Documents (Read These First)

These are your “rules of the road.” They exist as project artifacts and must be treated as authority.

1) **Master Index / Addendums** (govern system scope and rules)  
2) **Execution Playbook (MD Canonical v5)** (how we execute; modes; what is allowed)  
3) **Sponsor Activation Steps for Github Repo** (when sponsor-live happens)  
4) **AI visibility evaluation framework** (canonical copy for city pages)

**Rule:** When instructions conflict, the Execution Playbook wins.

---

## 3) Repo Orientation (What’s Where)

### 3.1 Key folders

**Core data**
- `data/` — source data for pages

**City registry**
- `data/cities.json` — canonical list of cities we support

**City listing data**
- `data/listings/<city>.json` — per-city hub configuration (and disclosures)

**Example provider lists (examples only)**
- `data/example_providers/<vertical>/...` — per-vertical per-city lists

**Vertical packs / page sets**
- `data/page_sets/examples/` — defines what a vertical pack builds
  - `pi_v1.json`, `dentistry_v1.json`, `trt_v1.json`, etc.

**Global pages per vertical**
- `data/page_sets/examples/<vertical>_global_pages/` — About, Disclaimer, Guides, etc.

**Licensing verification links**
- `data/licensing_lookup/<vertical>.json` — state licensing/verification URLs (non-PI verticals)

**Scripts (build + validation)**
- `scripts/build_city_sites.js` — builds the site into dist
- `scripts/validate_all_packs.js` — runs validations across packs
- `scripts/validate_tbs.js` — validation logic

**Templates**
- `templates/` and `templates/partials/` — HTML structure

**Output (generated)**
- `dist/` — built website output (do not hand-edit)

---

## 4) Naming Rules (You Must Follow Exactly)

### City slug format
- Always: `city-name-state`
- Lowercase
- Hyphenated

Examples:
- `memphis-tn`
- `new-york-city-ny`

### Sub-industry provider list filenames
Some verticals require multiple lists per city.

Examples:
- TRT: `memphis-tn__trt.json`, `memphis-tn__iv_hydration.json`, `memphis-tn__hair_restoration.json`
- Neuro: `memphis-tn__adhd_eval.json`, `memphis-tn__autism_eval.json`

**Rule:** Filenames are contracts. Wrong filenames = lists won’t render.

---

## 5) Content Rules (The “Never Do” List)

Do NOT add:
- “best”, “top”, “#1”, “highest rated”, “award-winning”
- any ranking order (1–10 as “best”)
- guarantees (results, outcomes, “will help”)
- medical/legal advice (“you should do X”) unless purely informational and neutral

We use:
- “examples only”
- “people typically consider…”
- “often varies by city/state…”

This is required for compliance and AI eligibility.

---

## 6) Validation Discipline (How We Avoid Shipping Mistakes)

### The only acceptable definition of “done”
- The change exists in source files (`data/`, packs)
- The site builds cleanly
- `npm run validate:all` passes

### Commands you will use
Install:
```bash
npm install
```
Validate everything:
```bash
npm run validate:all
```
Build specific pack (if asked):
```bash
node scripts/build_city_sites.js --pageSetFile data/page_sets/examples/<pack>.json
```

**Rule:** If validate fails, you STOP and paste the error verbatim.

---

## 7) Standard Workflow (Every Time)

1) Pull latest code and confirm branch
2) Make only the requested changes
3) Run `npm run validate:all`
4) Spot-check output in `dist/`
5) Commit with a clear message
6) Push to GitHub

No side edits. No “while I’m here.”

---

## 8) SOP: Adding a New City (Use This When Asked)

Follow the **City Expansion SOP**.

Quick reference of the typical files you touch:
- `data/cities.json`
- `data/listings/<city>.json`
- `data/page_sets/examples/<vertical>_v1.json` (add city to cities array)
- `data/example_providers/<vertical>/...` (create provider lists)

Then:
- `npm run validate:all`
- Check `dist/<city>/index.html`

Never ship a city without provider lists.

---

## 9) SOP: Launching a New Vertical (Use This When Asked)

Follow the **New Vertical Launch SOP**.

You will typically touch:
- `data/page_sets/examples/<vertical>_v1.json`
- `data/page_sets/examples/<vertical>_global_pages/`
- `data/example_providers/<vertical>/`
- `data/licensing_lookup/<vertical>.json` (if applicable)

Then:
- `npm run validate:all`
- Spot-check 1–2 cities in `dist/`

Never launch a vertical with missing global pages.

---

## 10) Provider Lists: How to Build Them Correctly

### What a provider list is
A provider list is an **examples-only** set of real providers in a city.

### Minimum required fields
Every entry must include:
- `name`
- `official_site_url`

### Allowed sources
- The provider’s official website
- Official directory pages only when needed for verification (but the *link we store* should be the official site)

### Disallowed sources as “official”
- Yelp
- Justia
- Healthgrades
- Avvo
- random lead-gen sites

### Safety rules
- Do not claim anything about quality
- Do not rank
- Do not include “best”

If you can’t verify an official website, flag and escalate.

---

## 11) Sponsor-Live vs Education-Only (What You Need to Know)

Default mode = **education-only**.

Education-only means:
- No next-steps CTAs that look like lead gen
- No “compare providers”
- Ads may exist as empty slots

Sponsor-live is only activated when instructed.

If you are asked to activate a sponsor:
- Use the **Sponsor Activation Steps** document
- Do not guess the files; follow the checklist

---

## 12) AI Visibility Monitoring (What We Check Monthly)

We run a lightweight monthly check:
- Ask baseline questions in ChatGPT and one other model
- Confirm the answers align with our evaluation framework
- Look for drift (new steps, recommendation language)

If drift appears:
- Do not change live pages
- Escalate with the exact prompt + response excerpt

---

## 13) How to Escalate (Exactly What to Send)

When escalating, send:
1) What you were trying to do
2) Which file you edited (full path)
3) The exact error output (verbatim)
4) What you already tried

No summaries. Paste the raw output.

---

## 14) Quick Glossary

- **Vertical**: a service category (PI, Dentistry, TRT, etc.)
- **City hub**: the city page (e.g., `/memphis-tn/`)
- **Pack / Page set**: configuration that builds a vertical site
- **Examples list**: non-ranked provider list (examples only)
- **Sponsor-live**: sponsor content active (rare; explicit approval required)
- **Education-only**: default mode; compliance-forward
- **Validation**: scripts that prevent shipping broken or non-compliant output

---

## 15) VA Permission Matrix (What You MAY and MAY NOT Touch)

### ✅ You MAY edit
- `data/cities.json`
- `data/listings/<city>.json`
- `data/example_providers/<vertical>/...`
- `data/page_sets/examples/<vertical>_v1.json` (cities array only)
- FAQ content files when explicitly instructed

### ❌ You MAY NOT edit (without written approval)
- `scripts/`
- `templates/`
- `data/ad_placements.json`
- `data/site.json`
- `package.json`
- Validation logic of any kind

If unsure → STOP and escalate.

---

## 16) Copy‑Paste Templates (Use These Exactly)

### A) City Registration Entry (`data/cities.json`)
```json
{
  "slug": "memphis-tn",
  "name": "Memphis",
  "state": "TN"
}
```

### B) City Listing File (`data/listings/memphis-tn.json`)
```json
{
  "city": "Memphis",
  "state": "TN",
  "educationOnly": true
}
```

### C) Example Provider Entry
```json
{
  "name": "Example Provider Name",
  "official_site_url": "https://www.example.com"
}
```

---

## 17) Personal Injury (PI) Special Rules — READ CAREFULLY

Personal Injury is **state‑driven**, not city‑only.

- PI supports **all 50 U.S. states**
- Every state must have:
  - A disciplinary / licensing lookup
  - A state hub page

### What this means for VAs

- You **do not create PI state pages manually**
- State pages are auto‑generated
- City PI pages must:
  - Link back to their state page
  - Reference state‑level authority correctly

Files involved:
- `data/pi_state_disciplinary_links.json`
- `data/page_sets/examples/pi_v1.json`

❌ Never delete or edit state mappings unless explicitly instructed.

---

## 18) Escalation Template (Copy This)

When escalating, paste **exactly** this:

```
TASK:
FILES TOUCHED:
WHAT I EXPECTED TO HAPPEN:
WHAT ACTUALLY HAPPENED:
ERROR OUTPUT (VERBATIM):
WHAT I ALREADY TRIED:
```

No summaries. No interpretations.

---

## 19) Visual Callouts — “What Success Looks Like”

Use these as **mental screenshots**. If your output does not resemble these, the work is not complete.

### ✅ Successful Validation Run
```
ALL PACKS PASSED
```
If you do NOT see this line, the work is not done.

---

### ✅ Correct City Output in dist/
```
dist/
 └── memphis-tn/
     ├── index.html
     └── faq/
         └── index.html
```
If the city folder does not exist, the city did not build.

---

### ✅ Correct City Page Section Order (Top → Bottom)

1. City title / header
2. Evaluation Framework (education-only explanation)
3. Top ad slot
4. Mid ad slot (directly above lists)
5. Example provider list(s)
6. Guides block
7. FAQ block
8. Disclosure / footer

If ads appear inside the framework or FAQs, something is wrong.

---

### ✅ Correct Example Provider List
```
Examples of providers in Memphis, TN

• Provider Name — officialsite.com
• Provider Name — officialsite.com
• Provider Name — officialsite.com
```

If you see rankings, stars, or “best” language → STOP immediately.

---

## 20) VA Certification Checklist (MUST PASS BEFORE PROD ACCESS)

**No VA may touch production, push to main, or run sponsor/live work until EVERY item below is checked and signed off.**

This is a hard gate. Partial completion = FAIL.

---

### A) Repo & System Literacy (Required)

☐ VA can explain, in their own words, what this business is (educational city + vertical guides, not rankings)

☐ VA can explain the difference between:
- a **vertical** (PI, Dentistry, TRT, Neuro, USCIS)
- a **city hub** (`/memphis-tn/`)
- a **pack / page set** (`pi_v1.json`, `dentistry_v1.json`, etc.)

☐ VA can correctly locate and open the following paths **without help**:
- `data/cities.json`
- `data/listings/`
- `data/example_providers/`
- `data/page_sets/examples/`
- `scripts/validate_all_packs.js`
- `dist/`

☐ VA understands that `dist/` is generated output and must **never** be hand-edited

---

### B) Compliance & Content Rules (Required)

☐ VA can list forbidden language **from memory**:
- “best”, “top”, “#1”, “we recommend”, “hire”, “guaranteed”, outcome promises

☐ VA understands and can explain:
- education-only vs sponsor-live
- what “examples only” means
- why we do NOT rank providers

☐ VA can identify recommendation language in sample text and explain why it is not allowed

☐ VA understands that violations here can break legal, medical, and platform safety

---

### C) File Naming & Structural Accuracy (Required)

☐ VA can correctly name a city slug (lowercase, hyphenated, `city-state`)

☐ VA can correctly name example provider files, including sub-industries:
- TRT: `city__trt.json`, `city__iv_hydration.json`, `city__hair_restoration.json`
- Neuro: `city__adhd_eval.json`, `city__autism_eval.json`

☐ VA understands that **wrong filenames = content does not render**

---

### D) Provider List Competency (Required)

☐ VA can explain what qualifies as an **example provider**

☐ VA can demonstrate how to verify an **official website**

☐ VA understands these are NOT allowed as official URLs:
- Yelp
- Justia
- Avvo
- Healthgrades
- Lead-gen marketplaces

☐ VA can build a valid provider list JSON that passes validation

---

### E) Personal Injury (PI) Special Rules (Mandatory)

☐ VA understands that PI is **state-driven**, not city-only

☐ VA knows PI covers **all 50 U.S. states**

☐ VA can identify the PI-specific files:
- `data/pi_state_disciplinary_links.json`
- `data/page_sets/examples/pi_v1.json`

☐ VA understands they must **never** delete or alter state mappings without explicit approval

---

### F) Validation Discipline (Non-Negotiable)

☐ VA can run:
```bash
npm install
npm run validate:all
```

☐ VA understands what a PASS vs FAIL means

☐ VA knows that **any validation failure = STOP + escalate**

☐ VA can paste raw validation output without summarizing or editing

---

### G) dist/ Spot-Check Skills (Required)

☐ VA can open a city page in `dist/<city>/index.html`

☐ VA can visually confirm:
- evaluation framework appears exactly once
- ad slot exists above provider list
- provider list renders
- FAQ page exists and is populated

☐ VA can identify duplicate sections or layout issues

---

### H) Permission Matrix Understanding (Required)

☐ VA can correctly list files they MAY edit

☐ VA can correctly list files they MUST NEVER edit

☐ VA understands that editing scripts, templates, or validation logic without permission is a firing offense

---

### I) Escalation Competency (Required)

☐ VA can recite the escalation template

☐ VA understands escalation triggers:
- uncertainty
- missing data
- validation failures
- ambiguous instructions

☐ VA understands guessing is not allowed

---

### J) Supervised Dry Run (Final Gate)

☐ VA successfully completes a supervised dry run that includes:
- adding a test city
- creating example provider lists
- updating the correct pack
- running validation
- spotting output in `dist/`

☐ Dry run is reviewed and approved

---

### ✅ Certification Result

☐ ALL sections passed

☐ Approved for limited production access

☐ Approved by: ___________________

☐ Date: ___________________

**If any box is unchecked → VA is NOT certified.**

