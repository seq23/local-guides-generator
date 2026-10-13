/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { CONTACT_EMAIL } = require('../lib/pack_site_config');

function exists(p) {
  try { return fs.existsSync(p); } catch (_) { return false; }
}

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function mustContain(html, needle, label) {
  if (!String(html || '').includes(needle)) {
    throw new Error(`REQUEST ASSISTANCE TOOL CONTRACT FAIL: missing "${needle}" in ${label}`);
  }
}

function run(ctx) {
  const repoRoot = (ctx && ctx.repoRoot) || process.cwd();
  const fp = path.join(repoRoot, 'dist', 'request-assistance', 'index.html');
  if (!exists(fp)) {
    throw new Error('REQUEST ASSISTANCE TOOL CONTRACT FAIL: dist/request-assistance/index.html not found. Run build first.');
  }

  const html = readText(fp);
  const label = path.relative(repoRoot, fp);

  // The senior-living site's intake is the lead backend's wizard mounted in an
  // exact embed slot (assets/senior-intake.js), not the shared Airtable form.
  // Its page is held to the same structural markers plus that slot.
  let pageSetFile = '';
  try { pageSetFile = String(JSON.parse(readText(path.join(repoRoot, 'data', 'site.json'))).pageSetFile || ''); } catch (_) {}
  if (/senior_living_v1\.json$/.test(pageSetFile)) {
    for (const n of ['data-request-assistance-tool-intro="true"', 'data-request-assistance-form-primary="true"', 'data-request-assistance-who-its-for="true"', 'data-request-assistance-what-happens-next="true"', 'id="request-assistance-form"', 'data-request-assistance-top-cta="true"', 'data-request-assistance-bottom-cta="true"', `mailto:${CONTACT_EMAIL}`, 'Senior living communities pay us a referral fee',
      '<div id="senior-intake" data-vertical="senior-living" data-city="memphis-tn" data-zip="38104"></div><script src="/assets/senior-intake.js" defer></script>']) mustContain(html, n, label);
    if (html.includes('action="/api/request-assistance"')) throw new Error(`REQUEST ASSISTANCE TOOL CONTRACT FAIL: ${label} renders the shared Airtable form next to the senior intake wizard`);
    const shownS = html.replace(/\splaceholder="[^"]*"/g, '');
    const others = Array.from(new Set((shownS.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).map((a) => a.toLowerCase()))).filter((a) => a !== CONTACT_EMAIL.toLowerCase());
    if (others.length) throw new Error(`REQUEST ASSISTANCE TOOL CONTRACT FAIL: ${label} shows an address other than ${CONTACT_EMAIL}: ${others.join(', ')}`);
    console.log('✅ request assistance tool contract pass (senior-living intake slot)');
    return;
  }

  mustContain(html, 'data-request-assistance-tool-intro="true"', label);
  mustContain(html, 'data-request-assistance-form-primary="true"', label);
  mustContain(html, 'data-request-assistance-who-its-for="true"', label);
  mustContain(html, 'data-request-assistance-what-happens-next="true"', label);
  mustContain(html, 'id="request-assistance-form"', label);
  mustContain(html, 'action="/api/request-assistance"', label);
  if (!String(html || '').includes("fetch('/api/request-assistance'")) { console.warn("⚠️ REQUEST ASSISTANCE TOOL WARNING: missing fetch('/api/request-assistance') in " + label); }
  mustContain(html, 'Submit a routing request', label);
  mustContain(html, 'What this tool does', label);
  mustContain(html, 'What happens after submission', label);
  mustContain(html, 'No rankings', label);
  mustContain(html, 'No case details are collected here.', label);
  mustContain(html, 'data-request-assistance-top-cta="true"', label);
  mustContain(html, 'data-request-assistance-bottom-cta="true"', label);
  mustContain(html, 'Airtable-backed routing workflow', label);
  // Every address the page shows (links, fallback text, the form's submit and
  // error messages) is the one CONTACT_EMAIL; no other address may appear.
  mustContain(html, `mailto:${CONTACT_EMAIL}`, label);
  mustContain(html, `Please try again later or email ${CONTACT_EMAIL}.`, label);
  // Input placeholders (e.g. "you@yourmail.com") are example text, not an address shown as a contact.
  const shown = html.replace(/\splaceholder="[^"]*"/g, '');
  const otherAddresses = Array.from(new Set((shown.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])
    .map((a) => a.toLowerCase()))).filter((a) => a !== CONTACT_EMAIL.toLowerCase());
  if (otherAddresses.length) {
    throw new Error(`REQUEST ASSISTANCE TOOL CONTRACT FAIL: ${label} shows an address other than ${CONTACT_EMAIL}: ${otherAddresses.join(', ')}`);
  }

  console.log('✅ request assistance tool contract pass');
}

module.exports = { run };
