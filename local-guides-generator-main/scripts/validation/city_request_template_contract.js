const fs = require('fs');
const path = require('path');

function fail(msg) { throw new Error(`CITY REQUEST TEMPLATE FAIL: ${msg}`); }

function run(ctx) {
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const fp = path.join(repoRoot, 'data', 'templates', 'city_request.template.json');
  if (!fs.existsSync(fp)) fail('missing data/templates/city_request.template.json');
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  if (!Array.isArray(data.requests)) fail('requests must be an array');
  for (const req of data.requests) {
    const required = ['vertical','state_code','city_name','city_slug','market_label','intended_package'];
    for (const key of required) {
      if (!String(req[key] || '').trim()) fail(`request missing ${key}`);
    }
    if ((req.is_base_included && req.is_extra_city) || (!req.is_base_included && !req.is_extra_city)) {
      fail(`${req.city_slug} must be exactly one of base or extra`);
    }
    const suffix = '-' + String(req.state_code || '').trim().toLowerCase();
    if (!String(req.city_slug || '').trim().toLowerCase().endsWith(suffix)) {
      fail(`${req.city_slug} must end with ${suffix}`);
    }
  }
  console.log('✅ CITY REQUEST TEMPLATE PASS');
}

module.exports = { run };
if (require.main === module) run();
