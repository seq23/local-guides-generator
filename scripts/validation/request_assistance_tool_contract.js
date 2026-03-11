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
  mustContain(html, 'data-request-assistance-who-its-for="true"', label);
  mustContain(html, 'data-request-assistance-what-happens-next="true"', label);
  mustContain(html, 'Use this tool if you want help finding local options before reaching out.', label);
  mustContain(html, 'id="request-assistance-form"', label);
  mustContain(html, 'What this tool does', label);
  mustContain(html, 'What happens after submission', label);
  mustContain(html, 'Many people review the local next-step guide first, then use this tool to narrow local options.', label);

  console.log('✅ request assistance tool contract pass');
}

module.exports = { run };
