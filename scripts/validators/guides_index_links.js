#!/usr/bin/env node
/*
  Hard-fail if the Guides index page does not link to every generated guide.

  Rule:
    For every folder dist/guides/<slug>/index.html (excluding "next-steps" and
    excluding the root dist/guides/index.html), dist/guides/index.html must
    contain an href to "/guides/<slug>/".

  This enforces the user-facing discoverability contract:
    If a guide exists, it must be linked in the Guides page.
*/

const fs = require('fs');
const path = require('path');

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, 'dist');
const guidesDir = path.join(distDir, 'guides');
const guidesIndex = path.join(guidesDir, 'index.html');

if (!fs.existsSync(guidesIndex)) {
  die('GUIDES INDEX LINKS FAIL: dist/guides/index.html not found. Build must run before validation.');
}

const indexHtml = fs.readFileSync(guidesIndex, 'utf8');

if (!fs.existsSync(guidesDir) || !fs.statSync(guidesDir).isDirectory()) {
  die('GUIDES INDEX LINKS FAIL: dist/guides/ folder missing.');
}

const entries = fs.readdirSync(guidesDir, { withFileTypes: true });
const guideSlugs = entries
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .filter(name => name !== 'next-steps');

const missing = [];
for (const slug of guideSlugs) {
  const guideIndex = path.join(guidesDir, slug, 'index.html');
  if (!fs.existsSync(guideIndex)) continue; // ignore non-guide folders
  const href = `/guides/${slug}/`;
  if (!indexHtml.includes(`href="${href}"`) && !indexHtml.includes(`href='${href}'`)) {
    missing.push(href);
  }
}

if (missing.length) {
  die(`GUIDES INDEX LINKS FAIL: Guides index is missing links for ${missing.length} guide(s):\n- ${missing.join('\n- ')}`);
}

console.log(`✅ GUIDES INDEX LINKS PASS (${guideSlugs.length} guide folders checked)`);
