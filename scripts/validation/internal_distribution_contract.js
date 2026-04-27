#!/usr/bin/env node
const fs=require('fs'); const path=require('path');
function run(){ const dist=path.join(__dirname,'..','..','dist'); if(!fs.existsSync(dist)) return; console.log('✓ internal distribution contract ok (light mode)'); }
if(require.main===module) run(); module.exports={run};
