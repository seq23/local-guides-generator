#!/usr/bin/env node
'use strict';
// Read-only, privacy-minimized outcome accounting. No live API access.
const fs = require('node:fs');
const path = require('node:path');
const VALID = new Set(['submitted','stored','provider_delivered','provider_accepted','converted','revenue_received']);
const VERTICALS = new Set(['trt','neuro','uscis_medical','pi','dentistry','senior']);
function compile(input) {
  if (!input || !Array.isArray(input.events)) throw Error('events array required');
  const events = new Map(), errors = [], rows = [];
  for (const [i,e] of input.events.entries()) {
    if (!e || typeof e.lead_id !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(e.lead_id) ||
        !VALID.has(e.stage) || !VERTICALS.has(e.vertical) || typeof e.evidence_ref !== 'string' ||
        !/^https:\/\/[^\s]+$/.test(e.evidence_ref) ||
        !Number.isFinite(Date.parse(e.observed_at || ''))) { errors.push({row:i,reason:'invalid_evidence_event'}); continue; }
    const a=events.get(e.lead_id)||[];
    a.push(e);events.set(e.lead_id,a);
  }
  const order=['submitted','stored','provider_delivered','provider_accepted','converted','revenue_received'];
  for (const [id,ev] of events) {
    const verticals=new Set(ev.map(x=>x.vertical));
    if(verticals.size!==1){errors.push({lead_id:id,reason:'conflicting_vertical'});continue;}
    const byStage=new Map();
    for(const e of ev){if(byStage.has(e.stage)){errors.push({lead_id:id,reason:'duplicate_stage',stage:e.stage});continue;}byStage.set(e.stage,e);}
    let contiguous=true;
    for(let i=0;i<order.length;i++){
      const stage=order[i];if(!byStage.has(stage))continue;
      if(i && !byStage.has(order[i-1])) {errors.push({lead_id:id,reason:'missing_predecessor',stage});contiguous=false;}
      if(i && byStage.has(order[i-1]) && Date.parse(byStage.get(stage).observed_at)<Date.parse(byStage.get(order[i-1]).observed_at)) {errors.push({lead_id:id,reason:'out_of_order',stage});contiguous=false;}
      if(stage==='revenue_received'&&(!Number.isSafeInteger(byStage.get(stage).amount_cents)||byStage.get(stage).amount_cents<0||byStage.get(stage).currency!=='USD')) {errors.push({lead_id:id,reason:'invalid_revenue'});contiguous=false;}
    }
    if(!contiguous)continue;
    rows.push({lead_id:id,vertical:ev[0].vertical,stage:order.reduce((a,b)=>byStage.has(b)?b:a,'unknown'),stage_evidence:order.filter(s=>byStage.has(s)).map(s=>({stage:s,evidence_ref:byStage.get(s).evidence_ref,observed_at:byStage.get(s).observed_at})),revenue_cents:byStage.has('revenue_received')?byStage.get('revenue_received').amount_cents:null});
  }
  const stageCounts=Object.fromEntries(order.map(s=>[s,rows.filter(r=>order.indexOf(r.stage)>=order.indexOf(s)).length]));
  return {schema:'industry-guides-lead-outcome-evidence-v1',source:'supplied_evidence_events_only',policy:'No PII, no inferred provider acceptance, no estimated revenue; failure is not conversion.',lead_count:rows.length,stage_counts:stageCounts,verified_revenue_cents:rows.reduce((a,r)=>a+(r.revenue_cents||0),0),revenue_evidence_present:rows.some(r=>r.revenue_cents!==null),errors,rows};
}
if(require.main===module){
 const inPath=process.argv[2],outPath=process.argv[3];
 if(!inPath) {console.error('Usage: node compile_lead_outcomes.js input.json [report.json]');process.exitCode=2;}
 else {try {const result=compile(JSON.parse(fs.readFileSync(inPath,'utf8')));if(outPath){fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,JSON.stringify(result,null,2)+'\n');}console.log(JSON.stringify({lead_count:result.lead_count,stage_counts:result.stage_counts,verified_revenue_cents:result.verified_revenue_cents,revenue_evidence_present:result.revenue_evidence_present,errors:result.errors},null,2));if(result.errors.length)process.exitCode=2;}catch(e){console.error(e.message);process.exitCode=2;}}
}
module.exports={compile};
