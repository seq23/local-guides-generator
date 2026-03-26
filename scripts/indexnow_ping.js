#!/usr/bin/env node
/**
 * Pings IndexNow endpoint for the current published surface.
 *
 * Rules:
 *  - If INDEXNOW_KEY is not set, exits 0 (safe no-op).
 *  - Hosts come from:
 *      1) INDEXNOW_HOSTS (comma/space separated)
 *      2) INDEXNOW_HOST
 *      3) SITE_URL (host)
 *  - If dist/sitemap.xml exists, submit the current crawlable surface from the sitemap.
 *  - Else if dist/ exists, derive the current crawlable surface from built index.html pages.
 *  - Else fall back to sitemap + homepage only.
 *  - Sends one request per host, chunked to 10,000 URLs max per request.
 *
 * NOTE: Intended to be non-blocking in CI (wrap in continue-on-error in workflows).
 */
const { getIndexNowConfig } = require("./lib/indexnow_config");
const https = require("https");
const fs = require("fs");
const path = require("path");

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body), "utf8");
    const u = new URL(url);
    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        path: u.pathname + (u.search || ""),
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": data.length,
        },
      },
      (res) => {
        let out = "";
        res.on("data", (c) => (out += c));
        res.on("end", () => resolve({ status: res.statusCode, body: out }));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function walkFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) stack.push(p);
      else out.push(p);
    }
  }
  return out;
}

function toUrlPath(distDir, filePath) {
  const rel = path.relative(distDir, filePath).replace(/\/g, '/');
  if (rel === 'index.html') return '/';
  if (!rel.endsWith('/index.html')) return null;
  return `/${rel.slice(0, -'/index.html'.length)}/`;
}

function parseSitemapLocs(xml) {
  const out = [];
  const re = /<loc>([\s\S]*?)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) out.push(String(m[1] || '').trim());
  return out;
}

function collectCurrentSurface(host) {
  const distDir = path.join(process.cwd(), 'dist');
  const sitemapPath = path.join(distDir, 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    const xml = fs.readFileSync(sitemapPath, 'utf8');
    const urls = parseSitemapLocs(xml)
      .filter(Boolean)
      .map((loc) => {
        try {
          return new URL(loc).toString();
        } catch (_) {
          return '';
        }
      })
      .filter(Boolean);
    if (urls.length) return Array.from(new Set(urls));
  }

  if (fs.existsSync(distDir)) {
    const urls = walkFiles(distDir)
      .map((fp) => toUrlPath(distDir, fp))
      .filter(Boolean)
      .map((p) => new URL(p, `https://${host}`).toString());
    if (urls.length) return Array.from(new Set(urls));
  }

  return [`https://${host}/sitemap.xml`, `https://${host}/`];
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const cfg = getIndexNowConfig();
  if (!cfg.key) return;

  const hosts = cfg.hosts.length
    ? cfg.hosts
    : cfg.primaryHost
      ? [cfg.primaryHost]
      : [];

  if (cfg.ci && hosts.length === 0) {
    console.error("INDEXNOW_KEY is set but no hosts are configured. Set SITE_URL or INDEXNOW_HOST(S).");
    process.exit(1);
  }
  if (hosts.length === 0) return;

  for (const host of hosts) {
    const currentSurface = collectCurrentSurface(host);
    const chunks = chunk(currentSurface, 10000);

    for (const urls of chunks) {
      const payload = {
        host,
        key: cfg.key,
        keyLocation: `https://${host}/indexnow.txt`,
        urlList: urls,
      };

      try {
        const res = await postJson("https://www.bing.com/indexnow", payload);
        console.log(`IndexNow ping: host=${host} status=${res.status} urls=${urls.length}`);
      } catch (e) {
        console.error(`IndexNow ping failed for host=${host}: ${e && e.message ? e.message : String(e)}`);
        process.exitCode = 0;
      }
    }
  }
}

main();
