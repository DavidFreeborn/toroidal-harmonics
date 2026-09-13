/* Integration checks without a browser. Run with linkedom on NODE_PATH. */
const {parseHTML}=require('linkedom');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'../dist/');
async function check(fail=[]){
 const {window}=parseHTML(fs.readFileSync(root+'index.html','utf8')),doc=window.document;
 Object.defineProperty(doc,'activeElement',{value:doc.body,writable:true});
 window.HTMLCanvasElement.prototype.getContext=function(){return {drawImage(){}}};
 window.HTMLElement.prototype.focus=function(){doc.activeElement=this};window.HTMLElement.prototype.blur=function(){doc.activeElement=doc.body};window.HTMLElement.prototype.scrollIntoView=function(){};
 const calls=[],images=[],uniforms={},raf=new Map();let active,draws=0,programId=0,frameId=0,now=0,resizeCallback,intersectCallback,rectReads=0;
 const gl=new Proxy({}, {get(o,k){
  if(k==='createProgram')return ()=>({id:++programId});
  if(k==='getShaderParameter'||k==='getProgramParameter')return ()=>true;
  if(k==='getParameter')return name=>name===gl.VIEWPORT?[0,0,1000,700]:16384;
  if(k==='isContextLost')return ()=>false;
  if(k==='clientWaitSync')return ()=>gl.CONDITION_SATISFIED;
  if(k==='checkFramebufferStatus')return ()=>gl.FRAMEBUFFER_COMPLETE;
  if(k==='getUniformLocation')return (p,n)=>({program:p,name:n});
  if(k==='useProgram')return p=>active=p;
  if(k.startsWith('uniform'))return (loc,...args)=>{assert.equal(active,loc.program,'wrong program');uniforms[loc.name]=args.length===1?args[0]:args;};
  if(k==='drawElements'||k==='drawElementsInstanced')return (...args)=>{draws++;calls.push({program:active.id,uniforms:{...uniforms},args});};
  if(k==='bufferData')return (target,data)=>assert(typeof data==='number'?data>0:data.length>0);
  if(k==='bufferSubData')return (target,offset,data,start,count)=>assert(count<=data.length);
  if(/^[A-Z_0-9]+$/.test(k))return k==='VIEWPORT'?2:1;
  return ()=>({});
 }});
 const el=id=>doc.getElementById(id);el('field').getContext=()=>gl;el('field').getBoundingClientRect=()=>{rectReads++;return {width:1000,height:700}};
 const context=vm.createContext({document:doc,console:{...console,warn:()=>{}},Float32Array,Float64Array,Uint32Array,Uint8Array,Image:class{constructor(){this.width=3640;this.height=1820;images.push(this)}},Math,Map,Set,Number,String,Error,devicePixelRatio:2,matchMedia:()=>({matches:false}),setTimeout:()=>1,clearTimeout:()=>{},requestAnimationFrame:fn=>{raf.set(++frameId,fn);return frameId},cancelAnimationFrame:id=>raf.delete(id),ResizeObserver:class{constructor(cb){resizeCallback=cb}observe(){}},IntersectionObserver:class{constructor(cb){intersectCallback=cb}observe(){}}});
 const files=[...fs.readFileSync(root+'index.html','utf8').matchAll(/<script defer src="\.\/(.*?)\?/g)].map(m=>m[1]);
 assert(!files.includes('gyroid.js'),'hidden geometry should not be downloaded');
 for(const file of files.filter(f=>f!=='artwork.js'))vm.runInContext(fs.readFileSync(root+file,'utf8'),context);
 for(const name of fail)vm.runInContext(name+'.create=()=>{throw new Error("simulated unavailable renderer")}',context);
 await vm.runInContext(fs.readFileSync(root+'artwork.js','utf8'),context);
 async function flush(delta=1000/60){for(let i=0;i<50;i++){await Promise.resolve();for(const im of images)if(im.onload&&!im.loaded){im.loaded=true;im.onload();}}now+=delta;const pending=[...raf.values()];raf.clear();for(const cb of pending)cb(now);}
 const click=id=>el(id).dispatchEvent(new window.Event('click'));
 function input(id,value){Object.defineProperty(el(id),'value',{value:String(value),writable:true,configurable:true});el(id).dispatchEvent(new window.Event('input'));}
 await flush();assert(draws>0);if(!fail.length)assert.equal(programId,2,'only the base and selected renderer compile at startup');
 const choices=[...doc.querySelectorAll('.study-choice')];
 assert.equal(choices.length,103);assert.equal(doc.querySelectorAll('.study-group').length,15);assert(el('controls').contains(el('variation')));assert(!el('error').textContent);
 // Selection waits for its renderer while the previous study keeps flowing.
 if(!fail.length){
  const initialTitle=el('study-title').textContent;
  vm.runInContext('this.originalKinetic=TorusKinetic.create;TorusKinetic.create=(...args)=>new Promise(resolve=>{this.releaseKinetic=()=>this.originalKinetic(...args).then(resolve)})',context);
  const chooseId=id=>choices.find(c=>c.querySelector('img').getAttribute('src').includes('/'+id+'.webp')).dispatchEvent(new window.Event('click'));
  chooseId(21);await flush();assert.equal(el('study-title').textContent,initialTitle);const waitingDraws=draws;await flush();assert(draws>waitingDraws,'old artwork keeps animating during compilation');
  chooseId(138);await flush();context.releaseKinetic();await flush();await flush();assert.equal(el('study-title').textContent,initialTitle,'a late completion must not overwrite the newer selection');
  vm.runInContext('TorusKinetic.create=this.originalKinetic',context);
  const time=calls.at(-1).uniforms.uTime;await flush(500);assert(Math.abs(calls.at(-1).uniforms.uTime-time-0.5*2*Math.PI/16)<1e-8,'elapsed wall time must not be clipped after a stall');
 }
 // Pausing stops the frame loop, and a burst of inputs produces one paint.
 click('pause');await flush();assert.equal(raf.size,0);const before=draws;
 input('ink',.7);input('ink',.8);input('ink',.93);assert.equal(draws,before);assert.equal(raf.size,1);await flush();assert.equal(raf.size,0);
 let constructions=0;
 for(let i=0;i<choices.length;i++){
  if(choices[i].disabled)continue;
  choices[i].dispatchEvent(new window.Event('click'));await flush();
  if(!fail.length)assert.equal(el('study-count').textContent,String(i+1).padStart(2,'0')+' / 103');
  assert(!/original/i.test(el('variation').textContent));
  for(let v=0;v<el('variation').options.length;v++){input('variation',v);await flush();assert.equal(el('variation').selectedIndex,v);constructions++;}
 }
 if(!fail.length){
  assert.equal(constructions,314);
  for(const mode of [1,2,3,4,5,6]){input('textureMode',mode);input('textureStrength',.82);input('textureScale',4);await flush();assert.equal(calls.at(-1).uniforms.uTextureMode,mode);assert.equal(calls.at(-1).uniforms.uTextureStrength,.82);assert.equal(calls.at(-1).uniforms.uTextureScale,4);}
  input('textureMode',0);await flush();assert(el('textureStrength-label').hidden);assert(el('textureScale-label').hidden);
  input('textureMode',1);input('textureStrength',0);await flush();assert(!el('textureStrength-label').hidden);assert(el('textureScale-label').hidden);
  input('textureStrength',.82);await flush();assert(!el('textureScale-label').hidden);
  for(const id of ['textureMode','textureStrength','textureScale'])assert(el('controls').contains(el(id)));
  const select=async id=>{choices.find(c=>c.querySelector('img').getAttribute('src').includes('/'+id+'.webp')).dispatchEvent(new window.Event('click'));await flush();};
  await select(21);input('palette',2);input('turns',3);await flush();assert.equal(calls.at(-1).uniforms.uInk,1);assert.equal(calls.at(-1).uniforms.uPalette,2);assert.equal(calls.at(-1).uniforms.uTurns,3);
  await select(59);input('recursion',2);await flush();assert.equal(el('recursion-value').value,'2');assert.equal(calls.at(-1).uniforms.uKind,5);
  await select(41);assert(!el('density-label').hidden);input('variation',1);await flush();assert(el('density-label').hidden);assert(el('wave-label').hidden);
  await select(34);assert(el('balance-label').hidden);input('variation',2);await flush();assert(!el('balance-label').hidden);
  await select(19);input('inkCycle',0);input('variation',3);await flush();assert(!el('balance-label').hidden);assert.equal(Number(el('balance').max),3);assert(el('wave-label').hidden);input('balance',2);await flush();assert.equal(calls.at(-1).uniforms.uBalance,.6);
  await select(67);input('density',0);await flush();assert.equal(calls.at(-1).uniforms.uGrid[0],12);input('density',1);await flush();assert.equal(calls.at(-1).uniforms.uGrid[0],14);
  await select(95);assert.equal(el('layers-name').textContent,'Iteration depth');assert(!el('layers-label').hidden);
  await select(101);input('variation',0);await flush();assert(el('layers-label').hidden);assert(el('turns-label').hidden);input('variation',1);await flush();assert(!el('layers-label').hidden);
  await select(115);assert.equal(el('layers-name').textContent,'Substitution depth');
  await select(121);input('density',0);await flush();assert.equal(calls.at(-1).args.at(-1),204);input('density',2);await flush();assert.equal(calls.at(-1).args.at(-1),1210);
  await select(68);assert(el('density-label').hidden);assert.equal(calls.at(-1).args.at(-1),1210);
  await select(135);assert.equal(el('layers-name').textContent,'Generations');input('winding',3);await flush();assert(!el('balance-label').hidden);assert(el('turns-label').hidden);input('balance',0);await flush();assert(el('layers-label').hidden);input('balance',.65);await flush();assert(!el('layers-label').hidden);assert.equal(calls.at(-1).uniforms.uBalance,.65);input('winding',1);await flush();assert(el('balance-label').hidden);assert(!el('turns-label').hidden);input('layers',1);await flush();assert(el('wave-label').hidden);input('layers',3);await flush();assert(!el('wave-label').hidden);
  await select(130);input('winding',4);await flush();assert(el('turns-label').hidden);assert(el('balance-label').hidden);assert(!el('wave-label').hidden);assert.equal(calls.at(-1).uniforms.uWinding,4);
  const creature=images.find(im=>im.src?.includes('escher/130.png'));assert(creature);assert.equal(calls.at(-1).uniforms.uCreatureReady,1,'selection waits for the detailed field');
  input('winding',3);input('balance',0);await flush();assert(el('wave-label').hidden);await select(131);assert(!el('wave-label').hidden);
  await select(56);assert(el('palette-label').hidden);assert(el('wave-label').hidden);

  await select(138);assert.equal(el('perspective-value').value,'105°');assert.equal(el('speed-value').value,'2.00×');assert.equal(el('density-value').value,'24');assert.equal(el('layers-value').value,'4');assert.equal(calls.at(-1).uniforms.uWinding,1);
  await select(21);assert.equal(el('variation').selectedIndex,4);assert.equal(el('density-value').value,'32');assert.equal(calls.at(-1).uniforms.uPalette,2);assert.equal(calls.at(-1).uniforms.uTurns,3);
  await select(26);assert.equal(calls.at(-1).uniforms.uInk,0);assert.equal(el('density-value').value,'48');
  await select(15);assert.equal(calls.at(-1).uniforms.uInk,.48);assert.equal(el('density-value').value,'64');
  await select(19);assert(el('ink-label').hidden);assert(!el('inkCycle-label').hidden);assert.equal(calls.at(-1).uniforms.uContrastCycle,1);assert.equal(el('balance-value').value,'Fourth');
  input('inkCycle',0);await flush();assert(!el('ink-label').hidden);input('ink',.37);await flush();assert.equal(calls.at(-1).uniforms.uInk,.37);assert.equal(calls.at(-1).uniforms.uContrastCycle,0);
  await select(16);assert.equal(calls.at(-1).uniforms.uInk,1);assert(el('inkCycle-label').hidden);assert.equal(calls.at(-1).uniforms.uContrastCycle,0);
  // Random always restores that study's preset; extra random changes valid
  // parameters without resuming a paused animation. The four new constructions
  // begin at their defined cycle origin; the earlier collection retains phase.
  function selectedId(){const selected=choices.find(button=>button.getAttribute('aria-pressed')==='true');return Number(selected.querySelector('img').getAttribute('src').match(/\/(\d+)\.webp/)[1]);}
  function expectedSpeed(){return vm.runInContext('TorusPresets.get('+selectedId()+').speed',context).toFixed(2)+'×';}
  for(let i=0;i<20;i++){
   const previousTime=calls.at(-1).uniforms.uTime;
   const old=el('study-count').textContent;click('random');await flush();assert.notEqual(el('study-count').textContent,old);
   assert.equal(calls.at(-1).uniforms.uTime,selectedId()>=145?0:previousTime);
   assert.equal(el('perspective-value').value,'105°');assert.equal(el('speed-value').value,expectedSpeed());
   const readyTime=calls.at(-1).uniforms.uTime;
   click('extra-random');await flush();assert.equal(raf.size,0);assert.equal(calls.at(-1).uniforms.uTime,selectedId()>=145?0:readyTime);const randomised=parameterSnapshot();
   click('reset-defaults');await flush();assert.notDeepEqual(parameterSnapshot(),randomised);assert.equal(el('perspective-value').value,'105°');assert.equal(el('speed-value').value,expectedSpeed());
  }
  function parameterSnapshot(){return [...doc.querySelectorAll('#controls input,#controls select')].map(x=>[x.id,x.value]);}

 }
 // Layout reads stop between resizes; invisible artwork schedules no work.
 click('pause');await flush();const reads=rectReads;for(let i=0;i<5;i++)await flush();assert.equal(rectReads,reads);
 Object.defineProperty(doc,'hidden',{value:true,writable:true});doc.dispatchEvent(new window.Event('visibilitychange'));assert.equal(raf.size,0);
 doc.hidden=false;doc.dispatchEvent(new window.Event('visibilitychange'));assert.equal(raf.size,1);await flush();
 intersectCallback([{isIntersecting:false}]);assert.equal(raf.size,0);intersectCallback([{isIntersecting:true}]);assert.equal(raf.size,1);await flush();
 resizeCallback();await flush();assert(rectReads>reads);
 // Slow frames reduce only the drawing resolution, not depth or density.
 const initialWidth=el('field').width,depth=el('recursion').value,density=el('density').value;
 for(let i=0;i<230;i++)await flush(1000/30);
 assert(el('field').width<=initialWidth);assert(el('field').width>=1000,'adaptive mode must never enlarge an undersized raster');assert.equal(el('recursion').value,depth);assert.equal(el('density').value,density);
 input('renderQuality','native');await flush();assert.equal(el('field').width,2000);
 for(let i=0;i<180;i++)await flush(1000/30);assert.equal(el('field').width,2000,'native quality must not drop during playback');
 input('renderQuality','fine');await flush();assert.equal(el('field').width,4000);
 input('renderQuality','adaptive');await flush();assert(el('field').width>=1000);
 click('pause');await flush();assert.equal(raf.size,0);
 console.log('PASS',fail.length?'renderer fallback: '+fail.join(', '):'314 constructions; lazy startup; input coalescing; pause, visibility and adaptive resolution');
}
(async()=>{await check();await check(['TorusChiaroscuro']);await check(['TorusKinetic','TorusSculptures','TorusSymmetry','TorusCycles','TorusVisionary','TorusTopology','TorusChiaroscuro','TorusMechanisms','TorusQuasicrystal','TorusMetamorphosis','TorusTessellations','TorusTransformations','TorusRevivals','TorusSpinor','TorusPhason']);
// The governor has bounded hysteresis, restores detail, and remembers studies.
const context={};vm.runInNewContext(fs.readFileSync(root+'performance.js','utf8')+';this.g=TorusPerformance.governor()',context);const g=context.g;
let t=0;g.reset('heavy');for(let i=0;i<240;i++)g.observe(34,t+=34);assert.equal(g.scale,.5);
g.reset('light');assert.equal(g.scale,1,'a demanding study must not lower unrelated studies');g.reset('heavy');assert.equal(g.scale,.5);
for(let i=0;i<1800;i++)g.observe(16.67,t+=16.67,{tag:g.tag,ms:1});assert.equal(g.scale,1);console.log('PASS adaptive-quality hysteresis and recovery');
})().catch(error=>{console.error(error);process.exitCode=1;});
