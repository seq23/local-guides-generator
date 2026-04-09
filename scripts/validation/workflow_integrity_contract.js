const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error(`WORKFLOW INTEGRITY FAIL: ${msg}`);
  process.exit(1);
}

function mustExist(rel) {
  const abs = path.join(process.cwd(), rel);
  if (!fs.existsSync(abs)) fail(`missing required file: ${rel}`);
  return abs;
}

function run() {
  const requiredWorkflows = [
    '.github/workflows/distribution.yml',
    '.github/workflows/ingestion_sync.yml',
    '.github/workflows/integrity_build.yml',
    '.github/workflows/promote_reference.yml',
    '.github/workflows/refresh-verification-page.yml',
    '.github/workflows/rotating_refresh.yml',
    '.github/workflows/validate.yml',
  ];
  requiredWorkflows.forEach(mustExist);

  mustExist('scripts/automation/refresh_verification_page.sh');
  mustExist('scripts/automation/refresh_verification_page.js');

  const refreshWorkflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/refresh-verification-page.yml'), 'utf8');
  if (!/npm run refresh:verification/.test(refreshWorkflow) && !/refresh_verification_page\.sh/.test(refreshWorkflow) && !/refresh_verification_page\.js/.test(refreshWorkflow)) {
    fail('refresh-verification workflow does not reference the refresh pipeline');
  }
  if (!/sitemap_emit|refresh:verification/.test(refreshWorkflow)) {
    fail('refresh-verification workflow does not regenerate dependent artifacts');
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  if (!pkg.scripts || !pkg.scripts['refresh:verification']) fail('package.json missing refresh:verification script');

  console.log('✅ WORKFLOW INTEGRITY CONTRACT PASS');
}

module.exports = { run };
