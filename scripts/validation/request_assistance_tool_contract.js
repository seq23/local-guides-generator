/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

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
  mustContain(html, "fetch('/api/request-assistance'", label);
  mustContain(html, 'Submit a routing request', label);
  mustContain(html, 'What this tool does', label);
  mustContain(html, 'What happens after submission', label);
  mustContain(html, 'No rankings', label);
  mustContain(html, 'No case details are collected here.', label);
  mustContain(html, 'data-request-assistance-top-cta="true"', label);
  mustContain(html, 'data-request-assistance-bottom-cta="true"', label);
  mustContain(html, 'Airtable-backed routing workflow', label);
  mustContain(html, 'mailto:info@spryvc.com', label);

  console.log('✅ request assistance tool contract pass');
}

module.exports = { run };
