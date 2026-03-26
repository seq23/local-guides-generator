const fs = require("fs");

function parseMaybeDotenv(value) {
  // Supports the user accidentally pasting:
  // <64-char-key>\nINDEXNOW_HOSTS=...\nINDEXNOW_KEY=...
  // or dotenv-style "KEY=VALUE" lines.
  const out = { raw: value || "" };
  if (!value) return out;

  const lines = String(value).split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if (lines.length === 1 && !lines[0].includes("=")) {
    out.key = lines[0];
    return out;
  }

  // If first non-empty line looks like 64-hex and no '=', treat as key line.
  if (lines[0] && /^[a-f0-9]{64}$/i.test(lines[0]) && !lines[0].includes("=")) {
    out.key = lines[0];
    lines.shift();
  }

  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1,-1);
    out[k] = v;
  }

  // If still no key, try INDEXNOW_KEY= in the blob.
  if (!out.key && out.INDEXNOW_KEY) out.key = out.INDEXNOW_KEY;
  return out;
}

function getIndexNowConfig() {
  const parsed = parseMaybeDotenv(process.env.INDEXNOW_KEY || "");
  const key = (parsed.key || "").trim();

  const hostsFromEnv = (process.env.INDEXNOW_HOSTS || parsed.INDEXNOW_HOSTS || "").trim();
  const hosts = hostsFromEnv
    ? hostsFromEnv.split(/[,\s]+/).map(h=>h.trim()).filter(Boolean)
    : [];

  const siteUrl = (process.env.SITE_URL || "").trim();
  let siteHost = "";
  try {
    if (siteUrl) siteHost = new URL(siteUrl).host;
  } catch {}

  const primaryHost = (process.env.INDEXNOW_HOST || "").trim() || (hosts[0] || siteHost || "");

  const ci = String(process.env.CI || "").toLowerCase() === "true";

  return { key, hosts, primaryHost, siteUrl, siteHost, ci, raw: parsed.raw };
}

module.exports = { getIndexNowConfig };
