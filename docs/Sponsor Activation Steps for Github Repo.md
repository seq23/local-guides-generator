---

\# Sponsor Activation Guide    
\*\*Edu-Only → Sponsors Live (Repo Reference)\*\*

This document explains exactly how taking sponsors “live” works in the Listings repo, including which files change when a sponsor is ready to take over a city, a state, or an entire site.

\---

\#\# The Repo Has TWO Separate Sponsor Systems

1\) \*\*Ad placements (static blocks)\*\*    
   Controlled by \`%%AD:\<key\>%%\` tokens.

2\) \*\*Next-Steps sponsor CTA flow\*\*    
   \- City: \`/city/next-steps/\`    
   \- PI State: \`/states/XX/next-steps/\`

These systems are related but independent.

\---

\# 1\) Turning “Edu-Only” OFF (Master Gate)

Controlled \*\*per pack\*\* in the page set JSON.

\#\#\# Files  
\- \`data/page\_sets/starter\_v1.json\`  
\- \`data/page\_sets/examples/pi\_v1.json\`  
\- \`data/page\_sets/examples/dentistry\_v1.json\`  
\- \`data/page\_sets/examples/trt\_v1.json\`  
\- \`data/page\_sets/examples/neuro\_v1.json\`  
\- \`data/page\_sets/examples/uscis\_medical\_v1.json\`

\#\#\# Current State  
Each pack includes:  
\- \`"educationOnly": true\`  
\- \`"sponsorship": { "nextStepsEnabled": false, "globalNextStepsEnabled": false }\`

Example (starter):  
\`data/page\_sets/starter\_v1.json\` sets \`educationOnly: true\` and both toggles false.

\#\#\# When You’re Ready to Take Sponsors  
To allow sponsorship at all:  
\- set \`"educationOnly": false\`

Then choose one path:

\*\*Path A — Sponsor-driven (per city):\*\*  
\`\`\`json  
"sponsorship": {  
  "nextStepsEnabled": true,  
  "globalNextStepsEnabled": false  
}

Path B — Global buyout:

"sponsorship": {  
  "nextStepsEnabled": false,  
  "globalNextStepsEnabled": true  
}

Logic enforced in:

scripts/helpers/sponsorship.js

---

# **2\) “Next Steps” Takeover (City \+ PI State)**

Creates:

* /CITY/next-steps/

* PI only: /states/XX/next-steps/

### **Sponsor Must Be “Live”**

A sponsor is live only if ALL are present:

* status: "live"

* firm\_name or name

* official\_site\_url

* intake\_url

Rule enforced in:

scripts/helpers/sponsorship.js → isSponsorLive()

---

## **2A) City Takeover**

### **Primary Source of Truth**

Create or update:

data/listings/\<citySlug\>.json

Example:

{  
  "sponsor": {  
    "status": "live",  
    "firm\_name": "Example Firm",  
    "official\_site\_url": "https://example.com",  
    "intake\_url": "https://example.com/intake"  
  },  
  "listings": \[  
    { "name": "Other Firm 1", "website": "https://..." }  
  \]  
}

This file powers:

* the neutral directory list

* the sponsor CTA module

Loaded by:

scripts/build\_city\_sites.js

---

### **Alternate Option (Next-Steps Only)**

Create:

* data/sponsors/\<citySlug\>.json

Example:

{  
  "nextStepsSponsor": {  
    "status": "live",  
    "name": "Example Sponsor",  
    "official\_site\_url": "https://example.com",  
    "intake\_url": "https://example.com/intake"  
  }  
}

Supported by:

scripts/build\_city\_sites.js → loadNextStepsSponsor()

---

## **2B) PI State Takeover**

You do NOT manually assign a state sponsor file.

The generator:

* scans all cities in the state

* selects the first city with a live sponsor

Logic:

scripts/build\_city\_sites.js → selectPiStateSponsor()

To take over a PI state:

* PI pack must allow next-steps

* at least one city in the state must have a live sponsor

Result:

* /states/XX/next-steps/ generated automatically

---

# **3\) Ad Placements Takeover (Static Blocks)**

Separate from next-steps.

### **Placement Keys**

Injected where %%AD:\<key\>%% tokens exist.

### **Enable / Disable Placements**

* data/ad\_placements.json

### **Sponsor Cards (Global)**

* data/sponsors/global.json

Example card:

{  
  "name": "Sponsor Name",  
  "label": "Advertising",  
  "url": "https://sponsor.com"  
}

Rendered by:

scripts/build\_city\_sites.js

(sponsorCardHtml() \+ injectSponsors())

---

### **City-Specific Overrides (Optional)**

Create:

* data/sponsors/\<citySlug\>.json

Include placement-keyed arrays:

{  
  "city\_hub\_top": \[  
    { "name": "City Sponsor", "label": "Advertising", "url": "https://..." }  
  \]  
}

---

# **4\) Buyout Types (Repo Meaning)**

### **Entire Site Buyout**

* educationOnly: false

* populate data/sponsors/global.json

* optional:

"sponsorship": { "globalNextStepsEnabled": true }

---

### **Total City Buyout**

* live sponsor in data/listings/\<city\>.json

* optional city-specific ad overrides

---

### **State Buyout (PI Only)**

* at least one live city sponsor in the state

* PI next-steps enabled

* state sponsor auto-selected

---

## **End of Document**

\---

\#\#\# Status  
\- ✅ Word-for-word preserved    
\- ✅ Markdown-ready    
\- ✅ Repo-accurate    
\- ✅ Safe to canonize  

If you want, next I can:  
\- split this into \*\*operator vs VA versions\*\*  
\- add a \*\*go-live checklist appendix\*\*  
\- or wire this into your \*\*Execution Playbook\*\* (only with approval)

Standing by.

\---

\# Appendix A — Sponsor Go-Live Checklist    
\*\*Operational, Required, No Exceptions\*\*

This checklist must be completed \*\*before\*\* any sponsor is considered live in production.

\---

\#\# A1) Pre-Flight (Required for Any Sponsorship)

\#\#\# Repo & Pack State  
\- \[ \] Correct page set identified (\`starter\`, \`pi\`, \`dentistry\`, \`trt\`, \`neuro\`, \`uscis\`)  
\- \[ \] Target pack file confirmed:  
  \- \`data/page\_sets/\<pack\>.json\`  
\- \[ \] \`"educationOnly": false\` explicitly set  
\- \[ \] Sponsorship mode chosen:  
  \- \[ \] City next-steps (\`nextStepsEnabled: true\`)  
  \- \[ \] OR global next-steps (\`globalNextStepsEnabled: true\`)  
\- \[ \] Only ONE sponsorship mode enabled per pack

\---

\#\#\# Sponsor Data Integrity  
For every sponsor being activated:

\- \[ \] \`status: "live"\` present  
\- \[ \] Sponsor name present (\`firm\_name\` or \`name\`)  
\- \[ \] \`official\_site\_url\` present and valid  
\- \[ \] \`intake\_url\` present and valid  
\- \[ \] URLs tested manually (no redirects to broken pages)

Failing any of the above \= sponsor does NOT render.

\---

\#\# A2) City-Level Sponsor Go-Live

\#\#\# Required Files (one path only)  
Choose \*\*one\*\*:

\- \[ \] \`data/listings/\<citySlug\>.json\`    
  \*\*OR\*\*  
\- \[ \] \`data/sponsors/\<citySlug\>.json\` (next-steps only)

Do \*\*not\*\* duplicate sponsor objects across both files.

\---

\#\#\# City Validation Checks  
\- \[ \] City page renders without unresolved tokens  
\- \[ \] Sponsor CTA renders only in sponsor zones  
\- \[ \] “Advertising” label visible where applicable  
\- \[ \] Educational content unchanged  
\- \[ \] No outcome language introduced

\---

\#\# A3) PI State-Level Sponsor Go-Live

\#\#\# Preconditions  
\- \[ \] PI pack has sponsorship enabled  
\- \[ \] At least one city in the state has a live sponsor  
\- \[ \] No manual state sponsor file created (not supported)

\---

\#\#\# Validation  
\- \[ \] \`/states/XX/next-steps/\` page generated  
\- \[ \] State hub page includes Next-Steps zone  
\- \[ \] Selected sponsor matches one of the live city sponsors  
\- \[ \] City backlinks remain intact

\---

\#\# A4) Ad Placement (Static Block) Go-Live

\#\#\# Placement Control  
\- \[ \] Placement key enabled in \`data/ad\_placements.json\`  
\- \[ \] Corresponding sponsor card exists in:  
  \- \`data/sponsors/global.json\`  
  \- OR city override in \`data/sponsors/\<citySlug\>.json\`

\---

\#\#\# Ad Card Requirements  
Each ad card must include:  
\- \[ \] Sponsor name  
\- \[ \] \`label: "Advertising"\`  
\- \[ \] Valid destination URL

No unlabeled ads. Ever.

\---

\#\# A5) Validation & Build (Hard Gate)

Before any deploy or ZIP:

\- \[ \] \`npm run validate:all\` → PASS  
\- \[ \] No warnings ignored  
\- \[ \] No unresolved \`%%AD:\*%%\` tokens  
\- \[ \] No schema violations  
\- \[ \] LKG snapshot generated

Failure at this step \= do not ship.

\---

\#\# A6) Post-Go-Live Sanity Check (Manual)

After build or deploy:

\- \[ \] Spot-check at least:  
  \- one city page with sponsor  
  \- one city page without sponsor  
  \- one guide page  
\- \[ \] Confirm sponsor separation from educational content  
\- \[ \] Confirm disclaimers still visible site-wide  
\- \[ \] Confirm no “best / top / recommended” language appears

\---

\#\# A7) Explicit Non-Goals (Reminder)

This checklist does NOT:  
\- guarantee traffic  
\- guarantee AI citation  
\- guarantee conversions

It ensures:  
\- compliance  
\- structural eligibility  
\- long-term durability

\---

\#\# End Appendix A