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

function readPageSet(pageSetFile) {
  // pageSetFile is usually like: "examples/trt_v1.json"
  const p = path.join(repoRoot, 'data', 'page_sets', pageSetFile);
  if (!fs.existsSync(p)) fail(`pageSetFile missing: data/page_sets/${pageSetFile}`);
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

function validateGuideHasTopBottom(html, label) {
  const top = count(html, 'data-sponsored-placement="top"');
  const bottom = count(html, 'data-sponsored-placement="bottom"');
  const mid = count(html, 'data-sponsored-placement="mid"');
  if (top !== 1 || bottom !== 1 || mid !== 0) {
    fail(`${label} ad blocks must be exactly 1 top / 0 mid / 1 bottom (got top=${top}, mid=${mid}, bottom=${bottom})`);
  }
}

function validateStateHasTopMid(html, label) {
  const top = count(html, 'data-sponsored-placement="top"');
  const mid = count(html, 'data-sponsored-placement="mid"');
  const bottom = count(html, 'data-sponsored-placement="bottom"');
  if (top !== 1 || mid !== 1 || bottom !== 0) {
    fail(`${label} ad blocks must be exactly 1 top / 1 mid / 0 bottom (got top=${top}, mid=${mid}, bottom=${bottom})`);
  }
}

function validateOneGuideSample() {
  const guidesDir = path.join(distRoot, 'guides');
  if (!fs.existsSync(guidesDir)) return;
  const entries = fs.readdirSync(guidesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(n => n && n !== 'assets');
  for (const slug of entries) {
    const fp = path.join(guidesDir, slug, 'index.html');
    if (!fs.existsSync(fp)) continue;
    const html = fs.readFileSync(fp, 'utf8');
    validateGuideHasTopBottom(html, `guide (${slug})`);
    return;
  }
}

function validatePIStateSampleIfPresent() {
  const tx = path.join(distRoot, 'states', 'tx', 'index.html');
  if (!fs.existsSync(tx)) return;
  const html = fs.readFileSync(tx, 'utf8');
  validateStateHasTopMid(html, 'state (tx)');
}

function validateCity(citySlug, verticalKey, pageSet) {
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
  const directoryEnabled = !!(pageSet.cityFeatures && pageSet.cityFeatures.directory);
  const stateLookupEnabled = !!(pageSet.cityFeatures && pageSet.cityFeatures.stateLookup);

  if (isPI(verticalKey)) {
    // PI: directory; NO state lookup
    mustContain(html, 'class="pi-home-directory"', label);
    mustOrder(html, 'data-llm-bait="question"', 'class="pi-home-directory"', label);
    mustNotContain(html, 'data-state-lookup="true"', label);
  } else {
    // non-PI: may be example providers OR may not (depends on pack)
    if (directoryEnabled) {
      // Example-providers block (when directory is enabled)
      mustContain(html, 'data-example-providers="true"', label);
      mustOrder(html, 'data-llm-bait="question"', 'data-example-providers="true"', label);
    }
    if (stateLookupEnabled) {
      mustContain(html, 'data-state-lookup="true"', label);
    }
  }

  // Footer disclosure must be present (contract phrases)
  mustContain(html, 'Advertising disclosure.', label);
  mustContain(html, 'No guarantees or endorsements.', label);
}

function main() {
  const site = readSite();
  const verticalKey = deriveVerticalKey(site.pageSetFile || '');
  const pageSet = readPageSet(site.pageSetFile || '');

  // starter_v1 is TRAINING ONLY; do not block publishing (validate_tbs exits early).
  for (const city of GOLDEN_CITIES) validateCity(city, verticalKey, pageSet);

  // Additional monetization contract checks (sales parity):
  // - At least one guide page must have exactly Top + Bottom (no Mid).
  // - If a PI state sample exists, it must have exactly Top + Mid (no Bottom).
  validateOneGuideSample();
  validatePIStateSampleIfPresent();

  console.log('✅ GOLDEN CONTRACT PASS');
}

main();
