const test=require('node:test'),assert=require('node:assert/strict');
const {build,decision}=require('../../scripts/operations/build_evidence_gated_market_queue');
test('preserves five nationwide domains and all fifteen initial markets',()=>{
 const d=build();
 assert.equal(d.by_vertical.length,5);
 assert.equal(d.by_vertical.reduce((n,v)=>n+v.initial_research_queue.length,0),15);
 for(const v of d.by_vertical){assert.equal(v.coverage_policy,'NATIONWIDE_PRESERVE_ALL_EXISTING_PAGES');assert.equal(v.initial_research_queue.length,3);for(const m of v.initial_research_queue){assert.equal(m.authorized_to_publish,false);assert.equal(m.verified_blue_ocean,false);assert.equal(m.score,null);}}
 assert.match(d.excluded_from_national_expansion,/Memphis metropolitan/);
});
test('no local sources means source-gathering stage, not a launch authorization',()=>{
 const d=decision({vertical:'neuro',cluster:'Hypothetical, XX',sources:[],status:'research_needed'});
 assert.equal(d.research_stage,'FIND_PRIMARY_SOURCES');
 assert.equal(d.commercial_launch_gate,'BLOCKED_PENDING_EVIDENCE');
 assert.ok(d.missing_evidence.includes('local_primary_sources'));
});
test('sources alone never produce a blue-ocean score or grant publishing authority',()=>{
 const d=decision({vertical:'trt',cluster:'Sample, XX',sources:['https://example.org/local'],status:'qualified'});
 assert.equal(d.research_stage,'SOURCE_BACKED_RESEARCH');
 assert.equal(d.authorized_to_publish,false);
 assert.equal(d.score,null);
 assert.ok(d.missing_evidence.includes('localized_serp_competition'));
});
