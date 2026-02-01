#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const buyoutsPath = path.join(repoRoot, "data", "buyouts.json");

function fail(msg) {
  console.error("❌ BUYOUTS SCHEMA FAIL:", msg);
  process.exit(1);
}
function isEmail(s){ return typeof s==="string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function isYmd(s){ return typeof s==="string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function parseYmd(s){
  const [y,m,d]=s.split("-").map(n=>parseInt(n,10));
  const dt=new Date(Date.UTC(y,m-1,d));
  // basic roundtrip check
  if (dt.getUTCFullYear()!==y || (dt.getUTCMonth()+1)!==m || dt.getUTCDate()!==d) return null;
  return dt;
}

let raw;
try { raw = fs.readFileSync(buyoutsPath, "utf8"); } catch(e){ fail(`missing ${buyoutsPath}`); }
let data;
try { data = JSON.parse(raw); } catch(e){ fail(`invalid JSON in data/buyouts.json: ${e.message}`); }
if (!Array.isArray(data)) fail("data/buyouts.json must be an array");

const seenIds = new Set();
const seenTargets = new Set(); // scope|vertical|target
const allowedScopes = new Set(["city","state","vertical","category"]);
const requiredBase = ["id","scope","vertical","toEmail","live","startDate","endDate"];

for (let i=0;i<data.length;i++){
  const r=data[i];
  if (typeof r!=="object" || !r) fail(`record[${i}] must be an object`);
  for (const k of requiredBase){
    if (!(k in r)) fail(`record[${i}] missing required key: ${k}`);
  }
  if (typeof r.id!=="string" || !r.id.trim()) fail(`record[${i}].id must be non-empty string`);
  if (seenIds.has(r.id)) fail(`duplicate id: ${r.id}`);
  seenIds.add(r.id);

  if (!allowedScopes.has(r.scope)) fail(`record[${i}].scope invalid: ${r.scope}`);
  if (typeof r.vertical!=="string" || !r.vertical.trim()) fail(`record[${i}].vertical must be non-empty string`);
  if (!isEmail(r.toEmail)) fail(`record[${i}].toEmail invalid email: ${r.toEmail}`);
  if (typeof r.live!=="boolean") fail(`record[${i}].live must be boolean`);
  if (!isYmd(r.startDate) || !parseYmd(r.startDate)) fail(`record[${i}].startDate invalid YYYY-MM-DD: ${r.startDate}`);
  if (!isYmd(r.endDate) || !parseYmd(r.endDate)) fail(`record[${i}].endDate invalid YYYY-MM-DD: ${r.endDate}`);
  const sd=parseYmd(r.startDate), ed=parseYmd(r.endDate);
  if (sd.getTime()>ed.getTime()) fail(`record[${i}] startDate after endDate (${r.startDate} > ${r.endDate})`);

  // scope-specific
  let targetKey = "";
  if (r.scope==="city"){
    if (typeof r.citySlug!=="string" || !r.citySlug.trim()) fail(`record[${i}].citySlug required for scope=city`);
    targetKey = r.citySlug;
  } else if (r.scope==="state"){
    if (typeof r.state!=="string" || !/^[A-Z]{2}$/.test(r.state)) fail(`record[${i}].state must be 2-letter uppercase (e.g., CA)`);
    targetKey = r.state;
  } else if (r.scope==="category"){
    if (typeof r.guideSlug!=="string" || !r.guideSlug.trim()) fail(`record[${i}].guideSlug required for scope=category`);
    targetKey = r.guideSlug;
  } else if (r.scope==="vertical"){
    targetKey = "ALL";
  }

  // Unknown keys guard (prevents drift)
  const allowed = new Set(requiredBase.concat(["citySlug","state","guideSlug","notes"]));
  for (const k of Object.keys(r)){
    if (!allowed.has(k)) fail(`record[${i}] unknown key not allowed: ${k}`);
  }

  // collision detection: same specificity same target
  const collision = `${r.scope}|${r.vertical}|${targetKey}`;
  if (seenTargets.has(collision)) fail(`duplicate buyout target (collision): ${collision}`);
  seenTargets.add(collision);
}

console.log(`✅ BUYOUTS SCHEMA PASS (${data.length} records)`);
