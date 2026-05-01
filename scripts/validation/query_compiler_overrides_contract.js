const fs = require('fs');
const path = require('path');

const EXPECTED = ['dentistry', 'neuro', 'trt', 'pi', 'uscis_medical'];

function run() {
  const repoRoot = path.join(__dirname, '..', '..');
  const base = path.join(repoRoot, 'data', 'community', 'query_compiler');
  const problems = [];

  for (const vertical of EXPECTED) {
    const fp = path.join(base, `${vertical}.json`);
    if (!fs.existsSync(fp)) {
      problems.push(`missing query compiler override file: data/community/query_compiler/${vertical}.json`);
      continue;
    }
    const json = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const overrides = json && json.overrides && typeof json.overrides === 'object' ? json.overrides : null;
    if (!overrides) {
      problems.push(`${vertical}.json missing overrides object`);
      continue;
    }
    const keys = Object.keys(overrides);
    if (keys.length < 2) problems.push(`${vertical}.json has too few override keys`);
    let totalItems = 0;
    for (const [key, value] of Object.entries(overrides)) {
      if (!value || typeof value !== 'object') {
        problems.push(`${vertical}.json override ${key} is not an object`);
        continue;
      }
      for (const field of ['items', 'addItems']) {
        if (!Array.isArray(value[field])) continue;
        totalItems += value[field].length;
        value[field].forEach((item, idx) => {
          if (!item || typeof item !== 'object') problems.push(`${vertical}.json ${key} ${field}[${idx}] is invalid`);
          else {
            if (!String(item.query || '').trim()) problems.push(`${vertical}.json ${key} ${field}[${idx}] missing query`);
            const href = String(item.href || '');
            if (!(href.startsWith('/') || href.includes('{route}'))) problems.push(`${vertical}.json ${key} ${field}[${idx}] href must start with / or include {route}`);
          }
        });
      }
    }
    if (totalItems < 4) problems.push(`${vertical}.json has too few override items`);
  }

  if (problems.length) {
    console.error('QUERY COMPILER OVERRIDES FAIL');
    problems.forEach((p) => console.error(` - ${p}`));
    process.exit(1);
  }
  console.log('✅ QUERY COMPILER OVERRIDES PASS');
}

module.exports = { run };
