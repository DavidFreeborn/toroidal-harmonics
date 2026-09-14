/* Defaults, option dependencies and random selection, without a browser. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),c={};
for(const f of ['presets','collection','parameters','selection'])vm.runInNewContext(fs.readFileSync('dist/'+f+'.js','utf8'),c);
vm.runInNewContext('this.P=TorusPresets;this.C=TORUS_COLLECTION;this.A=TORUS_CATALOGUE;this.S=TorusSelection;this.params=TorusParameters',c);
const entries=c.C.flatMap(g=>g.studies),requested=JSON.parse(fs.readFileSync('scripts/curation.json','utf8'));
assert.equal(entries.length,102);assert.equal(c.A.flatMap(g=>g.studies).length,128);
assert.equal(c.P.hidden.size,26);assert(c.P.hidden.has(147));assert(!entries.some(x=>x[0]===147));assert(c.A.flatMap(g=>g.studies).some(x=>x[0]===147),'Spinor source constructions remain archived');
for(const row of requested){
 const entry=entries.find(x=>x[0]===row.id);
 if(row.hidden){assert(!entry);continue;}
 assert(entry);const s=c.P.get(row.id);assert.equal(s.speed,row.set?.speed??2);assert.equal(s.perspective,105);assert.equal(s.ink,row.set?.ink??1);
 if(row.construction)assert.equal(entry[1][s.variation],row.construction);
 const p=c.params.profile(row.id,s.variation,s);
 for(const [key,value] of Object.entries(row.set||{}))if(p[key])assert.equal(s[key],value,`${row.id}: ${key}`);
 assert(s.variation>=0&&s.variation<entry[1].length);
}
let seed=4567;const rng=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
for(const [id,variants] of entries)for(let j=0;j<15;j++){
 const s=c.S.parameters(id,variants.length,rng),p=c.params.profile(id,s.variation,s);
 for(const [key,spec] of Object.entries(p)){
  assert(Number.isFinite(s[key]),`${id}: ${key} is not finite`);
  if(spec.values)assert(spec.values.includes(s[key]),`${id}: invalid ${key}`);
  else if(spec.min!==undefined)assert(s[key]>=spec.min&&s[key]<=spec.max);
 }
 if(id!==19)assert.equal(s.inkCycle,0);
}
const seen=new Set();for(let j=0;j<entries.length-1;j++)seen.add(c.S.index(0,entries.length,()=>true,()=>(j+.5)/(entries.length-1)));assert.equal(seen.size,entries.length-1);assert(!seen.has(0));
assert.equal(c.S.index(0,entries.length,i=>i===12,rng),12);
for(const id of [145,146,147,148]){
 const state=c.P.get(id),p=c.params.profile(id,0,{...state,textureMode:0});
 if(id!==147){assert(state.textureMode>0,'Visible studies start with curated lighting');assert(state.textureStrength>0&&state.textureStrength<=.35);}
 assert(p.textureMode&&!p.textureStrength&&!p.textureScale,'Off mode exposes only the choreography selector');
 for(const mode of [1,2,3,4,5,6]){
  const active=c.params.profile(id,0,{...state,textureMode:mode,textureStrength:.65});assert(active.textureMode&&active.textureStrength&&active.textureScale);
  const zero=c.params.profile(id,0,{...state,textureMode:mode,textureStrength:0});assert(zero.textureMode&&zero.textureStrength&&!zero.textureScale);
 }
}
console.log('PASS '+entries.length+' requested defaults, 26 hidden studies, '+entries.length*15+' valid random recipes and selection coverage');
