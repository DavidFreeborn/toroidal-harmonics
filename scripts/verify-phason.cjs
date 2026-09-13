/* Independent area, adjacency and periodic manifold checks for real flips. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),root=path.join(__dirname,'../dist'),context={};
for(const [file,name] of [['quasicrystal-data.js','TORUS_QUASI'],['phason.js','TorusPhason']])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8')+';this.'+name+'='+name,context);
const P=context.TorusPhason,levels=[...context.TORUS_QUASI.levels,context.TORUS_QUASI],tau=2*Math.PI;
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],norm=a=>Math.hypot(...a),wrap=(p,c)=>p.map((x,i)=>x-Math.round(x-c[i]));
const key=p=>p.map(x=>((Math.round((x-Math.floor(x))*1e7)%10000000)+10000000)%10000000).join(':');
const area=poly=>poly.reduce((sum,a,i)=>sum+cross(a,poly[(i+1)%poly.length]),0)/2;
function clean(poly){return poly.filter((point,i)=>norm(sub(point,poly[(i+poly.length-1)%poly.length]))>1e-9);}
function manifold(polygons){
 const segments=[],vertices=new Map();for(const raw of polygons){const poly=clean(raw);for(const point of poly)vertices.set(key(point),point);for(let i=0;i<poly.length;i++)segments.push([poly[i],poly[(i+1)%poly.length]]);}
 const edges=new Map(),orientations=new Map(),all=[...vertices.values()];
 // A moving junction subdivides an unchanged neighbouring edge. Split both
 // representations into the same atomic edges before counting incidences.
 for(const [a,b] of segments){
  const delta=sub(b,a),length2=delta[0]**2+delta[1]**2,splits=[0,1];if(length2<1e-16)continue;
  for(const point of all){const d=sub(wrap(point,a),a),t=(d[0]*delta[0]+d[1]*delta[1])/length2;if(t>1e-8&&t<1-1e-8&&Math.abs(cross(delta,d))<1e-10)splits.push(t);}
  splits.sort((x,y)=>x-y);
  for(let i=1;i<splits.length;i++)if(splits[i]-splits[i-1]>1e-8){const x=key([a[0]+delta[0]*splits[i-1],a[1]+delta[1]*splits[i-1]]),y=key([a[0]+delta[0]*splits[i],a[1]+delta[1]*splits[i]]);if(x===y)continue;const k=x<y?x+'/'+y:y+'/'+x;edges.set(k,(edges.get(k)||0)+1);orientations.set(k,(orientations.get(k)||0)+(x<y?1:-1));}
 }
 assert([...edges.values()].every(count=>count===2),'each atomic torus edge has exactly two incident faces');assert([...orientations.values()].every(value=>value===0),'shared edges have opposite orientations');assert.equal(vertices.size-edges.size+polygons.length,0,'the animated partition retains torus Euler characteristic');
 return {edges:new Set(edges.keys()),vertices:vertices.size};
}
let localStates=0,phaseStates=0,maxAreaError=0,minArea=Infinity;
for(let level=0;level<levels.length;level++)for(let variant=0;variant<3;variant++){
 const model=P.buildModel(levels[level],variant);assert(model.patches.length>model.tiles.length*.18,'enough independent real flips to reorganize the mosaic');assert(model.slots<=40);
 const used=new Set();for(const patch of model.patches)for(const id of patch.tiles){assert(!used.has(id));used.add(id);}
 for(const patch of model.patches){
  const region={...patch,flip:true},hexArea=area(patch.outer);
  assert(norm(sub(patch.centre,patch.other))>.001,'the pentagrid flip moves its threefold vertex');
  for(let step=0;step<=64;step++){
   const t=step/64,polygons=P.polygons(region,t),sum=polygons.reduce((value,poly)=>value+area(poly),0);maxAreaError=Math.max(maxAreaError,Math.abs(sum-hexArea));
   assert(Math.abs(sum-hexArea)<1e-12,'local flip retains the complete hexagon area');
   for(const poly of polygons){minArea=Math.min(minArea,area(poly));assert(area(poly)>1e-8);for(let i=0;i<poly.length;i++)assert(cross(sub(poly[(i+1)%poly.length],poly[i]),sub(poly[(i+2)%poly.length],poly[(i+1)%poly.length]))>=-1e-10,'transient polygon stays convex, with no folded or negative areas');}
   localStates++;
  }
  const before=P.polygons(region,0).map(clean),after=P.polygons(region,1).map(clean);
  for(const poly of [...before,...after]){assert.equal(poly.length,4);assert(norm(sub(sub(poly[1],poly[0]),sub(poly[2],poly[3])))<1e-7,'endpoint tiles are parallelograms');}
  const oldAreas=before.map(area).sort((a,b)=>a-b),newAreas=after.map(area).sort((a,b)=>a-b);for(let i=0;i<3;i++)assert(Math.abs(oldAreas[i]-newAreas[i])<1e-8,'flip preserves its three rhomb families and areas');
  for(let tile=0;tile<3;tile++){
   const old=before[(tile+2)%3],next=after[tile],a=sub(next[1],next[0]),b=sub(next[2],next[1]),c=sub(old[1],old[0]),d=sub(old[2],old[1]);
   const equal=(x,y)=>Math.min(norm(sub(x,y)),norm([x[0]+y[0],x[1]+y[1]]))<1e-7;
   assert(equal(a,c)&&equal(b,d)||equal(a,d)&&equal(b,c),'endpoint colour families follow the actual rhomb edge pair');
  }
 }
 for(let frame=0;frame<64;frame++){
  const time=tau*frame/64;let sum=0;
  for(const region of model.regions){const t=P.phase(region,time,.35,variant),loop=P.phase(region,time+tau,.35,variant);assert(Math.abs(t-loop)<1e-13,'animation closes at 2π for every region');for(const poly of P.polygons(region,t))sum+=area(poly);}
  assert(Math.abs(sum-1)<1e-12,'complete moving chart retains area one');phaseStates++;
 }
 // Check the periodic acceleration structure, including both chart seams.
 for(let sample=0;sample<1600;sample++){
  const q=[sample<200?(sample%2?1-1e-9:1e-9):(sample*.61803398875)%1,(sample*.41421356237)%1],cell=[Math.floor(q[0]*model.grid),Math.floor(q[1]*model.grid)],offset=(cell[1]*model.grid+cell[0])*model.groups*4,candidates=Array.from(model.search.slice(offset,offset+model.groups*4));
  const matches=[];model.regions.forEach((region,id)=>{const p=wrap(q,region.centre);if(region.outer.every((a,i)=>cross(sub(region.outer[(i+1)%region.outer.length],a),sub(p,a))>=-1e-11))matches.push(id+1);});
  assert(matches.length>0,'every chart sample belongs to a region');for(const id of matches)assert(candidates.includes(id),'periodic bucket contains its exact owning region');
 }
 if(level===0){
  const first=model.regions.flatMap(region=>P.polygons(region,0)),last=model.regions.flatMap(region=>P.polygons(region,1)),a=manifold(first),b=manifold(last);
  const changed=[...a.edges].filter(edge=>!b.edges.has(edge));assert(changed.length>=model.patches.length*3,'a flip actually replaces three bonds; it is not a pigment animation');
  for(const time of [0,.4,1.7,3.2,5.8,tau])manifold(model.regions.flatMap(region=>P.polygons(region,P.phase(region,time,.35,variant))));
 }
 console.log('PASS phason level',level,'variant',variant,model.tiles.length,'rhombi,',model.patches.length,'disjoint flips,',model.slots,'maximum bucket candidates');
}
console.log('PASS',localStates,'local interpolation states;',phaseStates,'whole-torus phases; nonnegative convex tiles, invariant area, actual adjacency replacement and periodic manifold. Maximum area error',maxAreaError,'minimum tile area',minArea);
