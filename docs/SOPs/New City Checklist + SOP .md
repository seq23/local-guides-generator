Got it — printing it **fully, inline, and more complete**.  
This is the **authoritative, no-excuses New City Launch Checklist**. If this is not satisfied, the city does not ship.

---

# **✅ NEW CITY LAUNCH CHECKLIST (AUTHORITATIVE)**

This checklist governs whether a **single city** is allowed to exist in the Listings system.  
It applies **per city, per vertical**.

**Rule:**  
If *any* item below is missing, incomplete, or ambiguous → **NO SHIP**.

---

## **1\. City Identity & Canonical Registration**

**Canonical Identity**

* City slug follows exact format: `city-name-state` (lowercase, hyphenated)  
* Slug matches exactly across:  
  * `data/cities.json`  
  * `data/listings/{city}.json`  
  * example provider filenames  
  * generated `/dist/{city}/` output  
* City exists in `data/cities.json`  
* State abbreviation exists in `data/us_states.json`  
* City is mapped to **one and only one** state  
* No alternate spellings, aliases, or duplicate city entries exist

**Intentional Inclusion**

* City is deliberately included (not auto-inherited)  
* City inclusion reviewed against expansion plan  
* City is not a test, placeholder, or legacy artifact

---

## **2\. City Listing File (`data/listings/{city}.json`)**

**File Integrity**

* City JSON file exists  
* File parses cleanly (no trailing commas, invalid fields)  
* City \+ state match canonical registry exactly

**Mode & Safety**

* `educationOnly = true` unless sponsor explicitly live  
* No sponsor references present if education-only  
* No calls to action implying comparison or selection  
* No “best”, “top”, “leading”, or outcome language

**Disclosure**

* City disclosure zone present  
* Disclosure is city-appropriate (no generic mismatch)  
* Disclosure clarifies educational intent

---

## **3\. Vertical Enablement (Per City)**

For **each vertical enabled in the city** (PI, Dentistry, TRT, Neuro, USCIS):

* City explicitly included in the page set JSON  
* City renders a vertical hub page  
* City page does NOT inherit unintended verticals  
* Vertical scope matches what users would expect in that city  
* No vertical ships accidentally or partially

---

## **4\. Example Provider / Directory Lists**

### **Presence (Mandatory)**

* City has a list section for **every enabled vertical**  
* No city ships without a list section  
* File path matches convention exactly:  
  * `data/example_providers/{vertical}/{city}.json`  
  * OR sub-industry format where applicable

### **Content Quality**

* Providers are real, verifiable entities  
* No fabricated names  
* No placeholders  
* No “coming soon” entries  
* Provider names match public branding  
* Links point to official websites (not directories unless required)

### **Neutrality**

* Clearly labeled “examples only”  
* No ranking order implied  
* No star ratings  
* No pricing claims  
* No outcome claims  
* No endorsements

### **Density & Balance**

* List is not sparse or misleading  
* List size consistent with other cities  
* National brands included only if legitimately present locally

---

## **5\. Sub-Industry Coverage (Where Required)**

### **TRT / Wellness**

* TRT list exists  
* IV Hydration list exists  
* Hair Restoration / PRP list exists  
* Each sub-industry rendered distinctly  
* Labels are explicit and unambiguous

### **Neuro**

* ADHD Evaluation list exists  
* Autism Evaluation list exists  
* No clinical claims beyond scope  
* Adult vs child language handled neutrally

### **Rule**

* No sub-industry silently omitted  
* No sub-industry merged incorrectly

---

## **6\. Ad Placement Readiness (Even if No Sponsors)**

**Structural Readiness**

* Top-of-page ad slot exists  
* Mid-page ad slot exists directly above list section  
* Ad slots render safely when empty  
* No unresolved ad tokens in dist

**Safety**

* Ads do not interrupt evaluation framework  
* Ads do not appear inside FAQs  
* Ads do not imply endorsement  
* Ads clearly separated from educational text

---

## **7\. AI Visibility Evaluation Framework (Mandatory)**

* Evaluation framework section present on city page  
* Framework appears **before** lists  
* Language is neutral and explanatory  
* Describes how people evaluate providers  
* Describes city/state variation where relevant  
* No language implying recommendation or selection  
* Matches canonical framework wording

---

## **8\. Guides & Supporting Content**

* Guides block auto-injects correctly  
* Guides are relevant to vertical \+ city  
* No broken guide links  
* No duplicate guide injections  
* Guide titles are neutral and informational

---

## **9\. Licensing & Regulatory Integrity**

### **PI**

* City links correctly to state disciplinary pages  
* State PI data exists and is valid  
* City page includes state authority references

### **Non-PI Verticals**

* Licensing lookup file exists for the vertical  
* State has at least one authoritative verification URL  
* City correctly references state-level regulation

---

## **10\. FAQ Integrity**

* City FAQ page exists  
* 10–12 FAQs present  
* No duplicate questions  
* Default state \= closed  
* Answers are neutral and accurate  
* No sales language  
* No guarantees or promises

---

## **11\. Build & Validation (Hard Gate)**

Before ship:

* `npm install` clean  
* `npm run validate:all` passes  
* No unresolved `%%TOKENS%%`  
* No markdown fences in scripts  
* JSON-LD schema parses cleanly  
* Page contracts enforced  
* LKG snapshot generated  
* Dist pages render correctly

---

## **12\. Human QA (Non-Delegable)**

* Page reads clearly to a normal user  
* No confusing or misleading phrasing  
* No legal red flags  
* No tone drift toward sales  
* Education vs advertising boundary is obvious

---

## **🚨 FINAL SHIP RULE**

If **any checkbox above is unchecked**:

**❌ CITY DOES NOT SHIP**

No partials.  
No “we’ll fix it later.”  
No exceptions.

---

Good call. You’re right — the prior SOP is **operator-level**, not **VA-executable**.

Below is a **VA-SAFE, ZERO-ASSUMPTION City Expansion SOP** that:

* names **exact files**  
* shows **where to edit**  
* says **what “done” looks like**  
* removes judgment calls  
* can be followed by someone who has *never* seen this repo

This is the version you hand to a VA.

---

# **🧭 CITY EXPANSION SOP (VA-SAFE, STEP-BY-STEP)**

**Audience:** New VA with no prior repo knowledge  
**Goal:** Add a new city correctly without breaking validation  
**Rule:** Follow steps in order. Do not skip steps.

---

## **BEFORE YOU START (MANDATORY)**

1. Make sure you are on the **main branch**  
2. Run:

npm install  
npm run validate:all

3. If validation fails → **STOP and report**

---

## **STEP 1 — Confirm the Vertical Exists (DO NOT CREATE CITIES YET)**

### **Files to check:**

data/page\_sets/examples/

You should see files like:

* `pi_v1.json`  
* `dentistry_v1.json`  
* `trt_v1.json`  
* `neuro_v1.json`  
* `uscis_medical_v1.json`

✅ If the vertical file exists → continue  
❌ If it does not → STOP and escalate

---

## **STEP 2 — Register the City (CANONICAL)**

### **File:**

data/cities.json

Add the city **once** using this format:

{  
  "slug": "memphis-tn",  
  "name": "Memphis",  
  "state": "TN"  
}

Rules:

* lowercase  
* hyphenated  
* no duplicates

Save the file.

---

## **STEP 3 — Create the City Listing File**

### **File to create:**

data/listings/memphis-tn.json

Copy from an existing city and update:

Required fields:

* city name  
* state  
* `educationOnly: true`

DO NOT:

* add sponsors  
* add rankings  
* change structure

---

## **STEP 4 — Add City to Each Vertical Page Set**

For **each vertical** you are enabling:

### **Files:**

data/page\_sets/examples/pi\_v1.json  
data/page\_sets/examples/dentistry\_v1.json  
data/page\_sets/examples/trt\_v1.json  
data/page\_sets/examples/neuro\_v1.json  
data/page\_sets/examples/uscis\_medical\_v1.json

Inside each file, add:

"memphis-tn"

to the `cities` array.

Save all files.

---

## **STEP 5 — Create Example Provider Lists (REQUIRED)**

### **Base folder:**

data/example\_providers/

---

### **PERSONAL INJURY**

data/example\_providers/pi/memphis-tn.json

Include:

* provider name  
* official website

Label clearly as **examples only**.

---

### **DENTISTRY**

data/example\_providers/dentistry/memphis-tn.json

Same rules as PI.

---

### **TRT (THREE FILES REQUIRED)**

data/example\_providers/trt/memphis-tn\_\_trt.json  
data/example\_providers/trt/memphis-tn\_\_iv\_hydration.json  
data/example\_providers/trt/memphis-tn\_\_hair\_restoration.json

Each file must contain **real providers**.

---

### **NEURO (TWO FILES REQUIRED)**

data/example\_providers/neuro/memphis-tn\_\_adhd\_eval.json  
data/example\_providers/neuro/memphis-tn\_\_autism\_eval.json

---

### **USCIS MEDICAL**

data/example\_providers/uscis\_medical/memphis-tn.json

---

## **STEP 6 — DO NOT TOUCH AD FILES**

Ad slots already exist.

DO NOT edit:

data/ad\_placements.json  
scripts/sponsorship.js

---

## **STEP 7 — Run Validation (MANDATORY)**

npm run validate:all

✅ All packs must PASS  
❌ Any error → STOP and report the error text

---

## **STEP 8 — Visual Check (REQUIRED)**

Open:

dist/memphis-tn/index.html

Confirm:

* evaluation framework appears  
* example lists are visible  
* ad slots exist above lists  
* no broken sections

---

## **STEP 9 — Commit Your Work**

git status  
git add .  
git commit \-m "Add city: Memphis, TN"  
git push origin main

---

## **🚨 ABSOLUTE RULES FOR VAs**

* ❌ Never invent providers  
* ❌ Never add rankings or “best” language  
* ❌ Never skip example lists  
* ❌ Never bypass validation  
* ❌ Never ship partial cities

---

## **WHEN TO ESCALATE (DO NOT GUESS)**

Escalate if:

* a provider list is hard to find  
* validation fails  
* file names do not match  
* city appears duplicated  
* anything feels unclear

---

## **WHAT SUCCESS LOOKS LIKE**

* City builds  
* All validations pass  
* City appears across enabled verticals  
* No sponsor content added  
* Repo remains clean

---

If you want, next I can:

* create a **VA training doc**  
* add **screenshots**  
* or turn this into a **click-by-click checklist**

Just say the word.

