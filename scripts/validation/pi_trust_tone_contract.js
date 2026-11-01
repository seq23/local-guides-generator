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

// Spry brain, "Accident guides / PI law firms" (1 Nov 2026): on theaccidentguides.com
// no "best/top/expert" wording about lawyers, and an explicit "we do not endorse or
// recommend any lawyer" line on every page. Checked on the built PI pages (the footer
// carries the line, scripts/build_city_sites.js PI_NO_ENDORSE_LINE) and on the sources.
const NO_ENDORSE_RE = /we do not endorse or recommend any lawyer/i;
const LAWYER_SUPERLATIVE_RE = /\b(best|top|top-rated|expert|leading|premier)[”"]?\s+(?:[a-z-]+\s+){0,2}(lawyers?|attorneys?|law firms?|firms?|counsel)\b|\bwho (is|are) the best\b/i;

function visibleText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    // A cell, item, heading or paragraph end is a boundary: "Expert witnesses" in one table
    // cell and "Attorney time" in the next are not one phrase.
    .replace(/<\/(td|th|li|p|h[1-6]|div|tr|dt|dd|summary|section|a|button|label|option)>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ");
}

function listHtml(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".html")) out.push(p);
    }
  };
  walk(dir);
  return out;
}

function checkBuiltPiPages(distDir) {
  const issues = [];
  const pages = listHtml(distDir).filter((p) => !/[\\/](admin)[\\/]/.test(p));
  if (!pages.length) return [`dist has no HTML pages to check (${distDir})`];
  for (const p of pages) {
    const text = visibleText(fs.readFileSync(p, "utf8"));
    const rel = path.relative(distDir, p);
    if (!NO_ENDORSE_RE.test(text)) issues.push(`${rel}: missing the "we do not endorse or recommend any lawyer" line`);
    const m = text.match(LAWYER_SUPERLATIVE_RE);
    if (m) issues.push(`${rel}: superlative wording about lawyers: "${m[0]}"`);
  }
  return issues;
}

function run({ site, distDir } = {}) {
  const isPiBuild = /pi_v1\.json$/.test(String((site && site.pageSetFile) || ""));
  const dist = distDir || path.join(__dirname, "..", "..", "dist");
  const distIssues = isPiBuild && fs.existsSync(dist) ? checkBuiltPiPages(dist) : [];
  const sourceIssues = runSources();
  const all = [...distIssues, ...sourceIssues];
  if (all.length) {
    console.error("PI TRUST / TONE FAIL");
    all.slice(0, 40).forEach((issue) => console.error(` - ${issue}`));
    if (all.length > 40) console.error(` ... and ${all.length - 40} more`);
    process.exit(1);
  }
  console.log(`✅ PI TRUST / TONE PASS${isPiBuild ? " (built PI pages checked)" : ""}`);
}

function runSources() {
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

  // Every PI source, the hub and the homepage included.
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const json = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const m = visibleText(json.main_html || '').match(LAWYER_SUPERLATIVE_RE);
    if (m) issues.push(`${file}: superlative wording about lawyers: "${m[0]}"`);
  }
  return issues;
}

module.exports = { run, checkBuiltPiPages, LAWYER_SUPERLATIVE_RE, NO_ENDORSE_RE, REQUIRED_DISCLAIMER, BANNED_PHRASES };
