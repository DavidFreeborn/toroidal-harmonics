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
uniform float uAperture,uEngraving,uGenerationRatio;
uniform highp int uKind,uVariant,uWinding,uTreatment;
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
 Kernel k;k.a=diagonal?uDiagonal[0]:uEvolution[0];k.b=vec2(0);k.c=vec2(0);k.da=vec2(0);k.db=vec2(0);k.dc=vec2(0);
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
 // Gaussian width changes seed size, not arbitrary overall brightness. The
 // normalized second/fourth spectral moments keep lobe amplitudes comparable.
 float aperture=uAperture>0.0?uAperture:1.0;
 if(cross){
  petal=.22*aperture*(multiply(a.b,b.a)-multiply(a.a,b.b));
  px=.22*aperture*(multiply(a.db,b.a)-multiply(a.da,b.b));py=.22*aperture*(multiply(a.b,b.da)-multiply(a.a,b.db));
 }else{
  petal=.018*aperture*aperture*(multiply(a.c,b.a)-6.0*multiply(a.b,b.b)+multiply(a.a,b.c));
  px=.018*aperture*aperture*(multiply(a.dc,b.a)-6.0*multiply(a.db,b.b)+multiply(a.da,b.c));
  py=.018*aperture*aperture*(multiply(a.c,b.da)-6.0*multiply(a.b,b.db)+multiply(a.a,b.dc));
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
// Degree-one integer chart changes preserve every lattice period. These are
// display pullbacks; the Fourier/complex field is evaluated in its own chart.
vec2 latticeChart(vec2 z){
 if(uWinding==1)return vec2(z.x+z.y,z.y);
 if(uWinding==2)return vec2(z.x,z.x+z.y);
 if(uWinding==3)return vec2(z.x+z.y,z.x+2.0*z.y);
 return z;
}
void main(){
 float v=vAngles.y,roots=uDensity<64.0?2.0:uDensity<112.0?4.0:6.0;
 vec2 chart=vec2(vAngles.x/TAU,(v-2.0*atan(sin(v)/(3.0+cos(v))))/TAU);
 // Each motion closes at 2pi. The elliptic procession also closes at pi,
 // leaving the zero/pole interchange exact at fixed points of the surface.
 chart.y+=uTime/(uKind==0?TAU:PI);
 vec2 z=latticeChart(chart)*roots,dx=dFdx(z),dy=dFdy(z);float tone;
 if(uKind==0){
  Field f;
  if(uVariant==2){
   f=rosette(kernel(z.x+z.y,true),kernel(z.x-z.y,true),false);
   vec2 x=f.x,y=f.y;f.x=x+y;f.y=x-y;
  }else f=rosette(kernel(z.x,false),kernel(z.y,false),uVariant==1);
  float intensity=dot(f.value,f.value),level=log(1.0+.30*intensity);
  vec2 ix=2.0*vec2(dot(f.value,f.x),dot(f.value,f.y));
  vec2 gradient=.30/(1.0+.30*intensity)*vec2(dot(ix,dx),dot(ix,dy));
  float body=torusEdgeCDF(level-.40,gradient),frequency=.35+.20*uEngraving;
  float width=uTreatment==1?.17:.032;
  float engraving=torusPeriodic(level*frequency-.45,width,gradient*frequency)*torusEdgeCDF(level-.72,gradient);
  if(uTreatment==2){
   // Continuous log-intensity shading retains the same resolved level sets.
   float pigment=.16+.84*(1.0-exp(-.70*level));
   tone=1.0-body*pigment*(1.0-.78*engraving);
  }else tone=1.0-body*(1.0-.88*engraving);
 }else{
  vec3 total=vec3(0);float weight=1.0,normalization=0.0;
  vec2 cover=uVariant==0?vec2(2,0):uVariant==1?vec2(1,1):vec2(2,1);
  for(int j=0;j<3;j++){
   if(float(j)>=uLayers)break;
   vec3 local=ellipticField(z,dx,dy,uDivisors[j]);
   total+=weight*vec3(local.x,dot(local.yz,dx),dot(local.yz,dy));normalization+=weight;
   z=multiply(cover,z);dx=multiply(cover,dx);dy=multiply(cover,dy);weight/=uGenerationRatio;
  }
  total/=normalization;
  float base=torusEdgeCDF(total.x,total.yz),frequency=1.0+uEngraving;
  float engraving=torusPeriodic(frequency*total.x,uTreatment==1?.17:.050,frequency*total.yz);
  if(uTreatment==2){
   // This odd transfer, and the even contour mask, preserve H -> -H exactly.
   float potential=.5+.48*total.x/sqrt(1.0+total.x*total.x);
   tone=mix(potential,1.0-potential,.82*engraving);
  }else tone=mix(base,1.0-base,engraving);
 }
 // A symmetric transfer preserves Elliptic Eyes' exact half-cycle complement.
 tone=.5+(tone-.5)*(.30+.68*uInk);fragColor=vec4(vec3(clamp(tone,0.0,1.0)),1);
}`;
 async function create(gl,vao,count){
  const programs=new Map(),pending=new Map(),evolution=new Float32Array(18),diagonal=new Float32Array(18),divisors=new Float32Array(12);
  async function prepare(kind){
   if(kind!==0&&kind!==1)throw Error('Unknown revival study');
   if(programs.has(kind))return programs.get(kind);if(pending.has(kind))return pending.get(kind);
   const task=TorusPrograms.link(gl,vertexSource,TorusLight.fragment(TorusPrograms.specialize(fragmentSource,{uKind:kind}))).then(program=>{
    const u={};for(const name of ['uViewProjection','uTime','uWave','uDensity','uLayers','uInk','uAperture','uEngraving','uGenerationRatio','uVariant','uWinding','uTreatment','uEvolution[0]','uDiagonal[0]','uDivisors[0]'])u[name]=gl.getUniformLocation(program,name);
    const value={program,u};programs.set(kind,value);return value;
   }).finally(()=>pending.delete(kind));pending.set(kind,task);return task;
  }
  return {prepare,draw(matrix,time,wave,density,kind,variant,options){
   const ready=programs.get(kind);if(!ready)throw Error('Prepare the revival study before drawing');const {program,u}=ready;
   gl.useProgram(program);TorusLight.bind(gl,program,options,time);gl.bindVertexArray(vao);
   gl.uniformMatrix4fv(u.uViewProjection,false,matrix);gl.uniform1f(u.uTime,time);gl.uniform1f(u.uWave,wave);gl.uniform1f(u.uDensity,density);gl.uniform1f(u.uLayers,options.layers);gl.uniform1f(u.uInk,options.ink);gl.uniform1i(u.uVariant,variant);
   gl.uniform1i(u.uWinding,options.winding??0);gl.uniform1i(u.uTreatment,options.palette??0);gl.uniform1f(u.uEngraving,options.recursion??3);gl.uniform1f(u.uGenerationRatio,1+(options.spectral??1));
   if(kind===0){
    const phase=time*(options.turns??1),alpha=.07+.12*(options.balance??.5),aperture=alpha/.13,normalization=Math.sqrt(aperture);
    gl.uniform1f(u.uAperture,aperture);
    for(let n=0;n<=8;n++){const weight=normalization*Math.exp(-alpha*n*n),angle=-n*n*phase;evolution[2*n]=weight*Math.cos(angle);evolution[2*n+1]=weight*Math.sin(angle);diagonal[2*n]=weight*Math.cos(2*angle);diagonal[2*n+1]=weight*Math.sin(2*angle);}
    gl.uniform2fv(u['uEvolution[0]'],evolution);gl.uniform2fv(u['uDiagonal[0]'],diagonal);
   }else{
    const rx=.26575+.14*(wave-.55),ry=.13375+.15*(wave-.55),inheritance=options.balance===undefined?.25:Math.PI*options.balance;
    for(let j=0;j<3;j++){const phase=.5*(time+inheritance*j),c=Math.cos(phase),s=Math.sin(phase);divisors[4*j]=rx*c;divisors[4*j+1]=ry*s;divisors[4*j+2]=-rx*s;divisors[4*j+3]=ry*c;}
    gl.uniform4fv(u['uDivisors[0]'],divisors);
   }
   gl.drawElements(gl.TRIANGLES,typeof count==='function'?count():count,gl.UNSIGNED_INT,0);
  }};
 }
 return {create};
})();
