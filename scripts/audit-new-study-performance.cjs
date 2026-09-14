/* Compare real production defaults at identical viewports on a hardware GPU.
   Default fixes phase0.8 for comparison; TORUS_LIVE_PHASE=1 measures motion.
   Usage: node scripts/audit-new-study-performance.cjs [dist] [report.json] [study-id ...]
   Run revisions sequentially; competing GPU jobs invalidate these timings. */
const fs=require('node:fs'),path=require('node:path');
const {open,percentile}=require('./browser-audit.cjs');
async function main(){
 const root=path.resolve(process.argv[2]||'dist'),out=path.resolve(process.argv[3]||'scripts/new-study-performance.json'),ids=process.argv.slice(4).map(Number),live=process.env.TORUS_LIVE_PHASE==='1',report={phase:live?'animated':.8,cases:[],errors:[]};
 for(const configuration of [{width:1100,height:760,dpr:2},{width:2560,height:1440,dpr:1},{width:390,height:844,dpr:2}]){
  const app=await open(root,{background:false,animate:true,...(live?{}:{phase:.8}),viewport:{width:configuration.width,height:configuration.height},dpr:configuration.dpr});
  try{
   report.renderer=app.info.renderer;
   for(const id of ids.length?ids:[145,146,148]){
    const selectionMs=await app.select(id);await app.input('renderQuality','native');await app.page.waitForTimeout(600);
    await app.page.evaluate(()=>{__audit.record=true;__audit.frames=[];__audit.draws=[];__audit.longTasks=[];__audit.gpu=[];});
    await app.page.waitForTimeout(2500);
    const data=await app.page.evaluate(()=>{__audit.record=false;const c=document.querySelector('canvas');return {draws:__audit.draws,gpu:__audit.gpu,longTasks:__audit.longTasks,width:c.width,height:c.height};});
    const times=[...new Set(data.draws.filter(d=>d.frame!==null).map(d=>d.frame))],intervals=times.slice(1).map((t,i)=>t-times[i]);
    const result={id,viewport:configuration,raster:[data.width,data.height],selectionMs,frames:intervals.length,medianMs:percentile(intervals,.5),p95Ms:percentile(intervals,.95),slowFrames:intervals.filter(t=>t>25).length,gpuMedianMs:percentile(data.gpu,.5),gpuP95Ms:percentile(data.gpu,.95),maxSubmitMs:Math.max(...data.draws.map(d=>d.ms)),longTasks:data.longTasks};
    report.cases.push(result);console.log(JSON.stringify(result));fs.writeFileSync(out,JSON.stringify(report,null,2));
   }
   report.errors.push(...app.errors);
  }finally{await app.close();}
 }
 fs.writeFileSync(out,JSON.stringify(report,null,2));if(report.errors.length)throw Error(report.errors.join('\n'));
}
main().catch(e=>{console.error(e);process.exitCode=1});
