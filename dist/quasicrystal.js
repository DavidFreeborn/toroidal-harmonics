/* Rational Penrose approximants: the dual rhombs close along both torus cycles. */
const TorusQuasicrystal=(()=>{
 const vertexSource = `#version 300 es
precision highp float;
layout(location=0) in vec2 aUV;
layout(location=1) in vec2 aOrigin;
layout(location=2) in vec2 aEdgeA;
layout(location=3) in vec2 aEdgeB;
layout(location=4) in vec3 aTile;
uniform mat4 uViewProjection;
uniform float uTime,uWave,uTurns;
uniform highp int uKind,uVariant;
out vec3 vPosition;
// Multisampled edge pixels must use a covered point of the rhomb. Evaluating
// just outside it can otherwise invent a child of zero width at a reversal.
centroid out vec2 vUV;
flat out vec3 vTile;
const float TAU=6.28318530718;
void main(){
 float t=uTime,ph=TAU*(3.0*aTile.x+2.0*aTile.y)-2.0*uTurns*t;
 vec2 q=aOrigin+aUV.x*aEdgeA+aUV.y*aEdgeB;
 float height=.035;
 if(uKind==0){
  float aperture=.52+.22*sin(ph);vec2 local=aUV-.5;
  float radius=max(abs(local.x),abs(local.y));
  height+=.10*uWave*(1.0-2.0*radius)*(.7+.3*sin(ph));
 }else if(uKind==2){
  float fold=(.5+.5*sin(ph))*(.6+.7*uWave),s=aUV.x;
  q=aOrigin+aEdgeB*aUV.y+aEdgeA*(s*cos(fold));height+=s*sin(fold)*length(aEdgeA)*6.5;
 }else if(uKind==3){
  // Each half rhomb folds about the common diagonal, with opposite normals.
  vec2 centre=aOrigin+.5*(aEdgeA+aEdgeB),diagonal=normalize(aEdgeB-aEdgeA),normal=vec2(-diagonal.y,diagonal.x);
  vec2 delta=q-centre;float across=dot(delta,normal),along=dot(delta,diagonal);
  float fold=(.5+.5*sin(ph))*(.4+1.0*uWave);
  q=centre+along*diagonal+across*cos(fold)*normal;height+=abs(across)*sin(fold)*7.0;
 }else if(uKind==4){
  vec2 f=aUV-.5;float r=max(abs(f.x),abs(f.y));height+=.15*uWave*(1.0-2.0*r)*(.5+.5*sin(ph));
 }else if(uKind==5){
  height+=.045*uWave*sin(3.14159265359*aUV.x)*sin(3.14159265359*aUV.y)*sin(ph);
 }
 q.x+=.024*uWave*sin(TAU*2.0*q.y+sin(t));q.y+=.024*uWave*sin(TAU*3.0*q.x-cos(t));
 if(uKind<6&&uVariant==1)q.x+=.028*sin(TAU*q.y+t);
 if(uKind<6&&uVariant==2)height+=.018*sin(TAU*(5.0*q.x-3.0*q.y)+t);
 float u=TAU*q.x,v=TAU*q.y-t,r=1.8-height;
 vPosition=vec3((3.0+r*cos(v))*cos(u),r*sin(v),(3.0+r*cos(v))*sin(u));
 vUV=aUV;vTile=vec3(aTile.z,ph,TAU*(2.0*aTile.x-3.0*aTile.y));gl_Position=uViewProjection*vec4(vPosition,1);
}`;
 const fragmentSource = `#version 300 es
precision highp float;
uniform float uTime,uInk,uLayers,uBalance,uWave,uTurns;
uniform highp int uKind,uVariant,uWinding;
in vec3 vPosition;
centroid in vec2 vUV;
flat in vec3 vTile;
out vec4 fragColor;
float stroke(float x,float width){return torusStroke(x,width,max(.0002,.65*fwidth(x)));}
void main(){
 float family=mod(vTile.x,5.0)-floor(vTile.x/5.0),ph=vTile.y;
 vec2 local=vUV-.5;float edge=min(min(vUV.x,1.0-vUV.x),min(vUV.y,1.0-vUV.y));
 float beat=.5+.5*sin(ph+family*1.25663706144),pigment=mix(.035,.91,smoothstep(.15,.85,beat));
 float rim=stroke(edge,.017),detail=0.0,weaveMask=1.0;
 if(uKind==0){
  float rho=max(abs(local.x),abs(local.y));
  for(int j=0;j<5;j++){if(float(j)>=uLayers)break;float r=.42*pow(.61803398875,float(j));detail=max(detail,stroke(rho-r,.009));}
 }else if(uKind==1){
  float one=length(vUV),two=length(vUV-1.0),wave=.52+.18*sin(ph);
  detail=max(stroke(one-wave,.025),stroke(two-wave,.025));
  detail=max(detail,.65*stroke(min(one,two)-wave*.618,.012));
 }else if(uKind==3){
  float d=abs(vUV.x+vUV.y-1.0);
  detail=max(stroke(d-.25,.017),stroke(d-.5,.012));
  pigment=mix(pigment,1.0-pigment,step(1.0,vUV.x+vUV.y));
 }else if(uKind==4){
  float r=max(abs(local.x),abs(local.y)),clock=.5+.5*sin(ph);
  for(int j=0;j<4;j++){if(float(j)>=uLayers)break;float k=float(j),radius=.43*pow(.61803398875,k);
   detail=max(detail,stroke(r-radius*(.72+.28*clock),.013));
  }
  pigment=mix(pigment,1.0-pigment,stroke(sin(6.28318530718*(local.x+local.y)-ph),.20));
  pigment*=smoothstep(.12,.17,r)*(1.0-smoothstep(.33,.40,r));
 }else if(uKind==5){
  float A=vUV.x+.16*sin(6.28318530718*vUV.y+ph),B=vUV.y+.16*sin(6.28318530718*vUV.x-ph);
  float nearest=10.0;
  for(int j=0;j<4;j++){if(float(j)>=uLayers)break;float k=(float(j)+.5)/uLayers;
   nearest=min(nearest,min(abs(A-k),abs(B-k)));}
  weaveMask=1.0-smoothstep(.055-max(.001,fwidth(nearest)),.055+max(.001,fwidth(nearest)),nearest);detail=stroke(nearest-.055,.009);pigment=mix(.05,.9,.5+.5*sin(ph+6.28318530718*(A-B)));
 }else if(uKind>=10){
  float phase=uTurns*uTime;
  if(uWinding==1)phase+=vTile.z;
  if(uWinding==2)phase=vTile.y;
  float stage=uWinding==3?uBalance:.5-.5*cos(phase);
  vec2 f=vUV,extent=vec2(1);float ancestry=mod(floor(vTile.x/5.0),2.0),leaf=edge;
  for(int j=0;j<4;j++){
   if(float(j)>=uLayers)break;float k=float(j);
   float lag=(.30+1.10*uWave)*(2.0*k-(uLayers-1.0))/max(1.0,uLayers-1.0);
   float g=stage/(stage+(1.0-stage)*exp2(lag));
   // A zero-angle turn still owns its central tile. Skipping that generation
   // changed the pigment of a finite region as it began to rotate.
   if(uKind==10){
    if(uVariant==1){f=vec2(1.0-f.y,f.x);extent=extent.yx;}
    if(uVariant==2&&mod(k,2.0)>.5)f=1.0-f;
    vec2 span=g*vec2(.61803398875,.38196601125),split=1.0-span;
    vec2 digit=step(split,f)*sign(span),width=mix(split,span,digit);
    // Retain the actual shrinking width. Clamping it to a positive minimum
    // makes its distance metric disagree with the neighbouring parent.
    f=clamp((f-digit*split)/width,0.0,1.0);extent*=width;ancestry+=digit.x+2.0*digit.y;
    // Measure edges in root coordinates. Normalised child distances have
    // unbounded derivatives as a child's width approaches zero, causing a
    // one-pixel flash on the surrounding rhomb even before that child is seen.
    vec2 bounds=min(f,1.0-f)*extent;leaf=min(bounds.x,bounds.y);
   }else{
    if(uVariant==1)g=1.0-g;
    if(uVariant==2&&mod(k,2.0)>.5)g=1.0-g;
    vec2 v=vec2(1.0-g,g),d=f-vec2(g,0);float denom=dot(v,v);
    vec2 child=vec2(dot(d,v),dot(d,vec2(-v.y,v.x)))/denom;
    float cut=min(min(child.x,child.y),min(1.0-child.x,1.0-child.y));
    if(cut<0.0){ancestry+=1.0+step(.5,f.x)+2.0*step(.5,f.y);leaf=min(min(min(f.x,f.y),min(1.0-f.x,1.0-f.y)),-cut*sqrt(denom));break;}
    f=child;ancestry+=2.0;leaf=cut;
   }
  }
  // The undivided central region keeps its pigment at either endpoint,
  // independently of the number of zero-area corner generations.
  float c=mod(ancestry-(uKind==11?2.0*uLayers:0.0),4.0);pigment=c<.5?.94:c<1.5?.05:c<2.5?.65:.23;
  float leafScale=min(extent.x,extent.y);
  rim=stroke(edge,.012);detail=stroke(leaf,.012*leafScale);
  if(uVariant==1){vec2 inset=(min(f,1.0-f)-.11)*extent;detail=max(detail,stroke(min(inset.x,inset.y),.008*leafScale));}
  if(uVariant==2)detail=max(detail,stroke(f.x-f.y,.015)*(1.0-smoothstep(.72*stage,.72*stage+.012,length(f-.5))));
  // Keep child engraving inside the parent rim, including partially covered
  // edge pixels. The outer rim uses the unmodified rhomb coordinates.
  detail*=smoothstep(0.0,max(.024,1.5*fwidth(edge)),edge);
 }else if(uKind>=6){
  float thin=step(1.5,family)*(1.0-step(3.5,family));
  pigment=mix(.10,.90,thin);pigment=mix(pigment,1.0-pigment,.32*beat);
  rim=stroke(edge,.012);
  if(uKind==6){
   if(uVariant==1)detail=max(stroke(abs(local.x)-.28,.013),stroke(abs(local.y)-.28,.013));
   if(uVariant==2){float r=max(abs(local.x),abs(local.y));for(int j=0;j<4;j++){if(float(j)>=uLayers)break;detail=max(detail,stroke(r-.43*pow(.61803398875,float(j)),.009));}}
  }else if(uKind==7){
   vec2 f=vUV;if(mod(floor(vTile.x/5.0),2.0)>.5)f.x=1.0-f.x;
   float arc=min(length(f),length(f-1.0));
   detail=stroke(arc-.5,uVariant==0?.06:.024);
   if(uVariant==1)detail=max(stroke(arc-.59,.017),stroke(arc-.41,.017));
   if(uVariant==2){detail=max(detail,stroke(f.x-f.y,.035));pigment=mix(pigment,1.0-pigment,step(.5,arc));}
  }else{
   vec2 f=vUV;float ancestry=thin,depth=0.0;
   for(int j=0;j<4;j++){
    if(float(j)>=uLayers)break;float k=float(j);depth=k;
    if(uKind==8){
     float split=.5+.11803398875*sin(ph-k*.8),side;
     if(mod(k+float(uVariant),2.0)<.5){side=step(split,f.x);f.x=side<.5?f.x/split:(f.x-split)/(1.0-split);}
     else{side=step(split,f.y);f.y=side<.5?f.y/split:(f.y-split)/(1.0-split);}
     ancestry=2.0*ancestry+side;
    }else{
     vec2 digit=floor(f*2.0);f=fract(f*2.0);float code=digit.x+2.0*digit.y;ancestry+=code;
     if(mod(code+k+float(uVariant),4.0)==0.0)break;
    }
   }
   float parity=mod(ancestry+depth,2.0),leaf=min(min(f.x,1.0-f.x),min(f.y,1.0-f.y));
   pigment=mix(.09,.92,parity);pigment=mix(pigment,1.0-pigment,.35*(.5+.5*sin(ph-depth*.8)));
   detail=stroke(leaf,.016);
   if(uVariant==1)detail=max(detail,stroke(max(abs(f.x-.5),abs(f.y-.5))-.31,.009));
   if(uVariant==2)detail=max(detail,stroke(sin(6.28318530718*(f.x+f.y)-ph),.10));
  }
 }else{
  detail=max(stroke(local.x,.012),stroke(abs(local.y)-.25,.009));
 }
 vec3 n=normalize(cross(dFdx(vPosition),dFdy(vPosition))),view=normalize(vec3(3.65,0,0)-vPosition);if(dot(n,view)<0.0)n=-n;
 float light=.87+.13*max(0.0,dot(n,normalize(vec3(-.6,1.4,-.8))));
 float tone=uKind==5?mix(1.0,(.98-uInk*pigment)*light,weaveMask):(.98-uInk*pigment)*light;
 // Continuous light changes should not flip every engraved edge at 50% grey.
 tone=mix(tone,mix(.035,.92,smoothstep(.35,.65,pigment)),max(rim,detail)*.9);
 fragColor=vec4(vec3(mix(tone,1.0,.12*smoothstep(4.5,9.0,length(vec3(3.65,0,0)-vPosition)))),1);
}`;
 async function create(gl){
  const program=await TorusPrograms.link(gl,vertexSource,TorusLight.fragment(fragmentSource,true));
  const u={};for(const n of ['uViewProjection','uTime','uWave','uTurns','uKind','uVariant','uInk','uLayers','uBalance','uWinding'])u[n]=gl.getUniformLocation(program,n);
  const vertices=[],indices=[],nx=4,ny=4;
  for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++)vertices.push(i/nx,j/ny);
  for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const n=i*(ny+1)+j;indices.push(n,n+1,n+ny+1,n+1,n+ny+2,n+ny+1);}
  const meshes=new Map(),levels=[...TORUS_QUASI.levels,TORUS_QUASI];
  function mesh(level){
   if(meshes.has(level))return meshes.get(level);
   const data=levels[level],vao=gl.createVertexArray();gl.bindVertexArray(vao);
   const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
   const tiles=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,tiles);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.tiles),gl.STATIC_DRAW);let offset=0;[2,2,2,3].forEach((size,i)=>{gl.enableVertexAttribArray(i+1);gl.vertexAttribPointer(i+1,size,gl.FLOAT,false,36,offset*4);gl.vertexAttribDivisor(i+1,1);offset+=size;});
   const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);
   const result={vao,count:data.count};meshes.set(level,result);return result;
  }
  const prepare=(kind,variant=0,options={},density=88)=>mesh(kind>=6?Math.min(2,Math.max(0,Math.floor(density/48)-(kind>=8?1:0))):2);
  return {prepare,draw(matrix,time,wave,density,kind,variant,options){
   const selected=prepare(kind,variant,options,density);
   gl.useProgram(program);TorusLight.bind(gl,program,options,time);gl.bindVertexArray(selected.vao);gl.uniformMatrix4fv(u.uViewProjection,false,matrix);gl.uniform1f(u.uTime,time);gl.uniform1f(u.uWave,wave);gl.uniform1f(u.uTurns,options.turns);gl.uniform1i(u.uKind,kind);gl.uniform1i(u.uVariant,variant);gl.uniform1f(u.uInk,options.ink);gl.uniform1f(u.uLayers,options.layers);gl.uniform1f(u.uBalance,options.balance);gl.uniform1i(u.uWinding,options.winding);gl.drawElementsInstanced(gl.TRIANGLES,indices.length,gl.UNSIGNED_INT,0,selected.count);
  }};
 }
 return {create};
})();
