/* CPU integration checks. Renderer mathematics and uploads are covered separately
   by verify-revivals-depth and verify-phason-detail; this checks the real panel,
   dependent random choices, and application state while preparation is pending. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
const dist=path.join(__dirname,'../dist');
const source=name=>fs.readFileSync(path.join(dist,name),'utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
const ids=[145,146,148];
const inactive={density:88,wave:.65,winding:2,layers:3,balance:.5,spectral:1,turns:1,recursion:3,palette:0,inkCycle:0};

function checkProfiles(){
 const context=vm.createContext({});
 for(const name of ['presets.js','collection.js','parameters.js','selection.js'])vm.runInContext(source(name),context);
 const {presets,parameters,selection,catalogue,collection}=vm.runInContext('({presets:TorusPresets,parameters:TorusParameters,selection:TorusSelection,catalogue:TORUS_CATALOGUE,collection:TORUS_COLLECTION})',context);
 const visible=collection.flatMap(group=>group.studies),all=catalogue.flatMap(group=>group.studies);
 assert.equal(visible.length,102);assert.equal(visible.reduce((sum,entry)=>sum+entry[1].length,0),311);
 assert.equal(all.length,128);assert.equal(presets.hidden.size,26);
 assert(presets.hidden.has(147));assert(!visible.some(entry=>entry[0]===147));
 assert.equal(all.find(entry=>entry[0]===147)[1].length,3,'hidden Spinor constructions remain in the source catalogue');
 const values={density:[40,88,136],winding:[0,1,2,3],palette:[0,1,2]};
 function valid(id,state){
  const profile=parameters.profile(id,state.variation,state);
  for(const [key,spec] of Object.entries(profile)){
   assert(Number.isFinite(state[key]),`${id}: finite ${key}`);
   if(spec.values)assert(spec.values.includes(state[key]),`${id}: supported ${key}=${state[key]}`);
   else if(spec.min!==undefined){
    assert(state[key]>=spec.min&&state[key]<=spec.max,`${id}: ${key} within range`);
    const steps=(state[key]-spec.min)/spec.step;
    assert(Math.abs(steps-Math.round(steps))<1e-7,`${id}: ${key} respects its slider step`);
   }else if(key==='textureMode')assert(Number.isInteger(state[key])&&state[key]>=0&&state[key]<=6);
  }
  for(const [key,value] of Object.entries(inactive))if(!profile[key])assert.equal(state[key],value,`${id}: neutral inactive ${key}`);
  assert.deepEqual(copy(parameters.normalise(id,state.variation,{...state})),copy(state),`${id}: normalisation is idempotent`);
  return profile;
 }
 let combinations=0,recipes=0;
 for(const id of ids){
  const preset=presets.get(id),entry=visible.find(entry=>entry[0]===id);
  assert.equal(entry[1].length,3);assert(preset.textureMode>0&&preset.textureStrength>0,'curated light is visible on entry');
  valid(id,preset);
  for(let variation=0;variation<3;variation++)for(const layers of id===145?[4,6,8]:[1,2,3])for(const palette of [0,1,2])for(const textureMode of [0,1,2,3,4,5,6])for(const textureStrength of [0,.73]){
   const state=parameters.normalise(id,variation,{...preset,variation,layers,palette,textureMode,textureStrength});
   const p=valid(id,state);
   for(const [key,expected] of Object.entries(values))assert.deepEqual(copy(p[key].values),expected,`${id}: ${key} choices`);
   assert.equal(Boolean(p.textureStrength),textureMode!==0);
   assert.equal(Boolean(p.textureScale),textureMode!==0&&textureStrength!==0);
   assert.equal(Boolean(p.balance),id===145||layers>1);
   assert.equal(Boolean(p.spectral),id===146&&layers>1);
   assert.equal(Boolean(p.recursion),id!==148,'all three revival treatments retain engraving');
   assert.equal(Boolean(p.turns),id!==146);
   if(id===145)assert.deepEqual(copy(p.layers.values),[4,6,8]);
   if(id===148)assert.deepEqual(copy(p.turns.values),[1,2,3]);
   for(const boundary of [-10000,10000]){
    const outside={...state};
    for(const [key,spec] of Object.entries(p))if(spec.values||spec.min!==undefined)outside[key]=boundary;
    valid(id,parameters.normalise(id,variation,outside));
   }
   combinations++;
  }
  let seed=id;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const seen={variation:new Set(),density:new Set(),winding:new Set(),palette:new Set(),textureMode:new Set(),layers:new Set()};
  if(id===146)seen.spectral=new Set();
  if(id!==146)seen.turns=new Set();
  for(let n=0;n<500;n++){
   const recipe=selection.parameters(id,3,rng),p=valid(id,recipe);
   assert(recipe.variation>=0&&recipe.variation<3);
   for(const [key,set] of Object.entries(seen))if(key==='variation'||p[key])set.add(recipe[key]);
   recipes++;
  }
  for(const [key,set] of Object.entries(seen)){
   const expected=key==='variation'?[0,1,2]:key==='textureMode'?[0,1,2,3,4,5,6]:key==='layers'?(id===145?[4,6,8]:[1,2,3]):key==='turns'?(id===145?[1,2]:[1,2,3]):key==='spectral'?[0,1,2]:values[key];
   assert.deepEqual([...set].sort((a,b)=>a-b),expected,`${id}: extra random reaches every ${key} choice`);
  }
 }
 // A one-layer starting preset must not prevent newly revealed controls from
 // being randomized when a later layer choice reveals them in the same recipe.
 const originalGet=presets.get;
 try{
  presets.get=id=>({...originalGet(id),layers:1,balance:.5,spectral:1});
  for(const id of [146,148]){
   const recipe=selection.parameters(id,3,()=>1-1e-9);
   assert.equal(recipe.layers,3);assert.equal(recipe.balance,1,'choose depth before sampling its dependent breadth/phase');
   if(id===146)assert.equal(recipe.spectral,2);
  }
 }finally{presets.get=originalGet;}
 console.log(`PASS new-study profiles: ${combinations} dependent states, ${recipes} seeded recipes, 102 studies / 311 constructions retained`);
}

async function checkRuntime(){
 const html=source('index.html'),{window}=parseHTML(html),document=window.document;
 Object.defineProperty(document,'activeElement',{value:document.body,writable:true});
 window.HTMLElement.prototype.focus=function(){document.activeElement=this;};
 window.HTMLElement.prototype.blur=function(){document.activeElement=document.body;};
 window.HTMLElement.prototype.scrollIntoView=function(){};
 window.HTMLCanvasElement.prototype.getContext=function(){return {drawImage(){}};};
 const el=id=>document.getElementById(id),frames=new Map(),draws=[],prepares=[],stageGates=[],prepareGates=[],warnings=[];
 let now=0,frameId=0,programId=0,activeProgram,phase='visible',stages=0;
 const gl=new Proxy({}, {get(object,key){
  if(key==='createProgram')return()=>({id:++programId});
  if(key==='getShaderParameter'||key==='getProgramParameter')return()=>true;
  if(key==='getParameter')return name=>name===gl.VIEWPORT?[0,0,1000,700]:16384;
  if(key==='isContextLost')return()=>false;
  if(key==='clientWaitSync')return()=>gl.CONDITION_SATISFIED;
  if(key==='checkFramebufferStatus')return()=>gl.FRAMEBUFFER_COMPLETE;
  if(key==='getUniformLocation')return(program,name)=>({program,name});
  if(key==='useProgram')return program=>{activeProgram=program;};
  if(key.startsWith('uniform'))return location=>assert.equal(activeProgram,location.program,'uniforms use the bound program');
  if(key==='bufferData')return(target,data)=>assert(typeof data==='number'?data>0:data.length>0);
  if(key==='bufferSubData')return(target,offset,data,start,count)=>assert(count<=data.length);
  if(/^[A-Z_0-9]+$/.test(key))return key==='VIEWPORT'?2:1;
  return()=>({});
 }});
 el('field').getContext=()=>gl;el('field').getBoundingClientRect=()=>({width:1000,height:700});
 const context=vm.createContext({document,console:{...console,warn:(...args)=>warnings.push(args)},Float32Array,Float64Array,Uint32Array,Uint8Array,Math,Map,Set,Number,String,Error,devicePixelRatio:2,matchMedia:()=>({matches:false}),setTimeout:()=>1,clearTimeout:()=>{},requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id),Image:class{},ResizeObserver:class{observe(){}},IntersectionObserver:class{observe(){}}});
 for(const file of [...html.matchAll(/<script defer src="\.\/(.*?)\?/g)].map(match=>match[1]).filter(file=>file!=='artwork.js'))vm.runInContext(source(file),context);
 function hold(queue){
  let release,reject;const promise=new Promise((resolve,fail)=>{release=resolve;reject=fail;});
  const gate={promise,release,reject,started:false};queue.push(gate);return gate;
 }
 context.rendererStub=name=>({
  prepare(kind,variant,options,density){
   if(name!=='TorusPhason')return;
   prepares.push({kind,variant,options:copy(options),density});
   const gate=prepareGates.shift();if(gate){gate.started=true;return gate.promise;}
  },
  draw(matrix,time,wave,density,kind,variant,options){
   if(name==='TorusRevivals'||name==='TorusPhason')draws.push({id:name==='TorusPhason'?148:145+kind,time,wave,density,kind,variant,options:copy(options),phase});
  }
 });
 // Real DOM, profiles, presets, selection and application code; instrument only
 // the rendering boundary. Synchronous CPU tests must not compile GPU shaders.
 for(const name of ['TorusKinetic','TorusSculptures','TorusSymmetry','TorusCycles','TorusVisionary','TorusTopology','TorusChiaroscuro','TorusMechanisms','TorusQuasicrystal','TorusMetamorphosis','TorusTessellations','TorusTransformations','TorusRevivals','TorusSpinor','TorusPhason'])vm.runInContext(`${name}.create=async()=>rendererStub('${name}')`,context);
 context.stage=async(gl,draw)=>{
  stages++;const gate=stageGates.shift();if(gate)gate.started=true;
  phase='stage';try{draw();}finally{phase='visible';}
  if(gate)await gate.promise;
 };
 vm.runInContext('TorusPrograms.stage=stage',context);
 await vm.runInContext(source('artwork.js'),context);
 const microtasks=async()=>{for(let i=0;i<50;i++)await Promise.resolve();};
 async function flush(delta=1000/60){await microtasks();now+=delta;const queued=[...frames.values()];frames.clear();for(const frame of queued)frame(now);await microtasks();}
 async function until(predicate,message){for(let i=0;i<50&&!predicate();i++)await flush();assert(predicate(),message);}
 const click=id=>el(id).dispatchEvent(new window.Event('click'));
 function input(id,value){Object.defineProperty(el(id),'value',{value:String(value),writable:true,configurable:true});el(id).dispatchEvent(new window.Event('input'));}
 const choices=[...document.querySelectorAll('.study-choice')];
 const selectedId=()=>Number(choices.find(button=>button.getAttribute('aria-pressed')==='true').querySelector('img').getAttribute('src').match(/\/(\d+)\.webp/)[1]);
 const visible=()=>draws.findLast(draw=>draw.phase==='visible');
 const level=density=>density<=2?density:Math.round((density-40)/48);
 const beginSelect=id=>choices.find(button=>button.querySelector('img').getAttribute('src').includes('/'+id+'.webp')).dispatchEvent(new window.Event('click'));
 async function select(id){beginSelect(id);await until(()=>selectedId()===id&&visible()?.id===id&&el('artwork').getAttribute('aria-busy')==='false',`select ${id}`);}
 function set(key,value){
  const draw=visible(),spec=vm.runInContext(`TorusParameters.profile(${draw.id},${draw.variant},${JSON.stringify(draw.options)})`,context)[key];
  assert(spec,`${draw.id}: ${key} is available`);
  input(key,spec.values&&el(key).tagName!=='SELECT'?spec.values.indexOf(value):value);
 }
 await flush();assert.equal(choices.length,102);assert(!choices.some(button=>button.querySelector('img').getAttribute('src').includes('/147.webp')));
 click('pause');await flush();assert.equal(frames.size,0);
 await select(148);const initial=visible();
 // Asynchronous geometry readiness precedes staging, and staging precedes the
 // visible geometry change. Uniform edits and playback remain live meanwhile.
 const prepareGate=hold(prepareGates),stageGate=hold(stageGates),stageCount=stages;
 set('density',136);await until(()=>prepareGate.started,'density invokes prepare');
 assert.equal(stages,stageCount,'do not stage before asynchronous geometry is ready');
 assert.equal(level(visible().density),level(initial.density));
 prepareGate.release();await until(()=>stageGate.started,'prepared density reaches offscreen stage');
 const prepareCount=prepares.length;
 set('ink',.42);await flush();assert.equal(visible().options.ink,.42);assert.equal(prepares.length,prepareCount,'uniform edits do not rebuild geometry');
 assert.equal(level(visible().density),level(initial.density),'old tiling stays visible while its replacement is staged');
 click('pause');await flush();await flush(500);await flush(500);click('pause');await flush();
 const heldTime=visible().time;assert(heldTime>initial.time);
 stageGate.release();await until(()=>level(visible().density)===2,'prepared density commits');
 assert.equal(visible().options.ink,.42);assert.equal(visible().time,heldTime,'preparation must not rewind live phase');
 assert.equal(el('pause').getAttribute('aria-label'),'Play animation');assert.equal(frames.size,0,'preparation must not resume playback');
 // A later variation inherits the pending density; completions arriving in
 // reverse order cannot discard either edit or restore an obsolete recipe.
 await select(148);
 const first=hold(stageGates);set('density',40);await until(()=>first.started,'first geometry edit stages');
 const second=hold(stageGates);input('variation',2);await until(()=>second.started,'later variation stages');
 second.release();await until(()=>visible().variant===2&&level(visible().density)===0,'latest combined geometry wins');
 first.release();await flush();assert.equal(visible().variant,2);assert.equal(level(visible().density),0);
 // Switching studies invalidates a delayed geometry edit, even after that edit
 // has successfully submitted its offscreen draw.
 const obsolete=hold(stageGates);set('density',136);await until(()=>obsolete.started,'obsolete edit stages');
 await select(145);const switchedDraws=draws.length;obsolete.release();await flush();
 assert.equal(selectedId(),145);assert.equal(visible().id,145);assert(!draws.slice(switchedDraws).some(draw=>draw.id===148&&draw.phase==='visible'));
 // A failed preparation retains a usable tiling and releases the busy state.
 await select(148);const failed=hold(prepareGates);input('variation',2);await until(()=>failed.started,'failure candidate prepares');
 const retainedDensity=visible().density,retainedVariant=visible().variant;failed.reject(new Error('simulated geometry preparation failure'));
 await until(()=>el('artwork').getAttribute('aria-busy')==='false','failed preparation releases busy state');
 assert.equal(visible().density,retainedDensity);assert.equal(visible().variant,retainedVariant);assert.equal(warnings.length,1);
 // The outgoing panel remains on screen during a study transition. Geometry
 // edits there cannot release the new study's busy state or contaminate it.
 const selectionGate=hold(stageGates),outgoing=copy(visible()),outgoingPrepares=prepares.length;
 beginSelect(146);await until(()=>selectionGate.started,'outgoing Phason selection waits for the new study');
 set('density',136);input('variation',2);await flush();
 assert.equal(el('artwork').getAttribute('aria-busy'),'true','old controls cannot clear an in-flight selection');
 assert.equal(prepares.length,outgoingPrepares,'ignore outgoing geometry edits during selection');
 assert.equal(selectedId(),148);assert.equal(visible().density,outgoing.density);assert.equal(visible().variant,outgoing.variant);
 selectionGate.release();await until(()=>selectedId()===146&&visible()?.id===146,'new study still commits');
 const ellipticPreset=vm.runInContext('TorusPresets.get(146)',context);
 assert.equal(visible().density,ellipticPreset.density);assert.equal(visible().variant,ellipticPreset.variation);
 for(const id of ids){
  await select(id);const defaults=vm.runInContext(`TorusPresets.get(${id})`,context);
  assert.equal(visible().options.textureMode,defaults.textureMode);assert(!el('textureStrength-label').hidden);assert(!el('textureScale-label').hidden);
  for(let variant=0;variant<3;variant++){
   input('variation',variant);await until(()=>visible().variant===variant,`${id}: variation ${variant}`);
   for(const density of [40,88,136]){
    set('density',density);await until(()=>visible().density===density,`${id}: density ${density} is forwarded`);
    if(id===148)assert(prepares.some(item=>item.variant===variant&&level(item.density)===level(density)),`${id}: prepare receives matching tiling detail`);
   }
  }
  for(const palette of [0,1,2]){set('palette',palette);await flush();assert.equal(visible().options.palette,palette);assert.equal(el('recursion-label').hidden,id===148);}
  for(const winding of [0,1,2,3]){set('winding',winding);await flush();assert.equal(visible().options.winding,winding);}
  set('wave',.79);await flush();assert.equal(visible().wave,.79);
  if(id!==148){set('recursion',5);await flush();assert.equal(visible().options.recursion,5);}
  if(id!==146){set('turns',id===145?2:3);await flush();assert.equal(visible().options.turns,id===145?2:3);}
  if(id!==145){
   set('layers',1);await flush();assert(el('balance-label').hidden);assert(el('spectral-label').hidden);
   set('layers',3);await flush();assert(!el('balance-label').hidden);
   if(id===146){assert(!el('spectral-label').hidden);set('spectral',2);await flush();assert.equal(visible().options.spectral,2);}
  }
  set('balance',.83);await flush();assert.equal(visible().options.balance,.83);
  set('textureMode',0);await flush();assert(el('textureStrength-label').hidden);assert(el('textureScale-label').hidden);
  set('textureMode',6);await flush();set('textureStrength',0);await flush();assert(!el('textureStrength-label').hidden);assert(el('textureScale-label').hidden);
  set('textureStrength',.72);await flush();set('textureScale',5);await flush();assert.equal(visible().options.textureMode,6);assert.equal(visible().options.textureStrength,.72);assert.equal(visible().options.textureScale,5);
  click('reset-defaults');await until(()=>visible().variant===defaults.variation&&visible().options.textureStrength===defaults.textureStrength,`${id}: reset restores the preset`);
  assert.equal(visible().options.textureMode,defaults.textureMode);assert.equal(visible().time,0);assert.equal(frames.size,0);
 }
 console.log('PASS new-study runtime: 9 constructions, all density/chart/tone mappings, light dependencies, async prepare ordering, live state preservation, rapid edits, study switch and failure recovery');
}

(async()=>{checkProfiles();await checkRuntime();})().catch(error=>{console.error(error);process.exitCode=1;});
