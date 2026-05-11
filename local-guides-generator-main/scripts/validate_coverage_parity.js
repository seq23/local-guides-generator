#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const MASTER_INVENTORY_JSON = path.join(ROOT, 'data', 'authoritative', 'master_inventory.json');
const COVERAGE_PROMOTED_CSV = path.join(ROOT, 'data', 'research', 'coverage', 'coverage_promoted.csv');
const COVERAGE_RUNTIME_SUPPORT_CSV = path.join(ROOT, 'data', 'research', 'coverage', 'coverage_runtime_support.csv');

function fail(msg) {
  console.error(`validate_coverage_parity failed: ${msg}`);
  process.exit(1);
}

function parseCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line, idx) => {
    const values = parseLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    row.__line = idx + 2;
    return row;
  });
}

function parseLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function groupedSubKeys(vertical) {
  const v = String(vertical || '').toLowerCase();
  if (v === 'trt') return ['trt', 'iv_hydration', 'hair_restoration'];
  if (v === 'neuro') return ['adhd_eval', 'autism_eval'];
  return [];
}

function normalizeVertical(vertical) {
  return String(vertical || '').trim().replace(/_/g, '-').toLowerCase();
}

function requireFile(file, label) {
  if (!fs.existsSync(file)) fail(`missing ${label}: ${path.relative(ROOT, file)}`);
}

function checkCoveragePromotedMode() {
  requireFile(COVERAGE_PROMOTED_CSV, 'authoritative promoted coverage CSV');
  requireFile(COVERAGE_RUNTIME_SUPPORT_CSV, 'runtime support CSV');

  const promotedRows = parseCsv(fs.readFileSync(COVERAGE_PROMOTED_CSV, 'utf8'))
    .filter((row) => String(row.publish_enabled || '').toLowerCase() === 'true');
  const runtimeRows = parseCsv(fs.readFileSync(COVERAGE_RUNTIME_SUPPORT_CSV, 'utf8'));

  if (!promotedRows.length) fail('coverage_promoted.csv has no publish_enabled=true rows');
  if (!runtimeRows.length) fail('coverage_runtime_support.csv has no rows');

  const runtimeMap = new Map();
  for (const row of runtimeRows) {
    const key = `${normalizeVertical(row.vertical)}::${row.city_slug}`;
    if (runtimeMap.has(key)) fail(`duplicate runtime support row for ${key}`);
    runtimeMap.set(key, row);
  }

  const failures = [];
  for (const row of promotedRows) {
    const key = `${normalizeVertical(row.vertical)}::${row.city_slug}`;
    const runtime = runtimeMap.get(key);
    if (!runtime) {
      failures.push(`${key} missing runtime support row`);
      continue;
    }

    if (String(runtime.runtime_ready || '').toLowerCase() !== 'true') {
      failures.push(`${key} runtime_ready is not true`);
      continue;
    }

    const listingPath = path.join(ROOT, runtime.listing_json_path || '');
    requireFile(listingPath, `listing json for ${key}`);
    let listingJson;
    try {
      listingJson = readJson(listingPath);
    } catch (err) {
      fail(`invalid listing json for ${key}: ${runtime.listing_json_path} (${err.message})`);
    }
    if (!listingJson || typeof listingJson !== 'object') {
      failures.push(`${key} listing json is not an object`);
    } else {
      if (String(listingJson.city_slug || '').trim() !== row.city_slug) {
        failures.push(`${key} listing json city_slug mismatch`);
      }
      if (!Array.isArray(listingJson.listings) || listingJson.listings.length < 1) {
        failures.push(`${key} listing json missing listings[]`);
      }
    }

    const grouped = groupedSubKeys(row.vertical);
    if (grouped.length) {
      for (const subKey of grouped) {
        const providerPath = path.join(ROOT, 'data', 'example_providers', normalizeVertical(row.vertical).replace(/-/g, '_'), `${row.city_slug}__${subKey}.json`);
        requireFile(providerPath, `grouped provider dataset for ${key} (${subKey})`);
        let providers;
        try {
          providers = readJson(providerPath);
        } catch (err) {
          fail(`invalid grouped provider dataset for ${key} (${subKey}): ${err.message}`);
        }
        if (!Array.isArray(providers) || providers.length < 1) {
          failures.push(`${key} grouped provider dataset empty (${subKey})`);
        }
      }
    } else {
      const providerPath = path.join(ROOT, runtime.provider_dataset_path || '');
      requireFile(providerPath, `provider dataset for ${key}`);
      let providers;
      try {
        providers = readJson(providerPath);
      } catch (err) {
        fail(`invalid provider dataset for ${key}: ${runtime.provider_dataset_path} (${err.message})`);
      }
      if (!Array.isArray(providers) || providers.length < 1) {
        failures.push(`${key} provider dataset empty`);
      }
    }
  }

  if (failures.length) {
    console.error('validate_coverage_parity failed:');
    failures.forEach((msg) => console.error(` - ${msg}`));
    process.exit(1);
  }

  console.log(`validate_coverage_parity: OK (${promotedRows.length} promoted coverage rows)`);
}

function checkMasterInventoryMode() {
  const arr = readJson(MASTER_INVENTORY_JSON);
  if (!Array.isArray(arr) || !arr.length) fail('master_inventory.json must be a non-empty array');

  const failures = [];
  for (const item of arr) {
    const slug = String(item.slug || item.id || '').trim();
    const vertical = normalizeVertical(item.vertical);
    if (!slug || !vertical) {
      failures.push('master inventory entry missing slug/id or vertical');
      continue;
    }
    const expected = [
      path.join(ROOT, vertical, slug, 'index.html'),
      path.join(ROOT, 'dist', vertical, slug, 'index.html'),
      path.join(ROOT, 'data', 'listings', `${slug}.json`)
    ];
    if (!expected.some((fp) => fs.existsSync(fp))) {
      failures.push(`${vertical}/${slug} missing runtime representation`);
    }
  }

  if (failures.length) {
    console.error('validate_coverage_parity failed:');
    failures.forEach((msg) => console.error(` - ${msg}`));
    process.exit(1);
  }

  console.log(`validate_coverage_parity: OK (${arr.length} authoritative inventory rows)`);
}

if (fs.existsSync(MASTER_INVENTORY_JSON)) {
  checkMasterInventoryMode();
} else {
  checkCoveragePromotedMode();
}
