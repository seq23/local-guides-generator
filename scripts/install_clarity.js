#!/usr/bin/env node
'use strict';
/**
 * Install the Microsoft Clarity tag into every published page in dist/.
 *
 * Purpose:
 * - The five domains built from this repo (theaccidentguides.com,
 *   dentistryguides.com, hormonesivhair.com, neuroevalguides.com,
 *   uscisexam.com) each have a Clarity project, but no tag was ever installed,
 *   so every one of those projects sat on "Almost there!" and recorded zero
 *   sessions. This closes that.
 *
 * Inputs:
 * - data/clarity_projects.json: hostname -> Clarity project id, plus the output
 *   root and any pages to leave untagged.
 *
 * Outputs:
 * - assets/clarity-loader.js in the repo and in the output root.
 * - A <script data-clarity-loader src="/assets/clarity-loader.js" defer> tag in
 *   the <head> of every emitted page.
 *
 * Notes:
 * - The snippet resolves its project id from location.hostname rather than
 *   being hardcoded. scripts/build_all_packs.js renders each of the five packs
 *   into the same dist/ path in turn, and Cloudflare Pages builds each vertical
 *   from this one repo, so a hardcoded id would send one domain's sessions into
 *   another domain's project.
 * - The loader is a SAME-ORIGIN file, not an inline script. An inline loader is
 *   refused by a strict CSP (script-src 'self'), which leaves the tag present
 *   on every page while the project stays empty - indistinguishable from having
 *   no tag at all. That exact bug was found and fixed in
 *   local-guides-citation-velocity. This repo currently serves no CSP, but the
 *   same-origin form costs nothing and survives one being added later.
 * - Idempotent: pages already carrying the marker are left alone, so this runs
 *   safely on every build.
 *
 * Use this when:
 * - Building the site. It is wired into `npm run build` and into
 *   scripts/build_all_packs.js, so it does not need to be run by hand.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = path.join(ROOT, 'data/clarity_projects.json');
const MARKER = 'data-clarity-loader';

if (!fs.existsSync(CONFIG)) {
  console.error(`clarity: missing ${path.relative(ROOT, CONFIG)}`);
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
const projects = cfg.projects || {};
const outDir = path.resolve(ROOT, process.env.PAGES_OUT_DIR || cfg.public_root || 'dist');
// The output root holds only rendered pages, so the guard list stays small.
const skipDirs = new Set([...(cfg.skip_dirs || []), '.git', 'node_modules']);
const skipFiles = new Set(cfg.skip_files || []);

if (!Object.keys(projects).length) {
  console.error('clarity: no projects configured');
  process.exit(1);
}
for (const [host, id] of Object.entries(projects)) {
  // A fabricated id collects nothing and a reused one corrupts the other
  // domain's project, so refuse anything that is not a plausible Clarity id.
  if (!/^[a-z0-9]{8,16}$/.test(String(id))) {
    console.error(`clarity: implausible project id for ${host}: ${id}`);
    process.exit(1);
  }
}
if (!fs.existsSync(outDir)) {
  console.error(`clarity: output root not found: ${path.relative(ROOT, outDir)}`);
  process.exit(1);
}

// One loader for every page. It picks the project by host so a shared build
// cannot report one domain's sessions under another domain's project.
const LOADER_REL = 'assets/clarity-loader.js';
const loaderJs = `(function(w,d,m){var h=(w.location.hostname||"").toLowerCase().replace(/^www\\./,"");var id=m[h];if(!id)return;w.clarity=w.clarity||function(){(w.clarity.q=w.clarity.q||[]).push(arguments)};var s=d.createElement("script");s.async=1;s.src="https://www.clarity.ms/tag/"+id;var f=d.getElementsByTagName("script")[0];f.parentNode.insertBefore(s,f)})(window,document,${JSON.stringify(projects)})`;
const snippet = `<script ${MARKER} src="/${LOADER_REL}" defer></script>`;

let upgraded = 0;
let touched = 0;
let already = 0;
let skipped = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!skipDirs.has(entry.name)) walk(abs); continue; }
    if (!entry.name.endsWith('.html')) continue;
    const rel = path.relative(outDir, abs).split(path.sep).join('/');
    if (skipFiles.has(rel) || skipFiles.has(entry.name)) { skipped += 1; continue; }
    const html = fs.readFileSync(abs, 'utf8');
    // Pages carrying an older inline loader are upgraded rather than skipped.
    // Leaving one would leave a tag a CSP could refuse to execute, which looks
    // exactly like having no tag at all.
    const inlineLoader = new RegExp(`<script ${MARKER}>[\\s\\S]*?<\\/script>`, 'i');
    if (inlineLoader.test(html)) {
      fs.writeFileSync(abs, html.replace(inlineLoader, snippet));
      upgraded += 1;
      continue;
    }
    if (html.includes(MARKER)) { already += 1; continue; }
    if (!/<\/head>/i.test(html)) { skipped += 1; continue; }
    fs.writeFileSync(abs, html.replace(/<\/head>/i, `${snippet}</head>`));
    touched += 1;
  }
}

// The loader must exist at the same origin it is requested from, so write it
// into the output tree before pages are rewritten to reference it. It is also
// written to the repo's assets/ directory: build_city_sites.js copies that
// directory into the output root, so the source copy is what keeps the file
// present on builds that do not run this script last, and what lets link
// validators resolve the reference to a file the repo actually declares.
for (const base of new Set([ROOT, outDir])) {
  const loaderAbs = path.join(base, LOADER_REL);
  fs.mkdirSync(path.dirname(loaderAbs), { recursive: true });
  fs.writeFileSync(loaderAbs, loaderJs + '\n');
}

walk(outDir);

console.log(`clarity: installed on ${touched} page(s); upgraded ${upgraded} from the inline loader; ${already} already correct; ${skipped} skipped`);
