#!/usr/bin/env node
/* eslint-disable no-console */
//
// Edge cache for the static sites, as code (config/edge_cache.json).
//
//   node scripts/cloudflare/apply_edge_cache.js rules          # upsert the cache rule on every zone
//   node scripts/cloudflare/apply_edge_cache.js wait <sha>     # wait for every Pages project to deploy <sha>
//   node scripts/cloudflare/apply_edge_cache.js purge          # purge every zone
//
// Token: CLOUDFLARE_EDGE_CACHE_TOKEN (Zone Read, Cache Rules Edit, Cache Purge,
// Pages Read). Each mode exits non-zero unless it acted on every configured
// zone/project, so it can never pass having done nothing.
//
// Why: see config/edge_cache.json. HTML was cf-cache-status DYNAMIC on every
// request, so every crawler fetch went to the Pages origin.
const fs = require('fs');
const path = require('path');

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config', 'edge_cache.json'), 'utf8'));
const API = 'https://api.cloudflare.com/client/v4';

function cacheRule(cfg) {
  const bypass = cfg.uncached_path_prefixes.map((p) => `not starts_with(http.request.uri.path, "${p}")`).join(' and ');
  return {
    ref: cfg.rule_ref,
    description: 'Static HTML and assets from the edge cache; /api/ stays dynamic (local-guides-generator config/edge_cache.json)',
    expression: `(${bypass})`,
    action: 'set_cache_settings',
    action_parameters: {
      cache: true,
      edge_ttl: {
        mode: 'override_origin',
        default: cfg.edge_ttl_seconds,
        status_code_ttl: [{ status_code_range: { from: 400, to: 599 }, value: -1 }]
      },
      browser_ttl: { mode: 'respect_origin' }
    },
    enabled: true
  };
}

async function cf(token, method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function zoneId(token, name) {
  const r = await cf(token, 'GET', `/zones?name=${encodeURIComponent(name)}`);
  const id = r.json && r.json.result && r.json.result[0] && r.json.result[0].id;
  if (!id) throw new Error(`zone not found or not readable: ${name} (HTTP ${r.status})`);
  return id;
}

async function applyRules(token) {
  const rule = cacheRule(CONFIG);
  let done = 0;
  for (const { zone } of CONFIG.sites) {
    const id = await zoneId(token, zone);
    const ep = await cf(token, 'GET', `/zones/${id}/rulesets/phases/http_request_cache_settings/entrypoint`);
    const existing = ep.status === 200 ? (ep.json.result.rules || []) : [];
    // Keep any rule someone else added; replace only ours (matched by ref).
    const rules = existing.filter((r) => r.ref !== rule.ref).map((r) => {
      const { id: _id, version: _v, last_updated: _l, ...rest } = r; // eslint-disable-line no-unused-vars
      return rest;
    });
    rules.push(rule);
    const put = await cf(token, 'PUT', `/zones/${id}/rulesets/phases/http_request_cache_settings/entrypoint`, { rules });
    if (!put.json.success) throw new Error(`cache rule update failed on ${zone}: ${JSON.stringify(put.json.errors)}`);
    console.log(`rules: ${zone} -> ${rules.length} cache rule(s), ${rule.ref} edge TTL ${CONFIG.edge_ttl_seconds}s`);
    done += 1;
  }
  if (done !== CONFIG.sites.length) throw new Error(`rules: applied on ${done}/${CONFIG.sites.length} zones`);
}

async function waitForDeploy(token, sha, timeoutMs) {
  const projects = [...new Set(CONFIG.sites.map((s) => s.pages_project))];
  const pending = new Set(projects);
  const deadline = Date.now() + timeoutMs;
  while (pending.size && Date.now() < deadline) {
    for (const p of [...pending]) {
      const r = await cf(token, 'GET', `/accounts/${CONFIG.account_id}/pages/projects/${p}/deployments?env=production&per_page=5`);
      const deps = (r.json && r.json.result) || [];
      const mine = deps.find((d) => d.deployment_trigger && d.deployment_trigger.metadata && d.deployment_trigger.metadata.commit_hash === sha);
      const stage = mine && mine.latest_stage;
      if (stage && stage.status === 'success') { console.log(`wait: ${p} deployed ${sha.slice(0, 7)}`); pending.delete(p); }
      else if (stage && ['failure', 'canceled'].includes(stage.status)) throw new Error(`wait: ${p} deployment of ${sha.slice(0, 7)} ${stage.status} at ${stage.name}`);
    }
    if (pending.size) await new Promise((res) => setTimeout(res, 20000));
  }
  if (pending.size) throw new Error(`wait: timed out waiting for ${[...pending].join(', ')} to deploy ${sha.slice(0, 7)}`);
}

async function purge(token) {
  let done = 0;
  for (const { zone } of CONFIG.sites) {
    const id = await zoneId(token, zone);
    const r = await cf(token, 'POST', `/zones/${id}/purge_cache`, { purge_everything: true });
    if (!r.json.success) throw new Error(`purge failed on ${zone}: ${JSON.stringify(r.json.errors)}`);
    console.log(`purge: ${zone} purged`);
    done += 1;
  }
  if (done !== CONFIG.sites.length) throw new Error(`purge: ${done}/${CONFIG.sites.length} zones`);
}

async function main() {
  const [mode, arg] = process.argv.slice(2);
  const token = process.env.CLOUDFLARE_EDGE_CACHE_TOKEN;
  if (!token) throw new Error('CLOUDFLARE_EDGE_CACHE_TOKEN is not set');
  if (mode === 'rules') return applyRules(token);
  if (mode === 'wait') { if (!arg) throw new Error('wait needs a commit sha'); return waitForDeploy(token, arg, Number(process.env.EDGE_CACHE_WAIT_MS || 30 * 60 * 1000)); }
  if (mode === 'purge') return purge(token);
  throw new Error('usage: apply_edge_cache.js rules | wait <sha> | purge');
}

module.exports = { cacheRule, CONFIG };

if (require.main === module) {
  main().catch((e) => { console.error(`EDGE CACHE FAIL: ${e.message}`); process.exit(1); });
}
