/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (st.isFile() && name.toLowerCase().endsWith('.html')) acc.push(full);
  }
}

function isNextStepsPage(relPath) {
  return /(^|\/)next-steps\/index\.html$/i.test(relPath.replace(/\\/g, '/'));
}

function assertContains(html, needle, label) {
  if (!html.includes(needle)) throw new Error(`NEXT STEPS CTA CONTRACT FAIL: missing "${needle}" in ${label}`);
}

function run(ctx) {
  const repoRoot = (ctx && ctx.repoRoot) || process.cwd();
  const distDir = path.join(repoRoot, 'dist');
  if (!fs.existsSync(distDir)) throw new Error('NEXT STEPS CTA CONTRACT FAIL: dist/ not found. Run build first.');

  const files = [];
  walk(distDir, files);
  const failures = [];
  let nextStepsCount = 0;

  for (const fp of files) {
    const rel = path.relative(distDir, fp).replace(/\\/g, '/');
    const html = fs.readFileSync(fp, 'utf8');
    const hasZone = html.includes('data-next-steps-zone="true"');
    const isNext = isNextStepsPage(rel);

    if (!isNext && hasZone) {
      failures.push(`${rel}: inline next-steps zone should not render outside dedicated /next-steps/ pages`);
    }

    if (!isNext) continue;
    nextStepsCount += 1;
    assertContains(html, 'data-next-steps-page-shell="true"', rel);
    assertContains(html, 'data-next-steps-cards="true"', rel);
    assertContains(html, 'data-next-steps-card="direct-match"', rel);
    assertContains(html, 'data-next-steps-card="compare"', rel);
    assertContains(html, 'data-next-steps-card="tools"', rel);
    assertContains(html, 'id="request-assistance-form"', rel);
    assertContains(html, 'Jump to the form', rel);
    assertContains(html, 'Compare Options', rel);
    assertContains(html, 'Use Lookup Tools', rel);
    assertContains(html, 'data-next-steps-routing="true"', rel);
  }

  if (nextStepsCount === 0) failures.push('no dedicated /next-steps/ pages found in dist');
  if (failures.length) throw new Error('NEXT STEPS CTA CONTRACT FAIL\n' + failures.join('\n'));
  console.log('✅ NEXT STEPS CTA CONTRACT PASS');
}

module.exports = { run };
