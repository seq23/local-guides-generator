// Pins the IndexNow named stop in distribution_scripts/indexnow_submit.sh.
// 13-14 Oct 2026: Bing answered 403 UserForbiddedToAccessSite for
// memphisseniorcarehomes.com (registered 13 Oct) while the key file was live
// and exact, and Deploy Distribution went red on every main push. The step now
// names that stop and exits 0 for the host -- ONLY when the live key file
// verifies AND the status is 403. Everything else must still fail.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(ROOT, 'distribution_scripts', 'indexnow_submit.sh');
const KEY = 'a'.repeat(64);
const HOST = 'new-site.example';

function serve({ submitStatus, submitBody = '', keyStatus = 200, keyBody = KEY + '\n', keyType = 'text/plain; charset=utf-8' }) {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/indexnow') {
      req.resume();
      req.on('end', () => { res.writeHead(submitStatus, { 'Content-Type': 'application/json' }); res.end(submitBody); });
      return;
    }
    if (req.url === `/${KEY}.txt`) { res.writeHead(keyStatus, { 'Content-Type': keyType }); res.end(keyBody); return; }
    res.writeHead(404); res.end();
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function run(opts) {
  const server = await serve(opts);
  const base = `http://127.0.0.1:${server.address().port}`;
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'indexnow-'));
  fs.writeFileSync(path.join(cwd, `${KEY}.txt`), KEY + '\n');
  fs.writeFileSync(path.join(cwd, 'urls.txt'), `https://${HOST}/\nhttps://${HOST}/guides/\n`);
  const summary = path.join(cwd, 'summary.md');
  const r = await new Promise((resolve) => {
    // spawnSync would block the event loop the fixture server runs on.
    import('node:child_process').then(({ spawn }) => {
      const child = spawn('bash', [SCRIPT, '--host', HOST, '--key', KEY, '--file', 'urls.txt', '--report', 'reports/r.json'], {
        cwd, env: { ...process.env, INDEXNOW_ENDPOINT: `${base}/indexnow`, INDEXNOW_KEY_BASE_URL: base, GITHUB_STEP_SUMMARY: summary },
      });
      let out = ''; child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });
      child.on('close', (status) => resolve({ status, out }));
    });
  });
  server.close();
  const report = JSON.parse(fs.readFileSync(path.join(cwd, 'reports', 'r.json'), 'utf8'));
  const sum = fs.existsSync(summary) ? fs.readFileSync(summary, 'utf8') : '';
  return { ...r, report, sum };
}

const FORBIDDEN = '{"errorCode":"UserForbiddedToAccessSite","message":"User is unauthorized to access the site."}';

test('403 with the key file live and exact is a named stop: exit 0, visible in log and job summary', async () => {
  const r = await run({ submitStatus: 403, submitBody: FORBIDDEN });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, new RegExp(`INDEXNOW_SITE_NOT_YET_VERIFIED ${HOST.replace('.', '\\.')} 403`));
  assert.match(r.sum, /NAMED STOP: `INDEXNOW_SITE_NOT_YET_VERIFIED new-site\.example 403`/);
  assert.equal(r.report.status, 'named-stop');
  assert.equal(r.report.namedStops.length, 1);
  assert.equal(r.report.failures.length, 0);
});

test('negative: 403 with a WRONG key file body still fails', async () => {
  const r = await run({ submitStatus: 403, submitBody: FORBIDDEN, keyBody: 'b'.repeat(64) });
  assert.equal(r.status, 1, r.out);
  assert.doesNotMatch(r.out, /INDEXNOW_SITE_NOT_YET_VERIFIED/);
  assert.equal(r.report.status, 'failed');
});

test('negative: 403 with the key file missing (404) still fails', async () => {
  const r = await run({ submitStatus: 403, submitBody: FORBIDDEN, keyStatus: 404, keyBody: 'not found' });
  assert.equal(r.status, 1, r.out);
  assert.equal(r.report.status, 'failed');
});

test('negative: 403 with a BOM-prefixed key file still fails', async () => {
  const r = await run({ submitStatus: 403, submitBody: FORBIDDEN, keyBody: '﻿' + KEY });
  assert.equal(r.status, 1, r.out);
});

test('negative: 403 with the key served as text/html still fails', async () => {
  const r = await run({ submitStatus: 403, submitBody: FORBIDDEN, keyType: 'text/html' });
  assert.equal(r.status, 1, r.out);
});

test('negative: any non-403 error with a good key file still fails (422, 500)', async () => {
  for (const code of [422, 500]) {
    const r = await run({ submitStatus: code, submitBody: '{}' });
    assert.equal(r.status, 1, `${code}: ${r.out}`);
    assert.equal(r.report.status, 'failed');
  }
});

test('200 is a plain success with no named stop', async () => {
  const r = await run({ submitStatus: 200 });
  assert.equal(r.status, 0, r.out);
  assert.equal(r.report.status, 'success');
  assert.equal(r.report.namedStops.length, 0);
});
