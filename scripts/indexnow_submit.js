#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, 'distribution.config.json');
const ALLOW_FAILURE = process.env.INDEXNOW_ALLOW_FAILURE === '1';
const MAX_RETRIES = Number(process.env.INDEXNOW_MAX_RETRIES || 3);
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readLines(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    const u = new URL(url);
    const req = https.request({
      method: 'POST',
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': payload.length,
      },
      timeout: 15000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => req.destroy(new Error('IndexNow request timed out')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function isRetryableError(errOrRes) {
  if (!errOrRes) return false;
  if (errOrRes instanceof Error) return true;
  return RETRYABLE_STATUSES.has(Number(errOrRes.status || 0));
}

async function submitWithRetry(host, payload) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const res = await postJson('https://www.bing.com/indexnow', payload);
      if (res.status && res.status < 300) return res;
      lastError = new Error(`IndexNow submit failed for ${host}: HTTP ${res.status || 'unknown'} ${res.body || ''}`);
      if (!isRetryableError(res) || attempt === MAX_RETRIES) throw lastError;
    } catch (err) {
      lastError = err;
      if (attempt === MAX_RETRIES || !isRetryableError(err)) throw err;
    }
    const delay = 1000 * attempt;
    console.warn(`indexnow_submit: retrying host=${host} attempt=${attempt + 1}/${MAX_RETRIES} after ${delay}ms`);
    await sleep(delay);
  }
  throw lastError || new Error(`IndexNow submit failed for ${host}`);
}

async function main() {
  if (!fs.existsSync(CONFIG)) throw new Error('distribution.config.json missing');
  const cfg = readJson(CONFIG);
  const idx = cfg.indexnow || {};
  if (!idx.key || !idx.key_file) throw new Error('indexnow config missing key settings');

  const batchFile = path.join(ROOT, idx.batch_file || 'dist/indexnow-batch.txt');
  const priorityFile = path.join(ROOT, idx.priority_file || 'dist/indexnow-priority.txt');
  const priorityUrls = readLines(priorityFile);
  const batchUrls = readLines(batchFile);
  const allUrls = [...new Set([...priorityUrls, ...batchUrls])];
  const chunkSize = Number(idx.chunk_size || 100);
  const hosts = Array.isArray(idx.hosts) ? idx.hosts : [];
  if (!hosts.length) throw new Error('indexnow.hosts missing');

  for (const host of hosts) {
    const urlsForHost = allUrls.filter((u) => {
      try { return new URL(u).host === host; } catch { return false; }
    });
    for (const urls of chunk(urlsForHost, chunkSize)) {
      if (!urls.length) continue;
      const payload = {
        host,
        key: idx.key,
        keyLocation: `https://${host}/${idx.key}.txt`,
        urlList: urls,
      };
      const res = await submitWithRetry(host, payload);
      console.log(`indexnow_submit: host=${host} status=${res.status} urls=${urls.length}`);
    }
  }
}

main().catch((err) => {
  if (ALLOW_FAILURE) {
    console.warn(`indexnow_submit: non-blocking warning: ${err.message}`);
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});
