#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, 'distribution.config.json');

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
      const res = await postJson('https://www.bing.com/indexnow', payload);
      if (!res.status || res.status >= 300) {
        throw new Error(`IndexNow submit failed for ${host}: HTTP ${res.status || 'unknown'} ${res.body || ''}`);
      }
      console.log(`indexnow_submit: host=${host} status=${res.status} urls=${urls.length}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
