/* eslint-disable no-console */
const fs=require('fs'); const path=require('path');
function walk(dir,out=[]){ if(!fs.existsSync(dir)) return out; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const f=path.join(dir,e.name); if(e.isDirectory()) walk(f,out); else if(e.isFile()&&e.name==='index.html') out.push(f);} return out; }
function fail(msg){ console.error('INTERNAL LINKING QUALITY FAIL\n'+msg); process.exit(1);} 
function run(){
  const root=path.join(__dirname,'..','..');
  const files=walk(path.join(root,'dist')).filter(f=>/index\.html$/.test(f));
  const bad=[];
  for(const f of files){
    const rel=path.relative(root,f);
    const html=fs.readFileSync(f,'utf8');
    if(/for-providers|privacy|about|contact|next-steps|request-assistance|methodology|disclaimer|editorial-policy|faq/.test(rel)) continue;
    const isGuideDetail=/dist[\/]guides[\/][^\/]+[\/]index\.html$/.test(f);
    const isCity=/dist[\/][a-z0-9-]+[\/]index\.html$/i.test(f) && !/dist[\/]guides[\/]/.test(f) && !/dist[\/]states[\/]/.test(f);
    const isHome=/dist[\/]index\.html$/.test(f);
    const hasRoutingBlock=html.includes('data-decision-routing-block="true"') || html.includes('data-branded-links="true"') || html.includes('data-home-about-block="true"') || html.includes('data-start-here="true"');
    const hasGuideRouting=html.includes('data-citation-routing-links="true"');
    if ((isHome || isCity) && !hasRoutingBlock) bad.push(rel+': missing decision routing surface');
    if (isGuideDetail && !hasGuideRouting) bad.push(rel+': missing guide routing surface');
    const anchors=(html.match(/<a href="\//g)||[]).length;
    if((hasRoutingBlock || hasGuideRouting) && anchors<3) bad.push(rel+': fewer than 3 owned anchors');
    if(/>\s*(click here|learn more)\s*</i.test(html)) bad.push(rel+': generic anchor text present');
  }
  if(bad.length) fail(bad.slice(0,200).join('\n'));
  console.log('✅ INTERNAL LINKING QUALITY PASS');
}
module.exports={run}; if(require.main===module) run();
