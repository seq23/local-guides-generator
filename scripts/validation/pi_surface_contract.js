const fs = require('fs');
const path = require('path');

function readJson(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function requireIncludes(text, needles, label, issues) {
  needles.forEach((needle) => {
    if (!String(text || '').includes(needle)) issues.push(`${label}: missing ${needle}`);
  });
}

function run() {
  const repoRoot = path.join(__dirname, '..', '..');
  const dir = path.join(repoRoot, 'data', 'page_sets', 'examples', 'pi_global_pages');
  const home = readJson(path.join(dir, 'home.json'));
  const guides = readJson(path.join(dir, 'guides.json'));
  const issues = [];

  requireIncludes(home.main_html, [
    'data-pi-home-callout="true"',
    'data-pi-home-routing="true"',
    'data-pi-home-case-routing="true"',
    'data-pi-home-markets="true"',
    '/guides/what-to-do-after-an-accident/',
    '/guides/evidence-checklist-after-an-accident/',
    '/guides/recorded-statements-and-insurance-calls/',
    '/guides/personal-injury-fees-explained/',
    '/guides/personal-injury-lawyer-red-flags/',
    '/guides/questions-to-ask-a-personal-injury-lawyer/'
  ], 'pi home', issues);

  requireIncludes(guides.main_html, [
    'data-pi-guides-hero="true"',
    'data-pi-guides-routing="true"',
    'data-pi-guides-case-types="true"',
    '/guides/what-to-do-after-an-accident/',
    '/guides/evidence-checklist-after-an-accident/',
    '/guides/recorded-statements-and-insurance-calls/',
    '/guides/personal-injury-fees-explained/',
    '/guides/personal-injury-lawyer-red-flags/',
    '/guides/questions-to-ask-a-personal-injury-lawyer/',
    '/guides/car-accidents/',
    '/guides/truck-accidents/',
    '/guides/slip-and-fall/',
    '/guides/brain-injury/',
    '/guides/medical-malpractice/'
  ], 'pi guides hub', issues);

  if (issues.length) {
    console.error('PI SURFACE CONTRACT FAIL');
    issues.forEach((issue) => console.error(` - ${issue}`));
    process.exit(1);
  }

  console.log('✅ PI SURFACE CONTRACT PASS');
}

module.exports = { run };
