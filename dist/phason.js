/* Reversible degree-three flips of a periodic rational pentagrid dual.
   Endpoint tiles are rhombi; intermediate pentagons partition the same hexagon. */
const TorusPhason=(()=>{
 const TAU=2*Math.PI,mod=x=>x-Math.floor(x),cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],mix=(a,b,t)=>[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
 const unwrap=(p,c)=>p.map((v,i)=>v-Math.round(v-c[i]));
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 // Public density uses the same three stops as the other pentagrid studies.
 // Keep 0/1/2 as explicit model levels for scientific fixtures.
 const levelForDensity=density=>clamp(Math.round(density<=2?density:(density-40)/48),0,2);
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
   const star=ids.filter(index=>vertices[index].neighbors.size===5).sort((a,b)=>{
    const pa=unwrap(vertices[a].point,centre),pb=unwrap(vertices[b].point,centre);return Math.hypot(...sub(pa,centre))-Math.hypot(...sub(pb,centre));
   })[0],anchor=star===undefined?centre:unwrap(vertices[star].point,centre);
   const relay=Math.atan2(centre[1]-anchor[1],centre[0]-anchor[0])/TAU;
   candidates.push({outer,centre,other,families,tiles:v.tiles,vertex:id,priority,relay});
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
   records.set([...r.centre,...r.centre,...r.other,r.flip?1:0,span,...r.families,r.relay||0,...p[0],...p[1],...p[2],...p[3],...(p[4]||p[0]),...(p[5]||p[1])],offset);
  }
  return {regions,patches,tiles,vertices,edgeCount:edges.size,grid,groups,slots,records,search,area:regions.reduce((sum,r)=>sum+area(r.outer),0)};
 }
 function phase(region,time,wave=0.65,variant=0,options={}){
  const [x,y]=region.centre,width=.12+.48*clamp(wave,0,1),winding=clamp(Math.round(options.winding??1),0,3),fronts=clamp(Math.round(options.turns??1),1,3);
  const longitudinal=winding===0?0:winding===1?1:winding===2?-1:2,meridional=winding===3?3:1;
  const shift=variant===1?.16*Math.sin(TAU*x):variant===2?.30*(region.relay||0)+.08*Math.sin(TAU*x):0;
  const direction=variant===1&&Math.cos(TAU*x)<0?-1:1;
  const v=clamp((Math.sin(TAU*(fronts*(meridional*y+longitudinal*x)+shift)-direction*time)+width)/(2*width),0,1);
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
uniform highp int uSlots,uVariant,uWinding,uFronts,uLayers,uPalette;
uniform float uTime,uWave,uInk,uBalance;
in vec3 vPosition;
in vec2 vAngles;
out vec4 fragColor;
const float TAU=6.28318530718;
float cross2(vec2 a,vec2 b){return a.x*b.y-a.y*b.x;}
// Exact pixel area of a convex chart polygon under its local screen Jacobian.
// Interior/exterior pixels exit before clipping. Partial pixels clip the unit
// square against its four or five edge planes, preserving tonal area.
// Reuse normalized planes for every contour, rather than rebuilding edges for
// each inset. The area/perimeter scale changes smoothly with the actual tile.
float tilePlanes(vec2 point,vec2 dx,vec2 dy,vec2 polygon[5],int count,out vec3 planes[5],out vec2 bounds){
 float twiceArea=0.0,perimeter=0.0;vec2 origin=polygon[0];bounds=vec2(1e10);
 for(int i=0;i<5;i++){
  if(i>=count)break;vec2 a=polygon[i],edge=polygon[(i+1)%count]-a;
  float lengthE=length(edge);if(lengthE<1e-10){planes[i]=vec3(0,0,1e10);continue;}
  planes[i]=vec3(cross2(edge,dx),cross2(edge,dy),cross2(edge,point-a))/lengthE;
  float radius=.5*(abs(planes[i].x)+abs(planes[i].y));bounds=min(bounds,planes[i].zz+vec2(-radius,radius));
  twiceArea+=cross2(a-origin,polygon[(i+1)%count]-origin);perimeter+=lengthE;
 }
 return twiceArea/max(perimeter,1e-10);
}
float insetCoverage(vec3 planes[5],int count,float inset,vec2 bounds){
 if(inset<=bounds.x)return 1.0;if(inset>=bounds.y)return 0.0;
 int partial=0;vec3 single=vec3(0);
 for(int i=0;i<5;i++){
  if(i>=count)break;vec3 p=planes[i];p.z-=inset;
  float radius=.5*(abs(p.x)+abs(p.y));if(p.z-radius<0.0){partial++;single=p;}
 }
 // Almost every boundary pixel meets one edge. The exact half-plane marginal
 // avoids a polygon clip there; only pixels containing a corner need clipping.
 if(partial==1){
  vec2 f=.5*abs(single.xy);float a=max(max(f.x,f.y),1e-12),b=min(f.x,f.y),d=single.z;
  if(b<1e-5*a)return clamp(.5+d/(2.0*a),0.0,1.0);
  float tail=max(a+b-abs(d),0.0),value=abs(d)<a-b?.5-abs(d)/(2.0*a):tail*tail/(8.0*a*b);
  return d<0.0?value:1.0-value;
 }
 vec2 points[10],next[10];points[0]=vec2(-.5,-.5);points[1]=vec2(.5,-.5);points[2]=vec2(.5,.5);points[3]=vec2(-.5,.5);int n=4;
 for(int edge=0;edge<5;edge++){
  if(edge>=count)break;vec3 p=planes[edge];p.z-=inset;int m=0;
  for(int j=0;j<10;j++){
   if(j>=n)break;vec2 a=points[j],b=points[(j+1)%n];float da=dot(p.xy,a)+p.z,db=dot(p.xy,b)+p.z;
   if(da>=0.0){next[m]=a;m++;}
   if((da>0.0&&db<0.0)||(da<0.0&&db>0.0)){next[m]=mix(a,b,da/(da-db));m++;}
  }
  n=m;if(n<3)return 0.0;for(int j=0;j<10;j++){if(j>=n)break;points[j]=next[j];}
 }
 float result=0.0;for(int j=0;j<10;j++){if(j>=n)break;result+=cross2(points[j],points[(j+1)%n]);}return clamp(.5*abs(result),0.0,1.0);
}
float coverage(vec2 point,vec2 dx,vec2 dy,vec2 polygon[5],int count,float inset){
 vec3 planes[5];vec2 bounds;tilePlanes(point,dx,dy,polygon,count,planes,bounds);return insetCoverage(planes,count,inset,bounds);
}
float progress(vec2 centre,float relay){
 float longitudinal=uWinding==0?0.0:uWinding==1?1.0:uWinding==2?-1.0:2.0,meridional=uWinding==3?3.0:1.0;
 float shift=uVariant==1?.16*sin(TAU*centre.x):uVariant==2?.30*relay+.08*sin(TAU*centre.x):0.0;
 float direction=uVariant==1&&cos(TAU*centre.x)<0.0?-1.0:1.0;
 float width=.12+.48*uWave,s=clamp((sin(TAU*(float(uFronts)*(meridional*centre.y+longitudinal*centre.x)+shift)-direction*uTime)+width)/(2.0*width),0.0,1.0);return s*s*s*(10.0+s*(-15.0+6.0*s));
}
float pigment(float family){
 float a=floor(family/5.0),b=mod(family,5.0),difference=b-a,thin=difference==2.0||difference==3.0?1.0:0.0;
 if(uPalette==1)return .075+.215*mod(a+b,5.0);
 float light=uVariant==1?1.0-thin:thin;if(uPalette==2)light=1.0-light;return mix(.065,.955,light);
}
vec2 stableMix(vec2 a,vec2 b,float t){return t<.5?a+t*(b-a):b+(1.0-t)*(a-b);}
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
  float t=tail.z>.5?progress(head.xy,family.w):0.0;vec2 centre=stableMix(head.zw,tail.xy,t),poly[5];
  for(int tile=0;tile<3;tile++){
   if(tail.z<.5&&tile>0)break;float tone;int sides=4;
   if(tail.z>.5){
    int k=2*tile;poly[0]=centre;
    // Exact endpoint rhombi avoid normalizing a spurious tiny fifth edge left
    // by floating-point interpolation. A bad edge can reject an entire tile.
    if(t<=0.0){poly[1]=outer[k];poly[2]=outer[k+1];poly[3]=outer[(k+2)%6];poly[4]=poly[3];}
    else if(t>=1.0){poly[1]=outer[k+1];poly[2]=outer[(k+2)%6];poly[3]=outer[(k+3)%6];poly[4]=poly[3];}
    else{poly[1]=stableMix(outer[k],outer[k+1],t);poly[2]=outer[k+1];poly[3]=outer[(k+2)%6];poly[4]=stableMix(outer[(k+2)%6],outer[(k+3)%6],t);sides=5;}
    tone=mix(pigment(family[tile]),pigment(family[(tile+2)%3]),t);
   }
   else{poly[0]=outer[0];poly[1]=outer[1];poly[2]=outer[2];poly[3]=outer[3];poly[4]=outer[3];tone=pigment(family.x);}
   vec3 planes[5];vec2 bounds;float extent=tilePlanes(p,dx,dy,poly,sides,planes,bounds);
   float border=.006*tail.w,cover=0.0,outerRing=0.0,tileTone=0.0;
   // One dynamic callsite prevents ANGLE from cloning the full corner clipper
   // for the outer polygon, its border and every contour threshold.
   int bands=2*clamp(uLayers,1,3);
   for(int band=0;band<bands;band++){
    float inset=band==0?0.0:border;
    if(band>=2){
     int layer=(band-2)/2;float centreInset=uLayers==2?.46:.28+.34*float(layer),halfWidth=.012+.055*uBalance;
     inset=extent*(centreInset+(band%2==0?-halfWidth:halfWidth));if(band%2==0)inset=max(border,inset);
    }
    float covered=insetCoverage(planes,sides,inset,bounds);
    if(band==0){cover=covered;if(cover<=0.0)break;}
    else if(band==1)tileTone=tone*covered+.025*(cover-covered);
    else if(band%2==0)outerRing=covered;
    else tileTone+=(1.0-2.0*tone)*max(0.0,outerRing-covered)*.92;
   }
   total+=tileTone;weight+=cover;
  }
 }
 float tone=weight>1e-5?total/weight:.68;
 float fade=.075*smoothstep(4.5,9.0,length(vPosition-vec3(3.65,0,0)));tone=mix(tone,1.0,fade);
 fragColor=vec4(vec3(mix(1.0,tone,uInk)),1);
}`;
 async function create(gl,vao,count){
  const program=await TorusPrograms.link(gl,vertexSource,TorusLight.fragment(fragmentSource,false)),uniforms={};
  for(const name of ['uViewProjection','uRegions','uBuckets','uIndex','uSlots','uVariant','uTime','uWave','uInk','uWinding','uFronts','uLayers','uBalance','uPalette'])uniforms[name]=gl.getUniformLocation(program,name);
  const cache=new Array(9);
  function prepare(kind=0,variant=0,options={},density=88){
   const level=levelForDensity(density);variant=clamp(Math.round(variant),0,2);const key=level*3+variant;if(cache[key])return cache[key];
   const model=buildModel([...TORUS_QUASI.levels,TORUS_QUASI][level],variant);
   function texture(unit,internal,width,height,format,type,data){const value=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,value);gl.texImage2D(gl.TEXTURE_2D,0,internal,width,height,0,format,type,data);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return value;}
   const regions=texture(5,gl.RGBA32F,6,model.regions.length,gl.RGBA,gl.FLOAT,model.records),buckets=texture(6,gl.RGBA16UI,model.grid*model.groups,model.grid,gl.RGBA_INTEGER,gl.UNSIGNED_SHORT,model.search);
   const value={model,regions,buckets};cache[key]=value;return value;
  }
  return {prepare,draw(matrix,time,wave,density,kind=0,variant=0,options={ink:1}){
   const selected=prepare(kind,variant,options,density);time-=Math.floor(time/TAU)*TAU;gl.useProgram(program);gl.bindVertexArray(vao);TorusLight.bind(gl,program,options,time);
   gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,selected.regions);gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,selected.buckets);
   gl.uniform1i(uniforms.uRegions,5);gl.uniform1i(uniforms.uBuckets,6);gl.uniform2i(uniforms.uIndex,selected.model.grid,selected.model.groups);gl.uniform1i(uniforms.uSlots,selected.model.slots);gl.uniform1i(uniforms.uVariant,variant);
   gl.uniform1i(uniforms.uWinding,clamp(Math.round(options.winding??1),0,3));gl.uniform1i(uniforms.uFronts,clamp(Math.round(options.turns??1),1,3));gl.uniform1i(uniforms.uLayers,clamp(Math.round(options.layers??2),1,3));gl.uniform1f(uniforms.uBalance,clamp(options.balance??.35,0,1));gl.uniform1i(uniforms.uPalette,clamp(Math.round(options.palette??0),0,2));
   gl.uniformMatrix4fv(uniforms.uViewProjection,false,matrix);gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uWave,wave);gl.uniform1f(uniforms.uInk,options.ink);gl.drawElements(gl.TRIANGLES,typeof count==='function'?count():count,gl.UNSIGNED_INT,0);
  }};
 }
 return {create,buildModel,phase,polygons,area,levelForDensity};
})();
