Totally fair — and no, this doesn’t have to “interfere” with the template at all.

**Good news:** adding an automated `verify` step is **additive**. It doesn’t change templates, content, or the generated site. It just runs checks **after** `npm run build` and fails if something’s off.

Since you already downloaded v5 and don’t want me to reprint another ZIP right now, here’s the cleanest way to add it later (in your new repo) with **2 small files \+ a tiny package.json change**.

---

# **What you’ll add (does not touch templates)**

* `scripts/verify_release_gate.js` (new file)  
* Update `package.json` to add `verify` commands

That’s it.

---

# **Step-by-step: add automated verification (safe \+ optional)**

## **Step 1 — Create `scripts/verify_release_gate.js`**

In your repo, create this file:

/\*\*  
 \* Release Gate Verifier  
 \* \- Runs simple checks against /dist after build.  
 \* \- Does NOT modify any files.  
 \* \- Exits non-zero on failure.  
 \*/

const fs \= require("fs");  
const path \= require("path");

const DIST\_DIR \= path.join(\_\_dirname, "..", "dist");

function fail(msg) {  
  console.error(\`\\n❌ VERIFY FAILED: ${msg}\\n\`);  
  process.exit(1);  
}

function ok(msg) {  
  console.log(\`✅ ${msg}\`);  
}

function exists(p) {  
  try {  
    fs.accessSync(p, fs.constants.F\_OK);  
    return true;  
  } catch {  
    return false;  
  }  
}

function readAllFiles(dir) {  
  const results \= \[\];  
  const entries \= fs.readdirSync(dir, { withFileTypes: true });  
  for (const e of entries) {  
    const full \= path.join(dir, e.name);  
    if (e.isDirectory()) results.push(...readAllFiles(full));  
    else results.push(full);  
  }  
  return results;  
}

function countMatches(files, regex) {  
  let count \= 0;  
  for (const f of files) {  
    const txt \= fs.readFileSync(f, "utf8");  
    const m \= txt.match(regex);  
    if (m) count \+= m.length;  
  }  
  return count;  
}

function filesContaining(files, regex) {  
  const hits \= \[\];  
  for (const f of files) {  
    const txt \= fs.readFileSync(f, "utf8");  
    if (regex.test(txt)) hits.push(f);  
  }  
  return hits;  
}

// \--- Guardrails \---  
if (\!exists(DIST\_DIR)) fail(\`dist/ not found. Run 'npm run build' first.\`);

const allFiles \= readAllFiles(DIST\_DIR).filter((f) \=\> f.endsWith(".html"));

// 1\) No placeholders  
const placeholderHits \= filesContaining(allFiles, /{{|%%/);  
if (placeholderHits.length) {  
  fail(\`Found placeholder tokens in ${placeholderHits.length} HTML files (e.g., ${placeholderHits\[0\]}).\`);  
}  
ok("No placeholder tokens found ({{ or %%).");

// 2\) Methodology page exists  
const methodologyPath \= path.join(DIST\_DIR, "methodology", "index.html");  
if (\!exists(methodologyPath)) fail("Missing dist/methodology/index.html");  
ok("Global /methodology/ page exists.");

// 3\) Footer links present (at least once per page set; we do a robust check)  
const requiredFooterSnippets \= \[  
  '/disclaimer/',  
  '/editorial-policy/',  
  '/privacy/',  
  'id="year"'  
\];

for (const snippet of requiredFooterSnippets) {  
  const hits \= countMatches(allFiles, new RegExp(snippet.replace(/\[.\*+?^${}()|\[\\\]\\\\\]/g, '\\\\$&'), "g"));  
  if (hits \=== 0\) fail(\`Footer requirement missing across dist: ${snippet}\`);  
  ok(\`Footer requirement present: ${snippet}\`);  
}

// 4\) Methodology link appears broadly  
const methodologyLinkHits \= countMatches(allFiles, /href="\\/methodology\\/"/g);  
if (methodologyLinkHits \< 10\) {  
  fail(\`Methodology link appears too few times (${methodologyLinkHits}). Expected it sitewide.\`);  
}  
ok(\`Methodology links detected across site: ${methodologyLinkHits}\`);

// 5\) Advertising label exists somewhere (not every page necessarily, but should exist)  
const advertisingHits \= countMatches(allFiles, /Advertising/g);  
if (advertisingHits \=== 0\) fail("No 'Advertising' labels found anywhere in dist.");  
ok(\`Advertising labels detected: ${advertisingHits}\`);

// 6\) City hub “best” phrase should not use curly quotes  
// We’ll fail if we find the specific smart-quote pattern “best” near the hub answer box.  
const smartQuoteBestHits \= countMatches(allFiles, /\[“”\]best\[“”\]/g);  
if (smartQuoteBestHits \> 0\) {  
  fail(\`Found smart quotes around best (${smartQuoteBestHits} occurrences). Use plain quotes or none.\`);  
}  
ok("No smart quotes around the word best.");

// 7\) Empty-directory protection message exists (at least once)  
const emptyStateHits \= countMatches(allFiles, /No firms are listed for this market yet/g);  
if (emptyStateHits \=== 0\) {  
  fail("Empty-state message not found. Cities without listings may render blank directories.");  
}  
ok(\`Empty-state message present: ${emptyStateHits}\`);

// 8\) Safety: banned endorsement phrases in listing cards (basic heuristic)  
// We allow the \*question\* phrasing on FAQ/hubs, but we don't want "we recommend" etc.  
const banned \= /(we recommend|our pick|top-rated firm|best firm|\#1 firm|guaranteed results)/i;  
const bannedHits \= filesContaining(allFiles, banned);  
if (bannedHits.length) {  
  fail(\`Found banned endorsement-style language in dist (e.g., ${bannedHits\[0\]}).\`);  
}  
ok("No obvious endorsement-style language detected.");

console.log("\\n🎉 VERIFY PASSED: Release Gate checks OK.\\n");  
process.exit(0);

## **Step 2 — Update `package.json` scripts**

Open `package.json` and add these scripts (keep your existing ones):

{  
  "scripts": {  
    "build": "node scripts/build\_city\_sites.js",  
    "verify": "node scripts/verify\_release\_gate.js",  
    "build:verify": "npm run build && npm run verify"  
  }  
}

## **Step 3 — Run it locally (optional)**

npm run build:verify

## **Step 4 — (Optional) Make Cloudflare enforce it later**

When you’re ready (not now), you can change Cloudflare build command to:

* `npm ci && npm run build:verify`

That ensures nothing can deploy if verification fails.

---

# **Why this won’t mess up your template**

* It **doesn’t edit** any templates or generated HTML.  
* It **only reads** `dist/` and exits with pass/fail.  
* If you don’t wire it into Cloudflare yet, it’s just a tool you can run manually.

---

If you want the safest approach right now: **add the file \+ scripts**, but keep Cloudflare build command as just `npm run build` until you’re comfortable. Then flip the switch later.

