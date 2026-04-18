const fs = require('fs');
const path = require('path');

function mustContain(haystack, needle, label) {
  if (!String(haystack || '').includes(needle)) {
    throw new Error(`ADMIN PAGE CONTRACT FAIL: missing ${label}`);
  }
}

function run() {
  const distPath = path.join(process.cwd(), 'dist', 'admin', 'index.html');
  const srcPath = path.join(process.cwd(), 'data', 'global_pages', 'admin.json');
  if (!fs.existsSync(srcPath)) throw new Error('ADMIN PAGE CONTRACT FAIL: missing data/global_pages/admin.json');
  if (!fs.existsSync(distPath)) throw new Error('ADMIN PAGE CONTRACT FAIL: missing dist/admin/index.html');
  const html = fs.readFileSync(distPath, 'utf8');
  mustContain(html, 'data-admin-gate="true"', 'password gate marker');
  mustContain(html, 'data-admin-shell="true"', 'admin shell marker');
  mustContain(html, 'data-admin-status-cards="true"', 'status cards');
  mustContain(html, 'data-admin-product-summary="true"', 'product summary');
  mustContain(html, 'data-admin-city-table="true"', 'city inventory table');
  mustContain(html, 'data-admin-activation-checklist="true"', 'activation checklist');
  mustContain(html, 'data-admin-statewide-counter="true"', 'statewide counter');
  mustContain(html, 'data-admin-city-request-guide="true"', 'city request guide');
  mustContain(html, 'data-admin-operator-docs="true"', 'operator docs section');
  mustContain(html, 'data-admin-city-paths="true"', 'city path section');
  console.log('✅ ADMIN PAGE CONTRACT PASS');
}

module.exports = { run };
if (require.main === module) run();
