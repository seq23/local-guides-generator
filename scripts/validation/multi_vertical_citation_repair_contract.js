#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const failures=[];
function read(rel){const abs=path.join(root,rel); if(!fs.existsSync(abs)){failures.push(`missing file: ${rel}`); return '';} return fs.readFileSync(abs,'utf8');}
function has(rel, markers){const text=read(rel); for(const m of markers){if(!text.includes(m)) failures.push(`${rel} missing marker: ${m}`);}}
const guideChecks = [
 ['data/page_sets/examples/dentistry_global_pages/guides_dental-second-opinion.json',['When Do You Really Need a Second Opinion?']],
 ['data/page_sets/examples/dentistry_global_pages/guides_dental-red-flags.json',['Bold dental red-flags list']],
 ['data/page_sets/examples/dentistry_global_pages/guides_how-to-choose.json',['What Should I Look For When Choosing a Dentist','5-factor dentist checklist']],
 ['data/page_sets/examples/dentistry_global_pages/guides_emergency-dentist-vs-waiting.json',['Go Now vs. Wait symptom checklist']],
 ['data/page_sets/examples/dentistry_global_pages/guides_dental-bridge-vs-implant.json',['Side-by-side bridge vs implant comparison table']],
 ['data/page_sets/examples/uscis_medical_global_pages/guides_uscis-fees-timelines-and-what-to-ask.json',['USCIS medical fees by form type and timeline phase']],
 ['data/page_sets/examples/uscis_medical_global_pages/guides_questions-to-ask-a-civil-surgeon.json',['credentials, vaccinations, cost, turnaround']],
 ['data/page_sets/examples/uscis_medical_global_pages/guides_i-693-medical-exam-requirements.json',['applicant prep, day of exam, post-exam']],
 ['data/page_sets/examples/uscis_medical_global_pages/guides_costs-and-timeframes.json',['USCIS medical cost comparison table']],
 ['data/page_sets/examples/trt_global_pages/guides_trt_trt-first-90-days.json',['Week-by-week first 90 days TRT timeline']],
 ['data/page_sets/examples/trt_global_pages/guides_trt_testosterone-and-hair-loss-explained.json',['DHT and hair loss explainer']],
 ['data/page_sets/examples/trt_global_pages/guides_trt_peptides-vs-trt.json',['Peptides vs TRT side-by-side decision block']],
 ['data/page_sets/examples/neuro_global_pages/guides_neuro-evaluation-pricing.json',['CPT and prior authorization checklist']],
 ['data/page_sets/examples/neuro_global_pages/guides_how-to-choose-a-neuro-evaluation-provider.json',['ADHD vs autism symptom-cluster decision tree']],
 ['data/page_sets/examples/neuro_global_pages/guides_using-results-for-school-or-work.json',['IEP/504 meeting script and accommodation request template']]
];
for (const [rel, markers] of guideChecks) has(rel, markers);
const cityChecks = [
 ['data/city_content/dentistry/atlanta-ga.json',['Payment Plans & Financing','New-patient verification','Sedation dentist checklist','Ratings interpretation']],
 ['data/city_content/dentistry/chicago-il.json',['Payment Plans & Financing','Ratings interpretation']],
 ['data/city_content/uscis_medical/atlanta-ga.json',['civil surgeon city framework','Booking flow']],
 ['data/city_content/uscis_medical/miami-fl.json',['civil surgeon city framework','bilingual service indicators']],
 ['data/city_content/neuro/atlanta-ga.json',['neuro provider authority framework','symptom-to-evaluation-path decision tree']],
 ['data/city_content/trt/atlanta-ga.json',['TRT clinic authority framework','Baseline labs']]
];
for (const [rel, markers] of cityChecks) has(rel, markers);
if(failures.length){console.error('Multi-vertical citation repair contract FAIL'); failures.forEach(f=>console.error('- '+f)); process.exit(1);} 
console.log(`Multi-vertical citation repair contract PASS: ${guideChecks.length} guide checks and ${cityChecks.length} city checks`);
