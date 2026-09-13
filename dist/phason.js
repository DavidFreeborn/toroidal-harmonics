/* Reversible degree-three flips of a periodic rational pentagrid dual.
   Endpoint tiles are rhombi; intermediate pentagons partition the same hexagon. */
const TorusPhason=(()=>{
 const TAU=2*Math.PI,mod=x=>x-Math.floor(x),cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],mix=(a,b,t)=>[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
 const unwrap=(p,c)=>p.map((v,i)=>v-Math.round(v-c[i]));
 function area(p){let value=0;for(let i=0;i<p.length;i++)value+=cross(p[i],p[(i+1)%p.length]);return value/2;}
 function buildModel(data,variant=0){
  const vertices=[],buckets=new Map(),tiles=[],edges=new Map(),precision=100000;
  function vertex(point){
   const p=point.map(mod),ix=Math.floor(p[0]*precision),iy=Math.floor(p[1]*precision);
   for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const id of buckets.get(((ix+dx+precision)%precision)+':'+((iy+dy+precision)%precision))||[]){const q=unwrap(vertices[id].point,p);if(Math.hypot(q[0]-p[0],q[1]-p[1])<2e-7)return id;}
   const id=vertices.length,key=ix+':'+iy;vertices.push({point:p,tiles:[],neighbors:new Set()});if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(id);return id;
  }
  for(let offset=0;offset<data.tiles.length;offset+=9){
   const a=data.tiles.slice(offset,offset+9),p=[[a[0],a[1]],[a[0]+a[2],a[1]+a[3]],[a[0]+a[2]+a[4],a[1]+a[3]+a[5]],[a[0]+a[4],a[1]+a[5]]];if(area(p)<0)p.reverse();
   const ids=p.map(vertex),id=tiles.length;tiles.push({vertices:ids,family:a[8]});for(const v of ids)vertices[v].tiles.push(id);
   for(let i=0;i<4;i++){const a=ids[i],b=ids[(i+1)%4],key=Math.min(a,b)+':'+Math.max(a,b);edges.set(key,(edges.get(key)||0)+1);vertices[a].neighbors.add(b);vertices[b].neighbors.add(a);}
  }
  if([...edges.values()].some(count=>count!==2)||vertices.length-edges.size+tiles.length!==0)throw Error('The phason approximant must be a closed torus tiling');
  const candidates=[];
  for(let id=0;id<vertices.length;id++){
   const v=vertices[id];if(v.tiles.length!==3||v.neighbors.size!==3)continue;
   const boundary=new Map();
   for(const tile of v.tiles)for(let i=0;i<4;i++){const face=tiles[tile].vertices,a=face[i],b=face[(i+1)%4],key=Math.min(a,b)+':'+Math.max(a,b);if(boundary.has(key))boundary.delete(key);else boundary.set(key,[a,b]);}
   if(boundary.size!==6)continue;
   const next=new Map([...boundary.values()]),outerIds=[boundary.values().next().value[0]];
   while(outerIds.length<6){const nextId=next.get(outerIds.at(-1));if(nextId===undefined)break;outerIds.push(nextId);}
   if(outerIds.length!==6||next.get(outerIds[5])!==outerIds[0])continue;
   const start=outerIds.findIndex(index=>v.neighbors.has(index)),ids=outerIds.slice(start).concat(outerIds.slice(0,start));
   if(![0,2,4].every(i=>v.neighbors.has(ids[i])))continue;
   const outer=ids.map(index=>unwrap(vertices[index].point,v.point));
   if(outer.some((p,i)=>cross(sub(outer[(i+1)%6],p),sub(outer[(i+2)%6],outer[(i+1)%6]))<1e-9))continue;
   const centre=v.point,other=[0,1].map(axis=>outer[0][axis]+outer[2][axis]+outer[4][axis]-2*centre[axis]);
   const families=[0,1,2].map(k=>tiles[v.tiles.find(tile=>[id,ids[2*k],ids[2*k+1],ids[(2*k+2)%6]].every(x=>tiles[tile].vertices.includes(x)))].family);
   const stars=ids.reduce((sum,index)=>sum+(vertices[index].neighbors.size===5?1:0),0),priority=stars*10+Math.sin(centre[0]*107.13+centre[1]*71.37+variant*8.71);
   candidates.push({outer,centre,other,families,tiles:v.tiles,vertex:id,priority});
  }
  candidates.sort((a,b)=>b.priority-a.priority);const occupied=new Set(),patches=[];
  for(const candidate of candidates)if(candidate.tiles.every(id=>!occupied.has(id))){patches.push(candidate);for(const id of candidate.tiles)occupied.add(id);}
  const regions=patches.map(p=>({...p,flip:true}));
  for(let id=0;id<tiles.length;id++)if(!occupied.has(id)){
   const tile=tiles[id],reference=vertices[tile.vertices[0]].point,outer=tile.vertices.map(index=>unwrap(vertices[index].point,reference)),centre=outer.reduce((sum,p)=>[sum[0]+p[0]/4,sum[1]+p[1]/4],[0,0]);
   regions.push({outer,centre,other:centre,families:[tile.family,tile.family,tile.family],flip:false,tiles:[id]});
  }
  const grid=32,index=Array.from({length:grid*grid},()=>[]),padding=1/128;
  for(let id=0;id<regions.length;id++){
   const region=regions[id],xs=region.outer.map(p=>p[0]),ys=region.outer.map(p=>p[1]),seen=new Set();
   for(let y=Math.floor((Math.min(...ys)-padding)*grid);y<=Math.floor((Math.max(...ys)+padding)*grid);y++)for(let x=Math.floor((Math.min(...xs)-padding)*grid);x<=Math.floor((Math.max(...xs)+padding)*grid);x++){const cell=((y%grid+grid)%grid)*grid+(x%grid+grid)%grid;if(!seen.has(cell)){index[cell].push(id+1);seen.add(cell);}}
  }
  const slots=Math.max(...index.map(list=>list.length)),groups=Math.ceil(slots/4);if(slots>40)throw Error('Phason spatial index exceeds its bounded search');
  const search=new Uint16Array(grid*grid*groups*4),records=new Float32Array(regions.length*24);
  for(let y=0;y<grid;y++)for(let x=0;x<grid;x++)search.set(index[y*grid+x],(y*grid+x)*groups*4);
  for(let id=0;id<regions.length;id++){
   const r=regions[id],p=r.outer,span=p.reduce((sum,v,i)=>sum+Math.hypot(...sub(p[(i+1)%p.length],v))/p.length,0),offset=id*24;
   records.set([...r.centre,...r.centre,...r.other,r.flip?1:0,span,...r.families,0,...p[0],...p[1],...p[2],...p[3],...(p[4]||p[0]),...(p[5]||p[1])],offset);
  }
  return {regions,patches,tiles,vertices,edgeCount:edges.size,grid,groups,slots,records,search,area:regions.reduce((sum,r)=>sum+area(r.outer),0)};
 }
 function phase(region,time,wave=0.65,variant=0){
  const [x,y]=region.centre,width=.12+.48*Math.max(0,Math.min(1,wave));
  const shift=variant===1?.16*Math.sin(TAU*x):variant===2?.12*Math.sin(2*TAU*x)+.06*Math.cos(TAU*x):0;
  const v=Math.max(0,Math.min(1,(Math.sin(TAU*(y+shift)-time)+width)/(2*width)));
  return v*v*v*(10+v*(-15+6*v));
 }
 function polygons(region,t){
  if(!region.flip)return [region.outer];const p=region.outer,c=mix(region.centre,region.other,t),q=[0,1,2].map(k=>mix(p[2*k],p[2*k+1],t));
  return [0,1,2].map(k=>[c,q[k],p[2*k+1],p[(2*k+2)%6],q[(k+1)%3]]);
 }
 const vertexSource = `#version 300 es
precision highp float;
layout(location=0) in vec2 aUV;
uniform mat4 uViewProjection;
out vec3 vPosition;
out vec2 vAngles;
const float TAU=6.28318530718;
void main(){vAngles=TAU*aUV;float u=vAngles.x,v=vAngles.y,r=3.0+1.8*cos(v);vPosition=vec3(r*cos(u),1.8*sin(v),r*sin(u));gl_Position=uViewProjection*vec4(vPosition,1);}`;
 const fragmentSource = `#version 300 es
precision highp float;
uniform highp sampler2D uRegions;
uniform highp usampler2D uBuckets;
uniform highp ivec2 uIndex;
uniform highp int uSlots,uVariant;
uniform float uTime,uWave,uInk;
in vec3 vPosition;
in vec2 vAngles;
out vec4 fragColor;
const float TAU=6.28318530718;
float cross2(vec2 a,vec2 b){return a.x*b.y-a.y*b.x;}
// Exact pixel area of a convex chart polygon under its local screen Jacobian.
// Interior/exterior pixels exit before clipping. Partial pixels clip the unit
// square against its four or five edge planes, preserving tonal area.
float coverage(vec2 point,vec2 dx,vec2 dy,vec2 polygon[5],int count,float inset){
 vec3 planes[5];bool interior=true;
 for(int i=0;i<5;i++){
  if(i>=count)break;vec2 a=polygon[i],edge=polygon[(i+1)%count]-a;
  float lengthE=length(edge);if(lengthE<1e-10){planes[i]=vec3(0,0,1);continue;}
  vec3 p=vec3(cross2(edge,dx),cross2(edge,dy),cross2(edge,point-a)-inset*lengthE);
  float radius=.5*(abs(p.x)+abs(p.y));if(p.z+radius<=0.0)return 0.0;if(p.z-radius<0.0)interior=false;planes[i]=p;
 }
 if(interior)return 1.0;
 vec2 points[10],next[10];points[0]=vec2(-.5,-.5);points[1]=vec2(.5,-.5);points[2]=vec2(.5,.5);points[3]=vec2(-.5,.5);int n=4;
 for(int edge=0;edge<5;edge++){
  if(edge>=count)break;vec3 p=planes[edge];int m=0;
  for(int j=0;j<10;j++){
   if(j>=n)break;vec2 a=points[j],b=points[(j+1)%n];float da=dot(p.xy,a)+p.z,db=dot(p.xy,b)+p.z;
   if(da>=0.0){next[m]=a;m++;}
   if((da>0.0&&db<0.0)||(da<0.0&&db>0.0)){next[m]=mix(a,b,da/(da-db));m++;}
  }
  n=m;if(n<3)return 0.0;for(int j=0;j<10;j++){if(j>=n)break;points[j]=next[j];}
 }
 float result=0.0;for(int j=0;j<10;j++){if(j>=n)break;result+=cross2(points[j],points[(j+1)%n]);}return clamp(.5*abs(result),0.0,1.0);
}
float progress(vec2 centre){
 float shift=uVariant==1?.16*sin(TAU*centre.x):uVariant==2?.12*sin(2.0*TAU*centre.x)+.06*cos(TAU*centre.x):0.0;
 float width=.12+.48*uWave,s=clamp((sin(TAU*(centre.y+shift)-uTime)+width)/(2.0*width),0.0,1.0);return s*s*s*(10.0+s*(-15.0+6.0*s));
}
float pigment(float family){float difference=mod(family,5.0)-floor(family/5.0);float thin=difference==2.0||difference==3.0?1.0:0.0;return mix(.065,.955,uVariant==1?1.0-thin:thin);}
void main(){
 vec2 q=fract(vAngles/TAU),dx=dFdx(vAngles/TAU),dy=dFdy(vAngles/TAU);ivec2 cell=ivec2(floor(q*float(uIndex.x)));
 float total=0.0,weight=0.0;
 for(int slot=0;slot<40;slot++){
  if(slot>=uSlots)break;uvec4 packed=texelFetch(uBuckets,ivec2(cell.x*uIndex.y+slot/4,cell.y),0);uint value=packed[slot%4];if(value==0u)break;int id=int(value)-1;
  vec4 head=texelFetch(uRegions,ivec2(0,id),0),tail=texelFetch(uRegions,ivec2(1,id),0),family=texelFetch(uRegions,ivec2(2,id),0);
  vec2 p=q-floor(q-head.xy+.5),outer[6];for(int i=0;i<3;i++){vec4 v=texelFetch(uRegions,ivec2(3+i,id),0);outer[2*i]=v.xy;outer[2*i+1]=v.zw;}
  int count=tail.z>.5?6:4;bool outside=false;
  for(int i=0;i<6;i++){if(i>=count)break;vec2 e=outer[(i+1)%count]-outer[i];float d=cross2(e,p-outer[i]),radius=.5*(abs(cross2(e,dx))+abs(cross2(e,dy)));if(d+radius<0.0){outside=true;break;}}
  if(outside)continue;
  float t=tail.z>.5?progress(head.xy):0.0;vec2 centre=mix(head.zw,tail.xy,t),poly[5];
  for(int tile=0;tile<3;tile++){
   if(tail.z<.5&&tile>0)break;float tone;
   if(tail.z>.5){int k=2*tile;poly[0]=centre;poly[1]=mix(outer[k],outer[k+1],t);poly[2]=outer[k+1];poly[3]=outer[(k+2)%6];poly[4]=mix(outer[(k+2)%6],outer[(k+3)%6],t);tone=mix(pigment(family[tile]),pigment(family[(tile+2)%3]),t);}
   else{poly[0]=outer[0];poly[1]=outer[1];poly[2]=outer[2];poly[3]=outer[3];poly[4]=outer[3];tone=pigment(family.x);}
   int sides=tail.z>.5?5:4;float cover=coverage(p,dx,dy,poly,sides,0.0);if(cover<=0.0)continue;
   float inner=coverage(p,dx,dy,poly,sides,.006*tail.w);total+=tone*inner+.025*(cover-inner);weight+=cover;
  }
 }
 float tone=weight>1e-5?total/weight:.68;
 float fade=.075*smoothstep(4.5,9.0,length(vPosition-vec3(3.65,0,0)));tone=mix(tone,1.0,fade);
 fragColor=vec4(vec3(mix(1.0,tone,uInk)),1);
}`;
 async function create(gl,vao,count){
  const program=await TorusPrograms.link(gl,vertexSource,TorusLight.fragment(fragmentSource,false)),uniforms={};
  for(const name of ['uViewProjection','uRegions','uBuckets','uIndex','uSlots','uVariant','uTime','uWave','uInk'])uniforms[name]=gl.getUniformLocation(program,name);
  const cache=new Map();
  function prepare(kind=0,variant=0,options={},density=0){
   const level=Math.max(0,Math.min(2,Math.round(density))),key=level+':'+variant;if(cache.has(key))return cache.get(key);
   const model=buildModel([...TORUS_QUASI.levels,TORUS_QUASI][level],variant);
   function texture(unit,internal,width,height,format,type,data){const value=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,value);gl.texImage2D(gl.TEXTURE_2D,0,internal,width,height,0,format,type,data);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return value;}
   const regions=texture(5,gl.RGBA32F,6,model.regions.length,gl.RGBA,gl.FLOAT,model.records),buckets=texture(6,gl.RGBA16UI,model.grid*model.groups,model.grid,gl.RGBA_INTEGER,gl.UNSIGNED_SHORT,model.search);
   const value={model,regions,buckets};cache.set(key,value);return value;
  }
  return {prepare,draw(matrix,time,wave,density,kind=0,variant=0,options={ink:1}){
   const selected=prepare(kind,variant,options,density);gl.useProgram(program);gl.bindVertexArray(vao);TorusLight.bind(gl,program,options,time);
   gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,selected.regions);gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,selected.buckets);
   gl.uniform1i(uniforms.uRegions,5);gl.uniform1i(uniforms.uBuckets,6);gl.uniform2i(uniforms.uIndex,selected.model.grid,selected.model.groups);gl.uniform1i(uniforms.uSlots,selected.model.slots);gl.uniform1i(uniforms.uVariant,variant);
   gl.uniformMatrix4fv(uniforms.uViewProjection,false,matrix);gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uWave,wave);gl.uniform1f(uniforms.uInk,options.ink);gl.drawElements(gl.TRIANGLES,typeof count==='function'?count():count,gl.UNSIGNED_INT,0);
  }};
 }
 return {create,buildModel,phase,polygons,area};
})();
