#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const distRoot = path.join(repoRoot, 'dist');

function fail(msg) {
  console.error('❌ GOLDEN CONTRACT FAIL:', msg);
  process.exit(1);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readSite() {
  const p = path.join(repoRoot, 'data', 'site.json');
  if (!fs.existsSync(p)) fail('data/site.json missing. Run prepare/build first.');
  return readJson(p);
}

function deriveVerticalKey(pageSetFile) {
  const base = path.basename(pageSetFile || '');
  const noExt = base.replace(/\.json$/, '');
  return noExt.replace(/_v\d+$/, '');
}

function isPI(verticalKey) {
  return verticalKey === 'pi';
}

const GOLDEN_CITIES = [
  'atlanta-ga',
  'charlotte-nc',
  'chicago-il',
  'dallas-tx',
  'los-angeles-ca',
  'memphis-tn',
  'new-york-city-ny',
  'orlando-fl',
  'philadelphia-pa',
  'phoenix-az',
];

function count(html, needle) {
  return (html.match(new RegExp(needle, 'g')) || []).length;
}

function mustContain(html, needle, label) {
  if (!html.includes(needle)) fail(`${label} missing marker: ${needle}`);
}

function mustNotContain(html, needle, label) {
  if (html.includes(needle)) fail(`${label} must NOT contain: ${needle}`);
}

function mustOrder(html, a, b, label) {
  const ia = html.indexOf(a);
  const ib = html.indexOf(b);
  if (ia === -1) fail(`${label} missing marker: ${a}`);
  if (ib === -1) fail(`${label} missing marker: ${b}`);
  if (ib <= ia) fail(`${label} order violation: "${b}" must appear after "${a}"`);
}

function validateAdsExactlyThree(html, label) {
  const top = count(html, 'data-sponsored-placement="top"');
  const mid = count(html, 'data-sponsored-placement="mid"');
  const bottom = count(html, 'data-sponsored-placement="bottom"');
  if (top !== 1 || mid !== 1 || bottom !== 1) {
    fail(`${label} ad blocks must be exactly 1 top / 1 mid / 1 bottom (got top=${top}, mid=${mid}, bottom=${bottom})`);
  }
}

function validateCity(citySlug, verticalKey) {
  const fp = path.join(distRoot, citySlug, 'index.html');
  if (!fs.existsSync(fp)) fail(`page missing: dist/${citySlug}/index.html (run build first)`);
  const html = fs.readFileSync(fp, 'utf8');
  const label = `city (${citySlug})`;

  // Ads (monetization contract)
  validateAdsExactlyThree(html, label);

  // Universal contract blocks
  mustContain(html, 'data-eval-framework="true"', label);
  mustContain(html, 'data-llm-bait="question"', label);
  mustContain(html, 'data-faq="true"', label);
  mustContain(html, 'data-guides="true"', label);

  // Start-here anchors
  mustContain(html, 'href="/guides/#costs"', label);
  mustContain(html, 'href="/guides/#timeline"', label);
  mustContain(html, 'href="/guides/#questions"', label);
  mustContain(html, 'href="/guides/#red-flags"', label);

  // LLM bait must appear BEFORE providers/listings for ALL city pages
  if (isPI(verticalKey)) {
    // PI: directory; NO state lookup
    mustContain(html, 'class="pi-home-directory"', label);
    mustOrder(html, 'data-llm-bait="question"', 'class="pi-home-directory"', label);
    mustNotContain(html, 'data-state-lookup="true"', label);
  } else {
    // non-PI: example providers + state lookup
    mustContain(html, 'data-example-providers="true"', label);
    mustOrder(html, 'data-llm-bait="question"', 'data-example-providers="true"', label);
    mustContain(html, 'data-state-lookup="true"', label);
  }

  // Footer disclosure must be present (contract phrases)
  mustContain(html, 'Advertising disclosure.', label);
  mustContain(html, 'No guarantees or endorsements.', label);
}

function main() {
  const site = readSite();
  const verticalKey = deriveVerticalKey(site.pageSetFile || '');

  // starter_v1 is TRAINING ONLY; do not block publishing (validate_tbs exits early).

  for (const city of GOLDEN_CITIES) validateCity(city, verticalKey);
  console.log('✅ GOLDEN CONTRACT PASS');
}

main();
