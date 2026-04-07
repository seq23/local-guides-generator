const fs = require('fs');
const path = require('path');

const RULES = {
  dentistry: { dir: 'data/page_sets/examples/dentistry_global_pages', minCount: 16, minWords: 260 },
  neuro: { dir: 'data/page_sets/examples/neuro_global_pages', minCount: 26, minWords: 220 },
  trt: { dir: 'data/page_sets/examples/trt_global_pages', minCount: 40, minWords: 220 },
  pi: { dir: 'data/page_sets/examples/pi_global_pages', minCount: 29, minWords: 260 },
  uscis_medical: { dir: 'data/page_sets/examples/uscis_medical_global_pages', minCount: 8, minWords: 220 }
};

function wordsFromHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean).length;
}

const WORD_WARN_BAND = 20;

function run() {
  const repoRoot = path.join(__dirname, '..', '..');
  const issues = [];
  const warnings = [];
  Object.entries(RULES).forEach(([vertical, rule]) => {
    const dir = path.join(repoRoot, rule.dir);
    if (!fs.existsSync(dir)) {
      issues.push(`${vertical}: missing guide directory ${rule.dir}`);
      return;
    }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !['guides.json', 'home.json'].includes(f));
    if (files.length < rule.minCount) issues.push(`${vertical}: expected at least ${rule.minCount} guide/detail files, found ${files.length}`);
    files.forEach((file) => {
      const fp = path.join(dir, file);
      const json = JSON.parse(fs.readFileSync(fp, 'utf8'));
      if (!String(json.route || '').startsWith('/')) issues.push(`${vertical}: ${file} missing route`);
      if (!String(json.title || '').trim()) issues.push(`${vertical}: ${file} missing title`);
      const html = String(json.main_html || '');
      const words = wordsFromHtml(html);
      const failBelow = rule.minWords - WORD_WARN_BAND;
      if (words < failBelow) {
        issues.push(`${vertical}: ${file} is below fail floor (${words} < ${failBelow} words)`);
      } else if (words < rule.minWords) {
        warnings.push(`${vertical}: ${file} is below target but within tolerance (${words} < ${rule.minWords} words)`);
      }
      if (vertical === 'dentistry') {
        ['definition', 'cost', 'recovery', 'candidacy', 'questions', 'red-flags', 'next-steps'].forEach((sectionId) => {
          if (!html.includes(`id=\"${sectionId}\"`)) issues.push(`${vertical}: ${file} missing #${sectionId}`);
        });
      }
      if (vertical === 'neuro') {
        ['definition', 'pricing', 'trust', 'process', 'questions', 'next-steps'].forEach((sectionId) => {
          if (!html.includes(`id="${sectionId}"`)) issues.push(`${vertical}: ${file} missing #${sectionId}`);
        });
      }
      if (vertical === 'uscis_medical') {
        ['quick-answer', 'cost', 'documents', 'process', 'questions', 'next-steps'].forEach((sectionId) => {
          if (!html.includes(`id="${sectionId}"`)) issues.push(`${vertical}: ${file} missing #${sectionId}`);
        });
      }
      if (vertical === 'trt') {
        ['definition', 'cost', 'safety', 'candidacy', 'questions', 'red-flags', 'next-steps'].forEach((sectionId) => {
          if (!html.includes(`id="${sectionId}"`)) issues.push(`${vertical}: ${file} missing #${sectionId}`);
        });
      }
      if (vertical === 'pi') {
        ['definition', 'when-to-call', 'cost', 'evidence', 'questions', 'red-flags', 'next-steps'].forEach((sectionId) => {
          if (!html.includes(`id="${sectionId}"`)) issues.push(`${vertical}: ${file} missing #${sectionId}`);
        });
        if (!/(timing|24 to 72 hours|24-72|urgent|early)/i.test(html)) issues.push(`${vertical}: ${file} missing timing or urgency language`);
        if (!/(photo|record|timeline|witness|medical|document)/i.test(html)) issues.push(`${vertical}: ${file} missing evidence-specific language`);
        if (!/(do not|don't|avoid|be careful|slow down|cautious|pressure)/i.test(html)) issues.push(`${vertical}: ${file} missing what-not-to-do / caution language`);
      }
    });
  });

  if (warnings.length) {
    console.warn('VERTICAL GUIDE DEPTH WARNINGS');
    warnings.forEach((msg) => console.warn(` - ${msg}`));
  }

  if (issues.length) {
    console.error('VERTICAL GUIDE DEPTH FAIL');
    issues.forEach((msg) => console.error(` - ${msg}`));
    process.exit(1);
  }
  console.log('✅ VERTICAL GUIDE DEPTH PASS');
}

module.exports = { run };
