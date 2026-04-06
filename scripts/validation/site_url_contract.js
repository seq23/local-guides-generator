const fs = require("fs");
const path = require("path");

function fail(msg) {
  console.error(`SITE URL CONTRACT FAIL: ${msg}`);
  process.exit(1);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function scanFiles(rootDir) {
  const hits = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", ".git"].includes(entry.name)) continue;
        walk(p);
      } else if (entry.isFile()) {
        const txt = fs.readFileSync(p, "utf8");
        if (/https?:\/\/example\.com|example\.com/i.test(txt)) {
          hits.push(path.relative(process.cwd(), p));
        }
      }
    }
  }
  if (fs.existsSync(rootDir)) walk(rootDir);
  return hits;
}

function run() {
  const sitePath = path.join(process.cwd(), 'data', 'site.json');
  if (!fs.existsSync(sitePath)) fail('Missing data/site.json');
  const site = readJson(sitePath);
  const siteUrl = String(site.siteUrl || '').trim();
  if (!siteUrl) fail('data/site.json siteUrl is empty');
  if (/placeholder-domain\.invalid/i.test(siteUrl)) fail(`data/site.json uses forbidden placeholder domain: ${siteUrl}`);

  const distDir = path.join(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    const distHits = scanFiles(distDir);
    if (distHits.length) fail(`dist contains forbidden placeholder-domain.invalid references: ${distHits.slice(0,10).join(', ')}`);
  }
}

module.exports = { run };
