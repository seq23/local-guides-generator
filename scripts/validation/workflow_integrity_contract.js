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
  const root = process.cwd();

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
  mustExist('scripts/automation/rotate_vertical_refresh.js');

  const refreshWorkflow = fs.readFileSync(
    path.join(root, '.github/workflows/refresh-verification-page.yml'),
    'utf8'
  );

  const rotatingWorkflow = fs.readFileSync(
    path.join(root, '.github/workflows/rotating_refresh.yml'),
    'utf8'
  );

  const rotateScript = fs.readFileSync(
    path.join(root, 'scripts/automation/rotate_vertical_refresh.js'),
    'utf8'
  );

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (!pkg.scripts || !pkg.scripts['refresh:verification']) {
    fail('package.json missing refresh:verification script');
  }

  // refresh-verification workflow must use the safe pipeline
  if (!/npm run refresh:verification/.test(refreshWorkflow)) {
    fail('refresh-verification workflow must call npm run refresh:verification');
  }

  // rotating workflow must not call the raw refresh script directly
  if (/node scripts\/automation\/refresh_verification_page\.js/.test(rotatingWorkflow)) {
    fail('rotating_refresh.yml must not call refresh_verification_page.js directly; use npm run refresh:verification');
  }

  // rotating workflow must still invoke the rotating entrypoint
  if (!/node scripts\/automation\/rotate_vertical_refresh\.js/.test(rotatingWorkflow)) {
    fail('rotating_refresh.yml must invoke rotate_vertical_refresh.js');
  }

  // rotate script must use the safe pipeline, not the raw script
  if (/node scripts\/automation\/refresh_verification_page\.js/.test(rotateScript)) {
    fail('rotate_vertical_refresh.js must not call refresh_verification_page.js directly; use npm run refresh:verification');
  }

  if (!/npm run refresh:verification/.test(rotateScript)) {
    fail('rotate_vertical_refresh.js must call npm run refresh:verification');
  }

  // refresh workflow should still indicate dependent artifact regeneration path
  if (!/refresh:verification|sitemap_emit/.test(refreshWorkflow)) {
    fail('refresh-verification workflow does not regenerate dependent artifacts');
  }

  console.log('✅ WORKFLOW INTEGRITY CONTRACT PASS');
}

module.exports = { run };
