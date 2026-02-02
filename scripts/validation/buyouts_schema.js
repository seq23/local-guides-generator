const fs = require('fs');
const path = require('path');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function isIsoDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function run() {
  const file = path.join(process.cwd(), 'data', 'buyouts.json');
  const data = readJson(file);
  if (!Array.isArray(data)) {
    throw new Error('BUYOUTS SCHEMA FAIL: data/buyouts.json must be an array');
  }

  const allowedScopes = new Set(['guide', 'city', 'state', 'vertical']);
  data.forEach((rec, idx) => {
    if (typeof rec !== 'object' || !rec) throw new Error(`BUYOUTS SCHEMA FAIL: record[${idx}] must be object`);
    if (!allowedScopes.has(rec.scope)) throw new Error(`BUYOUTS SCHEMA FAIL: record[${idx}].scope invalid`);
    if (!Array.isArray(rec.targets) || rec.targets.length === 0) throw new Error(`BUYOUTS SCHEMA FAIL: record[${idx}].targets required`);
    if (!isIsoDate(rec.starts_on)) throw new Error(`BUYOUTS SCHEMA FAIL: record[${idx}].starts_on invalid`);
    if (!isIsoDate(rec.ends_on)) throw new Error(`BUYOUTS SCHEMA FAIL: record[${idx}].ends_on invalid`);
    if (typeof rec.priority !== 'number') throw new Error(`BUYOUTS SCHEMA FAIL: record[${idx}].priority must be number`);
    if (typeof rec.buyout !== 'boolean') throw new Error(`BUYOUTS SCHEMA FAIL: record[${idx}].buyout must be boolean`);
    if (rec.live !== undefined && typeof rec.live !== 'boolean') throw new Error(`BUYOUTS SCHEMA FAIL: record[${idx}].live must be boolean`);
  });

  console.log(`✅ BUYOUTS SCHEMA PASS (${data.length} records)`);
}

module.exports = { run };
