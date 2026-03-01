/* eslint-disable no-console */

// CONTRACT:
//  - Hard-fail if the Connection Bubble is missing on REQUIRED pages.
//  - Required pages are discovered from dist/ output:
//      * Global home: dist/index.html
//      * Global guides hub: dist/guides/index.html (if present)
//      * City hubs: dist/<citySlug>/index.html (all city directories)
//      * PI state hubs: dist/states/<ST>/index.html (if present)
//  - Hard-fail if duplicated on required pages.
//  - Non-required pages containing the bubble are WARNING-ONLY (never fail).

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function countBubbleMarkers(html) {
  // Count only actual DOM marker usage (exclude JS string literals).
  const m = String(html || '').match(/<section[^>]*data-connection-bubble\s*=\s*"true"/gi);
  return m ? m.length : 0;
}

function listCityHubIndexHtmlPaths(distDir) {
  const out = [];
  const entries = fs.readdirSync(distDir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const name = e.name;
    // Skip known global folders.
    if (name === 'assets') continue;
    if (name === 'guides') continue;
    if (name === 'states') continue;
    if (name.startsWith('_')) continue;
    const p = path.join(distDir, name, 'index.html');
    if (!exists(p)) continue;
    // City hub pages are the ONLY top-level routes with body[data-city] equal to the directory name.
    // This avoids misclassifying global routes like /about/, /contact/, /privacy/.
    try {
      const html = readText(p);
      const m = html.match(/<body[^>]*data-city\s*=\s*"([^"]*)"/i);
      const dataCity = m ? String(m[1] || '') : '';
      if (dataCity && dataCity === name) {
        out.push(p);
      }
    } catch (_) {
      // ignore
    }
  }
  return out;
}

function listStateHubIndexHtmlPaths(distDir) {
  const out = [];
  const statesDir = path.join(distDir, 'states');
  if (!exists(statesDir)) return out;
  const entries = fs.readdirSync(statesDir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const ab = e.name;
    const p = path.join(statesDir, ab, 'index.html');
    if (!exists(p)) continue;
    out.push(p);
  }
  return out;
}

function walkHtmlFiles(dir) {
  const out = [];
  function walk(p) {
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const child of fs.readdirSync(p)) walk(path.join(p, child));
      return;
    }
    if (p.endsWith('.html')) out.push(p);
  }
  walk(dir);
  return out;
}

function run() {
  const distDir = path.join(REPO_ROOT, 'dist');
  if (!exists(distDir)) {
    console.error('CONNECTION BUBBLE CONTRACT FAIL: dist/ is missing. Build first.');
    process.exit(1);
  }

  const required = new Map(); // path -> label
  const warnings = [];
  const failures = [];

  // Required global pages
  const home = path.join(distDir, 'index.html');
  if (exists(home)) required.set(home, 'global_home');

  const guides = path.join(distDir, 'guides', 'index.html');
  if (exists(guides)) required.set(guides, 'global_guides');

  // Required city hubs (all)
  for (const p of listCityHubIndexHtmlPaths(distDir)) {
    required.set(p, 'city_hub');
  }

  // Required state hubs (if present)
  for (const p of listStateHubIndexHtmlPaths(distDir)) {
    required.set(p, 'state_hub');
  }

  // Validate required pages: exactly one bubble marker.
  for (const [p, label] of required.entries()) {
    const html = readText(p);
    const n = countBubbleMarkers(html);
    if (n === 0) failures.push(`MISSING bubble on required page (${label}): ${path.relative(REPO_ROOT, p)}`);
    if (n > 1) failures.push(`DUPLICATE bubble (${n}) on required page (${label}): ${path.relative(REPO_ROOT, p)}`);
  }

  // Warning-only: bubble on non-required pages
  const allHtml = walkHtmlFiles(distDir);
  for (const p of allHtml) {
    if (required.has(p)) continue;
    const html = readText(p);
    const n = countBubbleMarkers(html);
    if (n > 0) warnings.push(`WARNING: bubble present on non-required page (${n}): ${path.relative(REPO_ROOT, p)}`);
  }

  if (warnings.length) {
    for (const w of warnings.slice(0, 30)) console.log(w);
    if (warnings.length > 30) console.log(`... (${warnings.length - 30} more warnings)`);
  }

  if (failures.length) {
    console.error('CONNECTION BUBBLE CONTRACT FAIL');
    for (const f of failures.slice(0, 60)) console.error(' - ' + f);
    if (failures.length > 60) console.error(`... (${failures.length - 60} more failures)`);
    process.exit(1);
  }

  console.log('✅ connection bubble contract pass');
}

module.exports = { run };
