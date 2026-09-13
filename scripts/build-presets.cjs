/* Resolve the curated settings into self-contained study defaults. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={};
vm.runInNewContext(fs.readFileSync('dist/collection.js','utf8').split('const TORUS_COLLECTION =')[0]+';this.catalogue=typeof TORUS_CATALOGUE!=="undefined"?TORUS_CATALOGUE:[];',c);
if(!c.catalogue.length)vm.runInNewContext(fs.readFileSync('dist/collection.js','utf8')+';this.catalogue=TORUS_COLLECTION',c);
vm.runInNewContext(fs.readFileSync('dist/parameters.js','utf8')+';this.parameters=TorusParameters',c);
const entries=c.catalogue.flatMap(g=>g.studies),rows=JSON.parse(fs.readFileSync('scripts/curation.json','utf8'));
const base={speed:2,perspective:105,ink:1,wave:.65,density:88,variation:0,winding:2,layers:3,balance:.5,spectral:1,palette:0,turns:1,recursion:3,textureMode:1,textureStrength:.65,textureScale:2,inkCycle:0};
const presets={},hidden=[];let previous=base;
assert.equal(rows.length,entries.length);assert.equal(new Set(rows.map(x=>x.id)).size,entries.length);
for(const row of rows){
 const entry=entries.find(x=>x[0]===row.id);assert(entry,'Unknown study '+row.id);
 // Keep an explicitly curated archived recipe, without letting it change
 // inheritance for the next visible study. Older archives have no settings.
 if(row.hidden){hidden.push(row.id);if(!row.set)continue;}
 const variation=row.construction?entry[1].indexOf(row.construction):0;assert(variation>=0,'Unknown construction '+row.construction);
 // Inherit actual slider settings. The global preferences apply to each
 // study; local contrast exceptions and contrast cycling never leak onward.
 const s={...(row.inherit===false?base:previous),speed:2,perspective:105,ink:1,inkCycle:0,variation,...row.set};
 c.parameters.normalise(row.id,variation,s);
 for(const [key,value] of Object.entries(row.set||{})){
  const p=c.parameters.profile(row.id,variation,s);
  if(p[key])assert.equal(s[key],value,`Requested value changed: ${row.id} ${key}`);
 }
 presets[row.id]=s;if(!row.hidden)previous=s;
}
const source='/* Per-study defaults. Regenerate with node scripts/build-presets.cjs. */\n'+
 'const TorusPresets=(()=>{\n const base='+JSON.stringify(base)+';\n const hidden=new Set('+JSON.stringify(hidden)+');\n const settings={\n'+
 Object.entries(presets).map(([id,s])=>'  '+JSON.stringify(id)+':'+JSON.stringify(s)).join(',\n')+'\n };\n'+
 ' function get(id){return {...base,...settings[id]};}\n return {get,hidden};\n})();\n';
fs.writeFileSync('dist/presets.js',source);console.log(Object.keys(presets).length+' stored presets; '+(entries.length-hidden.length)+' visible studies; '+hidden.length+' hidden studies');
