#!/usr/bin/env node
'use strict';
// Produces a reproducible observed-demand snapshot, never a keyword volume estimate.
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const evidence=read('data/research/markets/phase2_fifteen_cluster_evidence_2026-10-29.json');
const domains={trt:'hormonesivhair.com',neuro:'neuroevalguides.com',uscis_medical:'uscisexam.com',pi:'theaccidentguides.com',dentistry:'dentistryguides.com'};
const placeParts=s=>s.replace(/,\s*[A-Z]{2}$/,'').split('–').map(x=>x.trim().replace(/,\s*[A-Z]{2}$/,'')).filter(Boolean);
function placeMatch(s,places){
 const value=String(s||'').toLowerCase().replace(/%20/g,' ').replace(/[-_]/g,' ');
 return places.some(p=>new RegExp('(^|[^a-z])'+p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([^a-z]|$)').test(value));
}
function run(){
 const gsc={}; const errors=[];
 for(const [vertical,host] of Object.entries(domains)){
  try{gsc[vertical]=read('data/search_intelligence/'+host+'/gsc_search_analytics_export.json');}
  catch(e){errors.push({host,error:'export_missing'});}
 }
 const rows=evidence.rows.map(m=>{
  const x=gsc[m.vertical],cities=placeParts(m.cluster),host=domains[m.vertical];
  if(!x)return {vertical:m.vertical,cluster:m.cluster,host,status:'GSC_EXPORT_MISSING',impressions:null,clicks:null,query_rows:null,source_window:null,matched_rows:[]};
  const matched=(x.rows||[]).filter(r=>placeMatch(r.query,cities)||placeMatch(r.page,cities));
  return {vertical:m.vertical,cluster:m.cluster,host,status:'HISTORICAL_GSC_PARTIAL_OBSERVATION',source_window:x.start_date+'..'+x.end_date,collected_at:x.collected_at,impressions:matched.reduce((a,r)=>a+Number(r.impressions||0),0),clicks:matched.reduce((a,r)=>a+Number(r.clicks||0),0),query_rows:matched.length,matched_rows:matched.map(r=>({query:r.query,page:r.page,impressions:r.impressions,clicks:r.clicks,position:r.position})),note:'Matched a city phrase in the exported query or landing-page URL. Zero matches does not imply zero keyword searches, zero GSC demand, or a competitive gap; exports can omit queries.'};
 });
 const out={schema:'industry-guides-historical-market-gsc-v1',generated_at:new Date().toISOString(),scope:'Read-only snapshot of checked-in GSC exports. Does not access live Google Search Console or infer search volume, keyword difficulty, provider demand, or Google indexing.',errors,rows};
 const fp=process.argv[2];if(fp){fs.mkdirSync(path.dirname(fp),{recursive:true});fs.writeFileSync(fp,JSON.stringify(out,null,2)+'\n');}
 console.log(JSON.stringify({markets:rows.length,with_export:rows.filter(r=>r.status!=='GSC_EXPORT_MISSING').length,with_observed_local_rows:rows.filter(r=>r.query_rows>0).length,by_market:rows.map(({cluster,vertical,impressions,clicks,query_rows})=>({vertical,cluster,impressions,clicks,query_rows}))},null,2));
 if(errors.length)process.exitCode=2;
}
run();
