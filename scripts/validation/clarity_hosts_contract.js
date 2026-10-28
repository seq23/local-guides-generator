#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: data/clarity_projects.json maps every public host to its Clarity
 * project id, the shipped loader carries the active host's id, and every
 * eligible rendered page outside skip_files loads it, with none on information
 * pages in all six publications scoped by the Search Readiness repairs.
 */
const fs = require('fs');
const path = require('path');
const { ROOT, DIST, publicHosts, activeHost, pages, head } = require('./lib_site_dist');
const { clarityEligible } = require('../lib/search_readiness_policy');

function fail(msg) { console.error(`CLARITY HOSTS FAIL: ${msg}`); process.exit(1); }

const EXPECTED = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'contracts', 'site_hygiene_registry.json'), 'utf8')).clarity_projects;
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'clarity_projects.json'), 'utf8'));
for (const host of publicHosts()) {
  const id = (cfg.projects || {})[host];
  if (!id && (cfg.pending || {})[host]) { console.log(`NAMED STOP: no Clarity project for ${host} yet: ${cfg.pending[host]}`); continue; }
  if (!id) fail(`no Clarity project for ${host}`);
  if (EXPECTED[host] && EXPECTED[host] !== id) fail(`${host} maps to ${id}, expected ${EXPECTED[host]}`);
}
const host = activeHost();
if (!cfg.projects[host]) { console.log(`CLARITY HOSTS: NAMED SKIP - ${host} is not a public host`); process.exit(0); }
const loader = path.join(DIST, 'assets', 'clarity-loader.js');
if (!fs.existsSync(loader)) fail('assets/clarity-loader.js missing from output root');
if (!fs.readFileSync(loader, 'utf8').includes(`"${host}":"${cfg.projects[host]}"`)) fail(`loader does not map ${host} to ${cfg.projects[host]}`);
const skip = new Set(cfg.skip_files || []);
const all = pages(fail).filter((p) => !skip.has(p.file));
const eligible = all.filter((p) => clarityEligible(p.html, `https://${host}/`));
const bad = all.filter((p) => clarityEligible(p.html, `https://${host}/`)
  ? !/<script data-clarity-loader src="\/assets\/clarity-loader\.js"/.test(head(p.html))
  : /data-clarity-loader|clarity\.ms\/tag\//i.test(p.html));
if (bad.length) fail(`${bad.length}/${all.length} pages violate Clarity eligibility, e.g. ${bad.slice(0, 3).map((b) => b.file).join(', ')}`);
console.log(`CLARITY HOSTS CONTRACT PASS (${publicHosts().length} hosts mapped; ${host} ${eligible.length}/${all.length} pages eligible and tagged)`);
