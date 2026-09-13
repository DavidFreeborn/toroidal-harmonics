/* Run in isolation. Steady rendering excludes background preparation; Random
   measures the real queue with a deterministic, identical study sequence. */
const fs=require('node:fs'),path=require('node:path');
const {open,percentile}=require('./browser-audit.cjs');
async function main(){
 const root=path.resolve(process.argv[2]),output=path.resolve(process.argv[3]),mode=process.argv[4]||'random';
 const app=await open(root,{animate:true,seed:1337,background:mode!=='steady',dpr:mode==='steady'?2:1,phase:mode==='steady'?.4:undefined});
 const result={mode,phase:mode==='steady'?.4:undefined,info:app.info,cases:[]};
 try{
  if(mode==='steady')await app.input('renderQuality','native');
  await app.page.waitForTimeout(3000);
  const cases=mode==='steady'?await app.page.evaluate(()=>[...document.querySelectorAll('.study-choice img')].map(x=>Number(x.src.match(/\/(\d+)\.webp/)[1]))):Array.from({length:12},(_,i)=>i);
  for(const id of cases){
   let selectionMs=0;
   if(mode==='steady'){await app.select(id);await app.page.waitForTimeout(180);}
   await app.page.evaluate(()=>{__audit.record=true;__audit.draws=[];__audit.gpu=[];__audit.longTasks=[];});
   if(mode==='random')selectionMs=await app.page.evaluate(()=>new Promise(resolve=>{
    const start=performance.now(),root=document.querySelector('#artwork'),observer=new MutationObserver(()=>{if(root.getAttribute('aria-busy')==='false'){observer.disconnect();resolve(performance.now()-start);}});
    observer.observe(root,{attributes:true,attributeFilter:['aria-busy']});document.getElementById('random').click();
   }));
   await app.page.waitForTimeout(mode==='steady'?1000:2400);
   const data=await app.page.evaluate(()=>{__audit.record=false;return {title:document.getElementById('study-title').textContent,draws:__audit.draws,gpu:__audit.gpu,longTasks:__audit.longTasks,width:document.querySelector('canvas').width};});
   const frames=[...new Set(data.draws.filter(d=>d.title===data.title&&d.frame!==null).map(d=>d.frame))],intervals=frames.slice(1).map((x,i)=>x-frames[i]);
   result.cases.push({id:mode==='steady'?id:undefined,title:data.title,selectionMs,width:data.width,gpuMedianMs:percentile(data.gpu,.5),gpuSamples:data.gpu.length,frameMedianMs:percentile(intervals,.5),frameP95Ms:percentile(intervals,.95),frameMaxMs:Math.max(...intervals),slowFrames:intervals.filter(x=>x>25).length,longTasks:data.longTasks});
   fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(mode,result.cases.length,data.title,'ready',selectionMs.toFixed(1),'GPU',percentile(data.gpu,.5).toFixed(2));
  }
  result.errors=app.errors;result.summary={medianSelectionMs:percentile(result.cases.map(x=>x.selectionMs),.5),p95SelectionMs:percentile(result.cases.map(x=>x.selectionMs),.95),medianGPUTimeMs:percentile(result.cases.map(x=>x.gpuMedianMs),.5)};
  fs.writeFileSync(output,JSON.stringify(result,null,2));
 }finally{await app.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
