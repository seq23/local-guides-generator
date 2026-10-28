import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { brandedTitle, clarityEligible } = require('../../scripts/lib/search_readiness_policy');

test('both scoped publications identify themselves; existing branding stays once', () => {
  for (const [host, brand] of [['uscisexam.com', 'USCIS Exam Guides'], ['dentistryguides.com', 'The Dentistry Guides']]) {
    assert.equal(brandedTitle('What to ask', `https://${host}`, brand), `What to ask | ${brand}`);
    assert.equal(brandedTitle(`${brand}: What to ask`, `https://${host}`, brand), `${brand}: What to ask`);
  }
  assert.equal(brandedTitle('Existing title', 'https://neuroevalguides.com', 'Neuro Evaluation Guides'), 'Existing title');
});

test('a contact CTA, fake form or prose about checkout is not a conversion page', () => {
  for (const html of ['<a href="/request-assistance/">Ask</a>', '<!-- <form> -->', '<script>const s="<form>"</script>', '<p>Go to /checkout/</p>']) {
    assert.equal(clarityEligible(html, 'https://uscisexam.com'), false);
    assert.equal(clarityEligible(html, 'https://dentistryguides.com'), false);
  }
});

test('real forms and buy links retain recording, including relative and quoted links', () => {
  for (const html of ['<form action="/api/lead">', '<a href="https://brand.gumroad.com/l/guide">Buy</a>', "<a href='/checkout/'>Buy</a>", '<a href=/booking/>Book</a>']) {
    assert.equal(clarityEligible(html, 'https://uscisexam.com'), true);
    assert.equal(clarityEligible(html, 'https://dentistryguides.com'), true);
  }
  assert.equal(clarityEligible('<p>Existing sibling policy</p>', 'https://neuroevalguides.com'), true);
});

test('the installer removes old blanket tags, preserves real conversion tags, and is idempotent', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-clarity-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ['scripts/lib', 'data', 'dist']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  for (const file of ['scripts/install_clarity.js', 'scripts/lib/search_readiness_policy.js']) {
    fs.copyFileSync(new URL(`../../${file}`, import.meta.url), path.join(root, file));
  }
  fs.writeFileSync(path.join(root, 'data/clarity_projects.json'), JSON.stringify({ projects: { 'uscisexam.com': 'y7l12fhi6v' } }));
  fs.writeFileSync(path.join(root, 'data/site.json'), JSON.stringify({ siteUrl: 'https://uscisexam.com' }));
  const tag = '<script data-clarity-loader src="/assets/clarity-loader.js" defer></script>';
  const pages = {
    'info.html': `<head>${tag}</head><body><a href="/request-assistance/">Ask</a></body>`,
    'old-inline.html': '<head><script data-clarity-loader>old()</script></head><body>Information</body>',
    'form.html': '<head></head><body><form action="/api/lead"></form></body>',
    'buy.html': `<head>${tag}</head><body><a href="https://brand.gumroad.com/l/guide">Buy</a></body>`,
  };
  for (const [file, html] of Object.entries(pages)) fs.writeFileSync(path.join(root, 'dist', file), html);
  const run = () => execFileSync(process.execPath, [path.join(root, 'scripts/install_clarity.js')], {
    cwd: root, env: { ...process.env, PAGES_OUT_DIR: path.join(root, 'dist') }, encoding: 'utf8',
  });
  run();
  const read = (file) => fs.readFileSync(path.join(root, 'dist', file), 'utf8');
  assert.doesNotMatch(read('info.html'), /data-clarity-loader/);
  assert.doesNotMatch(read('old-inline.html'), /data-clarity-loader/);
  assert.match(read('form.html'), /data-clarity-loader/);
  assert.equal(read('buy.html'), pages['buy.html']);
  const after = Object.keys(pages).map(read);
  run();
  assert.deepEqual(Object.keys(pages).map(read), after);
});
