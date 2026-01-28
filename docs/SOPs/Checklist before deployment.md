Here’s the **Release Gate** you run **before any deploy** (city adds, copy changes, sponsor updates, new vertical). This is written so a VA can execute it with zero judgment calls.

---

# **RELEASE GATE v1.0 — Local Guides Generator**

**Status:** REQUIRED  
**Applies to:** every deploy (PI now; dentistry/others later)

## **0\) Non-negotiables**

A release **fails** if any of these are violated:

* Any directory page implies **ranking, scoring, “best/top/\#1,” or endorsement**  
* Any ad placement is not clearly labeled **Advertising**  
* Required footer links are missing: `/disclaimer/`, `/editorial-policy/`, `/privacy/`  
* Any page ships with placeholder tokens (e.g., `{{CITY}}`)  
* Any city hub directory section is blank **without** an empty-state message

---

## **1\) Pre-build checks (source of truth)**

### **1.1 Repo hygiene**

* Confirm you’re working in the **generator repo** (not legacy): `local-guides-generator`  
* Confirm you’re on the right branch (usually `main`)

### **1.2 Inputs exist**

* `templates/` exists  
* `scripts/build_city_sites.js` exists  
* `data/cities.json` exists and is valid JSON  
* `data/states.json` exists and includes all states used in `cities.json`

### **1.3 City inventory sanity**

Open `data/cities.json`:

* Every city object has:  
  * `slug`, `city`, `state`, `marketLabel` (and any fields your builder expects)  
* No duplicate slugs  
* Slugs match your intended URLs (e.g., `new-york-city`, `las-vegas`)

---

## **2\) Build step (must pass)**

Run:

npm ci  
npm run build

**Build must complete with exit code 0\.**  
If build errors: **STOP** and fix. No partial deploys.

---

## **3\) Automated regression scans (must pass)**

Run these in terminal from repo root.

### **3.1 No placeholders in output**

grep \-R "{{" \-n dist || true  
grep \-R "%%" \-n dist || true

**Pass condition:** no matches.

### **3.2 “Best/top/\#1” banned language scan (directories)**

You are allowed to *ask/answer* “best/top” in FAQ/answer-box, **but never as endorsements or ranking language inside directory blocks.**

Run:

grep \-R \-n "best\\|top\\|\#1\\|number one\\|highest rated\\|award-winning" dist | head \-n 50

**Pass condition:**

* Instances should appear only in:  
  * FAQ questions/answers (with “no rankings”)  
  * answer box (with “no single best”)  
  * methodology language (“we do not rank”)  
* **Fail** if you find phrasing like:  
  * “Top firm” in a listing card  
  * “Best lawyer” next to a specific firm  
  * “Recommended” / “We recommend” / “Our picks”

### **3.3 Advertising label present for sponsor stacks**

grep \-R \-n "Advertising" dist | head \-n 50

**Pass condition:** Sponsor blocks include “Advertising” label wherever sponsor stacks exist.

### **3.4 Footer lock present everywhere**

grep \-R \-n "/disclaimer/" dist | wc \-l  
grep \-R \-n "/editorial-policy/" dist | wc \-l  
grep \-R \-n "/privacy/" dist | wc \-l  
grep \-R \-n 'id="year"' dist | wc \-l

**Pass condition:** counts are non-zero and roughly match total page count.  
**Fail** if any of these are missing from a meaningful number of pages.

### **3.5 Methodology page exists \+ is linked sitewide**

test \-f dist/methodology/index.html && echo "methodology page exists"  
grep \-R \-n 'href="/methodology/"' dist | wc \-l

**Pass condition:** methodology file exists \+ links appear across city hubs and FAQs.

### **3.6 Empty directory protection (no blank hubs)**

grep \-R \-n "No firms are listed for this market yet" dist | wc \-l

**Pass condition:** this message appears for cities with no listings JSON.  
**Fail** if any city hub shows an empty directory section without either listings cards or the empty-state message.

---

## **4\) Manual spot-checks (5 minutes total)**

Pick **3 cities**:

* one with listings (Phoenix)  
* two without listings (any two others)

Open these generated files:

* `dist/<city>/index.html` (hub)  
* `dist/<city>/faq/index.html` (FAQ)  
* `dist/methodology/index.html` (global)

### **4.1 Hub page checklist**

* Answer box includes **exact phrase** “best personal injury lawyer in {City}” (no curly quotes)  
* Methodology block present  
* Directory is populated **or** shows the empty-state message  
* Sponsor blocks are labeled **Advertising**

### **4.2 FAQ page checklist**

* Contains Qs for: best/top/most money (visible)  
* Answers explicitly say **no rankings** \+ how to choose \+ verify license  
* Links to hub directory \+ `/methodology/`

### **4.3 Methodology page checklist**

* Clearly states:  
  * no rankings/endorsements  
  * inclusion methodology  
  * verification via official lookup  
  * advertising disclosure  
  * corrections process

---

## **5\) Deploy gate (Cloudflare)**

### **5.1 Cloudflare Pages settings (must match)**

* **Build command:** `npm ci && npm run build`  
* **Output directory:** `dist`

### **5.2 Post-deploy smoke test (2 minutes)**

After deploy completes:

* visit:  
  * `/<city>/` (1–2 cities)  
  * `/<city>/faq/`  
  * `/methodology/`  
* confirm CSS loads and nav links work

---

# **VA SOP — “How to add a new city” (safe version)**

1. Add city to `data/cities.json`  
2. Add state to `data/states.json` if not already present  
3. (Optional) add listings file: `data/listings/<slug>.json`  
4. (Optional) add sponsors file: `data/sponsors/<slug>.json`  
5. Run Release Gate sections 2–5  
6. Push to GitHub (Cloudflare auto-deploy)

---

# **VA SOP — “How to update copy across all cities”**

1. Edit **template** or **page set** (never edit `dist/` as source)  
2. Run Release Gate sections 2–5  
3. Push

---

If you want this *even more bulletproof*, next step is I turn sections **3.1–3.6 into a single `npm run verify` script** that fails the build automatically. That’s the real enterprise move because it prevents human error from ever shipping.

