#!/usr/bin/env node
/**
 * Pull CITY-level clinician counts for neuropsychological evaluation, so a city
 * page can say something true of the city rather than only of the state.
 *
 * Why this exists. The geography file
 * (pull_cms_geo_service_costs.js) is state-level, which means San Diego and San
 * Francisco receive identical figures. Measured on the rendered pages, that pair
 * sits at 0.99 Dice - two pages competing for different queries on the same
 * text. State data cannot fix that, because the two cities genuinely are in the
 * same state. City data can.
 *
 * Source: Centers for Medicare & Medicaid Services, "Medicare Physician & Other
 * Practitioners - by Provider and Service", calendar year 2024 file (released
 * 2026-05-21, file PHY_R26_P05_V10_D24_Prov). This is the same release as the
 * geography file already in this repo, so the two are internally consistent.
 * Landing page:
 * https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider-and-service
 *
 * What a row is: one rendering provider, one HCPCS code, one year. The city is
 * Rndrng_Prvdr_City, which is the PRACTICE ADDRESS on the claim.
 *
 * Limits, which every page built on this must state:
 *   - Practice address is not catchment. A neuropsychologist serving Dallas from
 *     a Plano office counts as Plano. City counts therefore UNDERSTATE a metro,
 *     sometimes badly, and must never be presented as "the number of providers
 *     available in <city>".
 *   - CMS suppresses provider-service rows covering fewer than 11 beneficiaries,
 *     so low-volume clinicians are absent entirely. A city with a real clinic
 *     can show zero.
 *   - Medicare fee-for-service only. Private-pay and paediatric practices, which
 *     are much of the neuropsychology market, do not appear.
 *   - These are counts of clinicians who BILLED, not a directory, not a
 *     recommendation, and not evidence about quality.
 *
 * Usage: node scripts/research/pull_cms_provider_city_neuro.js
 * Writes data/research/costs/cms_provider_city_neuro_2024.json.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'data', 'research', 'costs', 'cms_provider_city_neuro_2024.json');

// Version-pinned CY2024 distribution, not a "latest" alias, so a rerun after
// CMS publishes CY2025 does not silently change every number on every page.
const DATASET_ID = '92396110-2aed-4d63-a6a2-5d6207d46a29';
const API = (qs) => `https://data.cms.gov/data-api/v1/dataset/${DATASET_ID}/data?${qs}`;

// Only the evaluation codes a member of the public would call "a neuropsych
// eval", plus the administration code that is billed alongside them.
const CODES = {
  96132: 'Evaluation of neuropsychological test, first hour',
  96133: 'Evaluation of neuropsychological test, each additional hour',
  96136: 'Administration of psychological or neuropsychological test, first 30 minutes',
};

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'local-guides-generator/city-research' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode} for ${url}`)); return; }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function pullCode(code) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const page = await get(API(`filter%5BHCPCS_Cd%5D=${encodeURIComponent(code)}&size=5000&offset=${offset}`));
    if (!Array.isArray(page) || !page.length) break;
    rows.push(...page);
    if (page.length < 5000) break;
    offset += 5000;
  }
  return rows;
}

const numOrNull = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const round2 = (n) => (n === null ? null : Math.round(n * 100) / 100);
const keyOf = (city, st) => `${String(city || '').trim().toUpperCase()}|${String(st || '').trim().toUpperCase()}`;

(async () => {
  const out = {
    source: {
      publisher: 'Centers for Medicare & Medicaid Services',
      dataset: 'Medicare Physician & Other Practitioners - by Provider and Service',
      calendar_year: 2024,
      dataset_released: '2026-05-21',
      distribution_id: DATASET_ID,
      landing_page: 'https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider-and-service',
      api_base: `https://data.cms.gov/data-api/v1/dataset/${DATASET_ID}/data`,
    },
    unit_of_observation: 'One rendering provider, one HCPCS code, calendar year 2024. City is the practice address on the claim (Rndrng_Prvdr_City).',
    limits: [
      'Practice address is not catchment: a clinician serving a metro from a suburban office counts as the suburb. City counts UNDERSTATE metros and must never be presented as the number of providers available in a city.',
      'CMS suppresses provider-service rows covering fewer than 11 beneficiaries, so low-volume clinicians are absent entirely and a city with a real clinic can show zero.',
      'Medicare fee-for-service only. Private-pay and paediatric neuropsychology practices, which are much of this market, do not appear.',
      'These are counts of clinicians who billed, not a directory, not a recommendation, and not evidence about quality.',
    ],
    pulled_at: new Date().toISOString().slice(0, 10),
    codes: {},
    cities: {},
  };

  for (const [code, description] of Object.entries(CODES)) {
    process.stderr.write(`pulling ${code}...`);
    const rows = await pullCode(code);
    process.stderr.write(` ${rows.length} rows\n`);
    out.codes[code] = { hcpcs: code, description, provider_rows: rows.length };

    for (const r of rows) {
      const city = r.Rndrng_Prvdr_City;
      const st = r.Rndrng_Prvdr_State_Abrvtn;
      if (!city || !st) continue;
      const k = keyOf(city, st);
      const bucket = (out.cities[k] ||= {
        city: String(city).trim(),
        state_abbr: String(st).trim().toUpperCase(),
        codes: {},
      });
      const cb = (bucket.codes[code] ||= {
        rendering_providers: 0,
        beneficiaries: 0,
        services: 0,
        _chg_weight: 0,
        _chg_sum: 0,
        provider_types: {},
      });
      cb.rendering_providers += 1;
      cb.beneficiaries += numOrNull(r.Tot_Benes) || 0;
      cb.services += numOrNull(r.Tot_Srvcs) || 0;
      const chg = numOrNull(r.Avg_Sbmtd_Chrg);
      const svc = numOrNull(r.Tot_Srvcs);
      // Service-weighted mean, so a one-service outlier cannot move a city's
      // figure the way a plain mean of provider averages would.
      if (chg !== null && svc) { cb._chg_sum += chg * svc; cb._chg_weight += svc; }
      const t = String(r.Rndrng_Prvdr_Type || '').trim();
      if (t) cb.provider_types[t] = (cb.provider_types[t] || 0) + 1;
    }
  }

  for (const bucket of Object.values(out.cities)) {
    for (const cb of Object.values(bucket.codes)) {
      cb.avg_submitted_charge_service_weighted = cb._chg_weight ? round2(cb._chg_sum / cb._chg_weight) : null;
      delete cb._chg_sum; delete cb._chg_weight;
      cb.provider_types = Object.fromEntries(
        Object.entries(cb.provider_types).sort((a, b) => b[1] - a[1]).slice(0, 5)
      );
    }
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  const n = Object.keys(out.cities).length;
  console.log(`wrote ${path.relative(ROOT, OUT)}: ${n} distinct practice cities across ${Object.keys(CODES).length} codes`);
})().catch((e) => { console.error(e.message); process.exit(1); });
