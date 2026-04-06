const fs = require('fs');
const path = require('path');

const RULES = {
  dentistry: { dir: 'data/page_sets/examples/dentistry_global_pages', minCount: 16, minWords: 220 },
  neuro: { dir: 'data/page_sets/examples/neuro_global_pages', minCount: 26, minWords: 220 },
  trt: { dir: 'data/page_sets/examples/trt_global_pages', minCount: 40, minWords: 220 },
  pi: { dir: 'data/page_sets/examples/pi_global_pages', minCount: 29, minWords: 220 }
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

function run() {
  const repoRoot = path.join(__dirname, '..', '..');
  const issues = [];
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
      const words = wordsFromHtml(json.main_html || '');
      if (words < rule.minWords) issues.push(`${vertical}: ${file} is thin (${words} words)`);
    });
  });

  if (issues.length) {
    console.error('VERTICAL GUIDE DEPTH FAIL');
    issues.forEach((msg) => console.error(` - ${msg}`));
    process.exit(1);
  }
  console.log('✅ VERTICAL GUIDE DEPTH PASS');
}

module.exports = { run };
