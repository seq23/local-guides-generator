const fs = require('fs');
const path = require('path');

const REQUIRED_OVERRIDE_KEYS = [
  'home:/',
  'faq:/faq/',
  'guides-hub:/guides/',
  'city:*',
  'state:*',
  'guide-detail:*',
  'global-detail:/personal-injury/'
];

const REQUIRED_ROUTE_GROUPS = {
  core_decisions: [
    '/guides/what-to-do-after-an-accident/',
    '/guides/evidence-checklist-after-an-accident/',
    '/guides/recorded-statements-and-insurance-calls/',
    '/guides/personal-injury-fees-explained/',
    '/guides/personal-injury-lawyer-red-flags/',
    '/guides/questions-to-ask-a-personal-injury-lawyer/',
    '/guides/when-to-call-a-personal-injury-lawyer/'
  ],
  major_case_types: [
    '/guides/car-accidents/',
    '/guides/truck-accidents/',
    '/guides/motorcycle-accidents/',
    '/guides/slip-and-fall/',
    '/guides/dog-bites/',
    '/guides/wrongful-death/'
  ],
  secondary_case_types: [
    '/guides/pedestrian-accidents/',
    '/guides/bicycle-accidents/',
    '/guides/rideshare-accidents/',
    '/guides/premises-liability/',
    '/guides/product-liability/',
    '/guides/workplace-injuries/'
  ],
  sensitive_case_types: [
    '/guides/brain-injury/',
    '/guides/spinal-cord-injury/',
    '/guides/medical-malpractice/',
    '/guides/nursing-home-abuse/'
  ],
  long_tail_case_types: [
    '/guides/burn-injury/',
    '/guides/bus-accidents/',
    '/guides/catastrophic-injury/',
    '/guides/bystander-injuries-near-law-enforcement/',
    '/guides/injuries-during-immigration-enforcement/',
    '/guides/vehicle-collisions-near-law-enforcement-activity/'
  ]
};

const REQUIRED_QUERY_FAMILIES = {
  first_actions: /(what to do|first steps|next steps|after an accident)/i,
  evidence: /(evidence|records?|documentation|photos?|witness|timeline)/i,
  fees: /(fee|cost|contingency)/i,
  lawyer_selection: /(red flags|questions to ask|when to call|choose|compare)/i,
  insurance: /(insurance|recorded statements?|insurer|adjuster)/i,
  major_case_types: /(car accident|truck accident|motorcycle accident|slip and fall|dog bite|wrongful death)/i,
  sensitive_case_types: /(brain injury|spinal cord injury|medical malpractice|nursing home abuse)/i,
  long_tail_case_types: /(burn injury|bus accident|catastrophic injury|law enforcement|immigration enforcement)/i
};

function normalizeItems(value) {
  const out = [];
  if (!value || typeof value !== 'object') return out;
  for (const field of ['items', 'addItems']) {
    if (!Array.isArray(value[field])) continue;
    for (const item of value[field]) {
      if (!item || typeof item !== 'object') continue;
      out.push(item);
    }
  }
  return out;
}

function run() {
  const repoRoot = path.join(__dirname, '..', '..');
  const fp = path.join(repoRoot, 'data', 'community', 'query_compiler', 'pi.json');
  const issues = [];

  if (!fs.existsSync(fp)) {
    console.error('PI QUERY COMPLETENESS FAIL');
    console.error(' - data/community/query_compiler/pi.json is missing');
    process.exit(1);
  }

  const json = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const overrides = json && json.overrides && typeof json.overrides === 'object' ? json.overrides : null;
  if (!overrides) {
    console.error('PI QUERY COMPLETENESS FAIL');
    console.error(' - pi.json missing overrides object');
    process.exit(1);
  }

  for (const key of REQUIRED_OVERRIDE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(overrides, key)) {
      issues.push(`missing required override key ${key}`);
    }
  }

  const items = Object.values(overrides).flatMap(normalizeItems);
  const hrefs = new Set(items.map((item) => String(item.href || '').trim()));
  const queryCorpus = items.map((item) => String(item.query || '').trim()).join('\n');

  for (const [group, routes] of Object.entries(REQUIRED_ROUTE_GROUPS)) {
    const missing = routes.filter((route) => !hrefs.has(route));
    if (missing.length) issues.push(`${group}: missing routes ${missing.join(', ')}`);
  }

  for (const [family, pattern] of Object.entries(REQUIRED_QUERY_FAMILIES)) {
    if (!pattern.test(queryCorpus)) issues.push(`missing query family coverage: ${family}`);
  }

  const uniqueRoutes = new Set(Array.from(hrefs).filter((href) => href.startsWith('/guides/')));
  if (uniqueRoutes.size < 28) {
    issues.push(`too few owned PI guide destinations in query compiler: found ${uniqueRoutes.size}, expected at least 28`);
  }

  if (issues.length) {
    console.error('PI QUERY COMPLETENESS FAIL');
    issues.forEach((issue) => console.error(` - ${issue}`));
    process.exit(1);
  }

  console.log('✅ PI QUERY COMPLETENESS PASS');
}

module.exports = { run };
