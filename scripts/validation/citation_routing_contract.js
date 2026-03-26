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

  const targets = [];
  const failures = [];

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('data-next-steps-zone="true"')) continue;
    targets.push(file);

    if (!html.includes('data-next-steps-answer="true"')) {
      failures.push(`${file}: missing data-next-steps-answer="true" block`);
    }
    if (!html.includes('data-next-steps-checklist="true"')) {
      failures.push(`${file}: missing data-next-steps-checklist="true" list`);
    }
    if (!html.includes('data-next-steps-routing="true"')) {
      failures.push(`${file}: missing data-next-steps-routing="true" explainer`);
    }
    if (!html.includes('data-request-assistance-link="true"')) {
      failures.push(`${file}: missing request assistance routing link`);
    }
    if (!html.includes('Review the local next-step guide before choosing a provider.')) {
      failures.push(`${file}: missing approved primary next-step guidance line`);
    }
    if (!html.includes('Use the request-assistance tool to find local options.') && !html.includes('Use the <a data-request-assistance-link="true"')) {
      failures.push(`${file}: missing approved secondary request-assistance guidance line`);
    }
  }

  if (targets.length === 0) {
    console.log('ℹ️ citation routing contract skip (no next-steps zone present in dist)');
    return;
  }

  if (failures.length) {
    throw new Error('CITATION ROUTING CONTRACT FAIL\n' + failures.join('\n'));
  }

  console.log(`✓ citation routing contract ok (${targets.length} files with next-steps zone)`);
}

module.exports = { run };
