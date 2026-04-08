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

function run() {
  const distDir = path.join(__dirname, '..', '..', 'dist');
  if (!fs.existsSync(distDir)) return;
  const files = [];
  walk(distDir, files);
  const failures = [];
  let checked = 0;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('Get Matched With a Provider')) continue;
    checked += 1;
    if (!html.includes('button=primary_cta') && !html.includes('button=inline_conversion_cta') && !html.includes('button=next_steps_page_primary') && !html.includes('button=connection_bubble')) {
      failures.push(`${file}: missing button source query param on conversion link`);
    }
    if (!html.includes('intent=direct_match')) {
      failures.push(`${file}: missing direct_match intent on conversion link`);
    }
  }
  if (failures.length) throw new Error('CONVERSION INTENT CONTRACT FAIL\n' + failures.join('\n'));
  if (checked) console.log(`✓ conversion intent contract ok (${checked} files)`);
}

module.exports = { run };
