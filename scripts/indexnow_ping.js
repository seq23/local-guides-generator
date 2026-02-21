#!/usr/bin/env node
/**
 * Pings IndexNow endpoint for sitemap + homepage.
 *
 * Rules:
 *  - If INDEXNOW_KEY is not set, exits 0 (safe no-op).
 *  - Hosts come from:
 *      1) INDEXNOW_HOSTS (comma/space separated)
 *      2) INDEXNOW_HOST
 *      3) SITE_URL (host)
 *  - If multiple hosts are provided, it sends one request per host (safer than mixing hosts in a single payload).
 *
 * NOTE: This is intended to be non-blocking in CI (wrap in continue-on-error in workflows).
 */
const { getIndexNowConfig } = require("./lib/indexnow_config");
const https = require("https");

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
    const payload = {
      host,
      key: cfg.key,
      keyLocation: `https://${host}/indexnow.txt`,
      urlList: [`https://${host}/sitemap.xml`, `https://${host}/`],
    };

    try {
      const res = await postJson("https://www.bing.com/indexnow", payload);
      console.log(`IndexNow ping: host=${host} status=${res.status}`);
    } catch (e) {
      // Do not leak key; just error type/message.
      console.error(`IndexNow ping failed for host=${host}: ${e && e.message ? e.message : String(e)}`);
      // Do NOT hard fail; caller controls continue-on-error.
      process.exitCode = 0;
    }
  }
}

main();
