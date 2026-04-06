/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function markerPositions(html, kind) {
  let re;
  if (kind === 'primary') re = /<section[^>]*data-primary-conversion-cta\s*=\s*"true"/gi;
  else if (kind === 'inline') re = /<section[^>]*data-inline-conversion-cta\s*=\s*"true"/gi;
  else if (kind === 'bubble') re = /<section[^>]*data-connection-bubble\s*=\s*"true"/gi;
  else re = null;
  if (!re) return [];
  return Array.from(String(html || '').matchAll(re)).map((m) => m.index || 0);
}

function listCityHubIndexHtmlPaths(distDir) {
  const out = [];
  for (const e of fs.readdirSync(distDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const name = e.name;
    if (name === 'assets' || name === 'guides' || name === 'states' || name.startsWith('_')) continue;
    const fp = path.join(distDir, name, 'index.html');
    if (!exists(fp)) continue;
    const html = readText(fp);
    const m = html.match(/<body[^>]*data-city\s*=\s*"([^"]*)"/i);
    const dataCity = m ? String(m[1] || '') : '';
    if (dataCity && dataCity === name) out.push(fp);
  }
  return out;
}

function listStateHubIndexHtmlPaths(distDir) {
  const out = [];
  const statesDir = path.join(distDir, 'states');
  if (!exists(statesDir)) return out;
  for (const e of fs.readdirSync(statesDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const fp = path.join(statesDir, e.name, 'index.html');
    if (exists(fp)) out.push(fp);
  }
  return out;
}

function listGuideDetailHtmlPaths(distDir) {
  const out = [];
  const guidesDir = path.join(distDir, 'guides');
  if (!exists(guidesDir)) return out;
  for (const e of fs.readdirSync(guidesDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const fp = path.join(guidesDir, e.name, 'index.html');
    if (exists(fp)) out.push(fp);
  }
  return out;
}

function sectionClassMismatches(html, kind) {
  const attr = kind === 'primary'
    ? 'data-primary-conversion-cta="true"'
    : 'data-inline-conversion-cta="true"';
  const expectedClass = kind === 'primary' ? 'conversion-cta--primary' : 'conversion-cta--inline';
  const sectionRe = /<section\b[^>]*class="([^"]*)"[^>]*>/gi;
  const mismatches = [];
  let m;
  while ((m = sectionRe.exec(String(html || ''))) !== null) {
    const sectionTag = m[0];
    if (!sectionTag.includes(attr)) continue;
    const classValue = m[1] || '';
    if (!classValue.split(/\s+/).includes(expectedClass)) {
      mismatches.push({ attr, expectedClass, sectionTag });
    }
  }
  return mismatches;
}

function validateExact(html, kind, expected, label, failures) {
  const n = markerPositions(html, kind).length;
  const marker = kind === 'primary'
    ? 'data-primary-conversion-cta="true"'
    : kind === 'inline'
      ? 'data-inline-conversion-cta="true"'
      : 'data-connection-bubble="true"';
  if (n !== expected) failures.push(`${label}: expected ${expected} occurrence(s) of ${marker} but found ${n}`);
  if (kind === 'primary' || kind === 'inline') {
    const mismatches = sectionClassMismatches(html, kind);
    for (const mismatch of mismatches) {
      failures.push(`${label}: ${mismatch.attr} must render with class ${mismatch.expectedClass}`);
    }
  }
}

function run() {
  const distDir = path.join(REPO_ROOT, 'dist');
  if (!exists(distDir)) {
    console.error('CONVERSION CONTRACT FAIL: dist/ is missing. Build first.');
    process.exit(1);
  }

  const failures = [];
  const requiredFull = [];
  const requiredGuideDetail = [];

  const home = path.join(distDir, 'index.html');
  if (exists(home)) requiredFull.push({ fp: home, label: 'global_home' });

  const guidesHub = path.join(distDir, 'guides', 'index.html');
  if (exists(guidesHub)) requiredFull.push({ fp: guidesHub, label: 'global_guides_hub' });

  for (const fp of listCityHubIndexHtmlPaths(distDir)) requiredFull.push({ fp, label: 'city_hub' });
  for (const fp of listStateHubIndexHtmlPaths(distDir)) requiredFull.push({ fp, label: 'state_hub' });
  for (const fp of listGuideDetailHtmlPaths(distDir)) requiredGuideDetail.push({ fp, label: 'guide_detail' });

  for (const row of requiredFull) {
    const html = readText(row.fp);
    const label = `${row.label}:${path.relative(REPO_ROOT, row.fp)}`;
    validateExact(html, 'primary', 1, label, failures);
    validateExact(html, 'inline', 1, label, failures);
    validateExact(html, 'bubble', 1, label, failures);

    const hero = markerPositions(html, 'primary')[0] ?? -1;
    const inline = markerPositions(html, 'inline')[0] ?? -1;
    const bubble = markerPositions(html, 'bubble')[0] ?? -1;
    if (!(hero >= 0 && inline >= 0 && bubble >= 0 && hero < inline && inline < bubble)) {
      failures.push(`${label}: conversion hierarchy order must be primary -> inline -> connection bubble`);
    }
  }

  for (const row of requiredGuideDetail) {
    const html = readText(row.fp);
    const label = `${row.label}:${path.relative(REPO_ROOT, row.fp)}`;
    validateExact(html, 'primary', 1, label, failures);
    validateExact(html, 'inline', 1, label, failures);
    validateExact(html, 'bubble', 1, label, failures);
    const hero = markerPositions(html, 'primary')[0] ?? -1;
    const inline = markerPositions(html, 'inline')[0] ?? -1;
    const bubble = markerPositions(html, 'bubble')[0] ?? -1;
    if (!(hero >= 0 && inline >= 0 && bubble >= 0 && hero < inline && inline < bubble)) {
      failures.push(`${label}: guide detail conversion order must be primary -> inline -> connection bubble`);
    }
  }

  if (failures.length) {
    console.error('CONVERSION CONTRACT FAIL');
    for (const f of failures.slice(0, 80)) console.error(' - ' + f);
    if (failures.length > 80) console.error(`... (${failures.length - 80} more failures)`);
    process.exit(1);
  }

  console.log('✅ conversion contract pass');
}

module.exports = { run };
