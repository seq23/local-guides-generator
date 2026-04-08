/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg) {
  const err = new Error(msg);
  err._validation = 'ANSWER_BLOCK_STRENGTH';
  throw err;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name === 'index.html') out.push(full);
  }
  return out;
}

function main() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const dist = path.join(repoRoot, 'dist');
  if (!fs.existsSync(dist)) {
    console.log('ANSWER BLOCK STRENGTH SKIP (dist missing)');
    return;
  }

  const globalExclusions = new Set([
    'about', 'contact', 'disclaimer', 'editorial-policy', 'faq', 'for-providers',
    'methodology', 'next-steps', 'privacy', 'request-assistance', 'personal-injury', 'states'
  ]);

  const targets = walk(dist).filter((file) => {
    const rel = path.relative(dist, file).replace(/\\/g, '/');
    if (rel === 'index.html' || rel === 'guides/index.html') return true;
    if (/^guides\/[^/]+\/index\.html$/i.test(rel)) return true;
    if (/^states\/[a-z]{2}\/index\.html$/i.test(rel)) return true;
    const cityMatch = rel.match(/^([a-z0-9-]+)\/index\.html$/i);
    if (cityMatch) return !globalExclusions.has(cityMatch[1]);
    return false;
  });

  const failures = [];
  for (const file of targets) {
    const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
    const html = fs.readFileSync(file, 'utf8');

    const hasAnswer = /class="[^"]*(answer-block|citation-summary)[^"]*"/i.test(html);
    if (!hasAnswer) {
      failures.push(`${rel}: missing answer block surface`);
      continue;
    }

    const answerPos = html.search(/class="[^"]*(answer-block|citation-summary)[^"]*"/i);
    const evalPos = html.search(/data-eval-framework="true"/i);
    if (evalPos !== -1 && answerPos > evalPos) {
      failures.push(`${rel}: answer block appears after evaluation framework`);
    }

    const answerSlice = html.slice(answerPos, answerPos + 2400).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const decisionTerms = ['when ', 'if ', 'depends', 'typically', 'most useful', 'what matters most'];
    if (!decisionTerms.some((term) => answerSlice.includes(term))) {
      failures.push(`${rel}: answer block missing decision-language signal`);
    }
    const contrastTerms = [' but ', ' however', ' instead', ' versus', ' vs ', 'tradeoff', 'common mistake'];
    if (!contrastTerms.some((term) => answerSlice.includes(term))) {
      failures.push(`${rel}: answer block missing comparison/contrast signal`);
    }

    if (/\/guides\/[^/]+\/index\.html$/i.test(rel) && !/comparison-block/i.test(html)) {
      failures.push(`${rel}: guide detail missing comparison block`);
    }
  }

  if (failures.length) fail('ANSWER BLOCK STRENGTH FAIL\n' + failures.slice(0, 200).join('\n'));
  console.log('✅ ANSWER BLOCK STRENGTH PASS');
}

module.exports = { run: main };

if (require.main === module) main();
