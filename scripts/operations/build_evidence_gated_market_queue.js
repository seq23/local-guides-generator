#!/usr/bin/env node
'use strict';
// Planning intelligence only: no page, provider, or ad is created by this script.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const evidence=JSON.parse(fs.readFileSync(path.join(ROOT,'data/research/markets/phase2_fifteen_cluster_evidence_2026-10-29.json'),'utf8'));
const domains={trt:'hormonesivhair.com',neuro:'neuroevalguides.com',uscis_medical:'uscisexam.com',pi:'theaccidentguides.com',dentistry:'dentistryguides.com'};
const workPriorities={trt:['Greenville','Ocala'],neuro:['Fayetteville','Huntsville'],uscis_medical:['Fresno','McAllen'],pi:['Midland','St. Louis'],dentistry:['Ocala','Billings']};
function decision(row){
 const sources=Array.isArray(row.sources)?row.sources.filter(s=>/^https:\/\//.test(s)):[];
 const pilot=row.status==='pilot_live'||row.status==='pilot_merged';
 const missing=[];
 if(!sources.length)missing.push('local_primary_sources');
 if(row.keyword_volume==null)missing.push('measured_local_demand');
 if(row.keyword_difficulty==null)missing.push('localized_serp_competition');
 if(row.provider_partner_count==null)missing.push('authorized_lead_recipient');
 if(row.verified_lead_value==null)missing.push('verified_lead_economics');
 const contentCandidate=sources.length>0;
 // This queue never certifies blue ocean or authorizes a publication by itself.
 return {vertical:row.vertical,domain:domains[row.vertical],cluster:row.cluster,
  existing_pilot:pilot,source_count:sources.length,source_urls:sources,
  research_stage:pilot?'MONITOR_EXISTING_PILOT':contentCandidate?'SOURCE_BACKED_RESEARCH':'FIND_PRIMARY_SOURCES',
  commercial_launch_gate:missing.length?'BLOCKED_PENDING_EVIDENCE':'REQUIRES_SEPARATE_EDITORIAL_AND_LEGAL_REVIEW',
  missing_evidence:missing,score:null,verified_blue_ocean:false,authorized_to_publish:false,
  notes:row.limits||'',next_action:pilot?'Measure current pilot; do not replicate city slugs':contentCandidate?'Verify direct offers, competing SERPs and intent differentiation':'Find current local primary sources before drafting'};
}
function build(rows=evidence.rows){
 if(rows.length!==15)throw Error('Expected exactly 15 initial candidate markets, five verticals x three; do not silently shrink scope');
 const items=rows.map(decision);
 for(const [vertical,host] of Object.entries(domains))if(items.filter(x=>x.vertical===vertical&&x.domain===host).length!==3)throw Error('Missing three clusters for '+vertical);
 const byVertical=Object.keys(domains).map(vertical=>{
  const candidate=items.filter(x=>x.vertical===vertical);
  const order=workPriorities[vertical];
  candidate.sort((a,b)=>{
   const p=x=>{const i=order.findIndex(s=>x.cluster.startsWith(s));return i<0?100:i};
   return p(a)-p(b)||a.cluster.localeCompare(b.cluster);
  });
  return {vertical,domain:domains[vertical],coverage_policy:'NATIONWIDE_PRESERVE_ALL_EXISTING_PAGES',initial_research_queue:candidate};
 });
 return {schema:'industry-guides-evidence-gated-national-queue-v1',as_of:evidence.as_of,
  policy:'Research sequence only. Does not narrow nationwide coverage, remove state/city pages, certify blue ocean, or create lead/provider relationships.',
  metrics_status:'Quantitative competition, local demand and revenue unverified; all market scores null.',
  excluded_from_national_expansion:'memphisseniorcarehomes.com — Memphis metropolitan focus',
  by_vertical:byVertical};
}
if(require.main===module){
 const result=build();
 const out=process.argv[2];
 if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');}
 console.log(JSON.stringify(result,null,2));
}
module.exports={decision,build};
