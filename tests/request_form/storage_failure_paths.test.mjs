import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRequestAssistance } from './load_endpoint.mjs';

async function submit({ airtableStatus=503, resendStatus=200, emailKey='fake-resend-test-key', table='Lead Requests', payload={} }={}) {
  const mod=await loadRequestAssistance('ra-fallback-');
  const seen=[];
  const original=globalThis.fetch;
  globalThis.fetch=async(url,init)=>{
    const endpoint=String(url);
    const body=JSON.parse(init.body);
    seen.push({endpoint,body});
    if(endpoint.includes('api.airtable.com'))return new Response(JSON.stringify({error:{type:'SERVER_ERROR',message:'temporary outage'}}),{status:airtableStatus});
    if(endpoint.includes('api.resend.com'))return new Response(JSON.stringify(resendStatus===200?{id:'test-message'}:{error:'down'}),{status:resendStatus});
    throw Error('Unexpected endpoint');
  };
  try{
    const req=new Request('https://uscisexam.com/api/request-assistance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider_type:'USCIS Medical Exam Provider',email:'synthetic@example.test',consent:'yes',vertical_key:'pi',page_slug:'/guides/mcallen-i693-exam-cost-and-civil-surgeons/',market_slug:'mcallen-tx',src:'test-harness',...payload})});
    const res=await mod.onRequestPost({request:req,env:{AIRTABLE_BASE_ID:'app-test',AIRTABLE_TABLE_NAME:table,AIRTABLE_API_TOKEN:'fake-token',RESEND_API_KEY:emailKey,LEAD_TO:'test-recipient@example.test'}});
    return {status:res.status,body:await res.json(),seen};
  } finally {globalThis.fetch=original;}
}

test('Airtable outage falls back to email and explicitly marks record missing from Airtable',async()=>{
  const r=await submit();
  assert.equal(r.status,200);
  assert.deepEqual(r.body,{ok:true,storage:'email_fallback'});
  const msg=r.seen.find(x=>x.endpoint.includes('resend.com'));
  assert.ok(msg);
  assert.match(msg.body.text,/NOT in Airtable and needs to be entered manually/);
  assert.match(msg.body.text,/vertical_key: uscis_medical/);
  assert.match(msg.body.text,/page_slug: \/guides\/mcallen-i693-exam-cost-and-civil-surgeons\//);
  assert.match(msg.body.text,/market_slug: mcallen-tx/);
  assert.equal(msg.body.to[0],'test-recipient@example.test');
});

test('both storage channels failing returns 503; never acknowledges successful lead storage',async()=>{
  const r=await submit({resendStatus:503});
  assert.equal(r.status,503);
  assert.deepEqual(r.body,{ok:false,error:'storage_unavailable'});
});

test('Airtable success still sends a notification, marked as a copy',async()=>{
  const mod=await loadRequestAssistance('ra-success-');
  const before=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,init)=>{calls.push({url:String(url),data:JSON.parse(init.body)});return new Response(String(url).includes('airtable.com')?JSON.stringify({records:[{id:'rec-test'}]}):JSON.stringify({id:'test-notice'}),{status:200});};
  try{
    const request=new Request('https://neuroevalguides.com/api/request-assistance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider_type:'ADHD / autism evaluation or therapy provider',service_needed:'evaluation',email:'synthetic@example.test',consent:'yes',vertical_key:'dentistry',page_slug:'/states/SD/'})});
    const response=await mod.onRequestPost({request,env:{AIRTABLE_BASE_ID:'app-test',AIRTABLE_TABLE_NAME:'Leads',AIRTABLE_API_TOKEN:'fake',RESEND_API_KEY:'fake',LEAD_TO:'test@example.test'}});
    assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,storage:'airtable'});
    const fields=calls.find(x=>x.url.includes('airtable.com')).data.records[0].fields;
    assert.equal(fields.vertical_key,'neuro');assert.equal(fields.page_slug,'/states/SD/');
    assert.match(calls.find(x=>x.url.includes('resend.com')).data.text,/This lead is stored in Airtable/);
  }finally{globalThis.fetch=before;}
});
