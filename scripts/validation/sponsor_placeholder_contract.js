/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg){
  const err = new Error(msg);
  err._validation = 'SPONSOR_PLACEHOLDER_CONTRACT';
  throw err;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fp, out);
    else if (entry.isFile() && fp.endsWith('.html')) out.push(fp);
  }
  return out;
}

function run(ctx) {
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const distRoot = path.join(repoRoot, 'dist');
  if (!fs.existsSync(distRoot)) fail('dist/ missing. Run build first.');
  const bad = [];
  for (const fp of walk(distRoot)) {
    const html = fs.readFileSync(fp, 'utf8');
    if (/\bplaceholder\b/i.test(html) && /data-sponsor-stack=/.test(html)) {
      bad.push(path.relative(repoRoot, fp));
      continue;
    }
    if (html.includes('data-sponsored-empty="true"') && !html.includes('/for-providers/')) {
      bad.push(path.relative(repoRoot, fp) + ' empty sponsor disclosure missing /for-providers/ link');
    }
  }
  if (bad.length) fail('SPONSOR PLACEHOLDER CONTRACT FAIL\n' + bad.join('\n'));
  console.log('✅ SPONSOR PLACEHOLDER CONTRACT PASS');
}

module.exports = { run };
