/* A based contraction of the 720-degree rotation loop in S^3.
   The radius-preserving ambient deformation is an embedding, not a prescribed
   twist angle painted onto a ribbon. See docs/spinor-loom.md for the proof. */
const TorusSpinor=(()=>{
 const TAU=2*Math.PI,INNER=.38,OUTER=1.15,EXTENT=1.31;
 const vertexSource=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
layout(location=3) in float aMaterial;
layout(location=4) in vec4 aCentreScale;
layout(location=5) in vec3 aFrame0;
layout(location=6) in vec3 aFrame1;
layout(location=7) in vec3 aFrame2;
layout(location=8) in vec4 aPhase;
uniform mat4 uViewProjection;
uniform float uWave;
out vec3 vPosition,vNormal;
out vec2 vUV;
flat out float vMaterial;
const float PI=3.141592653589793;
vec3 rotateQ(vec4 q,vec3 p){return p+2.0*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
void main(){
 bool belt=aMaterial<0.0;
 vec3 p=aPosition;if(belt)p.x*=.095+.085*uWave;
 float radius=length(p),s=clamp((radius-.38)/.77,0.0,1.0);
 // A C2 join makes both cube attachment and fixed anchor locally rigid.
 float alpha=.5*PI*s*s*s*(10.0+s*(-15.0+6.0*s));
 float da=.5*PI*30.0*s*s*(1.0-s)*(1.0-s)/.77;
 float c=cos(alpha),h=sin(alpha),C=aPhase.x,S=aPhase.y;
 vec4 q=vec4(c*c*S,h*c*(1.0-C),-h*c*S,h*h+c*c*C);
 vec4 qa=vec4(-2.0*h*c*S,(c*c-h*h)*(1.0-C),-(c*c-h*h)*S,2.0*h*c*(1.0-C));
 // Conjugation changes the arch plane and leaves the spinning x axis fixed.
 mat2 arch=mat2(aPhase.z,aPhase.w,-aPhase.w,aPhase.z);
 q.yz=arch*q.yz;qa.yz=arch*qa.yz;
 vec3 local=rotateQ(q,p),normal;
 if(belt){
  vec3 radial=2.0*da*(cross(qa.xyz,cross(q.xyz,p)+q.w*p)+cross(q.xyz,cross(qa.xyz,p)+qa.w*p));
  vec3 along=rotateQ(q,aNormal)+radial*dot(p,aNormal)/radius;
  vec3 across=rotateQ(q,vec3(1,0,0))+radial*p.x/radius;
  normal=normalize(cross(along,across));
 }else normal=rotateQ(q,aNormal);
 mat3 frame=mat3(aFrame0,aFrame1,aFrame2);
 vPosition=aCentreScale.xyz+aCentreScale.w*(frame*local);
 vNormal=frame*normal;vUV=aUV;vMaterial=aMaterial;
 gl_Position=uViewProjection*vec4(vPosition,1);
}`;
 const fragmentSource=`#version 300 es
precision highp float;
uniform float uInk;
uniform int uPalette;
in vec3 vPosition,vNormal;
in vec2 vUV;
flat in float vMaterial;
out vec4 fragColor;
void main(){
 vec3 view=normalize(vec3(3.65,0,0)-vPosition);
 vec3 normal=normalize(vNormal);if(!gl_FrontFacing)normal=-normal;
 bool belt=vMaterial<0.0;
 // Pigments belong to material faces; time never enters the fragment shader.
 float pigment=belt?(gl_FrontFacing?.94:.045):(vMaterial>5.5?.23:(mod(vMaterial,2.0)<.5?.94:.045));
 if(uPalette==1)pigment=1.0-pigment;
 pigment=mix(.96,pigment,uInk);
 vec3 light=normalize(vec3(-.6,1.4,-.8));
 float diffuse=.76+.24*max(0.0,dot(normal,light));
 float rim=pow(max(0.0,dot(normal,normalize(light+view))),24.0)*.035;
 float tone=clamp(pigment*diffuse+rim,.025,.98);
 vec2 pixel=max(fwidth(vUV),vec2(.00001));
 vec2 margin=min(vUV,1.0-vUV);
 vec2 line=clamp(vec2(.5)+(vec2(belt?.016:.014)-margin)/pixel,0.0,1.0);
 float edge=belt?line.y:max(line.x,line.y);
 tone=mix(tone,pigment>.5?.17:.66,edge*(belt?.58:.72));
 float fog=.17*smoothstep(5.0,10.0,length(vec3(3.65,0,0)-vPosition));
 fragColor=vec4(vec3(mix(tone,1.0,fog)),1);
}`;
 function meshData(variant=0){
  const vertices=[],indices=[];
  const add=(p,n,uv,material)=>vertices.push(...p,...n,...uv,material);
  const directions=variant===1?[[0,0,1],[0,0,-1],[0,1,0],[0,-1,0]]:[[0,0,1],[0,0,-1]];
  const along=160,across=8;
  for(const direction of directions){
   const start=vertices.length/9;
   for(let i=0;i<=along;i++)for(let j=0;j<=across;j++){
    const r=.21+(1.20-.21)*i/along;
    add([2*j/across-1,direction[1]*r,direction[2]*r],direction,[i/along,j/across],-1);
   }
   for(let i=0;i<along;i++)for(let j=0;j<across;j++){
    const k=start+i*(across+1)+j;indices.push(k,k+across+1,k+1,k+1,k+across+1,k+across+2);
   }
  }
  function cuboid(centre,half,anchor=false){
   const normals=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
   for(let f=0;f<6;f++){
    const axis=Math.floor(f/2),x=(axis+1)%3,y=(axis+2)%3,n=normals[f],start=vertices.length/9;
    const corners=[[-1,-1],[1,-1],[1,1],[-1,1]];if(f%2)corners.reverse();
    for(const [a,b] of corners){const p=centre.slice();p[axis]+=n[axis]*half[axis];p[x]+=a*half[x];p[y]+=b*half[y];add(p,n,[(a+1)/2,(b+1)/2],anchor?6:f);}
    indices.push(start,start+1,start+2,start,start+2,start+3);
   }
  }
  cuboid([0,0,0],[.21,.21,.21]);
  for(const d of directions)cuboid(d.map(x=>x*1.225),[.235,d[1]===0?.045:.025,d[2]===0?.045:.025],true);
  return {vertices:new Float32Array(vertices),indices:new Uint16Array(indices)};
 }
 function recipe(density=88,winding=1){
  const count=Math.max(12,Math.min(40,Math.round(12+density/8))),pitch=[1,2,3,5][Math.max(0,Math.min(3,Math.round(winding)))]||2;
  // Enclosing spheres stay disjoint at every phase, even on the inner wall.
  // Minimise the exact torus chord over its mean minor angle, then keep a gap.
  let radius=.46;
  for(let iteration=0;iteration<10;iteration++){
   const tube=1.8-radius-.035;let separation=Infinity;
   for(let i=1;i<count;i++){
    const du=Math.PI*i/count,dv=pitch*du,ss=Math.sin(du)**2;
    const x=Math.max(-1,Math.min(1,-3*Math.cos(dv)/tube));
    const product=9+6*tube*x*Math.cos(dv)+tube*tube*(x*x-Math.sin(dv)**2);
    const distance=Math.sqrt(Math.max(0,4*tube*tube*Math.sin(dv)**2+4*product*ss));
    separation=Math.min(separation,distance);
   }
   const next=Math.min(.46,.44*separation);if(next>=radius)break;radius=next;
  }
  return {count,pitch,radius,scale:radius/EXTENT,depth:radius+.035};
 }
 async function create(gl){
  const program=await TorusPrograms.link(gl,vertexSource,fragmentSource);
  const u={};for(const name of ['uViewProjection','uWave','uInk','uPalette'])u[name]=gl.getUniformLocation(program,name);
  const instanceData=new Float32Array(40*17),instanceBuffer=gl.createBuffer(),meshes=new Map(),recipes=new Map();
  gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);gl.bufferData(gl.ARRAY_BUFFER,instanceData.byteLength,gl.DYNAMIC_DRAW);
  let lastTime=NaN,lastVariant=-1,lastRecipe=null,lastTurns=-1;
  function prepare(kind=0,variant=0,options={},density=88){
   const type=variant===1?1:0;
   let m=meshes.get(type);
   if(!m){
    const data=meshData(type),vao=gl.createVertexArray(),vb=gl.createBuffer(),ib=gl.createBuffer();gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,data.vertices,gl.STATIC_DRAW);
    let offset=0;[3,3,2,1].forEach((size,i)=>{gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,36,offset);offset+=size*4;});
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,data.indices,gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);offset=0;
    [4,3,3,3,4].forEach((size,i)=>{gl.enableVertexAttribArray(i+4);gl.vertexAttribPointer(i+4,size,gl.FLOAT,false,68,offset);gl.vertexAttribDivisor(i+4,1);offset+=size*4;});
    m={vao,vb,ib,count:data.indices.length};meshes.set(type,m);
   }
   const key=density+':'+(options.winding??1);
   if(!recipes.has(key)){if(recipes.size>64)recipes.clear();recipes.set(key,recipe(density,options.winding??1));}
   return m;
  }
  return {prepare,draw(matrix,time,wave,density,kind,variant=0,options={}){
   const mesh=prepare(kind,variant,options,density),r=recipes.get(density+':'+(options.winding??1)),turns=Math.max(1,Math.min(3,Math.round(options.turns??1)));
   if(lastTime!==time||lastVariant!==variant||lastRecipe!==r||lastTurns!==turns){
    for(let i=0;i<r.count;i++){
     const u=TAU*(i+.5)/r.count,v=r.pitch*u-time,cu=Math.cos(u),su=Math.sin(u),cv=Math.cos(v),sv=Math.sin(v),tube=1.8-r.depth;
     const phase=turns*time-2*u,arch=variant===2?(i%2?1:-1)*Math.PI/3:0,k=i*17;
     instanceData[k]=(3+tube*cv)*cu;instanceData[k+1]=tube*sv;instanceData[k+2]=(3+tube*cv)*su;instanceData[k+3]=r.scale;
     instanceData[k+4]=-su;instanceData[k+5]=0;instanceData[k+6]=cu;
     instanceData[k+7]=-cv*cu;instanceData[k+8]=-sv;instanceData[k+9]=-cv*su;
     instanceData[k+10]=sv*cu;instanceData[k+11]=-cv;instanceData[k+12]=sv*su;
     instanceData[k+13]=Math.cos(phase);instanceData[k+14]=Math.sin(phase);instanceData[k+15]=Math.cos(arch);instanceData[k+16]=Math.sin(arch);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,instanceData,0,r.count*17);
    lastTime=time;lastVariant=variant;lastRecipe=r;lastTurns=turns;
   }
   gl.useProgram(program);gl.bindVertexArray(mesh.vao);gl.uniformMatrix4fv(u.uViewProjection,false,matrix);
   gl.uniform1f(u.uWave,Math.max(0,Math.min(1,wave??.65)));gl.uniform1f(u.uInk,Math.max(0,Math.min(1,options.ink??.95)));gl.uniform1i(u.uPalette,options.palette===1?1:0);
   gl.drawElementsInstanced(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0,r.count);
  },dispose(){for(const m of meshes.values()){gl.deleteVertexArray(m.vao);gl.deleteBuffer(m.vb);gl.deleteBuffer(m.ib);}gl.deleteBuffer(instanceBuffer);gl.deleteProgram(program);meshes.clear();recipes.clear();}};
 }
 return {create,meshData,recipe};
})();
