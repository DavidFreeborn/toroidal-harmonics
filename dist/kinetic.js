/* Kinetic constructions, mounted on the toroidal chamber. */
const TorusKinetic = (() => {
  const vertexSource = `#version 300 es
precision highp float;
layout(location=7) in float aInstance;
layout(location=0) in vec3 aParam;
uniform mat4 uViewProjection;
uniform float uTime;
uniform float uWave;
uniform float uTurns;
uniform highp int uKind;
uniform highp int uVariant;
uniform vec2 uGrid;
out vec3 vPosition;
out vec2 vParam;
flat out float vPart;
const float PI=3.14159265359;
const float TAU=6.28318530718;
mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,s,0,-s,c);}
mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0,-s,0,1,0,s,0,c);}
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0,-s,c,0,0,0,1);}
vec3 torus(float u,float v,float depth){float r=1.8-depth;return vec3((3.0+r*cos(v))*cos(u),r*sin(v),(3.0+r*cos(v))*sin(u));}
// Differentiate the moving frame once; no extra curve samples per vertex.
vec3 cable(float s,float group,float strand,out vec3 derivative,out vec3 n){
 float u=2.0*s+TAU*group/uGrid.x,v=3.0*s-uTime,cu=cos(u),su=sin(u),cv=cos(v),sv=sin(v);
 n=-vec3(cv*cu,sv,cv*su);
 vec3 tu=vec3(-su,0,cu),tv=vec3(-sv*cu,cv,-sv*su);
 vec3 dn=-2.0*cv*tu-3.0*tv,dtu=2.0*(cv*n+sv*tv),dtv=3.0*n-2.0*sv*tu;
 float A=2.0*(3.0+1.66*cv),B=4.98,L=length(vec2(A,B));
 vec3 tangent=(A*tu+B*tv)/L;
 vec3 dT=-9.96*sv*tu+A*dtu+B*dtv;dT=(dT-tangent*dot(tangent,dT))/L;
 vec3 across=cross(tangent,n),dAcross=cross(dT,n)+cross(tangent,dn);
 float phase=12.0*s+TAU*strand/3.0+2.0*uTime,cp=cos(phase),sp=sin(phase),orbit=.042+.023*uWave;
 derivative=2.0*(3.0+1.65*cv)*tu+4.95*tv+orbit*(12.0*(-sp*n+cp*across)+cp*dn+sp*dAcross);
 return vec3((3.0+1.65*cv)*cu,1.65*sv,(3.0+1.65*cv)*su)+orbit*(cp*n+sp*across);
}
void main(){
 float t=uTime,a=uWave;
 vParam=aParam.xy;vPart=aParam.z;
 vec3 world;
 if(uKind==2){
  float group=floor(aInstance/3.0),strand=mod(aInstance,3.0);
  float s=aParam.x*TAU;
  vec3 derivative,n;vec3 p=cable(s,group,strand,derivative,n),tangent=normalize(derivative);
  n=normalize(n-tangent*dot(n,tangent));vec3 b=cross(tangent,n);
  float radius=.025*(.94+.06*cos(9.0*s+3.0*t));
  world=p+radius*(cos(aParam.y*TAU)*n+sin(aParam.y*TAU)*b);
  vPart=strand;
 }else{
  int components=uKind==1?6:(uKind==3?3:1);
  float id=floor(aInstance/float(components));
  float part=mod(aInstance,float(components));
  float i=mod(id,uGrid.x),j=floor(id/uGrid.x);
  float u=TAU*(i+.5)/uGrid.x,v0=TAU*(j+.5)/uGrid.y,v=v0-t;
  float ph=3.0*u+2.0*v0-3.0*t+.38*sin(5.0*u-2.0*v0+t);
  float wave=.5+.5*sin(ph);
  float su=(3.0+1.8*cos(v))*TAU/uGrid.x,sv=1.8*TAU/uGrid.y;
  vec3 p;
  if(uKind==0){
   // Six faces belong to a genuinely rotating solid, with smooth delayed motion.
   vec2 xy=aParam.xy*2.0-1.0;int face=int(aParam.z+.1);
   if(face==0)p=vec3(xy,1);else if(face==1)p=vec3(xy,-1);
   else if(face==2)p=vec3(xy.x,1,xy.y);else if(face==3)p=vec3(xy.x,-1,xy.y);
   else if(face==4)p=vec3(1,xy);else p=vec3(-1,xy);
   float clock=2.0*u+2.0*v0-uTurns*t;
   float angle=clock-.72*a*sin(clock);
   float turn=.15*a*sin(2.0*u-v0+2.0*t);
   mat3 orientation=rz(turn)*rx(angle);
   if(uVariant==1)orientation=ry(angle)*rz(.20*sin(clock));
   if(uVariant==2)orientation=rz(.28*sin(clock))*ry(angle)*rx(angle);
   if(uVariant==3)orientation=ry(angle)*rx((mod(i+j,2.0)*2.0-1.0)*angle);
   if(uVariant==4)orientation=rz(angle)*ry(angle)*rx(.45);
   p=orientation*p;
   // One isotropic scale preserves cubic proportions and prevents collisions.
   vec3 extent=abs(orientation[0])+abs(orientation[1])+abs(orientation[2]);
   float size=.465*min(su/extent.x,sv/extent.y);
   p*=size;p.z+=extent.z*size+.018;
  }else if(uKind==1){
   // Six curved blades turn and lift around a changing open aperture.
   float s=aParam.x,b=aParam.y*2.0-1.0;
   float opening=.5+.5*sin(ph+.7*sin(2.0*u-v0+t));
   float size=min(su,sv)*.95;
   float inner=.045+.23*opening;
   float radius=mix(inner,.48,s);
   float theta=part*TAU/6.0+(1.0-s)*(.45+1.15*opening)+.16*sin(ph)
    +b*(.12+.35*sin(PI*s));
   p=vec3(radius*cos(theta),radius*sin(theta),.018+(.06+.20*a*opening)*sin(PI*s));
   p*=vec3(su*.97,sv*.97,size);vPart=part;
  }else if(uKind==3){
   // Three independently phased planes carry nested closed rings.
   float size=min(su,sv)*.94;
   float radius=.46-.085*part;
   float theta=aParam.x*TAU,around=aParam.y*TAU;
   float tube=.036;
   p=vec3((radius+tube*cos(around))*cos(theta),(radius+tube*cos(around))*sin(theta),tube*sin(around));
   float alpha=(.40+.6*a)*sin(2.0*u+v0+2.0*t+part*TAU/3.0);
   float beta=(.45+.65*a)*cos(u-3.0*v0-t+part*1.2);
   p=rz(.35*sin(ph)+part*PI/3.0)*ry(beta)*rx(alpha)*p;
   p.z+=.50;p*=vec3(su*.97,sv*.97,size);vPart=part;
  }else{
   // Four connected panels lift and twist around an opening square aperture.
   float theta=aParam.x*TAU;
   vec2 outer=vec2(cos(theta),sin(theta));outer*=.5/max(abs(outer.x),abs(outer.y));
   float variant=float(uVariant);
   float opening=smoothstep(.05,.95,wave+.12*variant*sin(u+v0));
   float hole=.13+(.50+.045*variant)*opening;
   float parity=mod(i+j,2.0)*2.0-1.0;
   vec3 inner=rz(parity*(.15+.70*a*opening+.14*variant*a*sin(ph)))*vec3(outer*hole,0);
   vec2 xy=mix(inner.xy,outer,aParam.y);
   float lift=(1.0-aParam.y)*(.10+.38*opening)*(.5+.5*a);
   p=vec3(xy.x*su,xy.y*sv,.025+lift*min(su,sv));
  }
  // Tangent offsets are mapped back to the torus before the inward lift.
  // This keeps broad components attached to the same curved surface.
  float uu=u+p.x/(3.0+1.8*cos(v)),vv=v+p.y/1.8;
  if(uKind==0){
   // A rigid cube lives in the orthonormal frame at its centre. Mapping each
   // corner through angular offsets would bend its faces and change its angles.
   vec3 tu=vec3(-sin(u),0,cos(u));
   vec3 tv=vec3(-sin(v)*cos(u),cos(v),-sin(v)*sin(u));
   vec3 inward=-vec3(cos(v)*cos(u),sin(v),cos(v)*sin(u));
   world=torus(u,v,0.0)+tu*p.x+tv*p.y+inward*p.z;
  }else world=torus(uu,vv,p.z);
 }
 vPosition=world;gl_Position=uViewProjection*vec4(world,1.0);
}`;
  const fragmentSource = `#version 300 es
precision highp float;
uniform highp int uKind;
uniform highp int uVariant;
uniform float uTime;
uniform float uInk;
uniform highp int uPalette;
in vec3 vPosition;
in vec2 vParam;
flat in float vPart;
out vec4 fragColor;
const float TAU=6.28318530718;
float line(float p,float w){return torusPeriodic(p,w,fwidth(p));}
void main(){
 vec3 view=normalize(vec3(3.65,0,0)-vPosition);
 vec3 n=normalize(cross(dFdx(vPosition),dFdy(vPosition)));
 if(dot(n,view)<0.0)n=-n;
 float facing=abs(dot(n,view));
 float diffuse=max(0.0,dot(n,normalize(vec3(1.0,1.6,-.7))));
 float paper=.94+.055*diffuse;
 float ink=0.0;
  if(uKind==0||uKind==1||uKind==4){
  vec2 d=min(vParam,1.0-vParam),aa=max(fwidth(vParam)*.9,vec2(.0002));
  float border=uKind==0?.027:.024;
  ink=1.0-min(smoothstep(border-aa.x,border+aa.x,d.x),smoothstep(border-aa.y,border+aa.y,d.y));
  if(uKind==1){ink=max(ink,.78*line(vParam.y*4.0,.045)*smoothstep(.06,.18,vParam.x));paper=.92+.065*diffuse;}

  if(uKind==4){ink=1.0-smoothstep(border-aa.y,border+aa.y,d.y);ink=max(ink,line(vParam.x*4.0-.5,.015));ink=max(ink,.65*line(vParam.y*5.0,.027));paper=.89+.10*diffuse;}
 }else{
  // Fine black silhouettes, white enamel faces and a narrow reflected band.
  ink=1.0-smoothstep(.16,.42,facing);
  paper=.76+.22*pow(facing,.55);
  if(uKind==2)ink=max(ink,.48*line(vParam.y*3.0,.025));
 }
 float pigment=0.0;
 if(uKind==0){
  // Pigment depends ONLY on face identity. Rotation reveals the light wave.
  pigment=vPart<.5?.02:vPart<1.5?.97:vPart<2.5?.88:vPart<3.5?.12:vPart<4.5?.44:.67;
  if(uPalette==1)pigment=mod(vPart,2.0)*.97;
  if(uPalette==2)pigment=.035+.175*vPart;
 }else if(uKind==1)pigment=mod(vPart,2.0)*.84;
 else if(uKind==4)pigment=mod(floor(vParam.x*4.0),2.0)*.88;
 else pigment=mod(vPart,3.0)<.5?.85:mod(vPart,3.0)<1.5?.04:.42;
 if(uPalette==3)pigment=.02;
 paper=mix(paper,paper*(1.0-.96*pigment),uInk);
 float edge=mix(.035,.80,smoothstep(.35,.65,pigment*uInk));
 float tone=mix(paper,edge,clamp(ink,0.0,1.0));
 float fog=.12*smoothstep(4.2,9.0,length(vec3(3.65,0,0)-vPosition));
 fragColor=vec4(vec3(mix(tone,1.0,fog)),1.0);
}`;
  async function create(gl){
    const visibility=TorusPerformance.instances(gl);

    const program=await TorusPrograms.link(gl,vertexSource,TorusLight.fragment(fragmentSource,true));
    const uniforms={};for(const n of ['uViewProjection','uTime','uWave','uKind','uVariant','uGrid','uInk','uPalette','uTurns'])uniforms[n]=gl.getUniformLocation(program,n);
    function mesh(nx,ny,faces=1){
      const vertices=[],indices=[];
      for(let face=0;face<faces;face++){
        const offset=vertices.length/3;
        for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++)vertices.push(i/nx,j/ny,face);
        for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const n=offset+i*(ny+1)+j;if(faces===6&&[0,3,4].includes(face))indices.push(n,n+ny+1,n+1,n+1,n+ny+1,n+ny+2);else indices.push(n,n+1,n+ny+1,n+1,n+ny+2,n+ny+1);}
      }
      const vao=gl.createVertexArray();gl.bindVertexArray(vao);
      const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
      const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);
      return {vao,count:indices.length};
    }
    const meshes=[];
    const specs=[[1,1,6],[16,3],[384,8],[48,8],[32,2]];
    const prepare=kind=>meshes[kind]||(meshes[kind]=mesh(...specs[kind]));
    return {prepare,draw(matrix,time,wave,density,kind,variant=0,options={ink:.86,palette:0,turns:1}){
      const even=x=>Math.round(x/2)*2;
      let nx=even(18+density*.12),ny=24,parts=1;
      if(kind===1){nx=even(16+density*.09);ny=20;parts=6;}
      if(kind===2){nx=Math.round(3+density*.04);if(nx%3===0)nx++;ny=1;parts=3;}
      if(kind===3){nx=even(16+density*.07);ny=18;parts=3;}
      if(kind===4){nx=even(18+density*.10);ny=22;}
      gl.useProgram(program);TorusLight.bind(gl,program,options,time);gl.uniformMatrix4fv(uniforms.uViewProjection,false,matrix);gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uWave,wave);gl.uniform1i(uniforms.uKind,kind);gl.uniform1i(uniforms.uVariant,variant);gl.uniform2f(uniforms.uGrid,nx,ny);
      gl.uniform1f(uniforms.uInk,options.ink);gl.uniform1i(uniforms.uPalette,options.palette);gl.uniform1f(uniforms.uTurns,options.turns);
      const m=prepare(kind);
      const count=visibility.bind(m.vao,matrix,nx,ny,parts,time,kind===2?0:.8);
      const closed=kind===0||kind===2;if(closed)gl.enable(gl.CULL_FACE);
      if(count)gl.drawElementsInstanced(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0,count);
      if(closed)gl.disable(gl.CULL_FACE);
    }};
  }
  return {create};
})();
