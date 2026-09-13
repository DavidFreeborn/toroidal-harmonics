/* Eight original visionary geometries, transported around the same torus. */
const TorusVisionary = (() => {
  const vertexSource = `#version 300 es
precision highp float;
layout(location=0) in vec2 aUV;
uniform mat4 uViewProjection;
out vec3 vPosition;
out vec2 vAngles;
const float TAU=6.28318530718;
void main(){
 vec2 a=aUV*TAU;float r=3.0+1.8*cos(a.y);
 vPosition=vec3(r*cos(a.x),1.8*sin(a.y),r*sin(a.x));vAngles=a;
 gl_Position=uViewProjection*vec4(vPosition,1);
}`;
  const fragmentSource = `#version 300 es
precision highp float;
uniform float uTime;
uniform float uWave;
uniform float uDensity;
uniform highp int uKind;
in vec3 vPosition;
in vec2 vAngles;
out vec4 fragColor;
const float PI=3.14159265359;
const float TAU=6.28318530718;
// PACKING_START
const vec3 packing[64]=vec3[64](
 vec3(0.5358983849,0.0000000000,0.4641016151),
 vec3(-0.2679491924,0.4641016151,0.4641016151),
 vec3(-0.2679491924,-0.4641016151,0.4641016151),
 vec3(-0.7759907623,0.0000000000,0.2240092377),
 vec3(0.3879953811,-0.6720277132,0.2240092377),
 vec3(0.3879953811,0.6720277132,0.2240092377),
 vec3(0.1271290072,0.8807755982,0.1100969498),
 vec3(0.6992095395,0.5504847489,0.1100969498),
 vec3(0.1271290072,-0.8807755982,0.1100969498),
 vec3(0.6992095395,-0.5504847489,0.1100969498),
 vec3(-0.8263385466,-0.3302908493,0.1100969498),
 vec3(-0.8263385466,0.3302908493,0.1100969498),
 vec3(-0.0000000000,0.0000000000,0.0717967697),
 vec3(0.8293652770,0.4371965037,0.0624566434),
 vec3(-0.0360593599,0.9368496507,0.0624566434),
 vec3(0.8293652770,-0.4371965037,0.0624566434),
 vec3(-0.0360593599,-0.9368496507,0.0624566434),
 vec3(-0.7933059171,0.4996531471,0.0624566434),
 vec3(-0.7933059171,-0.4996531471,0.0624566434),
 vec3(0.2490322323,0.4313364791,0.0539170599),
 vec3(0.2490322323,-0.4313364791,0.0539170599),
 vec3(-0.4980644646,0.0000000000,0.0539170599),
 vec3(0.6543835385,0.6974926378,0.0435932899),
 vec3(0.2768545740,0.9154590871,0.0435932899),
 vec3(0.6543835385,-0.6974926378,0.0435932899),
 vec3(0.2768545740,-0.9154590871,0.0435932899),
 vec3(-0.9312381125,0.2179664493,0.0435932899),
 vec3(-0.9312381125,-0.2179664493,0.0435932899),
 vec3(0.8917944455,0.3564538360,0.0396059818),
 vec3(-0.1371991455,0.9505435628,0.0396059818),
 vec3(0.8917944455,-0.3564538360,0.0396059818),
 vec3(-0.1371991455,-0.9505435628,0.0396059818),
 vec3(-0.7545953000,0.5940897267,0.0396059818),
 vec3(-0.7545953000,-0.5940897267,0.0396059818),
 vec3(0.5701624478,0.4937751641,0.0308609478),
 vec3(0.1425406119,0.7406627461,0.0308609478),
 vec3(0.5701624478,-0.4937751641,0.0308609478),
 vec3(0.1425406119,-0.7406627461,0.0308609478),
 vec3(-0.7127030597,0.2468875820,0.0308609478),
 vec3(-0.7127030597,-0.2468875820,0.0308609478),
 vec3(-0.1009338675,0.0000000000,0.0291370978),
 vec3(0.0504669338,-0.0874112934,0.0291370978),
 vec3(0.0504669338,0.0874112934,0.0291370978),
 vec3(0.9257508467,0.2989478393,0.0271770763),
 vec3(-0.2039790001,0.9511976705,0.0271770763),
 vec3(0.9257508467,-0.2989478393,0.0271770763),
 vec3(-0.2039790001,-0.9511976705,0.0271770763),
 vec3(-0.7217718466,0.6522498312,0.0271770763),
 vec3(-0.7217718466,-0.6522498312,0.0271770763),
 vec3(0.2099521116,0.3636477244,0.0242431816),
 vec3(0.2099521116,-0.3636477244,0.0242431816),
 vec3(-0.4199042231,0.0000000000,0.0242431816),
 vec3(0.6206091014,0.7547356244,0.0228707765),
 vec3(0.3433156731,0.9148310598,0.0228707765),
 vec3(0.6206091014,-0.7547356244,0.0228707765),
 vec3(0.3433156731,-0.9148310598,0.0228707765),
 vec3(-0.9639247745,0.1600954355,0.0228707765),
 vec3(-0.9639247745,-0.1600954355,0.0228707765),
 vec3(0.8277725122,0.5213614721,0.0217233947),
 vec3(0.0376260233,0.9775527602,0.0217233947),
 vec3(0.8277725122,-0.5213614721,0.0217233947),
 vec3(0.0376260233,-0.9775527602,0.0217233947),
 vec3(-0.8653985355,0.4561912881,0.0217233947),
 vec3(-0.8653985355,-0.4561912881,0.0217233947)
);
// PACKING_END
float footprint=.001;
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
vec2 cis(float a){return vec2(cos(a),sin(a));}
vec2 cmul(vec2 a,vec2 b){return vec2(a.x*b.x-a.y*b.y,a.x*b.y+a.y*b.x);}
vec2 divide(vec2 a,vec2 b){return vec2(dot(a,b),a.y*b.x-a.x*b.y)/max(dot(b,b),1e-12);}
vec2 diskMove(vec2 z,vec2 a){return divide(z-a,vec2(1.0-dot(a,z),a.y*z.x-a.x*z.y));}
float fill(float d){float w=clamp(fwidth(d)*.7,.0002,max(.0003,footprint*1.4));return 1.0-smoothstep(-w,w,d);}
float line(float d,float w){return fill(abs(d)-w);}
float ring(vec2 p,float r,float w){return line(length(p)-r,w);}
float segment(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.0,1.0));}
float lens(vec2 p,float height){
 // Intersection of two equal circles. The tips stay at (+/-1,0).
 float c=(1.0-height*height)/(2.0*height),r=c+height;
 return length(vec2(p.x,abs(p.y)+c))-r;
}
float eye(vec2 z,float breath,float detail){
 float oldFoot=footprint;footprint=max(footprint,max(length(dFdx(z)),length(dFdy(z))));
 float h=.35+.08*breath,d=lens(z,h);
 float ink=line(d,.024);
 ink=max(ink,.65*line(lens(z/1.14,h),.012));
 float pupil=.095+.035*breath;
 ink=max(ink,ring(z,.29+.025*breath,.025)*fill(d));
 ink=max(ink,fill(length(z)-pupil)*fill(d));
 if(detail>.5){
  float th=atan(z.y,z.x),r=length(z);
  float ribs=line(sin(18.0*th+2.0*breath),.12);
  ink=max(ink,ribs*fill(r-.26)*(1.0-fill(r-.18))*.65*fill(d));
  ink=max(ink,.55*ring(z,.19,.009)*fill(d));
 }
 footprint=oldFoot;return ink;
}
float guardian(vec2 p,float phase,float wave){
 // Continuous bilateral contour families: temples become the neighbouring crown.
 float breath=.5+.5*sin(phase),ink=0.0;
 vec2 z=p;z.x*=1.0+.035*wave*sin(phase+3.0*p.y);
 float profile=.21*sqrt(max(0.0,1.0-pow((z.y-.01)/.405,2.0)));
 profile*=1.0-.20*exp(-90.0*pow(z.y+.255,2.0));
 for(int j=0;j<4;j++){
  float fj=float(j),offset=fj*.032;
  ink=max(ink,(j==0?1.0:.65)*line(abs(z.x)-profile-offset,.0036)*fill(abs(z.y-.01)-.4));
 }
 vec2 e=vec2(abs(z.x)-.103,z.y-.065);
 e=rot(.10+.09*wave*sin(phase))*e;
 ink=max(ink,eye(e/vec2(.088,.13),breath,1.0));
 ink=max(ink,eye((z-vec2(0,.256))/vec2(.066,.085),1.0-breath,0.0));
 // A curved bridge and small paired nostrils, keeping the facial contour light.
 float nose=.021+.026*exp(-85.0*pow(z.y+.125,2.0))+.11*max(z.y-.005,0.0);
 ink=max(ink,line(abs(z.x)-nose,.0028)*fill(abs(z.y+.037)-.116));
 ink=max(ink,.8*line(length((z-vec2(sign(z.x)*.032,-.13))/vec2(1,.5))-.018,.0027));
 float mouth=(z.y+.222)+.018*cos(PI*clamp(z.x/.077,-1.0,1.0));
 ink=max(ink,line(mouth,.003)*fill(abs(z.x)-.077));
 ink=max(ink,.65*line(mouth+.012,.002)*fill(abs(z.x)-.054));
 ink=max(ink,ring(z-vec2(0,-.306),.016,.003));
 // The crown's branching arcs meet the next row through the chart seam.
 for(int j=0;j<6;j++){
  float fj=float(j),x=.035+fj*.055;
  float curve=x*(.58+.42*cos(TAU*z.y))+.012*wave*sin(phase+4.0*z.y)*pow(cos(PI*z.y),2.0)*sin(PI*fj/5.0);
  float mask=1.0-fill(abs(z.y-.0)-.30);
  ink=max(ink,(.78-fj*.065)*line(abs(z.x)-curve,.003)*mask);
 }
 // Diamond vertices form a shared connective mesh between the guardians.
 ink=max(ink,.48*line(abs(z.x)+abs(z.y)-.5,.003));
 return ink;
}
// Reflection in the sides of a regular {sides, valence} hyperbolic polygon.
// Each reflecting circle is orthogonal to the unit disk boundary.
vec3 hyperFold(vec2 z,float sides,float valence){
 float alpha=PI/sides,c=cos(PI/valence)/sqrt(pow(cos(PI/valence),2.0)-pow(sin(alpha),2.0));
 float rr=c*c-1.0,flips=0.0;
 for(int i=0;i<18;i++){
  float ang=atan(z.y,z.x);ang=mod(ang+alpha,2.0*alpha)-alpha;
  z=length(z)*cis(ang);z.y=abs(z.y);
  vec2 d=z-vec2(c,0);float dd=dot(d,d);
  if(dd<rr){z=vec2(c,0)+d*(rr/max(dd,1e-10));flips+=1.0;}
 }
 return vec3(z,flips);
}
void main(){
 float t=uTime,wave=uWave;
 // A deliberately broader scale gives the figurative forms room to read.
 float columns=4.0*floor(1.2+uDensity*.013);
 vec2 n=vec2(columns,columns*1.5);
 vec2 q=vec2(vAngles.x,vAngles.y+t)*n/TAU;
 vec2 id=floor(q),p=fract(q)-.5;
 float baseFoot=max(.0002,max(length(dFdx(q)),length(dFdy(q))));footprint=baseFoot;
 float phase=TAU*id.y/n.y-2.0*t;
 float hand=mod(id.x+id.y,2.0)*2.0-1.0,ink=0.0;
 if(uKind==6)phase=vAngles.y-t;
 if(uKind==0){
  // Staggered ranks of three-eyed guardians, each entire face phase-locked.
  q.x+=.5*mod(id.y,2.0);p=fract(q)-.5;
  ink=guardian(vec2(p.x,-p.y),phase,wave);
 }else if(uKind==1||uKind==6){
  bool seven=uKind==1;
  vec2 z=p/.46;float boundary=length(z);
  if(!seven){z=.92*sin(vAngles.y+t)*cis(n.x*.25*vAngles.x+.3*wave*sin(vAngles.y+t));boundary=0.0;}
  z=diskMove(z,(.12+.25*wave)*cis(seven?phase:t));
  z=rot((seven?1.0:-1.0)*t)*z;
  float sides=seven?7.0:5.0,valence=seven?3.0:4.0;
  float c=cos(PI/valence)/sqrt(pow(cos(PI/valence),2.0)-pow(sin(PI/sides),2.0));
  float rr=sqrt(c*c-1.0),apothem=c-rr;
  vec3 folded=hyperFold(z,sides,valence);vec2 h=folded.xy;
  float f=max(length(dFdx(h)),length(dFdy(h)));footprint=max(.0002,f);
  float edges=line(length(h-vec2(c,0))-rr,.0045);
  if(seven){
   // Seven radially aligned eyes inside each heptagon, repeated by disk isometries.
   vec2 e=(h-vec2(apothem*.53,0))/vec2(apothem*.37,apothem*.47);
   ink=max(edges*.5,eye(e,.5+.5*sin(phase),0.0));
   ink=max(ink,ring(h,apothem*.16,.0035));
  }else{
   // Nested pentagonal geodesics and an ocular seed form a changing rose window.
   ink=edges;
   float d=length(h-vec2(c,0));
   ink=max(ink,.68*line(d-(rr+.057+.018*wave*sin(phase)),.003));
   ink=max(ink,.45*line(d-(rr+.12),.0025));
   ink=max(ink,eye((h-vec2(apothem*.50,0))/(apothem*.34),.5+.5*cos(phase),0.0));
  }
  ink*=1.0-smoothstep(.025,.085,f);
  footprint=baseFoot;
  ink*=1.0-smoothstep(.78,.965,boundary);if(seven)ink=max(ink,.65*ring(p/.46,.995,.006));
 }else if(uKind==2){
  // A logarithmic spiral lattice. One time cycle shifts its radial index by one.
  vec2 z=rot(hand*.18*sin(phase))*p;
  float r=max(length(z),1e-5),angle=atan(z.y,z.x);
  float L=log(3.0),zoom=t/TAU;
  float logR=log(r/.455)/L-zoom;
  float twist=3.0*angle/TAU-logR;
  vec2 local=vec2(fract(twist+.5)-.5,fract(logR)-.5);
  // Both lattice coordinates shift by integers at t+2pi, exactly closing the loop.
  vec2 e=vec2(local.x/.39,local.y/.40);
  float tiny=smoothstep(.006,.022,r);
  float visibility=1.0-smoothstep(.12,.30,baseFoot/max(r,.002));
  ink=eye(e,.5+.5*sin(phase),1.0)*visibility;
  ink=max(ink,.5*line(abs(local.y)-.465,.004)*visibility);
  ink*=tiny*fill(r-.44);
  ink=max(ink,ring(p,.454,.003));
 }else if(uKind==3){
  // Ford circles at reduced rational numbers p/q, radius 1/(2q^2).
  // Equal neighbouring rows meet along their tangent baseline.
  vec2 z=vec2(q.x+t/TAU,q.y);
  float row=floor(z.y),height=fract(z.y);
  float yy=mod(row,2.0)<.5?height:1.0-height;
  z.x+=.5*mod(row,2.0);
  for(int j=1;j<=10;j++){
   float den=float(j),num=floor(z.x*den+.5);
   int aa=int(mod(abs(num),den)),bb=j;
   for(int k=0;k<6;k++){if(aa>0){int tmp=bb%aa;bb=aa;aa=tmp;}}
   {
    float valid=bb==1?1.0:0.0;float rad=.5/(den*den);vec2 v=vec2(z.x-num/den,yy-rad);
    float visible=valid*(1.0-smoothstep(.025,.12,baseFoot/rad));
    ink=max(ink,line(length(v)-rad,.0025)*visible);
    float e=eye(v/(rad*.78),.5+.5*sin(phase),j<3?1.0:0.0);
    ink=max(ink,e*visible);
    ink=max(ink,.55*ring(v,rad*.88,.0012)*visible);
   }
  }
  ink=max(ink,.45*line(yy,.002));
 }else if(uKind==4){
  // Six eye-bearing orbitals counter-rotate inside a twelvefold corona.
  vec2 z=rot(hand*phase*.5)*p;
  float radius=length(z),ang=atan(z.y,z.x);
  float sector=mod(ang+PI/6.0,PI/3.0)-PI/6.0;
  vec2 w=radius*cis(sector);
  float orbit=.275+.017*wave*sin(phase);
  ink=eye((w-vec2(orbit,0))/vec2(.125,.19),.5+.5*sin(phase),1.0);
  ink=max(ink,ring(z,.17+.011*wave*cos(phase),.004));
  ink=max(ink,ring(z,.425,.004));
  ink=max(ink,.5*ring(z,.449,.002));
  // Six alternating lobes on each of three moving, concentric star contours.
  for(int j=0;j<3;j++){
   float r=.36+float(j)*.023+.009*cos(12.0*ang+hand*phase-float(j)*.6);
   ink=max(ink,(.7-float(j)*.1)*line(radius-r,.003));
  }
  vec2 c=rot(-hand*phase)*z;
  ink=max(ink,eye(c/.112,.5+.5*cos(phase),0.0));
 }else if(uKind==5){
  // Bilateral branching curves form an entity's ribs, antennae, and spine.
  // Each generation is a scaled image of the preceding generation.
  p.y=-p.y;float y=p.y;float taper=sqrt(max(0.0,1.0-pow((y+.015)/.47,2.0)));
  for(int j=0;j<7;j++){
   float fj=float(j),delay=phase-fj*.26;
   float side=(.055+fj*.040)*(.62+.38*cos(TAU*y));
   side+=.015*wave*sin(TAU*y+delay)*pow(cos(PI*y),2.0)*sin(PI*fj/6.0);
   ink=max(ink,(1.0-fj*.075)*line(abs(p.x)-side,.003));
  }
  for(int j=0;j<3;j++){
   float s=pow(.56,float(j)),cy=.18-.29*(1.0-s);
   vec2 z=(p-vec2(0,cy))/s;
   ink=max(ink,eye(z/vec2(.19,.22),.5+.5*sin(phase-float(j)*.7),1.0));
  }
  // A self-similar fork repeats at three scales, with its branches opening together.
  for(int j=0;j<3;j++){
   float s=pow(.52,float(j));
   vec2 z=(vec2(abs(p.x),p.y)-vec2(0,.31)) / s;
   float spread=.15+.045*wave*sin(phase-float(j)*.5);
   ink=max(ink,.7*line(segment(z,vec2(0,0),vec2(spread,.14)),.005)*fill(abs(z.x)-.4));
  }
  ink=max(ink,.5*line(p.x,.002)*fill(abs(p.y+.22)-.19));
 }else{
  // A genuine finite Apollonian circle packing, transformed by a disk isometry.
  vec2 z=diskMove(p/.468,(.18+.21*wave)*cis(phase));
  z=rot(t)*z;
  float boundary=length(p/.468),distance=1e3;
  vec2 seed=vec2(10);float radius=1.0;
  for(int j=0;j<64;j++){
   vec3 c=packing[j];vec2 v=z-c.xy;float d=length(v)-c.z;
   distance=min(distance,abs(d));
   if(d<0.0){seed=v/c.z;radius=c.z;}
  }
  float f=max(length(dFdx(z)),length(dFdy(z)));
  footprint=max(baseFoot,f);
  ink=line(distance,.006);
  float visibility=1.0-smoothstep(.06,.28,f/radius);
  ink=max(ink,eye(seed/.75,.5+.5*sin(phase),0.0)*visibility);
  ink*=fill(boundary-.985);
  footprint=baseFoot;ink=max(ink,ring(p/.468,1.0,.009));

 }
 float depth=.12*smoothstep(4.5,9.0,length(vec3(3.65,0,0)-vPosition));
 fragColor=vec4(vec3(1.0-clamp(ink,0.0,1.0)*(.96-depth)),1);
}`;
  async function create(gl,vao,count){

    const program=await TorusPrograms.link(gl,vertexSource,TorusLight.fragment(fragmentSource,false));
    const uniforms={};for(const key of ['uViewProjection','uTime','uWave','uDensity','uKind'])uniforms[key]=gl.getUniformLocation(program,key);
    return {draw(matrix,time,wave,density,kind){
      gl.useProgram(program);gl.bindVertexArray(vao);gl.uniformMatrix4fv(uniforms.uViewProjection,false,matrix);
      gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uWave,wave);gl.uniform1f(uniforms.uDensity,density);gl.uniform1i(uniforms.uKind,kind);
      gl.drawElements(gl.TRIANGLES,typeof count==='function'?count():count,gl.UNSIGNED_INT,0);
    }};
  }
  return {create};
})();
