// Fixtures for scripts/validation/request_form_own_vertical_contract.js (owner,
// 25 Oct 2026): every guide site's forms open on its own service, pre-selected,
// with the other services still listed; every lead carries the site's
// vertical_key and the page the visitor came from; the endpoint accepts each
// site's own label and fills vertical_key from the host when a form omits it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const lf = require('../../scripts/lib/site_lead_form.js');
const ns = require('../../scripts/lib/neuro_services.js');
const aff = require('../../scripts/lib/trt_affiliates.js');
const contract = require('../../scripts/validation/request_form_own_vertical_contract.js');
const { PACK_SITE_CONFIG } = require('../../scripts/lib/pack_site_config.js');

const shared = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/global_pages/request-assistance.json'), 'utf8')).main_html;
const fnSrc = fs.readFileSync(path.join(ROOT, 'functions/api/request-assistance.js'), 'utf8');
const VKS = ['pi', 'dentistry', 'neuro', 'trt', 'uscis_medical'];

function sitePage(vk) {
  let h = shared;
  if (vk === 'neuro') h = ns.applyToRequestAssistanceHtml(h);
  if (vk === 'trt') h = aff.applyToRequestAssistanceHtml(h);
  return lf.applyOwnVerticalFirst(h, vk);
}
const formOf = (h) => h.match(/<form[^>]*id="request-assistance-form"[^>]*>[\s\S]*?<\/form>/i)[0];

test('every guide site opens on its own service, pre-selected, others listed below', () => {
  for (const vk of VKS) {
    const page = sitePage(vk);
    assert.deepEqual(contract.checkForm(formOf(page), vk, vk), [], vk);
    assert.deepEqual(contract.checkRequestPageAttribution(page, vk, PACK_SITE_CONFIG[vk].siteUrl), [], vk);
    assert.deepEqual(contract.checkApiAccepts(vk, fnSrc), [], vk);
    const opts = lf.providerOptions(formOf(page));
    assert.equal(opts[0].text, lf.OWN_PROVIDER_TYPES[vk][0]);
    assert.ok(opts.length >= 5, vk + ': other services must stay listed');
  }
});

test('the 25 Oct 2026 neuro form fails: "Select one" default, Personal Injury first, blank vertical_key', () => {
  const lead = ns.applyToRequestAssistanceHtml(shared);
  const p = contract.checkForm(formOf(lead), 'neuro', 'neuro');
  assert.ok(p.some((x) => /first provider type is "Select one"/.test(x)), p.join('\n'));
  assert.ok(p.some((x) => /blank default/.test(x)));
  assert.ok(p.some((x) => /vertical_key is ""/.test(x)));
});

test('own service first but not pre-selected fails; a second pre-selection fails', () => {
  const page = sitePage('neuro');
  const unselected = formOf(page).replace('<option selected>', '<option>');
  assert.ok(contract.checkForm(unselected, 'neuro', 'x').some((x) => /not pre-selected/.test(x)));
  const two = formOf(page).replace('<option>Personal Injury Attorney</option>', '<option selected>Personal Injury Attorney</option>');
  assert.ok(contract.checkForm(two, 'neuro', 'x').some((x) => /2 options pre-selected/.test(x)));
});

test('a foreign service listed first fails, even pre-selected', () => {
  const page = sitePage('pi');
  const foreign = lf.applyOwnVerticalFirst(page, 'dentistry');
  assert.ok(contract.checkForm(formOf(foreign), 'pi', 'x').some((x) => /first provider type is "Dentist/.test(x)));
});

test('dropping the other services fails (owner: keep them listed)', () => {
  const only = formOf(sitePage('uscis_medical')).replace(/(<option selected>USCIS Medical Exam Provider<\/option>)[\s\S]*?(<\/select>)/, '$1$2');
  assert.ok(contract.checkForm(only, 'uscis_medical', 'x').some((x) => /no longer listed/.test(x)));
});

test('the old attribution script, which blanked vertical_key and ignored the referrer, fails', () => {
  const page = sitePage('neuro')
    .replace("if (el) el.value = paramMap[key] || el.value || '';", "if (el) el.value = paramMap[key] || '';")
    .replace("if (srcEl) srcEl.value = src || refTag || 'direct';", "if (srcEl) srcEl.value = src || '';")
    .replace("page_slug: qs('page_slug') || refPath,", "page_slug: qs('page_slug'),");
  const p = contract.checkRequestPageAttribution(page, 'neuro', 'https://neuroevalguides.com');
  assert.ok(p.some((x) => /leaves vertical_key ""/.test(x)), p.join('\n'));
  assert.ok(p.some((x) => /leaves src ""/.test(x)));
  assert.ok(p.some((x) => /leaves page_slug ""/.test(x)));
});

test('another site as referrer is tagged by host and path', () => {
  const r = contract.runRequestPageScript(sitePage('trt'), { href: 'https://hormonesivhair.com/request-assistance/', referrer: 'https://www.google.com/' });
  assert.equal(r.src, 'www.google.com/');
  assert.equal(r.page_slug, '');
  assert.equal(r.vertical_key, 'trt');
  assert.equal(r.button_source, 'request_page_referrer');
});

test('an endpoint that rejects a site label fails', () => {
  const broken = fnSrc.replace(`  '${ns.NEURO_PROVIDER_TYPE}',\n`, '');
  assert.notEqual(broken, fnSrc);
  assert.ok(contract.checkApiAccepts('neuro', broken).length > 0);
});

test('applyOwnVerticalFirst throws instead of shipping an unchanged form', () => {
  assert.throws(() => lf.applyOwnVerticalFirst(shared.replace('<option>Personal Injury Attorney</option>', ''), 'pi'), /no "Personal Injury Attorney" option/);
  assert.throws(() => lf.applyOwnVerticalFirst(shared.replace(/name="vertical_key"/, 'name="vk"'), 'pi'), /vertical_key/);
  assert.equal(lf.applyOwnVerticalFirst(shared, 'starter'), shared, 'non-guide packs keep the shared form');
});

// --- Endpoint ---------------------------------------------------------------

test("the endpoint's host map matches every guide site and pages project", () => {
  const block = fnSrc.match(/const HOST_VERTICAL = \{([\s\S]*?)\};/)[1];
  const map = Object.fromEntries(Array.from(block.matchAll(/'([^']+)':\s*'([^']+)'/g)).map((m) => [m[1], m[2]]));
  for (const vk of VKS) assert.equal(map[new URL(PACK_SITE_CONFIG[vk].siteUrl).host], vk, vk + ' siteUrl');
  const edge = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/edge_cache.json'), 'utf8'));
  for (const s of edge.sites) {
    const vk = s.pages_project.replace('local-guides-generator-', '').replace(/-/g, '_');
    if (!VKS.includes(vk)) continue;
    assert.equal(map[s.zone], vk, s.zone);
    assert.equal(map[s.pages_project + '.pages.dev'], vk, s.pages_project);
  }
  assert.deepEqual([...new Set(Object.values(map))].sort(), [...VKS].sort());
});

async function loadEndpoint() {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ra-fn-')), 'request-assistance.mjs');
  fs.writeFileSync(tmp, fnSrc);
  return import(pathToFileURL(tmp).href);
}

async function post(mod, host, body) {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    if (String(url).includes('airtable')) return new Response(JSON.stringify({ records: [{ id: 'rec1' }] }), { status: 200 });
    return new Response('{}', { status: 200 });
  };
  try {
    const req = new Request(`https://${host}/api/request-assistance`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const res = await mod.onRequestPost({ request: req, env: { AIRTABLE_BASE_ID: 'app', AIRTABLE_TABLE_NAME: 'Leads', AIRTABLE_API_TOKEN: 't', RESEND_API_KEY: 'r', LEAD_TO: 'leads@example.com' } });
    return { status: res.status, fields: ((calls.find((c) => c.url.includes('airtable')) || {}).body || { records: [{}] }).records[0].fields, mail: ((calls.find((c) => c.url.includes('resend')) || {}).body || {}).text || '' };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('a lead with no vertical_key gets the host site; source page fields reach the row', async () => {
  const mod = await loadEndpoint();
  const r = await post(mod, 'neuroevalguides.com', { email: 'a@example.com', consent: 'on', provider_type: ns.NEURO_PROVIDER_TYPE, service_needed: 'evaluation', vertical_key: '', src: '/states/MA/boston/', page_slug: '/states/MA/boston/', button_source: 'request_page_referrer' });
  assert.equal(r.status, 200);
  assert.equal(r.fields.vertical_key, 'neuro');
  assert.equal(r.fields.provider_type, ns.NEURO_PROVIDER_TYPE);
  assert.equal(r.fields.src, '/states/MA/boston/');
  assert.equal(r.fields.page_slug, '/states/MA/boston/');
  assert.equal(r.fields.button_source, 'request_page_referrer');
  for (const [host, vk] of [['www.uscisexam.com', 'uscis_medical'], ['thedentistryguides.com', 'dentistry'], ['abc123.local-guides-generator-trt.pages.dev', 'trt'], ['theaccidentguides.com', 'pi']]) {
    const x = await post(mod, host, { email: 'a@example.com', consent: 'on', provider_type: 'Personal Injury Attorney' });
    assert.equal(x.fields.vertical_key, vk, host);
  }
  // A bare /request-assistance/ submission on the umbrella site: blanks read "(not tagged)" in the email.
  const umbrella = await post(mod, 'theindustryguides.com', { email: 'a@example.com', consent: 'on', provider_type: 'Personal Injury Attorney' });
  assert.equal(umbrella.fields.vertical_key, '', 'the multi-vertical umbrella site is not guessed');
  assert.match(umbrella.mail, /^vertical_key: \(not tagged\)$/m);
  assert.match(umbrella.mail, /^page_slug: \(not tagged\)$/m);
  assert.doesNotMatch(umbrella.mail, /^[a-z_]+: $/m, 'no blank line in the lead email');
  const explicit = await post(mod, 'neuroevalguides.com', { email: 'a@example.com', consent: 'on', provider_type: ns.NEURO_PROVIDER_TYPE, service_needed: 'both', vertical_key: 'neuro' });
  assert.equal(explicit.fields.vertical_key, 'neuro');
});
