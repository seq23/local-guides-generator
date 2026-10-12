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
