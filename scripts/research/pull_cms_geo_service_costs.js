#!/usr/bin/env node
/**
 * Pull real, published price figures for the cost pages, and record where each
 * one came from.
 *
 * Source: Centers for Medicare & Medicaid Services, "Medicare Physician & Other
 * Practitioners - by Geography and Service", calendar year 2024 file (released
 * 2026-05-21). Landing page:
 * https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-geography-and-service
 *
 * What the numbers mean, because a cost page that gets this wrong is worse than
 * no cost page:
 *   Avg_Sbmtd_Chrg      the average amount providers BILLED for the code. This
 *                       is list price, and almost nobody pays it.
 *   Avg_Mdcr_Alowd_Amt  the average amount Medicare ALLOWED - the negotiated
 *                       price, including the beneficiary's coinsurance.
 *   Avg_Mdcr_Pymt_Amt   the average amount Medicare actually PAID.
 * The gap between the first and the second is the single most useful published
 * fact about US healthcare pricing, and it is the spine of every cost page here.
 *
 * Limits, which every page built on this must state:
 *   - Medicare fee-for-service claims only. The population skews 65+ and
 *     disabled beneficiaries, so utilisation is not the general population's.
 *   - A cash-pay or commercially-insured patient is not charged the allowed
 *     amount. The submitted charge is closer to a self-pay starting point, and
 *     is still not a quote.
 *   - Codes Medicare does not cover (routine dental restorative work, most
 *     elective hormone therapy) do not appear at all. Their absence here is a
 *     finding, not a gap to fill with an invented number.
 *
 * Usage: node scripts/research/pull_cms_geo_service_costs.js
 * Writes data/research/costs/cms_geography_service_2024.json.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'data', 'research', 'costs', 'cms_geography_service_2024.json');

// Version-pinned CY2024 distribution, not the "latest" alias, so a rerun after
// CMS publishes CY2025 does not silently change every number on every page.
const DATASET_ID = '0c75b0b3-b40f-4007-a5ac-f9f2fed95862';
const API = (qs) => `https://data.cms.gov/data-api/v1/dataset/${DATASET_ID}/data?${qs}`;

const CODE_SETS = {
  neuro: ['96116', '96121', '96130', '96131', '96132', '96133', '96136', '96137'],
  hormone: ['11980', '84403', '84402', '82670', '84443', '85025', '80053', '96372'],
  dental_oral_surgery: ['D7140', 'D7210', 'D7220', 'D7230', 'D7240', '41899', '21248'],
  injury_care: ['99283', '99284', '99285', '72141', '72148', '73721', '97110', '97140', '20610', '62323', '64483'],
};

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'local-guides-generator/cost-research' } }, (res) => {
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
    const page = await get(API(`filter%5BHCPCS_Cd%5D=${encodeURIComponent(code)}&size=500&offset=${offset}`));
    if (!Array.isArray(page) || !page.length) break;
    rows.push(...page);
    if (page.length < 500) break;
    offset += 500;
  }
  return rows;
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const round2 = (n) => (n === null ? null : Math.round(n * 100) / 100);

(async () => {
  const out = {
    source: {
      publisher: 'Centers for Medicare & Medicaid Services',
      dataset: 'Medicare Physician & Other Practitioners - by Geography and Service',
      calendar_year: 2024,
      dataset_released: '2026-05-21',
      distribution_id: DATASET_ID,
      landing_page: 'https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-geography-and-service',
      api_base: `https://data.cms.gov/data-api/v1/dataset/${DATASET_ID}/data`,
    },
    field_meaning: {
      avg_submitted_charge: 'Average amount the provider billed for the code (list price).',
      avg_medicare_allowed: 'Average amount Medicare allowed, including beneficiary coinsurance (negotiated price).',
      avg_medicare_paid: 'Average amount Medicare paid.',
      place_of_service: 'F = facility (hospital/outpatient department). O = office / non-facility.',
    },
    limits: [
      'Medicare fee-for-service claims only; the population skews 65+ and disabled beneficiaries.',
      'Not a quote. A cash-pay patient is not charged the allowed amount, and the submitted charge is a starting point, not a price.',
      'Codes Medicare does not cover do not appear in this dataset at all.',
      'CMS suppresses cells with fewer than 11 beneficiaries, so some states are absent for low-volume codes.',
    ],
    pulled_at: new Date().toISOString().slice(0, 10),
    codes: {},
  };

  for (const [group, codes] of Object.entries(CODE_SETS)) {
    for (const code of codes) {
      process.stdout.write(`pulling ${group}/${code} ... `);
      let rows;
      try { rows = await pullCode(code); } catch (e) { console.log(`ERROR ${e.message}`); continue; }
      if (!rows.length) { console.log('no rows (code absent from dataset)'); out.codes[code] = { group, hcpcs: code, present: false }; continue; }
      const entry = {
        group,
        hcpcs: code,
        present: true,
        description: rows[0].HCPCS_Desc,
        national: {},
        states: {},
      };
      for (const r of rows) {
        const rec = {
          rendering_providers: num(r.Tot_Rndrng_Prvdrs),
          beneficiaries: num(r.Tot_Benes),
          services: num(r.Tot_Srvcs),
          avg_submitted_charge: round2(num(r.Avg_Sbmtd_Chrg)),
          avg_medicare_allowed: round2(num(r.Avg_Mdcr_Alowd_Amt)),
          avg_medicare_paid: round2(num(r.Avg_Mdcr_Pymt_Amt)),
        };
        const pos = r.Place_Of_Srvc;
        if (r.Rndrng_Prvdr_Geo_Lvl === 'National') entry.national[pos] = rec;
        else if (r.Rndrng_Prvdr_Geo_Lvl === 'State') {
          entry.states[r.Rndrng_Prvdr_Geo_Desc] = entry.states[r.Rndrng_Prvdr_Geo_Desc] || {};
          entry.states[r.Rndrng_Prvdr_Geo_Desc][pos] = rec;
        }
      }
      out.codes[code] = entry;
      console.log(`${rows.length} rows, ${Object.keys(entry.states).length} states`);
    }
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  const present = Object.values(out.codes).filter((c) => c.present).length;
  console.log(`\nwrote ${path.relative(ROOT, OUT)}: ${present}/${Object.keys(out.codes).length} codes present in the CMS file.`);
})();
