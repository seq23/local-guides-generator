const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error(`REQUEST ASSISTANCE PRODUCTION GUARDRAIL FAIL: ${msg}`);
  process.exit(1);
}

function isProductionContext(env) {
  const explicit = String(env.LKG_DEPLOY_ENV || env.DEPLOY_ENV || '').trim().toLowerCase();
  if (explicit === 'production' || explicit === 'prod') return true;
  if (explicit === 'preview' || explicit === 'staging' || explicit === 'dev' || explicit === 'development' || explicit === 'baseline') return false;

  const context = String(env.CONTEXT || '').trim().toLowerCase();
  if (context === 'production') return true;
  if (context === 'preview' || context === 'branch-deploy' || context === 'deploy-preview') return false;

  const cfPages = String(env.CF_PAGES || '').trim();
  const cfBranch = String(env.CF_PAGES_BRANCH || '').trim();
  if (cfPages && cfBranch) return cfBranch === 'main';

  return false;
}

function run() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const fnPath = path.join(repoRoot, 'functions', 'api', 'request-assistance.js');
  if (!fs.existsSync(fnPath)) {
    fail('functions/api/request-assistance.js not found.');
  }

  const src = fs.readFileSync(fnPath, 'utf8');
  const requiredRefs = ['AIRTABLE_API_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_TABLE_NAME'];
  for (const token of requiredRefs) {
    if (!src.includes(token)) fail(`endpoint missing expected env reference: ${token}`);
  }

  if (!isProductionContext(process.env)) {
    console.log('REQUEST ASSISTANCE PRODUCTION GUARDRAIL PASS (non-production context)');
    return;
  }

  const missing = requiredRefs.filter((k) => !String(process.env[k] || '').trim());
  if (missing.length) {
    fail(`production context missing required env: ${missing.join(', ')}`);
  }

  console.log('REQUEST ASSISTANCE PRODUCTION GUARDRAIL PASS');
}

module.exports = { run, isProductionContext };

if (require.main === module) run();
