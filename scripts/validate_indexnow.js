#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, 'distribution.config.json');
const INDEXNOW_TXT = path.join(ROOT, 'indexnow.txt');
const BUILD_BATCH = path.join(ROOT, '.build', 'indexnow-batch.txt');
const BUILD_PRIORITY = path.join(ROOT, '.build', 'indexnow-priority.txt');
const DIST_BATCH = path.join(ROOT, 'dist', 'indexnow-batch.txt');
const DIST_PRIORITY = path.join(ROOT, 'dist', 'indexnow-priority.txt');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readLines(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}

function uniq(arr) {
  return [...new Set(arr)];
}

function pickExisting(...candidates) {
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return null;
}

if (!fs.existsSync(CONFIG)) throw new Error('distribution.config.json missing');
if (!fs.existsSync(INDEXNOW_TXT)) throw new Error('indexnow.txt missing');

const cfg = readJson(CONFIG);
const indexnow = cfg.indexnow || {};
if (!indexnow.key || !indexnow.key_file) {
  throw new Error('distribution.config.json missing indexnow.key or key_file');
}

const keyPath = path.join(ROOT, indexnow.key_file);
if (!fs.existsSync(keyPath)) throw new Error(`IndexNow key file missing: ${indexnow.key_file}`);

const keyTxt = fs.readFileSync(keyPath, 'utf8').trim();
const rootTxt = fs.readFileSync(INDEXNOW_TXT, 'utf8').trim();
if (!keyTxt) throw new Error(`IndexNow key file is empty: ${indexnow.key_file}`);
if (!rootTxt) throw new Error('indexnow.txt is empty');
if (keyTxt !== indexnow.key) throw new Error('IndexNow key file content does not match distribution.config.json key');
if (rootTxt !== indexnow.key) throw new Error('indexnow.txt content does not match distribution.config.json key');

const batchFile = pickExisting(BUILD_BATCH, path.join(ROOT, indexnow.batch_file || ''), DIST_BATCH);
const priorityFile = pickExisting(BUILD_PRIORITY, path.join(ROOT, indexnow.priority_file || ''), DIST_PRIORITY);
if (!batchFile) throw new Error('IndexNow batch file missing (.build or configured path)');
if (!priorityFile) throw new Error('IndexNow priority file missing (.build or configured path)');

const batchLines = readLines(batchFile);
const priorityLines = readLines(priorityFile);
if (!batchLines.length) throw new Error(`IndexNow batch file is empty: ${path.relative(ROOT, batchFile)}`);
if (!priorityLines.length) throw new Error(`IndexNow priority file is empty: ${path.relative(ROOT, priorityFile)}`);

const dupes = batchLines.filter((x, i) => batchLines.indexOf(x) !== i);
if (dupes.length) throw new Error(`Duplicate URLs in IndexNow batch: ${uniq(dupes).length}`);

const hosts = new Set(indexnow.hosts || []);
if (!hosts.size) throw new Error('distribution.config.json indexnow.hosts missing or empty');

for (const url of batchLines.concat(priorityLines)) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL in IndexNow files: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`IndexNow URL must use https: ${url}`);
  }
  if (!hosts.has(parsed.host)) {
    throw new Error(`URL host not allowed by distribution.config.json: ${url}`);
  }
}

const chunkSize = Number(indexnow.chunk_size || 100);
if (!Number.isFinite(chunkSize) || chunkSize <= 0) throw new Error('Invalid indexnow.chunk_size');
if (batchLines.length > chunkSize * 100) {
  throw new Error(`IndexNow batch too large: ${batchLines.length}`);
}

console.log(`validate_indexnow: OK (batch=${path.relative(ROOT, batchFile)} priority=${path.relative(ROOT, priorityFile)})`);
