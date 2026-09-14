/* CPU checks for the public Phason controls and bounded prepared renderer. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../dist'),context={TorusPrograms:{link:async()=>({})},TorusLight:{fragment:source=>source,bind(){}}};
for(const [file,name] of [['quasicrystal-data.js','TORUS_QUASI'],['phason.js','TorusPhason']])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8')+';this.'+name+'='+name,context);
const P=context.TorusPhason,levels=[...context.TORUS_QUASI.levels,context.TORUS_QUASI],tau=2*Math.PI;
let phaseChecks=0,resourceAllocations=0,draws=0;
(async()=>{
 for(const [density,level] of [[0,0],[1,1],[2,2],[40,0],[88,1],[136,2],[-100,0],[1000,2]])assert.equal(P.levelForDensity(density),level);
 for(let level=0;level<3;level++)for(let variant=0;variant<3;variant++){
  const model=P.buildModel(levels[level],variant);assert(model.slots<=10);
  const representatives=model.patches.filter((_,index)=>index%Math.ceil(model.patches.length/12)===0);
  for(const region of representatives)for(const winding of [0,1,2,3])for(const turns of [1,2,3])for(const wave of [0,.35,1]){
   const options={winding,turns};let minimum=1,maximum=0;
   for(let frame=0;frame<64;frame++){
    const time=tau*frame/64,value=P.phase(region,time,wave,variant,options);
    assert(Number.isFinite(value)&&value>=0&&value<=1);minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);
    assert(Math.abs(value-P.phase(region,time+tau,wave,variant,options))<1e-12,'every control combination closes at 2π');
    const translated={...region,centre:[region.centre[0]+1,region.centre[1]-1]};
    assert(Math.abs(value-P.phase(translated,time,wave,variant,options))<1e-11,'front field respects both torus chart seams');
    phaseChecks++;
   }
   assert.equal(minimum,0,'each active patch reaches its first genuine rhomb tiling');assert.equal(maximum,1,'each active patch reaches its second genuine rhomb tiling');
  }
 }
 // Record only GPU API mutations: all nine model/variant entries have a finite
 // resource ceiling, and prepared playback must never create/upload resources.
 const calls=[],uniforms=new Map(),gl=new Proxy({
  createTexture(){resourceAllocations++;return{}},texImage2D(...args){calls.push(args)},getUniformLocation(_program,name){return name},
  uniform1i(name,value){uniforms.set(name,value)},uniform1f(name,value){uniforms.set(name,value)},drawElements(){draws++}
 },{get(target,key){if(key in target)return target[key];return key===key.toUpperCase()?1:()=>{}}});
 const renderer=await P.create(gl,{},6),prepared=[];
 for(const density of [40,88,136])for(let variant=0;variant<3;variant++)prepared.push(renderer.prepare(0,variant,{},density));
 assert.equal(resourceAllocations,18);assert.equal(calls.length,18);
 const matrix=new Float32Array(16),options={ink:1,winding:0,turns:1,layers:1,balance:0,palette:0};
 for(let frame=0;frame<216;frame++){
  const level=frame%3,variant=Math.floor(frame/3)%3,density=[40,88,136][level];
  options.winding=frame%4;options.turns=1+frame%3;options.layers=1+frame%3;options.balance=frame/215;options.palette=frame%3;
  assert.equal(renderer.prepare(0,variant,options,density),prepared[level*3+variant],'uniform-only controls reuse prepared model');
  renderer.draw(matrix,tau*frame/216,.35,density,0,variant,options);
  assert.equal(uniforms.get('uWinding'),options.winding);assert.equal(uniforms.get('uFronts'),options.turns);assert.equal(uniforms.get('uLayers'),options.layers);assert.equal(uniforms.get('uBalance'),options.balance);assert.equal(uniforms.get('uPalette'),options.palette);
 }
 assert.equal(resourceAllocations,18);assert.equal(calls.length,18);assert.equal(draws,216);
 console.log('PASS',phaseChecks,'front states: every public direction/count/breadth closes at 2π, respects both seams and reaches both rhomb endpoints. Nine cached models use exactly18 textures;216 prepared draws perform zero resource allocations/uploads.');
})().catch(error=>{console.error(error);process.exitCode=1});
