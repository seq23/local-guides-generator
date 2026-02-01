/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

function loadBuyouts(repoRoot){
  const p = path.join(repoRoot, "data", "buyouts.json");
  const raw = fs.readFileSync(p, "utf8");
  const arr = JSON.parse(raw);
  return Array.isArray(arr) ? arr : [];
}

function isLive(b){
  // LIVE requires all 3: record exists + live:true + today within [startDate,endDate] (UTC)
  if (!b || b.live !== true) return false;
  const today = new Date();
  const y=today.getUTCFullYear(), m=today.getUTCMonth()+1, d=today.getUTCDate();
  const t = Date.UTC(y, m-1, d);
  const parse = (s) => {
    const [yy,mm,dd]=String(s).split("-").map(n=>parseInt(n,10));
    return Date.UTC(yy,mm-1,dd);
  };
  const sd=parse(b.startDate), ed=parse(b.endDate);
  return t >= sd && t <= ed;
}

function filterLiveForVertical(all, vertical){
  return all.filter(b => b && b.vertical === vertical && isLive(b));
}

module.exports = { loadBuyouts, isLive, filterLiveForVertical };
