/* Browser inspection and steady-frame measurements for the phason partition. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{open,percentile}=require('./browser-audit.cjs');
(async()=>{
 const output=path.join(__dirname,'phason-audit');fs.mkdirSync(output,{recursive:true});
 const app=await open(path.join(__dirname,'../dist'),{animate:true,background:false,dpr:2,phase:.4});
 try{
  app.page.on('console',message=>{if(message.type()==='warning')console.log(message.text());});
  await app.page.evaluate(()=>{const get=TorusPresets.get;TorusPresets.get=id=>id===148?{...get(id),density:0,wave:.35}:get(id);});
  const selectionMs=await app.select(148);await app.input('renderQuality','native');await app.settle();
  assert.equal(await app.page.locator('#study-title').textContent(),'Phason Tide');
  const report={info:app.info,selectionMs,cases:[]};
  for(const variant of [0,1,2]){
   await app.input('variation',variant);await app.page.waitForTimeout(400);await app.page.evaluate(()=>{__audit.record=true;__audit.gpu=[];__audit.draws=[];});await app.page.waitForTimeout(1200);
   const result=await app.page.evaluate(()=>{__audit.record=false;return {gpu:__audit.gpu,draws:__audit.draws};});
   report.cases.push({variant,gpuMedianMs:percentile(result.gpu,.5),gpuP95Ms:percentile(result.gpu,.95),samples:result.gpu.length});
   await app.page.screenshot({path:path.join(output,'variant-'+variant+'.png')});console.log(report.cases.at(-1));
  }
  report.errors=app.errors;fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2));assert.equal(app.errors.length,0);
 }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
