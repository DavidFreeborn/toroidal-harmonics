/* Finite Fourier revivals and balanced elliptic divisors on a periodic chart.
   See scripts/REVIVALS-MATHEMATICS.md for equations and numerical limits. */
const TorusRevivals=(()=>{
 const vertexSource = `#version 300 es
precision highp float;
layout(location=0) in vec2 aUV;
uniform mat4 uViewProjection;
out vec3 vPosition;
out vec2 vAngles;
const float TAU=6.28318530718;
void main(){vec2 a=aUV*TAU;vAngles=a;vPosition=vec3((3.0+1.8*cos(a.y))*cos(a.x),1.8*sin(a.y),(3.0+1.8*cos(a.y))*sin(a.x));gl_Position=uViewProjection*vec4(vPosition,1);}`;
 const fragmentSource = `#version 300 es
precision highp float;
uniform float uTime,uWave,uDensity,uLayers,uInk;
uniform highp int uKind,uVariant;
uniform vec2 uEvolution[9],uDiagonal[9];
uniform vec4 uDivisors[3];
in vec3 vPosition;
in vec2 vAngles;
out vec4 fragColor;
const float PI=3.14159265359,TAU=6.28318530718;
vec2 multiply(vec2 a,vec2 b){return vec2(a.x*b.x-a.y*b.y,a.x*b.y+a.y*b.x);}
struct Kernel{vec2 a,b,c,da,db,dc;};
struct Field{vec2 value,x,y;};
Kernel kernel(float x,bool diagonal){
 vec2 step=vec2(cos(TAU*x),sin(TAU*x)),harmonic=vec2(1,0);
 Kernel k;k.a=vec2(1,0);k.b=vec2(0);k.c=vec2(0);k.da=vec2(0);k.db=vec2(0);k.dc=vec2(0);
 for(int j=1;j<=8;j++){
  if(float(j)>uLayers)break;
  float n=float(j),n2=n*n;harmonic=multiply(harmonic,step);
  vec2 evolution=diagonal?uDiagonal[j]:uEvolution[j];
  vec2 value=2.0*harmonic.x*evolution,derivative=-2.0*TAU*n*harmonic.y*evolution;
  k.a+=value;k.b+=n2*value;k.c+=n2*n2*value;
  k.da+=derivative;k.db+=n2*derivative;k.dc+=n2*n2*derivative;
 }
 return k;
}
Field rosette(Kernel a,Kernel b,bool cross){
 vec2 core=multiply(a.a,b.a),cx=multiply(a.da,b.a),cy=multiply(a.a,b.da),petal,px,py;
 if(cross){
  petal=.22*(multiply(a.b,b.a)-multiply(a.a,b.b));
  px=.22*(multiply(a.db,b.a)-multiply(a.da,b.b));py=.22*(multiply(a.b,b.da)-multiply(a.a,b.db));
 }else{
  petal=.018*(multiply(a.c,b.a)-6.0*multiply(a.b,b.b)+multiply(a.a,b.c));
  px=.018*(multiply(a.dc,b.a)-6.0*multiply(a.db,b.b)+multiply(a.da,b.c));
  py=.018*(multiply(a.c,b.da)-6.0*multiply(a.b,b.db)+multiply(a.a,b.dc));
 }
 float coreWeight=.06+.12*(1.0-uWave),petalWeight=.6+uWave;
 Field f;f.value=coreWeight*core+petalWeight*petal;f.x=coreWeight*cx+petalWeight*px;f.y=coreWeight*cy+petalWeight*py;return f;
}
// A periodic Green potential built from theta_1(z | i). Its quadratic
// correction cancels the theta quasi-period multiplier. Three Fourier terms
// suffice on the reduced square; the first omitted term is below 3e-12.
vec3 thetaPotential(vec2 z,vec2 dx,vec2 dy){
 vec2 p=fract(z+.5)-.5,trig=vec2(cos(PI*p.x),sin(PI*p.x)),step=multiply(trig,trig);
 float exponential=exp(PI*p.y),ch=.5*(exponential+1.0/exponential),sh=.5*(exponential-1.0/exponential);
 vec2 hyperbolic=vec2(ch,sh),hstep=vec2(ch*ch+sh*sh,2.0*ch*sh),theta=vec2(0),prime=vec2(0);
 for(int j=0;j<3;j++){
  float n=float(j),k=2.0*n+1.0,coefficient=2.0*(j==1?-1.0:1.0)*exp(-PI*(n+.5)*(n+.5));
  theta+=coefficient*vec2(trig.y*hyperbolic.x,trig.x*hyperbolic.y);
  prime+=PI*k*coefficient*vec2(trig.x*hyperbolic.x,-trig.y*hyperbolic.y);
  trig=multiply(trig,step);hyperbolic=vec2(dot(hyperbolic,hstep),dot(hyperbolic,hstep.yx));
 }
 float norm=dot(theta,theta),variance=(dot(dx,dx)+dot(dy,dy))/12.0;
 vec2 covariant=prime+TAU*p.y*vec2(-theta.y,theta.x);
 // Regularize only the displayed singularity over its pixel footprint.
 float filteredNorm=max(norm+variance*dot(covariant,covariant),1e-20);
 vec2 logarithmic=vec2(dot(covariant,theta),covariant.y*theta.x-covariant.x*theta.y)/filteredNorm;
 return vec3(.5*log(filteredNorm)-PI*p.y*p.y,logarithmic.x,-logarithmic.y);
}
vec3 ellipticField(vec2 z,vec2 dx,vec2 dy,vec4 divisor){
 vec2 a=divisor.xy,b=divisor.zw;
 vec3 field=thetaPotential(z-a,dx,dy)+thetaPotential(z+a,dx,dy)-thetaPotential(z-b,dx,dy)-thetaPotential(z+b,dx,dy);
 float constant=TAU*(a.y*a.y-b.y*b.y);
 float visibility=1.0-smoothstep(.18,.60,max(length(dx),length(dy)));
 field*=visibility;field.x+=constant;return field;
}
void main(){
 float v=vAngles.y,roots=uDensity<64.0?2.0:uDensity<112.0?4.0:6.0;
 vec2 chart=vec2(vAngles.x/TAU,(v-2.0*atan(sin(v)/(3.0+cos(v))))/TAU);
 // Each motion closes at 2pi. The elliptic procession also closes at pi,
 // leaving the zero/pole interchange exact at fixed points of the surface.
 chart.y+=uTime/(uKind==0?TAU:PI);
 vec2 z=chart*roots,dx=dFdx(z),dy=dFdy(z);float tone;
 if(uKind==0){
  Field f;
  if(uVariant==2){
   f=rosette(kernel(z.x+z.y,true),kernel(z.x-z.y,true),false);
   vec2 x=f.x,y=f.y;f.x=x+y;f.y=x-y;
  }else f=rosette(kernel(z.x,false),kernel(z.y,false),uVariant==1);
  float intensity=dot(f.value,f.value),level=log(1.0+.30*intensity);
  vec2 ix=2.0*vec2(dot(f.value,f.x),dot(f.value,f.y));
  vec2 gradient=.30/(1.0+.30*intensity)*vec2(dot(ix,dx),dot(ix,dy));
  float body=torusEdgeCDF(level-.40,gradient);
  float engraving=torusPeriodic(level*.95-.45,.032,gradient*.95)*torusEdgeCDF(level-.72,gradient);
  tone=1.0-body*(1.0-.88*engraving);
 }else{
  vec3 total=vec3(0);float weight=1.0,normalization=0.0;
  vec2 cover=uVariant==0?vec2(2,0):uVariant==1?vec2(1,1):vec2(2,1);
  for(int j=0;j<3;j++){
   if(float(j)>=uLayers)break;
   vec3 local=ellipticField(z,dx,dy,uDivisors[j]);
   total+=weight*vec3(local.x,dot(local.yz,dx),dot(local.yz,dy));normalization+=weight;
   z=multiply(cover,z);dx=multiply(cover,dx);dy=multiply(cover,dy);weight*=.5;
  }
  total/=normalization;
  float base=torusEdgeCDF(total.x,total.yz);
  float engraving=torusPeriodic(4.0*total.x,.050,4.0*total.yz);
  tone=mix(base,1.0-base,engraving);
 }
 // A symmetric transfer preserves Elliptic Eyes' exact half-cycle complement.
 tone=.5+(tone-.5)*(.30+.68*uInk);fragColor=vec4(vec3(clamp(tone,0.0,1.0)),1);
}`;
 const intrinsicLight={textureMode:0,textureStrength:0,textureScale:1};
 async function create(gl,vao,count){
  const programs=new Map(),pending=new Map(),evolution=new Float32Array(18),diagonal=new Float32Array(18),divisors=new Float32Array(12);
  async function prepare(kind){
   if(kind!==0&&kind!==1)throw Error('Unknown revival study');
   if(programs.has(kind))return programs.get(kind);if(pending.has(kind))return pending.get(kind);
   const task=TorusPrograms.link(gl,vertexSource,TorusLight.fragment(TorusPrograms.specialize(fragmentSource,{uKind:kind}))).then(program=>{
    const u={};for(const name of ['uViewProjection','uTime','uWave','uDensity','uLayers','uInk','uVariant','uEvolution[0]','uDiagonal[0]','uDivisors[0]'])u[name]=gl.getUniformLocation(program,name);
    const value={program,u};programs.set(kind,value);return value;
   }).finally(()=>pending.delete(kind));pending.set(kind,task);return task;
  }
  return {prepare,draw(matrix,time,wave,density,kind,variant,options){
   const ready=programs.get(kind);if(!ready)throw Error('Prepare the revival study before drawing');const {program,u}=ready;
   gl.useProgram(program);TorusLight.bind(gl,program,intrinsicLight,time);gl.bindVertexArray(vao);
   gl.uniformMatrix4fv(u.uViewProjection,false,matrix);gl.uniform1f(u.uTime,time);gl.uniform1f(u.uWave,wave);gl.uniform1f(u.uDensity,density);gl.uniform1f(u.uLayers,options.layers);gl.uniform1f(u.uInk,options.ink);gl.uniform1i(u.uVariant,variant);
   if(kind===0){
    const phase=time*(options.turns??1);
    for(let n=0;n<=8;n++){const weight=Math.exp(-.13*n*n),angle=-n*n*phase;evolution[2*n]=weight*Math.cos(angle);evolution[2*n+1]=weight*Math.sin(angle);diagonal[2*n]=weight*Math.cos(2*angle);diagonal[2*n+1]=weight*Math.sin(2*angle);}
    gl.uniform2fv(u['uEvolution[0]'],evolution);gl.uniform2fv(u['uDiagonal[0]'],diagonal);
   }else{
    const rx=.23+.065*wave,ry=.12+.025*wave;
    for(let j=0;j<3;j++){const phase=.5*(time+.25*j),c=Math.cos(phase),s=Math.sin(phase);divisors[4*j]=rx*c;divisors[4*j+1]=ry*s;divisors[4*j+2]=-rx*s;divisors[4*j+3]=ry*c;}
    gl.uniform4fv(u['uDivisors[0]'],divisors);
   }
   gl.drawElements(gl.TRIANGLES,typeof count==='function'?count():count,gl.UNSIGNED_INT,0);
  }};
 }
 return {create};
})();
