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

function run() {
  const distDir = path.join(__dirname, '..', '..', 'dist');
  if (!fs.existsSync(distDir)) return;

  const files = [];
  walk(distDir, files);
  const failures = [];
  const targets = [];

  for (const file of files) {
    const rel = path.relative(distDir, file).replace(/\\/g, '/');
    const html = fs.readFileSync(file, 'utf8');
    if (!/(^|\/)next-steps\/index\.html$/i.test(rel)) continue;
    targets.push(rel);

    if (!html.includes('data-next-steps-answer="true"')) failures.push(`${rel}: missing decision-hub answer block`);
    if (!html.includes('data-next-steps-checklist="true"')) failures.push(`${rel}: missing decision-hub checklist`);
    if (!html.includes('data-next-steps-routing="true"')) failures.push(`${rel}: missing routing explainer`);
    if (!html.includes('id="request-assistance-form"')) failures.push(`${rel}: missing full request-assistance form`);
    if (!html.includes('Get matched with a provider') || !html.includes('Compare your options') || !html.includes('Use lookup tools')) {
      failures.push(`${rel}: missing required next-steps decision hub actions`);
    }
  }

  if (targets.length === 0) {
    console.log('ℹ️ citation routing contract skip (no dedicated next-steps pages present in dist)');
    return;
  }
  if (failures.length) throw new Error('CITATION ROUTING CONTRACT FAIL\n' + failures.join('\n'));
  console.log(`✓ citation routing contract ok (${targets.length} dedicated next-steps pages)`);
}

module.exports = { run };
