/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function run(ctx) {
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const cssPath = path.join(repoRoot, 'assets', 'styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  const required = [
    '.runtime-next-steps-media img',
    '.conversion-cta__media img',
    'max-height: 360px',
    'aspect-ratio: 16 / 9',
    'object-fit: cover',
    'break-inside: avoid',
    'page-break-inside: avoid'
  ];
  const missing = required.filter((needle) => !css.includes(needle));
  if (missing.length) throw new Error('SPONSOR MEDIA LAYOUT CONTRACT FAIL\nMissing CSS contract: ' + missing.join(', '));
  console.log('✅ SPONSOR MEDIA LAYOUT CONTRACT PASS');
}

if (require.main === module) {
  try { run({}); } catch (err) { console.error(err.message); process.exit(1); }
}

module.exports = { run };
