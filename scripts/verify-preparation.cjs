/* Deterministic first-draw staging, cache lifetime and cooperative queue checks. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../dist/programs.js'),'utf8');
const ticks=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function harness(){
 const raf=new Map(),idle=new Map(),timers=new Map();let id=0;
 const sandbox={document:{hidden:false},requestAnimationFrame:fn=>{raf.set(++id,fn);return id;},requestIdleCallback:fn=>{idle.set(++id,fn);return id;},cancelIdleCallback:id=>idle.delete(id),setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(source+';this.P=TorusPrograms',sandbox);
 const run=async(map,...args)=>{const current=[...map.values()];map.clear();for(const fn of current)fn(...args);await ticks();};
 return {...sandbox,raf,idle,timers,run};
}
function graphics(){
 let next=0;const enums=['VERTEX_SHADER','FRAGMENT_SHADER','LINK_STATUS','DRAW_FRAMEBUFFER_BINDING','READ_FRAMEBUFFER_BINDING','RENDERBUFFER_BINDING','VIEWPORT','FRAMEBUFFER','DRAW_FRAMEBUFFER','READ_FRAMEBUFFER','RENDERBUFFER','SAMPLES','DEPTH_BITS','DEPTH_COMPONENT16','DEPTH_COMPONENT24','RGBA8','COLOR_ATTACHMENT0','DEPTH_ATTACHMENT','FRAMEBUFFER_COMPLETE','COLOR_BUFFER_BIT','DEPTH_BUFFER_BIT','SYNC_GPU_COMMANDS_COMPLETE','ALREADY_SIGNALED','CONDITION_SATISFIED','WAIT_FAILED','TIMEOUT_EXPIRED'];
 const gl=Object.fromEntries(enums.map(key=>[key,++next])),events=[],fences=[];
 let draw='canvas',read='readback',renderbuffer='old depth',viewport=[0,0,2000,1200],lost=false,fail=false,ready=true;
 Object.assign(gl,{
  getExtension:()=>null,isContextLost:()=>lost,
  getParameter(key){return key===gl.DRAW_FRAMEBUFFER_BINDING?draw:key===gl.READ_FRAMEBUFFER_BINDING?read:key===gl.RENDERBUFFER_BINDING?renderbuffer:key===gl.VIEWPORT?[...viewport]:key===gl.SAMPLES?4:key===gl.DEPTH_BITS?24:null;},
  createProgram:()=>({id:++next}),createShader:()=>({id:++next}),shaderSource(){},compileShader(){events.push('compile');},attachShader(){},linkProgram(){},getProgramParameter:()=>!fail,getProgramInfoLog:()=> 'bad shader',getShaderInfoLog:()=>'',deleteProgram(){events.push('delete program');},deleteShader(){},
  createFramebuffer(){events.push('framebuffer');return {id:++next};},createRenderbuffer(){events.push('renderbuffer');return {id:++next};},
  bindFramebuffer(kind,value){if(kind===gl.FRAMEBUFFER||kind===gl.DRAW_FRAMEBUFFER)draw=value;if(kind===gl.FRAMEBUFFER||kind===gl.READ_FRAMEBUFFER)read=value;},bindRenderbuffer(_,value){renderbuffer=value;},
  renderbufferStorageMultisample(_,samples,format,w,h){events.push({samples,format,w,h});},renderbufferStorage(){throw Error('must preserve the MSAA pipeline');},framebufferRenderbuffer(){},checkFramebufferStatus:()=>gl.FRAMEBUFFER_COMPLETE,
  viewport(...value){viewport=value;},clear(){assert.notEqual(draw,'canvas','preparation must not clear the visible canvas');},
  fenceSync(){const fence={id:++next,ready};fences.push(fence);return fence;},flush(){events.push('flush');},clientWaitSync:fence=>fence.ready?gl.CONDITION_SATISFIED:gl.TIMEOUT_EXPIRED,deleteSync(fence){events.push('delete fence '+fence.id);},
 });
 return {gl,events,fences,get draw(){return draw;},get viewport(){return viewport;},get bindings(){return {draw,read,renderbuffer};},set lost(value){lost=value;},set fail(value){fail=value;},set ready(value){ready=value;}};
}
(async()=>{
 {
  const h=harness(),source='#version 300 es\nuniform highp int uKind,uVariant,uWinding;\nuniform float uLayers;\nvoid main(){int uKindExtra=uKind+uVariant;}';
  const specialized=h.P.specialize(source,{uKind:5});
  assert(specialized.startsWith('#version 300 es\n'));assert(specialized.includes('uniform highp int uVariant,uWinding;'));assert(specialized.includes('const highp int uKind=5;'));assert(specialized.includes('uniform float uLayers;'));assert(specialized.includes('int uKindExtra=uKind+uVariant;'));
  assert.equal(h.P.specialize('uniform int a,b,c;',{a:0,c:-2}),'uniform int b;\nconst int a=0;\nconst int c=-2;');
  assert.throws(()=>h.P.specialize(source,{uKind:1.5}),/32-bit integer/);assert.throws(()=>h.P.specialize(source,{missing:1}),/No integer uniform/);
  console.log('PASS constant study identity preserves grouped uniforms, precision, names and all dynamic controls');
 }
 for(const [file,name,max] of [['metamorphosis.js','TorusMetamorphosis',20],['tessellations.js','TorusTessellations',19],['topology.js','TorusTopology',53]]){
  const h=harness(),compiled=[];let fail=true;
  const gl=new Proxy({},{get:(_,key)=>key==='getUniformLocation'?((program,name)=>({program,name})):(()=>({}))});
  const c={TorusPrograms:{specialize:h.P.specialize,link:async(gl,vertex,fragment)=>{compiled.push(fragment);if(fail)throw Error('retry');return {}; }},TorusLight:{fragment:source=>source,bind(){}},TORUS_SPECTRUM:{samples:[]},TORUS_CHAIR:{samples:[],width:1,height:1}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist',file),'utf8')+';this.renderer='+name,c);
  const renderer=await c.renderer.create(gl,{},6);assert.equal(compiled.length,0,'family creation must not compile every study');
  await assert.rejects(renderer.prepare(0),/retry/);fail=false;
  const first=renderer.prepare(0);assert.equal(first,renderer.prepare(0),'same study compilation must be shared');await first;await renderer.prepare(0);assert.equal(compiled.length,2);
  await renderer.prepare(max);assert.equal(compiled.length,3);assert(compiled[2].includes('const highp int uKind='+max+';'));assert(compiled[2].includes('uVariant'));
  renderer.draw(new Float32Array(16),.4,.8,48,max,2,{layers:4,balance:.6,ink:.85,spectral:1});
  await assert.rejects(renderer.prepare(max+1),/Unknown/);
  if(file==='topology.js'){
   const map=fs.readFileSync(path.join(__dirname,'../dist/artwork.js'),'utf8').match(/const topologyKinds=(\{[^;]+\});/)[1],kinds=Object.values(vm.runInNewContext('('+map+')'));
   for(const kind of kinds)await renderer.prepare(kind);assert.equal(new Set(compiled.map(source=>source.match(/const highp int uKind=(\d+);/)[1])).size,kinds.length,'all runtime topology identities are accepted');
   await assert.rejects(renderer.prepare(1),/Unknown/);
  }
  console.log('PASS',file,'lazy per-study compilation, shared pending requests, retry and prepared draw');
 }
 {
  const h=harness(),g=graphics(),a=h.P.link(g.gl,'v','f'),b=h.P.link(g.gl,'v','f');assert.equal(a,b,'concurrent requests share one program');await a;
  assert.equal(await h.P.link(g.gl,'v','f'),await a);assert.equal(g.events.filter(e=>e==='compile').length,2);
  g.fail=true;await assert.rejects(h.P.link(g.gl,'v','broken'),/bad shader/);g.fail=false;await h.P.link(g.gl,'v','broken');assert.equal(h.P.pending(g.gl),0);
  console.log('PASS shader promise deduplication and retry after compilation failure');
 }
 {
  const h=harness(),g=graphics(),before=g.bindings;g.ready=false;let draws=0;
  const draw=()=>{assert.notEqual(g.draw,'canvas');assert(g.viewport[2]<=256&&g.viewport[3]<=256);draws++;};
  const a=h.P.stage(g.gl,draw,2000,1200),b=h.P.stage(g.gl,draw,2000,1200);await ticks();
  assert.equal(draws,1,'second preparation waits for first GPU completion');assert.deepEqual(g.bindings,before);assert.deepEqual(g.viewport,[0,0,2000,1200]);
  assert.equal(h.raf.size,1);g.fences[0].ready=true;await h.run(h.raf);await a;assert.equal(draws,2);assert.deepEqual(g.bindings,before);
  g.fences[1].ready=true;await h.run(h.raf);await b;
  assert.equal(g.events.filter(e=>e==='framebuffer').length,1);assert.equal(g.events.filter(e=>e==='renderbuffer').length,2);
  const storage=g.events.filter(e=>e&&typeof e==='object');assert.equal(storage.length,2);assert(storage.every(e=>e.samples===4&&e.w===256&&e.h===154));assert.equal(storage[1].format,g.gl.DEPTH_COMPONENT24);
  assert.equal(g.events.filter(e=>typeof e==='string'&&e.startsWith('delete fence')).length,2);
  await assert.rejects(h.P.stage(g.gl,()=>{throw Error('draw failure');}),/draw failure/);assert.deepEqual(g.bindings,before);assert.deepEqual(g.viewport,[0,0,2000,1200]);
  g.ready=true;await h.P.stage(g.gl,draw);assert.equal(draws,3,'a failed preparation does not poison later selections');
  g.lost=true;await assert.rejects(h.P.afterGPU(g.gl),/context lost/);
  console.log('PASS bounded offscreen MSAA staging, serialized GPU readiness, state restoration and failure recovery');
 }
 {
  const h=harness(),g=graphics();g.ready=false;h.document.hidden=true;
  const wait=h.P.afterGPU(g.gl);assert.equal(h.raf.size,0);assert.equal(h.timers.size,1);g.fences[0].ready=true;await h.run(h.timers);await wait;
  console.log('PASS preparation fences settle in hidden documents');
 }
 {
  const h=harness(),events=[],errors=[];let allowed=false,release;
  const queue=h.P.idleQueue({canRun:()=>allowed,onError:(error,key)=>errors.push(key)});
  const first=queue.enqueue('neighbor',()=>{events.push('neighbor');return new Promise(resolve=>{release=resolve;});});
  const second=queue.enqueue('intent',()=>{events.push('intent');return 2;},2);
  assert.equal(queue.enqueue('intent',()=>{throw Error('duplicate');}),second);assert.equal(h.idle.size,0,'no background work under GPU load');
  allowed=true;queue.kick();allowed=false;await h.run(h.idle,{timeRemaining:()=>50});assert.equal(events.length,0,'headroom is rechecked at execution');
  allowed=true;queue.kick();await h.run(h.idle,{timeRemaining:()=>50});assert.equal(await second,2);assert.deepEqual(events,['intent']);
  await h.run(h.timers);await h.run(h.idle,{timeRemaining:()=>50});assert.equal(queue.active,'neighbor');
  queue.enqueue('third',()=>events.push('third'));queue.kick();assert.equal(h.idle.size,0,'only one job executes at a time');
  release(1);await first;await ticks();queue.cancel('third');await h.run(h.timers);assert.equal(events.length,2);
  const rejected=queue.enqueue('bad',()=>{throw Error('expected');});await h.run(h.idle,{timeRemaining:()=>50});await assert.rejects(rejected,/expected/);assert.deepEqual(errors,['bad']);
  const cancelled=queue.enqueue('cancelled',()=>events.push('cancelled'));queue.dispose();assert.equal(await cancelled,false);assert.equal(queue.pending,0);assert.equal(h.idle.size,0);
  console.log('PASS headroom gating, intent priority, deduplication, serialization, cancellation and queue cleanup');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
