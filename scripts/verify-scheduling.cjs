/* Deterministic simulations for optional GPU features and frame pacing. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../dist');
const context={};vm.runInNewContext(fs.readFileSync(path.join(root,'performance.js'),'utf8')+';this.P=TorusPerformance',context);
const P=context.P;
for(const hz of [60,90,120,144]){
 const g=P.governor(),control=P.governor();g.reset('heavy','family');control.reset('heavy','family');let t=0,changes=0;
 const observe=(ms,now,timing=null)=>{control.observe(ms,now);return g.observe(ms,now,timing)};
 // First establish the presentation interval, then a reproducible pixel cost.
 for(let i=0;i<80;i++)observe(1000/hz,t+=1000/hz);
 for(let i=0;i<2400;i++){
  const ms=Math.ceil((7+24*g.scale*g.scale)/(1000/hz))*(1000/hz);
  if(observe(ms,t+=ms))changes++;
 }
 const stable=g.scale;assert(stable<1);assert(changes<=4,'quality pumps at '+hz+' Hz');
 g.reset('adjacent','family');control.reset('adjacent','family');assert.equal(g.scale,stable,'family quality should carry across settings');
 g.reset('heavy','family');control.reset('heavy','family');assert.equal(g.scale,stable);
 for(let i=0;i<1000;i++)observe(1000/hz,t+=1000/hz,{tag:'stale',ms:.1});
 assert.equal(g.scale,control.scale,'stale timing must not affect recovery');
 for(let i=0;i<7000;i++)g.observe(1000/hz,t+=1000/hz,{tag:g.tag,ms:.2});
 assert.equal(g.scale,1,'real headroom restores detail');
 console.log('PASS',hz+' Hz: stable resolution, remembered budget, stale sample rejection and recovery');
}
{
 const g=P.governor();g.reset('light');let t=0;
 for(let i=0;i<1500;i++)g.observe(i%40===0?300:1000/60,t+=1000/60);
 assert.equal(g.scale,1,'isolated long tasks must not lower resolution');
 for(let i=0;i<160;i++)g.observe(400,t+=400);assert.equal(g.scale,.5);
 console.log('PASS isolated stalls ignored, sustained overload reduces resolution');
}
{
 const g=P.governor();g.reset('fresh native raster');let t=0;
 for(let i=0;i<8;i++)g.observe(65,t+=65);assert.equal(g.scale,1,'initial warmup plus five misses do not trigger an emergency reduction');
 g.observe(65,t+=65);assert(g.scale<1,'persistent severe overload is corrected before the normal 24-frame window');
 console.log('PASS prompt, conservative response to a severely overloaded native raster');
}
{
 const g=P.governor();g.reset('ready');let t=0;
 for(let i=0;i<80;i++)g.observe(1000/60,t+=1000/60,{tag:g.tag,ms:3});
 assert.equal(g.headroom,true,'stable GPU measurements establish background capacity');
 g.suspend();assert.equal(g.headroom,false,'visibility and staging invalidate old measurements');
 for(let i=0;i<80;i++)g.observe(1000/60,t+=1000/60);assert.equal(g.headroom,false,'RAF alone cannot establish spare GPU capacity');
 for(let i=0;i<80;i++)g.observe(1000/60,t+=1000/60,{tag:g.tag,ms:3});assert.equal(g.headroom,true);
 for(let i=0;i<80;i++)g.observe(1000/60,t+=1000/60);assert.equal(g.headroom,false,'old GPU results expire');
 g.observe(NaN,t);g.observe(Infinity,t);assert.equal(g.scale,1);assert.equal(g.period,1000/60);
 console.log('PASS measured headroom, suspension, result expiry and non-finite sample rejection');
}
{
 let count=0,deletes=0,disjoint=false;const ext={TIME_ELAPSED_EXT:1,GPU_DISJOINT_EXT:2},pending=[];
 const gl={QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,getExtension:()=>ext,createQuery:()=>({id:++count}),beginQuery:(_,q)=>pending.push(q),endQuery(){},getQueryParameter:(_,kind)=>kind===3?true:2e6,getParameter:()=>disjoint,deleteQuery(){deletes++}};
 const timer=P.gpuTimer(gl);let result=null;
 for(let i=0;i<120;i++){const value=timer.poll();if(value)result=value;timer.begin('study:2');timer.end();}
 assert(count<=4,'queries must remain bounded');assert.equal(result.ms,2);assert.equal(result.tag,'study:2');
 disjoint=true;for(let i=0;i<16;i++){assert.equal(timer.poll(),null);timer.begin('study:2');timer.end();}assert(deletes>0);
 const fallback=P.gpuTimer({getExtension:()=>null});fallback.begin('x');fallback.end();assert.equal(fallback.poll(),null);
 console.log('PASS bounded GPU queries, disjoint rejection and extension-free fallback');
}
{
 let creates=0,starts=0,deletes=0,ready=false;const ext={TIME_ELAPSED_EXT:1,GPU_DISJOINT_EXT:2};
 const gl={QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,getExtension:()=>ext,createQuery:()=>({id:++creates}),beginQuery(){starts++;},endQuery(){},getQueryParameter:(_,kind)=>kind===3?ready:2e6,getParameter:()=>false,deleteQuery(){deletes++;}};
 const timer=P.gpuTimer(gl);let t=0;
 for(let i=0;i<32;i++){timer.poll(t);timer.begin('old',t);timer.end();t+=1000/60;}
 assert.equal(starts,4,'one measurement per eight frames');ready=true;assert.equal(timer.poll(t+1100),null,'late results do not describe the current frame budget');assert.equal(deletes,4);
 timer.reset();timer.begin('new',0);timer.end();timer.dispose();assert.equal(deletes,creates);
 const before=starts;for(let i=0;i<32;i++){timer.begin('disposed',i);timer.end();assert.equal(timer.poll(i),null);}assert.equal(starts,before);
 console.log('PASS sparse timer sampling, delayed-result expiry and explicit query disposal');
}
async function compiler({parallel=true,fail=false,lost=false}={}){
 const events=[],raf=[],EXT=17,LINK=18;let complete=!parallel,pending=true;
 const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,LINK_STATUS:LINK,getExtension(){return parallel?{COMPLETION_STATUS_KHR:EXT}:null},createProgram:()=>({}),createShader:()=>({}),shaderSource(){},compileShader(){events.push('compile')},attachShader(){},linkProgram(){events.push('link')},getProgramParameter(_,kind){events.push(kind);if(kind===EXT)return complete;assert(complete,'must not synchronously ask link status while still compiling');return !fail},getShaderParameter(){throw Error('stage status creates an avoidable stall')},getProgramInfoLog:()=> 'test shader error',getShaderInfoLog:()=>'',deleteProgram(){events.push('delete program')},deleteShader(){events.push('delete shader')},isContextLost:()=>lost};
 const c={requestAnimationFrame:fn=>raf.push(fn)};vm.runInNewContext(fs.readFileSync(path.join(root,'programs.js'),'utf8')+';this.P=TorusPrograms',c);
 const promise=c.P.link(gl,'vertex','fragment').then(()=>{pending=false;return null},e=>{pending=false;return e});
 if(parallel&&!lost){await Promise.resolve();assert(pending);assert.deepEqual(events.slice(0,3),['compile','compile','link']);assert.equal(raf.length,1);complete=true;raf.shift()();}
 const error=await promise;assert.equal(Boolean(error),fail||lost);assert.equal(events.filter(x=>x==='delete shader').length,2);assert.equal(events.includes('delete program'),fail||lost);
}
(async()=>{await compiler();await compiler({parallel:false});await compiler({fail:true});await compiler({lost:true});console.log('PASS nonblocking completion, synchronous fallback, compilation failure and context loss');})().catch(e=>{console.error(e);process.exitCode=1});
