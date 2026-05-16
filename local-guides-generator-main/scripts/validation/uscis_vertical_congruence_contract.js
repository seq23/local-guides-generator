/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error('USCIS VERTICAL CONGRUENCE FAIL\n' + msg);
  process.exit(1);
}

function run() {
  const root = path.join(__dirname, '..', '..');
  const scriptFile = path.join(root, 'scripts', 'vertical_upgrades', 'uscis.js');
  const shellFile = path.join(root, 'scripts', 'verticals', 'uscis.sh');
  const overrideFile = path.join(root, 'data', 'community', 'query_compiler', 'uscis_medical.json');
  const libFile = path.join(root, 'scripts', 'vertical_upgrades', 'lib.js');
  const missing = [scriptFile, shellFile, overrideFile, libFile].filter((fp) => !fs.existsSync(fp));
  if (missing.length) fail('missing required USCIS congruence files:\n' + missing.join('\n'));
  const script = fs.readFileSync(scriptFile, 'utf8');
  if (!/profileConfig\('uscis_medical'\)/.test(script)) fail("uscis.js does not use profileConfig('uscis_medical')");
  const lib = fs.readFileSync(libFile, 'utf8');
  if (!/uscis_medical:\s*\{/.test(lib)) fail('vertical_upgrades/lib.js is missing uscis_medical profile');
  console.log('✅ uscis vertical congruence contract pass');
}

module.exports = { run };
