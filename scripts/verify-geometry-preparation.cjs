/* The selected geometry must be resident before its first visible draw.
   Exercises the production caches, all kinds and the geometry-changing controls. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../dist');
let allocations=0,draws=0,uploads=0,active=null,bound=null;
const gl=new Proxy({}, {get(_,key){
 if(key==='createBuffer'||key==='createVertexArray')return ()=>{allocations++;return {}};
 if(key==='bindVertexArray')return value=>{bound=value};
 if(key==='useProgram')return value=>{active=value};
 if(key==='getUniformLocation')return (program,name)=>({program,name});
 if(key.startsWith('uniform'))return location=>assert.equal(location.program,active);
 if(key==='bufferData')return (target,data)=>{assert(data.length>0);uploads++};
 if(key==='bufferSubData')return (target,offset,data,start,count)=>assert(count<=data.length);
 if(key==='drawElementsInstanced')return (mode,count,type,offset,instances)=>{assert(bound);assert(count>0);assert(instances>0);draws++};
 if(/^[A-Z_0-9]+$/.test(key))return key;
 return ()=>{};
}});
const c=vm.createContext({console,Float32Array,Float64Array,Uint32Array,Uint8Array,Math,Map,WeakSet,Set,
 TorusPrograms:{link:async()=>({})},TorusLight:{fragment:s=>s,bind(){}}});
for(const file of ['performance.js','gyroid.js','quasicrystal-data.js','kinetic.js','sculptures.js','chiaroscuro.js','mechanisms.js','quasicrystal.js','cycles.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
const matrix=new Float32Array([0,0,-1.004008,-1,0,.76,0,0,-.506667,0,0,0,0,0,3.584469,3.65]);
const options={recursion:3,ink:.86,palette:0,turns:1,winding:2,layers:3,balance:.5};
(async()=>{
 let recipes=0;
 for(const [name,kinds] of [['Kinetic',5],['Sculptures',3],['Chiaroscuro',8],['Mechanisms',12],['Quasicrystal',12],['Cycles',4]]){
  const renderer=await vm.runInContext('Torus'+name,c).create(gl);
  const before=draws;
  for(let kind=0;kind<kinds;kind++)for(const variant of [0,1,2])for(const recursion of [1,3,4])for(const density of [32,88,200]){
   const settings={...options,recursion};
   const prepared=renderer.prepare(kind,variant,settings,density);
   assert(prepared?.vao&&prepared.count>0,name+' prepares a valid selected mesh');
   const mark=[allocations,uploads];
   assert.equal(renderer.prepare(kind,variant,settings,density),prepared,name+' reuses prepared geometry');
   renderer.draw(matrix,.4,.65,density,kind,variant,settings);
   assert.deepEqual([allocations,uploads],mark,name+' allocated geometry in its first draw');
   renderer.draw(matrix,.417,.65,density,kind,variant,settings);
   assert.deepEqual([allocations,uploads],mark,name+' allocated geometry during playback');
   recipes++;
  }
  assert(draws>before,name+' rendered visible instances');
  console.log('PASS',name,'selected geometry preparation and steady drawing');
 }
 console.log('PASS',recipes,'recipes:',draws,'draws without geometry allocation after preparation');
})().catch(error=>{console.error(error);process.exitCode=1});
