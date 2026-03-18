/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg) {
  throw new Error(`REQUEST ASSISTANCE LAYOUT FAIL: ${msg}`);
}

function run(ctx = {}) {
  const repoRoot = ctx.repoRoot || process.cwd();
  const fp = path.join(repoRoot, 'dist', 'request-assistance', 'index.html');
  if (!fs.existsSync(fp)) {
    fail('dist/request-assistance/index.html not found. Run build first.');
  }

  const html = fs.readFileSync(fp, 'utf8');
  const hero = html.indexOf('data-request-assistance-tool-intro="true"');
  const formPrimary = html.indexOf('data-request-assistance-form-primary="true"');
  const formPanel = html.indexOf('data-request-assistance-form-panel="true"');
  const sideNote = html.indexOf('data-request-assistance-side-note="true"');
  const whoItsFor = html.indexOf('data-request-assistance-who-its-for="true"');
  const whatHappensNext = html.indexOf('data-request-assistance-what-happens-next="true"');
  const formId = html.indexOf('id="request-assistance-form"');

  if (hero === -1) fail('missing utility intro section marker');
  if (formPrimary === -1) fail('missing primary form section marker');
  if (formPanel === -1) fail('missing primary form panel marker');
  if (formId === -1) fail('missing request assistance form');
  if (sideNote === -1) fail('missing before-you-submit side note');
  if (whoItsFor === -1) fail('missing who-its-for section');
  if (whatHappensNext === -1) fail('missing what-happens-next section');
  if (!(hero < formPrimary && formPrimary < whoItsFor && whoItsFor < whatHappensNext)) {
    fail('section order must remain intro -> primary form -> explanatory sections');
  }
  if (!(formPrimary < formPanel && formPanel < whoItsFor)) {
    fail('primary form panel must live inside the primary action section before explanatory sections');
  }
  if (!(formId > formPanel && formId < whoItsFor)) {
    fail('form must live inside the primary form panel before explanatory sections');
  }
  if (!html.includes('Submit a routing request')) fail('missing submit-a-routing-request headline');
  if (!html.includes('Primary action')) fail('missing primary action label');
  if (!html.includes('Before you submit')) fail('missing before-you-submit guidance label');
  console.log('✅ request_assistance_layout_contract PASS');
}

module.exports = { run };
