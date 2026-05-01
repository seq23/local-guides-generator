const fs = require('fs');
const path = require('path');

const REQUIRED_DISCLAIMER = 'Educational only. Not legal advice. No endorsements or rankings.';
const BANNED_PHRASES = [
  'guaranteed win',
  'guaranteed outcome',
  'guarantee you',
  'million-dollar',
  'call now',
  'act now',
  'limited time',
  'we win big'
];
const SENSITIVE_GUIDES = [
  'brain-injury.json',
  'spinal-cord-injury.json',
  'medical-malpractice.json',
  'nursing-home-abuse.json',
  'wrongful-death.json',
  'catastrophic-injury.json',
  'burn-injury.json',
  'bystander-injuries-near-law-enforcement.json',
  'injuries-during-immigration-enforcement.json',
  'vehicle-collisions-near-law-enforcement-activity.json'
];

function run() {
  const repoRoot = path.join(__dirname, '..', '..');
  const dir = path.join(repoRoot, 'data', 'page_sets', 'examples', 'pi_global_pages');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !['guides.json', 'home.json'].includes(f));
  const issues = [];

  for (const file of files) {
    const fp = path.join(dir, file);
    const json = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const html = String(json.main_html || '');
    const lower = html.toLowerCase();

    if (!html.includes(REQUIRED_DISCLAIMER)) {
      issues.push(`${file}: missing PI disclaimer`);
    }

    for (const phrase of BANNED_PHRASES) {
      if (lower.includes(phrase)) issues.push(`${file}: banned hype phrase "${phrase}"`);
    }

    if (SENSITIVE_GUIDES.includes(file)) {
      if (!/(safety|stability|needs)[^<]{0,80}?comes first/i.test(html)) {
        issues.push(`${file}: sensitive PI page missing safety-first language`);
      }
      if (!/record|timeline|document/i.test(html)) {
        issues.push(`${file}: sensitive PI page missing records/timeline language`);
      }
      if (!/cost|fee/i.test(html)) {
        issues.push(`${file}: sensitive PI page missing cost clarity language`);
      }
    }
  }

  if (issues.length) {
    console.error('PI TRUST / TONE FAIL');
    issues.forEach((issue) => console.error(` - ${issue}`));
    process.exit(1);
  }

  console.log('✅ PI TRUST / TONE PASS');
}

module.exports = { run };
