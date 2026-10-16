// Fixtures for scripts/validation/link_audit.js: the dead-URL list, the
// /cdn-cgi/l/email-protection href ban and the bare-email fence rule each
// fail on a page that breaks them and pass on one that does not.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { run } = require('../../scripts/validation/link_audit.js');
const REAL_DEAD_LIST = JSON.parse(fs.readFileSync(new URL('../../config/dead_outbound_urls.json', import.meta.url), 'utf8'));

function fixture(body, deadList = REAL_DEAD_LIST) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'link-audit-'));
  fs.mkdirSync(path.join(root, 'dist', 'about'), { recursive: true });
  fs.mkdirSync(path.join(root, 'config'), { recursive: true });
  fs.writeFileSync(path.join(root, 'config', 'dead_outbound_urls.json'), JSON.stringify(deadList));
  fs.writeFileSync(path.join(root, 'dist', 'about', 'index.html'), '<p>about</p>');
  fs.writeFileSync(
    path.join(root, 'dist', 'index.html'),
    `<html><body><a href="/about/">About</a> <a href="https://www.dhp.virginia.gov/">VA board</a> ${body}</body></html>`
  );
  return { repoRoot: root };
}

test('clean page passes', () => {
  const r = run(fixture('<p>Contact: <!--email_off--><a href="mailto:hello@theindustryguides.com">hello@theindustryguides.com</a><!--/email_off--> or <!--email_off-->renew@clinic.org<!--/email_off--></p><script type="application/ld+json">{"email":"a@b.org"}</script>'));
  assert.equal(r.outboundExamined, 1);
});

test('every checked-in dead URL fails the build', () => {
  assert.ok(REAL_DEAD_LIST.entries.length >= 8);
  for (const e of REAL_DEAD_LIST.entries) {
    assert.throws(() => run(fixture(`<a href="${e.url}">x</a>`)), /listed dead/, e.url);
  }
});

test('a host-dead entry blocks any path on that host', () => {
  assert.throws(() => run(fixture('<a href="https://member.vsb.org/vsbportal/">x</a>')), /listed dead/);
});

test('a /cdn-cgi/l/email-protection href fails', () => {
  assert.throws(() => run(fixture('<a href="/cdn-cgi/l/email-protection" class="__cf_email__">[email protected]</a>')), /cdn-cgi\/l\/email-protection/);
});

test('a bare email address in text outside a fence fails', () => {
  assert.throws(() => run(fixture('<dd>Send documents by email to renew@clinic.org first.</dd>')), /Bare email addresses/);
});

test('an unfenced mailto anchor still fails', () => {
  assert.throws(() => run(fixture('<a href="mailto:x@y.org">write</a>')), /Unfenced mailto/);
});

test('an empty dead list is refused, not passed', () => {
  assert.throws(() => run(fixture('', { entries: [] })), /zero entries/);
});
