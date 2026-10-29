#!/usr/bin/env node
'use strict';
// Read-only live URL probe: HTTP reachability is NOT Google indexing or lead fulfillment.
// Usage: node scripts/operations/probe_canonical_urls.js [output.json]
// Optional: PROBE_BASE_URLS=https://... comma separated (for controlled testing).
const fs=require('fs'), path=require('path');
const DEFAULT_HOSTS=['hormonesivhair.com','neuroevalguides.com','uscisexam.com','theaccidentguides.com','dentistryguides.com','memphisseniorcarehomes.com','theindustryguides.com'];
const routes={
  'hormonesivhair.com':['/guides/ocala-vitamin-c-injection-iv-prices/'],
  'neuroevalguides.com':['/guides/huntsville-adhd-testing-prices/'],
  'uscisexam.com':['/guides/mcallen-i693-exam-cost-and-civil-surgeons/'],
  'theaccidentguides.com':['/guides/st-louis-accident-reports-lawyer-checklist/'],
  'dentistryguides.com':['/guides/billings-new-patient-dental-exam-prices/'],
  'memphisseniorcarehomes.com':['/guides/assisted-living-cost-memphis/']
};
const hosts=process.env.PROBE_BASE_URLS?process.env.PROBE_BASE_URLS.split(',').map(x=>x.trim()).filter(Boolean):DEFAULT_HOSTS.map(h=>'https://'+h);
async function check(url){
 const started=Date.now();let res;
 try {
  res=await fetch(url,{method:'GET',redirect:'follow',signal:AbortSignal.timeout(9000),headers:{'user-agent':'IndustryGuidesReadOnlySiteAudit/1.0'}});
  const html=String(res.headers.get('content-type')||'').includes('text/html')?await res.text():'';
  const canonical=html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1]||html.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical/i)?.[1]||null;
  const robots=html.match(/<meta\b[^>]*name=["']robots["'][^>]*content=["']([^"']+)/i)?.[1]||null;
  return {url,status:res.status,reachable:true,ok:res.ok,final_url:res.url,content_type:res.headers.get('content-type'),canonical,robots,elapsed_ms:Date.now()-started,google_indexed:null};
 }catch(e){return {url,status:null,reachable:false,ok:false,network_error:String(e?.cause?.code||e?.name||'fetch_error'),elapsed_ms:Date.now()-started,google_indexed:null};}
}
async function run(){
 const jobs=[];
 for(const h of hosts){let u;try{u=new URL(h);}catch{throw Error('Invalid base URL: '+h);}
  if(!['https:','http:'].includes(u.protocol))throw Error('Only HTTP(S) allowed');
  const base=u.origin;for(const p of ['/', '/robots.txt','/sitemap.xml',...(routes[u.hostname]||[])])jobs.push(base+p);
 }
 const rows=[];for(const url of jobs)rows.push(await check(url));
 const payload={schema:'industry-guides-production-http-probe-v1',checked_at:new Date().toISOString(),scope:'Read-only HTTP check. 200 != Google indexed; network error != HTTP 404; no Airtable, email, or provider transaction tested.',results:rows,totals:{checked:rows.length,http_ok:rows.filter(x=>x.ok).length,http_errors:rows.filter(x=>x.reachable&&!x.ok).length,network_failures:rows.filter(x=>!x.reachable).length}};
 const out=process.argv[2];if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(payload,null,2)+'\n');}
 console.log(JSON.stringify(payload,null,2));if(payload.totals.network_failures||payload.totals.http_errors)process.exitCode=2;
}
run().catch(e=>{console.error(e.message);process.exitCode=1;});
