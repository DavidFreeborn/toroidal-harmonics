(async () => {
  'use strict';
  const embedded=globalThis.TORUS_EMBED===true;
  let previewReady=false;
  const previewMessage=(type,data={})=>{if(embedded&&globalThis.parent!==globalThis)globalThis.parent.postMessage({type,...data},globalThis.location.origin);};
  const root = document.getElementById('artwork');
  const canvas = document.getElementById('field');
  const error = document.getElementById('error');
  const gl = canvas.getContext('webgl2', {antialias:true, alpha:false, powerPreference:embedded?'default':'high-performance', preserveDrawingBuffer:false});
  if (!gl) {error.hidden=false;error.textContent='This artwork needs WebGL 2. Please open it in a browser with hardware acceleration enabled.';previewMessage('torus-preview-error');return;}
  const vertexSource = `#version 300 es
  precision highp float;
  layout(location=0) in vec2 aUV;
  uniform mat4 uViewProjection;
  out vec3 vPosition;
  out vec2 vAngles;
  const float TAU=6.28318530718;
  void main(){
    float u=aUV.x*TAU, v=aUV.y*TAU;
    float radial=3.0+1.8*cos(v);
    vec3 p=vec3(radial*cos(u),1.8*sin(v),radial*sin(u));
    vPosition=p;
    vAngles=vec2(u,v);
    gl_Position=uViewProjection*vec4(p,1.0);
  }`;
  const fragmentSource = `#version 300 es
precision highp float;
in vec3 vPosition;
in vec2 vAngles;
uniform float uTime;
uniform float uWave;
uniform float uDensity;
uniform float uPattern;
uniform float uInk;
uniform highp int uPalette;
uniform vec3 uCamera;
uniform highp sampler2D uEigen;
uniform highp sampler2D uMoore;
out vec4 fragColor;
const float PI=3.14159265359;
const float TAU=6.28318530718;
float pixelFootprint=.001;
float contour(float d,float width){return torusStroke(d,width,max(fwidth(d)*.65,.0003));}
float stroke(float d,float width){float aa=clamp(fwidth(d)*.65,.0003,max(.0003,1.5*pixelFootprint));return torusStroke(d,width,aa);}
float solid(float d){float aa=clamp(fwidth(d)*0.72,0.0003,max(0.0003,1.5*pixelFootprint));return 1.0-smoothstep(-aa,aa,d);}
float line(float p,float width){return torusPeriodic(p,width,fwidth(p));}
mat2 rotate(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float capsule(vec2 p,vec2 a,vec2 b,float r){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.0,1.0))-r;}
float phaseOf(vec2 id,vec2 n){return TAU*(3.0*id.x/n.x+4.0*id.y/n.y);}
vec2 cells(float density){return vec2(max(12.0,4.0*floor(density*0.095)),max(16.0,4.0*floor(density*0.12)));}
// Surface area is r(R+r cos v) du dv. Y=v+(r/R)sin v makes it constant.
vec2 canonical(float u,float v,float t){return vec2(u,v+0.6*sin(v)+t);}
// Each shear has determinant 1. Their composition preserves area exactly.
vec2 silkMap(vec2 q,float t,float a){
 q.x+=(0.28+0.45*a)*sin(4.0*q.y+sin(t));
 q.y+=(0.17+0.26*a)*sin(3.0*q.x-0.7*cos(t));
 q.x+=(0.11+0.22*a)*sin(7.0*q.y+0.7*sin(2.0*t));
 q.y+=0.13*a*sin(5.0*q.x+cos(t));
 return q;
}
vec2 weaveMap(vec2 q,float t,float a){
 q.x+=0.15*a*sin(3.0*q.y+sin(t));
 q.y+=0.20*a*sin(2.0*q.x-cos(t));
 q.x+=0.07*a*sin(4.0*q.y+sin(t));
 return q;
}
vec2 cis(float p){return vec2(cos(p),sin(p));}
float softMask(float d,float width){return torusStroke(d,width,max(fwidth(d)*.65,.00001));}
vec4 geometricModes(float v){
 float x=fract(v/TAU)*512.0;int i=int(floor(x));
 return mix(texelFetch(uEigen,ivec2(i,0),0),texelFetch(uEigen,ivec2((i+1)%512,0),0),fract(x));
}
float advanced(float u,float v,float t,float a,float density,float mode){
 vec2 q=canonical(u,v,t);
 if(mode<15.5){
  q=silkMap(q,t,a);
  float N=round(density*1.5);
  float phase=(N*q.x+8.0*q.y)/TAU;
  float breath=0.5+0.5*cos(3.0*q.y-2.0*q.x+sin(t));
  return line(phase,0.042+0.039*breath);
 }
 if(mode<16.5){
  float x=q.x+0.11*a*sin(3.0*q.y+sin(t));
  float y=q.y+0.17*a*sin(2.0*q.x-cos(t));
  float psi=cos(3.0*x+0.35*sin(t))*cos(2.0*y)
   +0.30*a*cos(5.0*x-3.0*y+sin(t))
   +0.18*a*sin(2.0*x+4.0*y-cos(2.0*t));
  float stripes=line(psi*density*0.30,0.045);
  float main=softMask(psi,0.008);
  return max(stripes,main*0.82);
 }
 if(mode<17.5){
  q=weaveMap(q,t,a);
  float h=4.0*(3.0*q.x+2.0*q.y)/TAU;
  float k=4.0*(2.0*q.x-3.0*q.y)/TAU;
  float dh=abs(fract(h+.5)-.5),dk=abs(fract(k+.5)-.5);
  float Nh=round(density*.12)*2.0;
  float one=line(h*Nh,0.080)*softMask(dh,0.17);
  float two=line(k*Nh,0.080)*softMask(dk,0.17);
  float coverH=softMask(dh,0.195),coverK=softMask(dk,0.195);
  float order=mod(floor(h+.5)+floor(k+.5),2.0);
  return mix(one+two*(1.0-coverH),two+one*(1.0-coverK),order);
 }
 if(mode<18.5){
  float x=q.x,y=q.y;
  vec2 z=cis(3.0*x+2.0*y)+(.67+.13*a*cos(t))*cis(-2.0*x+3.0*y-2.0*t)
   +.31*a*cis(7.0*x-y+t)+vec2(.19*sin(t),.13*cos(2.0*t));
  float rr=max(dot(z,z),.00005),r=sqrt(rr);
  float angle=atan(z.y,z.x);
  float arms=round(density*.29);
  float twist=12.0+18.0*a;
  float phi=arms*angle+twist*log(r)+t;
  vec2 dx=dFdx(z),dy=dFdy(z);
  float gx=(arms*(z.x*dx.y-z.y*dx.x)+twist*dot(z,dx))/rr;
  float gy=(arms*(z.x*dy.y-z.y*dy.x)+twist*dot(z,dy))/rr;
  float footprint=abs(gx)+abs(gy),aa=max(.0001,.65*footprint);
  float ink=1.0-smoothstep(.130-aa,.130+aa,abs(sin(phi)));
  ink=mix(ink,.083,smoothstep(.55,1.8,footprint));
  return ink*smoothstep(.035,.14,r);
 }
 if(mode<19.5){
  // Numerically solved eigenfunctions of this torus's Laplace-Beltrami
  // operator, periodically driven and circulated, not free wave dynamics.
  vec4 modes=geometricModes(v+t+0.07*a*sin(2.0*u));
  vec4 angular=vec4(cos(u+sin(t)),cos(2.0*u-.6*cos(t)),
   cos(3.0*u+.7*sin(2.0*t)),cos(4.0*u-.4*cos(2.0*t)));
  vec4 amplitude=vec4(.90,.64+.16*a*sin(t),.40+.20*a*cos(t),.25+.10*a*sin(2.0*t));
  float field=dot(modes*angular,amplitude);
  return line(field*density*.27,0.055);
 }
 // A rounded Moore curve becomes a continuous moving labyrinth.
 q=weaveMap(q,t,a);
 q.x+=.055*a*sin(5.0*q.y+2.0*t);
 vec2 uv=fract(q/TAU);
 vec4 texel=texture(uMoore,uv);
 float d=texel.r*.025;
 float ph=atan(texel.b*2.0-1.0,texel.g*2.0-1.0);
 float pulse=.5+.5*cos(12.0*ph-3.0*t);
 float width=(.00030+.00006*pulse)*sqrt(88.0/density)*(1.0+1.8*uInk*pulse);
 return max(softMask(d-.0017,width),softMask(d-.0045,width*.80));
}

// Rotating four-point blocks exchange places while Voronoi adjacency changes.
float exchange(float u,float v,float t,float a,float density){
 vec2 n=vec2(max(16.0,4.0*floor(density*.085)),24.0);
 vec2 q=vec2(u,v+t)*n/TAU,block=floor(q/2.0);
 float first=1000.0;vec2 r1=vec2(0),candidates[36];int count=0;
 for(int iy=-1;iy<=1;iy++)for(int ix=-1;ix<=1;ix++){
  vec2 b=block+vec2(float(ix),float(iy)),centre=2.0*b+1.0;
  float chirality=mod(b.x+b.y,2.0)*2.0-1.0;
  float phase=3.0*t+1.1*a*sin(TAU*(2.0*centre.x/n.x+centre.y/n.y))
   +.7*a*cos(TAU*(centre.x/n.x-3.0*centre.y/n.y)+t);
  float angle=chirality*phase;
  float radius=.63+.13*a*sin(2.0*phase+TAU*centre.y/n.y);
  for(int k=0;k<4;k++){
   float theta=angle+TAU*(float(k)+.5)/4.0;
   vec2 r=centre+radius*vec2(cos(theta),sin(theta))-q;
   candidates[count++]=r;
   float d=dot(r,r);
   if(d<first){first=d;r1=r;}
  }
 }
 float edge=1000.0;
 for(int k=0;k<36;k++){
  vec2 r=candidates[k],delta=r-r1;float separation=dot(delta,delta);
  if(separation>.00001)edge=min(edge,dot(.5*(r+r1),delta)*inversesqrt(separation));
 }
 float rim=softMask(edge-.023,.014);
 float inset=softMask(edge-.105,.012);
 float fine=softMask(edge-.155,.005);
 float bead=1.0-smoothstep(.055-fwidth(first),.055+fwidth(first),sqrt(first));
 float shade=max(.14*exp(-edge*16.0),uInk*.74*(.5+.5*cos(5.0*r1.x+3.0*r1.y))*(1.0-softMask(edge,.17)));
 return max(max(rim,inset),max(fine,max(bead,shade)));
}

void main(){
 float u=vAngles.x,v=vAngles.y,t=uTime,w=v+t,a=uWave;
 vec2 n=cells(uDensity);
 vec2 z=vec2(u,w)*n/TAU;
 pixelFootprint=max(length(dFdx(z)),length(dFdy(z)));
 vec2 id=floor(z),p=fract(z)-0.5;
 float ph=phaseOf(id,n),alt=mod(id.x+id.y,2.0)*2.0-1.0;
 float ink=0.0;
 if(uPattern>25.5){
  ink=exchange(u,v,t,a,uDensity);
 }else if(uPattern>20.5){
  ink=0.0;
 }else if(uPattern>14.5){
  ink=advanced(u,v,t,a,uDensity,uPattern);
 }else if(uPattern<0.5){
  // An over-under braid of tripled strands. The crossing order reverses
  // every half turn; all three strands keep their white separation.
  float x=u*n.x/TAU,y=w*12.0/TAU;
  float sway=(0.23+0.08*a)*sin(TAU*y+0.45*a*sin(4.0*u-2.0*t));
  float l=x+sway,r=x-sway;
  float one=max(line(l,0.027),max(line(l-0.10,0.021),line(l+0.10,0.021)));
  float two=max(line(r,0.027),max(line(r-0.10,0.021),line(r+0.10,0.021)));
  float coverOne=line(l,0.154),coverTwo=line(r,0.154);
  float order=step(0.0,cos(TAU*y));
  ink=mix(one+two*(1.0-coverOne),two+one*(1.0-coverTwo),order);
 }else if(uPattern<1.5){
  // Four-petal rosettes breathe in a phase-delayed lattice.
  float beat=sin(3.0*t+ph);
  vec2 q=rotate(0.27*a*alt*beat)*p;
  float r=length(q),theta=atan(q.y,q.x);
  float petal=0.245+0.105*cos(4.0*theta)+0.036*a*beat;
  ink=stroke(r-petal,0.0105);
  ink=max(ink,stroke(r-petal*0.67,0.0075));
  ink=max(ink,solid(r-(0.029+0.013*(1.0+beat))));
  float veins=stroke(sin(theta*4.0)*r,0.006)*solid(r-petal*0.64)*solid(0.10-r);
  ink=max(ink,veins);
 }else if(uPattern<2.5){
  // Nested fan ribs open and close. Staggered rows carry the wave upward.
  z.x+=0.5*mod(id.y,2.0);id=floor(z);p=fract(z)-0.5;ph=phaseOf(id,n);
  vec2 q=rotate(0.20*a*sin(ph+2.0*t))*p; q.y+=0.34;
  float radius=length(q),theta=atan(q.x,q.y);
  float opening=0.60+0.24*a*sin(3.0*t+ph);
  float mask=solid(abs(theta)-opening)*solid(radius-0.64)*solid(0.10-radius);
  ink=stroke(abs(fract(radius*9.0+0.5)-0.5)/9.0,0.005)*mask;
  ink=max(ink,stroke(abs(theta)-opening,0.012)*solid(radius-0.635)*solid(0.10-radius));
  ink=max(ink,solid(length(q)-0.035));
 }else if(uPattern<3.5){
  // Elliptical tracks tilt in counterphase; a pair of beads runs around each.
  float angle=0.6*alt+0.45*a*sin(ph+2.0*t);
  vec2 q=rotate(angle)*p;
  vec2 axes=vec2(0.35,0.18+0.055*a*sin(ph+2.0*t));
  float d=(length(q/axes)-1.0)*min(axes.x,axes.y);
  ink=stroke(d,0.008);
  float orbit=3.0*t+ph;
  vec2 bead=axes*vec2(cos(orbit),sin(orbit));
  ink=max(ink,solid(length(q-bead)-0.052));
  ink=max(ink,solid(length(q+bead)-0.028));
 }else if(uPattern<4.5){
  // Contour engraving of a smooth periodic interference field.
  float x=u*round(uDensity*0.18)+1.15*a*sin(4.0*w-2.0*t);
  float y=w*12.0+0.8*a*sin(8.0*u+2.0*t);
  float f=cos(x)+cos(y)+0.28*a*cos(x-y+2.0*t);
  ink=line(f*3.5,0.055);
 }else if(uPattern<5.5){
  // A tapered curved stroke in every cell, with metachronal curvature.
  z.x+=0.20*a*sin(4.0*w+2.0*t);id=floor(z);p=fract(z)-0.5;ph=phaseOf(id,n);
  float yy=(p.y+0.36)/0.72;
  float center=0.14*a*sin(TAU*yy+ph+3.0*t)*(1.0-yy);
  float radius=0.018+0.078*pow(clamp(yy,0.0,1.0),1.7);
  float body=solid(abs(p.x-center)-radius)*solid(abs(p.y)-0.36);
  float head=solid(length(vec2(p.x,p.y-0.30))-0.090);
  ink=max(body,head);
  ink=max(ink,stroke(p.x-center-0.12,0.006)*solid(abs(p.y+0.07)-0.22)*0.7);
 }else if(uPattern<6.5){
  // Alternating hinged pairs perform a travelling pendulum wave.
  float beat=ph+3.0*t;
  float angle=0.25+1.02*a*(0.5+0.5*sin(beat));
  vec2 anchor=vec2(0.0,-0.27);
  vec2 end=anchor+0.46*vec2(sin(angle)*alt,cos(angle));
  vec2 end2=-anchor-0.46*vec2(sin(angle)*alt,cos(angle));
  ink=solid(capsule(p,anchor,end,0.018));
  ink=max(ink,solid(capsule(p,-anchor,end2,0.018)));
  ink=max(ink,solid(length(p-end)-0.047));
  ink=max(ink,solid(length(p-end2)-0.047));
 }else if(uPattern<7.5){
  // Two coherent waves in bead position and radius, with no randomness.
  z.x+=0.22*a*sin(5.0*w+3.0*t);id=floor(z);p=fract(z)-0.5;ph=phaseOf(id,n);
  float pulse=0.5+0.5*sin(ph+4.0*t);
  float r=0.045+(0.08+0.10*a)*pulse*pulse;
  vec2 q=p-vec2(0.07*a*cos(ph+2.0*t),0.12*a*sin(ph+2.0*t));
  ink=solid(length(q)-r);
  float halo=r+0.11+0.03*sin(ph+2.0*t);
  ink=max(ink,stroke(length(q)-halo,0.0065)*(0.30+0.70*pulse));
 }else if(uPattern<8.5){
  // A deterministic Truchet tiling. Smooth global coordinate shears
  // preserve the arcs' joins while the entire tiling circulates.
  z.x+=0.30*a*sin(4.0*w+2.0*t);
  z.y+=0.30*a*sin(6.0*u+2.0*t);
  id=floor(z);p=fract(z)-0.5;
  if(mod(id.x+id.y,4.0)<2.0)p.x=-p.x;
  float d=min(length(p-vec2(-0.5)),length(p-vec2(0.5)));
  float band=solid(abs(d-.50)-.12);
  ink=max(stroke(d-0.50,0.012),max(stroke(d-0.37,0.009),stroke(d-0.63,0.009)));
  ink=max(ink,uInk*band*(.15+.72*mod(id.x+id.y,2.0)));
 }else if(uPattern<9.5){
  // Bernoulli lemniscates, including a moving bead on the exact curve.
  float tilt=0.40*a*sin(ph+2.0*t)+alt*0.25;
  vec2 q=rotate(tilt)*p;
  float r2=dot(q,q),c=0.155;
  float f=r2*r2-c*(q.x*q.x-q.y*q.y);
  vec2 grad=4.0*r2*q-2.0*c*vec2(q.x,-q.y);
  ink=stroke(f/max(length(grad),0.02),0.008)*solid(length(q)-0.43);
  float b=3.0*t+ph,ss=sin(b),cc=cos(b);
  vec2 bead=sqrt(c)*vec2(cc,ss*cc)/(1.0+ss*ss);
  ink=max(ink,solid(length(q-bead)-0.038));
 }else if(uPattern<10.5){
  // Moving level sets periodically reconnect into a cellular lace.
  float x=u*round(uDensity*0.20)+0.40*a*sin(3.0*w+2.0*t);
  float y=w*16.0+0.40*a*sin(6.0*u-2.0*t);
  float field=cos(x)+cos(y)+0.72*a*cos(x-y+2.0*t);
  float level=0.28*a*sin(4.0*t+4.0*u);
  ink=contour(field-level,0.12);
  ink=max(ink,contour(field-level-0.56,0.026));
  ink=max(ink,contour(field-level+0.56,0.026));
 }else if(uPattern<11.5){
  // Tapered paired lenses, with fine white veins inside the ink.
  float angle=alt*(0.42+0.27*a*sin(ph+3.0*t));
  vec2 q=rotate(angle)*p;
  float d=length(vec2(abs(q.x)+0.24,q.y))-0.42;
  float leaf=solid(d);
  float spine=stroke(q.x,0.008);
  float veins=line(9.0*q.y-4.0*abs(q.x)+0.18*a*sin(ph+2.0*t),0.030);
  ink=leaf*(1.0-max(spine,veins)*0.94);
  ink=mix(ink,max(stroke(d,.010),ink*(.10+.90*mod(id.x+id.y+float(uPalette),2.0))),uInk);
 }else if(uPattern<12.5){
  float b=0.5+0.5*sin(8.0*w+16.0*u);
  float contours=uDensity*(w/TAU+(1.6*a*sin(12.0*u)*sin(3.0*w)+0.65*a*cos(24.0*u)*cos(4.0*w))/88.0);
  ink=line(contours,0.044+0.022*b+uInk*.20*b);
 }else if(uPattern<13.5){
  float x=uDensity*2.0*u/TAU,y=24.0*w/TAU;
  float bend=0.6*a*sin(8.0*w)*cos(12.0*u);
  ink=max(line(x+y+bend,0.10),line(x-y-bend,0.10));
  ink*=0.85+0.15*cos(4.0*w-8.0*u);
 }else{
  float warp=u+0.055*a*sin(6.0*w)*sin(12.0*u)+0.012*a*sin(4.0*w)*sin(24.0*u);
  float b=0.5+0.5*sin(8.0*w+16.0*u);
  ink=line(warp*uDensity*4.0/TAU,0.055+0.085*b*b);
 }
 float depth=1.0-smoothstep(4.0,9.0,length(vPosition-uCamera))*(uPattern>14.5?0.40:0.65);
 float tone=1.0-clamp(ink,0.0,1.0)*0.97*depth;
 fragColor=vec4(vec3(tone),1.0);
}
`;
  let program;
  try{program=await TorusPrograms.link(gl,vertexSource,TorusLight.fragment(fragmentSource));}
  catch(e){error.hidden=false;error.textContent='The artwork could not start on this device.';console.error(e);previewMessage('torus-preview-error');return;}
  gl.useProgram(program);
  const uniforms={};for(const key of ['uViewProjection','uTime','uWave','uDensity','uPattern','uInk','uPalette','uCamera','uEigen','uMoore'])uniforms[key]=gl.getUniformLocation(program,key);
  const eigenTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,eigenTexture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,512,1,0,gl.RGBA,gl.FLOAT,new Float32Array(TORUS_EIGEN.samples));
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.uniform1i(uniforms.uEigen,0);
  const mooreTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,mooreTexture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,128,128,255]));
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  gl.uniform1i(uniforms.uMoore,1);
  const mooreImage=new Image();
  let mooreResolve;const mooreReady=new Promise(resolve=>{mooreResolve=resolve;});
  mooreImage.onload=()=>{gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,mooreTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,mooreImage);requestDraw();mooreResolve();};
  mooreImage.onerror=()=>{console.error('The Moore distance field could not be loaded.');mooreResolve();};
  if(!embedded)mooreImage.src='./moore-field.png';
  const U=192,V=96,uv=new Float32Array((U+1)*(V+1)*2),indices=new Uint32Array(U*V*6);
  let k=0;for(let i=0;i<=U;i++)for(let j=0;j<=V;j++){uv[k++]=i/U;uv[k++]=j/V;}
  k=0;for(let i=0;i<U;i++)for(let j=0;j<V;j++){const n=i*(V+1)+j;indices[k++]=n;indices[k++]=n+1;indices[k++]=n+V+1;indices[k++]=n+1;indices[k++]=n+V+2;indices[k++]=n+V+1;}
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,uv,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
  const surface=TorusPerformance.surfaceMesh(U,V);let surfaceCount=indices.length;
  gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(1,1,1,1);
  let kinetic=null,sculptures=null,symmetry=null,cycles=null,visionary=null,topology=null,chiaroscuro=null,mechanisms=null,quasicrystal=null,metamorphosis=null,tessellations=null,transformations=null,revivals=null,spinor=null,phason=null;
  const attempted=new Set(),initializing=new Map(),unavailableStudies=new Set();
  const embeddedScripts=new Map();
  function loadEmbeddedScript(name){
    if(!embeddedScripts.has(name))embeddedScripts.set(name,new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='./'+name+'.js?v=24';
      script.onload=resolve;script.onerror=()=>reject(new Error('Could not load '+name));document.head.appendChild(script);
    }));
    return embeddedScripts.get(name);
  }
  function initialize(name){
    if(initializing.has(name))return initializing.get(name);
    if(attempted.has(name))return Promise.resolve();attempted.add(name);
    quality.suspend();
    const task=(async()=>{
      try{
        if(embedded){
          const dependencies={topology:['spectrum'],metamorphosis:['spectrum'],quasicrystal:['quasicrystal-data'],phason:['quasicrystal-data'],tessellations:['tessellation-data']};
          await Promise.all((dependencies[name]||[]).map(loadEmbeddedScript));await loadEmbeddedScript(name);
        }
        if(name==='revivals')revivals=await TorusRevivals.create(gl,vao,()=>surfaceCount);
        if(name==='spinor')spinor=await TorusSpinor.create(gl);
        if(name==='phason')phason=await TorusPhason.create(gl,vao,()=>surfaceCount);
        if(name==='mechanisms')mechanisms=await TorusMechanisms.create(gl);
        if(name==='quasicrystal')quasicrystal=await TorusQuasicrystal.create(gl);
        if(name==='transformations')transformations=await TorusTransformations.create(gl,vao,()=>surfaceCount,requestDraw);
        if(name==='tessellations')tessellations=await TorusTessellations.create(gl,vao,()=>surfaceCount);
        if(name==='metamorphosis')metamorphosis=await TorusMetamorphosis.create(gl,vao,()=>surfaceCount);
        if(name==='kinetic')kinetic=await TorusKinetic.create(gl);
        if(name==='sculptures')sculptures=await TorusSculptures.create(gl);
        if(name==='symmetry')symmetry=await TorusSymmetry.create(gl,vao,()=>surfaceCount);
        if(name==='cycles')cycles=await TorusCycles.create(gl);
        if(name==='visionary')visionary=await TorusVisionary.create(gl,vao,()=>surfaceCount);
        if(name==='topology')topology=await TorusTopology.create(gl,vao,()=>surfaceCount);
        if(name==='chiaroscuro')chiaroscuro=await TorusChiaroscuro.create(gl);
      }catch(e){console.warn('A renderer is unavailable; the other studies remain available.',e);}
    })();
    initializing.set(name,task);task.finally(()=>initializing.delete(name));return task;
  }
  async function prepare(mode){
    try{await prepareRenderer(mode);}
    catch(e){unavailableStudies.add(mode);console.warn('This study is unavailable; the other studies remain available.',e);}
  }
  async function prepareRenderer(mode){
    if(embedded&&mode===20){if(!mooreImage.src)mooreImage.src='./moore-field.png';await mooreReady;}
    if(mode===148)return initialize('phason');
    if(mode===147)return initialize('spinor');
    if(mode===145||mode===146){await initialize('revivals');if(revivals){const task=revivals.prepare(mode-145);if(TorusPrograms.pending(gl))quality.suspend();await task;}return;}
    if(mode>=141)return initialize('quasicrystal');
    if(mode>=125){await initialize('transformations');if(transformations)await transformations.prepare(mode-125);return;}
    if(mode>=121)return initialize('quasicrystal');
    if(mode>=101){await initialize('tessellations');if(tessellations){const task=tessellations.prepare(mode-101);if(TorusPrograms.pending(gl))quality.suspend();await task;}return;}
    if(mode>=95||mode>=71&&mode<=85){await initialize('metamorphosis');if(metamorphosis){const task=metamorphosis.prepare(mode>=95?mode-80:mode-71);if(TorusPrograms.pending(gl))quality.suspend();await task;}return;}
    if(mode>=92||mode>=68&&mode<=70)return initialize('quasicrystal');
    if(mode>=86||mode>=62&&mode<=67)return initialize('mechanisms');
    if(mode>=54)return initialize('chiaroscuro');
    if(hasTopology(mode)){await initialize('topology');if(topology){const task=topology.prepare(topologyKinds[mode]);if(TorusPrograms.pending(gl))quality.suspend();await task;return;}}
    if(mode>=46)return initialize('visionary');
    if(mode>=42)return initialize('cycles');
    if(mode>=30)return initialize('symmetry');
    if(mode>=27)return initialize('sculptures');
    if(mode>=21&&mode<=25)return initialize('kinetic');
  }
  const topologyKinds={0:0,4:4,7:7,10:10,13:13,14:14,15:15,16:16,17:17,18:18,19:19,30:30,34:34,35:35,38:38,39:39,41:41,47:47,49:49,50:50,51:51,53:53};
  const hasTopology=mode=>Object.prototype.hasOwnProperty.call(topologyKinds,mode);
  const ready=(name,value)=>!attempted.has(name)||initializing.has(name)||Boolean(value);
  const available=mode=>!unavailableStudies.has(mode)&&(mode===148?ready('phason',phason):mode===147?ready('spinor',spinor):mode===145||mode===146?ready('revivals',revivals):mode>=141?ready('quasicrystal',quasicrystal):mode>=125?ready('transformations',transformations):mode>=121?ready('quasicrystal',quasicrystal):mode>=101?ready('tessellations',tessellations):(mode>=95||mode>=71&&mode<=85)?ready('metamorphosis',metamorphosis):(mode>=92||mode>=68&&mode<=70)?ready('quasicrystal',quasicrystal):(mode>=86||mode>=62&&mode<=67)?ready('mechanisms',mechanisms):mode>=54?ready('chiaroscuro',chiaroscuro):hasTopology(mode)&&ready('topology',topology)?true:mode>=46?ready('visionary',visionary):mode>=42?ready('cycles',cycles):mode>=30?ready('symmetry',symmetry):mode>=27?ready('sculptures',sculptures):mode>=21&&mode<=25?ready('kinetic',kinetic):true);
  const studyArchive=[
    ['Talbot Cathedral','Finite Fourier rosettes disperse into fractional wave revivals, then reconstruct their original arrangement exactly.',145],
    ['Elliptic Eyes','Moving zeros and poles exchange in a doubly periodic theta-function field, reversing a connected hierarchy of eyes and arches.',146],
    ['Spinor Loom','Continuously turning cubes carry two-sided ribbons through a closed belt-trick cycle, untwisting after each 720-degree turn.',147],
    ['Phason Tide','A travelling front changes rhomb adjacency in a periodic pentagrid. Temporary polygonal tiles fill each flip before returning to rhombi.',148],
    ["Square to honeycomb", "Rows stagger continuously, changing four-sided Voronoi cells into six-sided cells and back.", 125],
    ["Cairo to crystal", "Four seed families move between a square crystal and a pentagonal partition, changing the shared boundaries as they travel.", 126],
    ["Octagon bloom", "The corners of square tiles retreat together. Diamonds grow from the meeting points while the squares become octagons.", 127],
    ["Pythagorean turn", "An inscribed square turns through a right angle, shrinking and growing as four corner triangles appear and disappear. The five regions always fill their parent.", 128],
    ["Truchet reconnection", "Four fixed edge midpoints exchange their pairing through a moving saddle. The paths meet, reconnect and separate.", 129],
    ["Square to swan", "Squares unfold into complete swans, with curved necks, pointed beaks, layered wings and feet. Every contour is shared with a neighbouring bird; the finished flock lingers before returning.", 130],
    ["Fish and fowl", "Complete fish with fins and gills reshape into swans with curved necks and feathered wings. Their shared contours move continuously between two tessellating animal designs.", 131],
    ["Reptile interlock", "Hexagonal cells unfold into three interlocking reptile orientations. Heads, four bent legs, toes and curling tails resolve into a rotational mosaic, with scales and contrasting engraving.", 132],
    ["Moth mosaic", "Diamond symmetry resolves into moths with paired wings, antennae and tapering bodies. Fine veins follow each wing as the shared contours change.", 133],
    ["Scale to wing", "Finned fish change into moths with paired wings and long tapering bodies. Scales give way to wing veins as both dark and light creatures pass through the same continuous geometric transformation.", 134],
    ["Quadtree genesis", "New quadrants grow from zero area, then subdivide in their own delayed generations. The hierarchy builds and retracts without dissolving between images.", 135],
    ["Sierpi\u0144ski bloom", "A central square recedes while eight neighbouring regions grow and recursively repeat the same process, forming a filled Sierpi\u0144ski inlay.", 136],
    ["Cantor reweaving", "Paired strips grow from opposite edges of each parent, then repeat the operation on alternating axes to build a nested rectangular weave.", 137],
    ["Pythagorean recursion", "The turning-square dissection repeats inside its own moving square. Delayed generations unfold into nested rotations and then return to their parent.", 138],
    ["Eyes of emergence", "Recursive frames grow around retained cells, whose apertures open into almond-shaped eyes. Each generation inherits the same birth and return.", 139],
    ["Golden mitosis", "Unequal child regions grow from the edges of a parent and subdivide at golden-section proportions, turning through successive generations.", 140],
    ["Pentagrid genesis", "Golden-section child regions grow and subdivide inside every rhomb of a periodic pentagrid, building a coordinated hierarchy of changing tiles.", 141],
    ["Rhombic chrysalis", "Nested inscribed quadrilaterals turn and contract within each pentagrid rhomb. Their corner regions grow into an interlocking hierarchy before returning.", 142],
    ["Square counterweave", "Alternating square tiles flex together while internal counterturns carry a second rhythm.", 101],
    ["Hexagonal cadence", "A three-colour hexagonal tessellation passes coordinated light through its sixfold neighbourhoods.", 102],
    ["Triangular fugue", "Two orientations of triangular tiles exchange tones along closed torus windings.", 103],
    ["Rhombic cubes", "Three rhombi meet within each hexagon. Travelling facet tones turn a continuous mosaic into an ambiguous field of cubes.", 104],
    ["Octagonal inlay", "Regular octagons and their square interstices form a continuous two-scale inlay.", 105],
    ["Cairo pentagons", "A fourfold orbit of moving Voronoi seeds gives a breathing tessellation of congruent pentagons.", 106],
    ["Herringbone tide", "A diagonal domino rule pairs every cell exactly once, weaving vertical and horizontal tiles into a continuous herringbone.", 107],
    ["Kagome counterpoint", "Hexagons touch at their vertices, leaving triangular interstices in a coordinated sixfold mosaic.", 108],
    ["Interlocking waves", "Paired cuts transform a square tessellation into interlocking curls, carrying the boundaries and their pigments together.", 109],
    ["Swallow migration", "Reflected rows of interlocking, bird-like tesserae trade positive and negative space as their shared cuts evolve.", 110],
    ["Fish and current", "Fish-like tesserae pass in alternating rows, sharing undulating edges and travelling gill marks.", 111],
    ["Winged tesserae", "Bilateral wing marks reveal a reflected tessellation, with dark and pale forms sharing the same moving boundaries.", 112],
    ["Figure-ground metamorphosis", "A shared partition moves between straight geometry and interlocking organic forms while its figure and ground exchange tones.", 113],
    ["Quadtree parquet", "An adaptive square dissection retains one child at each generation and subdivides the others, producing nested tiles that cover every parent.", 114],
    ["Chair substitution", "Each L-shaped chair inflates into four smaller chairs. An exact periodic patch joins the hierarchy around both torus cycles.", 115],
    ["Triangular inheritance", "Every triangle splits into four. Central triangles become tiles while their three neighbours continue the recursion.", 116],
    ["Sierpi\u0144ski inlay", "Each central ninth becomes a tile while the surrounding eight squares subdivide, creating a fully filled recursive carpet.", 117],
    ["Dyadic rooms", "Alternating horizontal and vertical splits breathe within their parents. The nested rectangles change proportions without opening gaps.", 118],
    ["Pinwheel parquet", "An adaptive square dissection rotates successive children by quarter turns, exposing directional ancestry at several scales.", 119],
    ["Truchet carpet", "A recursive square lattice carries connected quarter-circle paths. Boundary-preserving deformations keep their endpoints joined.", 120],
    ["Penrose counterpoint", "Thick and thin rhombi exchange light in a periodic pentagrid approximation. Three resolutions preserve closure around the torus.", 121],
    ["Pentagrid pathways", "Paired arcs meet at rhomb-edge midpoints across a periodic pentagrid, linking local motifs into long paths.", 122],
    ["Golden partitions", "Golden-section proportions guide alternating recursive cuts within each pentagrid rhomb. Their shared chambers expand and contract.", 123],
    ["Rhombic inheritance", "Adaptive dyadic subdivisions fill each pentagrid rhomb with tiles of several generations, exchanging pigment according to ancestry.", 124],
    ["Burr constellation", "Three orthogonal pairs of beams separate and counterturn in a shared three-phase motion. Their facets carry a second rhythm of light.", 86],
    ["Elbow quadrille", "Four elbow-shaped units exchange positions around a breathing square of pivots, revealing alternating faces as they turn.", 87],
    ["Cubic chrysalis", "Six square petals unfold from a cubic nucleus in three delayed phases, exposing their dark and pale faces.", 88],
    ["Cantor carillon", "A binary Cantor construction places turning lamellae at successively finer ternary positions. Its gaps and faces participate in the same wave.", 89],
    ["Screw lattice", "Square plates form a stepped helix. The pitch breathes as its tiers rotate and pass waves of light from one face to the next.", 90],
    ["Octahedral counterpoint", "An open octahedral frame surrounds a counter-rotating cube; the dual cubic symmetries repeatedly align and separate.", 91],
    ["Rhombic butterflies", "The two halves of each rhomb fold about a shared diagonal, exchanging bright and dark wings across a periodic pentagrid.", 92],
    ["Golden apertures", "Nested golden-ratio contours contract and open with the relief of their rhombic chambers, following a common light phase.", 93],
    ["Pentagrid braid", "Paired families of fine bands bend across rhombi and exchange contrast with the same phase that raises the mosaic.", 94],
    ["Julia tapestry", "A continuously varying quadratic Julia family is pulled back through two closed torus windings; its escape bands reveal successive levels of the iteration.", 95],
    ["Inversion lace", "Square reflections and circle inversions create successive scales of curved filigree, with a shared pulse passing through every scale.", 96],
    ["Quadrature labyrinth", "The real and imaginary components of one evolving wave define joined dark regions, bright passages and the fine contours within them.", 97],
    ["Paperfolding damask", "Binary cell parity chooses the handedness of paperfold-inspired square contours at each scale. Their counter-rotations reveal nested gaps.", 98],
    ["Nested separatrices", "Critical contour fields pass through successive integer torus maps, opening nested chambers as their saddle connections change.", 99],
    ["Lenticular choir", "Watching eyes arise between two conjugate ribbons. Smaller eyes occupy the gaps inside each lid while their tones follow a common winding.", 100],
    ["Cubic zipper", "Paired cubes roll in opposite directions as their face tones pass through a shared winding phase.", 62],
    ["Counterlocked frames", "Two closed square frames form a linked pair. Their common rotation preserves the link while light passes between the two loops.", 63],
    ["Hinge fugue", "Four hinged solids open in opposing phases; the rhythm of their faces follows the same winding as the hinge wave.", 64],
    ["Octant relay", "Eight cubes exchange light around the corners of a rotating cubic frame, with a second rotation within each octant.", 65],
    ["Cubic brocade", "Two perpendicular families of square beams lift and twist around alternating crossings.", 66],
    ["Recursive cube eclipse", "An eight-map corner construction rotates at each recursive scale, revealing changing alignments of its pale and dark facets.", 67],
    ["Penrose lanterns", "Nested golden-ratio frames illuminate a periodic pentagrid approximant. Its rhombi close around both torus cycles.", 68],
    ["Golden rhomb counterpoint", "Rhomb families exchange pale and dark roles while paired arcs share a common travelling phase.", 69],
    ["Quasicrystal shutters", "The rhombi of a periodic Penrose approximant hinge upward in a coherent winding wave, exposing a second rhythm of light.", 70],
    ["Escher current", "Interlocking tile boundaries deform together through invertible shears. Nested contours exchange figure and ground.", 71],
    ["Day and night", "A continuous tessellation of eye-bearing forms exchanges dark and light while its shared boundaries bend and turn.", 72],
    ["Metamorphic tesserae", "A nodal field changes which neighbouring regions connect; its internal contours participate in the same transformation.", 73],
    ["Figure-ground braid", "Opposing families of broad ribbons share their geometry with the light field, reversing which family dominates each crossing.", 74],
    ["Toral substitution", "Successive applications of an integer torus automorphism produce nested square worlds with phase-linked tonal reversals.", 75],
    ["Sierpiński counterpoint", "A ternary carpet moves through a smooth torus deformation; each genuine recursive scale carries a different phase of light.", 76],
    ["Dyadic loom", "Successive twofold torus coverings insert finer woven passages into the open spaces of the preceding scale.", 77],
    ["Recursive witness", "A hierarchy of torus coverings carries eyes within eyes. Their pupils, irises and lids follow coupled winding phases.", 78],
    ["Ophanim interferometer", "Sixfold eye wheels and the ribbons linking them share one phase, exchanging contrast as the wheels turn.", 79],
    ["Cathedral of return", "Branching ribs, watching eyes and winding connections evolve as one field; dark and light travel through its changing corridors.", 80],
    ["Nodal jacquard", "Numerically solved torus eigenmodes bend a woven fabric and determine its nodal accents.", 81],
    ["Vortex lace", "Complex wave interference drives broad spiralling regions through migrating phase defects and nested radial contours.", 82],
    ["Renormalisation tide", "A logarithmic sequence of scales passes continually through itself; alternating tones return after each pair of scale changes.", 83],
    ["Reversible loom", "Four coupled periodic shears stretch and restore a woven fabric, with crossing tones carried by the same evolving map.", 84],
    ["Truchet substitution", "Connected contour ribbons change their pairings while finer copies occupy the gaps left by each preceding scale.", 85],

    ['Menger tide','Recursive cubic voids turn through fixed white, graphite and grey faces. A travelling rotation reveals each scale of the sponge.',54],
    ['Sierpiński lanterns','A tetrahedron divides into four copies at every level. Alternating facets form a recursive procession of light and shadow.',55],
    ['Recursive gimbals','Nested cubic frames counter-rotate at successive scales, passing through moments of alignment.',56],
    ['Helicoid folia','Layered helical leaves turn their pale fronts and dark reverses through a coordinated spiral.',57],
    ['Octahedral chrysalis','Triangular faces hinge open from nested octahedra, revealing alternating dark interiors and pale shells.',58],
    ['Sierpiński shutters','A Sierpiński carpet is built by removing the central ninth at every level; its surviving panels hinge in delayed waves.',59],
    ['Villarceau ribbons','Pale and dark ribbons follow the two oblique circle families of the torus, counter-rotating through alternating crossings.',60],
    ['Cable of cables','Three cables each carry three smaller strands along closed torus windings. Fixed strand shades reveal the nested braiding.',61],
    ['Cathedral of infinity','A continuous hyperbolic eye lattice opens across the whole chamber, passing through nested pentagonal worlds.',52],
    ['Seraphic procession','Three-eyed guardians rise in staggered ranks as their shared crowns and facial contours breathe together.',46],
    ["Indra’s mirrors",'Successive finite coverings of the torus carry eyes at nested scales, with contrasting irises and winding connections.',53],
    ['Infinite witness','A three-armed logarithmic spiral carries watching eyes through a repeating descent into smaller scales.',48],
    ['Ophanim','Six eye-bearing orbitals turn inside a twelvefold corona, with a counter-rotating eye at their centre.',50],
    ['Farey eyes','A hierarchy of tangent circles at rational positions carries eyes of successively smaller sizes around the chamber.',49],
    ['Neural cathedral','Bilateral ribs flow into their neighbours while nested eyes and branching antennae breathe in delayed phases.',51],
    ['Poincaré eyes','Sevenfold eye rosettes repeat through a hyperbolic disk, gathering into finer structures toward its boundary.',47],
    ['Folding procession','Panels rise, turn over, and settle into the next part of a travelling fold.',42],
    ['Concertina canon','Opposing pleated fans open and close in a single coordinated wave.',43],
    ['Möbius procession','One-sided bands turn and tilt in alternating columns, revealing their half-twists.',44],
    ['Octahedral relay','Eight-faced solids turn through their threefold symmetry, pausing briefly as neighbouring faces take their places.',45],
    ['Rotating squares','Opposite rotations open and close a lattice of square frames, with a travelling wave of alignment.',30],
    ['Cycloidal relay','Rows of wheels roll in opposite directions while their marked rims trace the cycle.',31],
    ['Hexagonal irises','Six petals turn together on a triangular lattice, opening and closing around a shared aperture.',32],
    ['Ribbon exchange','Paired ribbons exchange places in a continuous, alternating over-under rhythm.',33],
    ['Saddle metamorphosis','A repeating contour field passes through its saddle points, joining islands and separating them again.',34],
    ['Orbital quartet','Four linked circular orbits turn together while their markers counter-rotate.',35],
    ['Möbius medallions','A moving focus transforms concentric circles into an off-centre pencil of circles.',36],
    ['Spiral gearing','Five logarithmic arms turn against their neighbours in a coordinated travelling wave.',37],
    ['Four-way exchange','Curves keep their four boundary connections while smoothly changing which directions join.',38],
    ['Squircle canon','Nested circular contours become squares, turn, and return in alternating phases.',39],
    ['Cassini breathing','Pairs of foci separate and reunite as nested ovals divide into smaller loops and join again.',40],
    ['Villarceau counterflow','Two families of actual circles on the torus counter-rotate; their intersections travel along its meridians.',41],
    ['Recursive kirigami','Five nested tiers of pleated paper open in alternating directions, with a delayed wave passing from one scale to the next.',27],
    ['Jacquard manifold','Braids within braids: nine fine ribbons form each woven bundle, alternating above and below along closed torus windings.',28],
    ['Gyroid lace','A continuous saddle-shaped lattice opens into branching passages, breathing and flowing around the chamber.',29],
    ['Kirigami vault','Connected panels lift and twist as square apertures open in travelling waves.',25],
    ['Rolling reconstruction','Cubes with fixed porcelain, graphite and grey faces turn in delayed waves around the chamber.',21],
    ['Cellular exchange','Moving quartets exchange positions while their Voronoi cells change neighbours.',26],
    ['Braided trefoils','Three-strand cables wind around closed trefoil paths, with true depth at their crossings.',23],
    ['Iris vault','Six curved blades open and curl around each changing aperture.',22],
    ['Gyroscopic counterpoint','Nested rings turn in independently phased planes, revealing larger travelling waves.',24],
    ['Toroidal eigenmodes','Eigenfunctions of this curved torus combine into a travelling contour field.',19],
    ['Hamiltonian silk','Area-preserving currents stretch a continuous family of fine filaments.',15],
    ['Moore filaments','Fine distance contours around a closed Moore curve flow through an area-preserving deformation.',20],
    ['Phase vortices','Complex wave interference creates migrating vortices and fine spiral rays.',18],
    ['Separatrix engraving','Nested streamlines gather around moving centres and saddles.',16],
    ['Coprime weave','Broad bundles follow intersecting torus windings, with alternating crossings.',17],
    ['Silk braid','Three strands pass over and under their neighbours.',0],
    ['Petal tide','Nested rosettes open and turn in a travelling wave.',1],
    ['Folding fans','Rows of fine arches open and close in counterpoint.',2],
    ['Orbital canon','Paired beads circle tilting elliptical tracks.',3],
    ['Guilloché','Interference contours form a continuously changing engraving.',4],
    ['Comet field','Tapered strokes curl and stream around the chamber.',5],
    ['Pendulum weave','Hinged pairs swing in alternating, phase-delayed waves.',6],
    ['Pearl waves','Two coherent waves move and swell a field of beads.',7],
    ['Truchet currents','Connected arcs bend through a smoothly shearing tiling.',8],
    ['Figure-eight ballet','Beads trace rotating Bernoulli lemniscates.',9],
    ['Breathing lattice','A lace of moving contours repeatedly separates and reconnects.',10],
    ['Feather tide','Veined lenses lean and rise in alternating rows.',11],
    ['Harmonic ribbons','Travelling wave contours widen into dark bands and narrow into pale engravings.',12],
    ['Interlaced currents','Contrasting families of woven ribbons exchange which one passes above at their crossings.',13],
    ['Meridian flow','Meridian strands compress and expand into alternating dark currents and fine silk.',14]
  ];
  const collectionEntries=TORUS_COLLECTION.flatMap(group=>group.studies.map((entry,index)=>({id:entry[0],variants:entry[1],family:entry[2],group:index===0?group.name:''})));
  const studies=collectionEntries.map(entry=>studyArchive.find(study=>study[2]===entry.id));
  const state={...TorusPresets.get(studies[0][2]),time:0.4,pattern:0,paused:embedded||matchMedia('(prefers-reduced-motion: reduce)').matches};
  let viewProjection=new Float32Array(16);
  function projection(aspect){
    const cam=[3.65,0,0],near=0.04,far=20,f=Math.min(1,aspect)/Math.tan(state.perspective*Math.PI/360);
    // Camera right is -Z, up is +Y, forward is -X.
    const view=new Float32Array([0,0,1,0, 0,1,0,0, -1,0,0,0, 0,0,-cam[0],1]);
    const proj=new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)/(near-far),-1, 0,0,2*far*near/(near-far),0]);
    const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let t=0;t<4;t++)out[c*4+r]+=proj[t*4+r]*view[c*4+t];
    viewProjection=out;const visible=surface.indices(out);surfaceCount=visible.length;gl.bindVertexArray(vao);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER,0,visible,0,visible.length);gl.uniformMatrix4fv(uniforms.uViewProjection,false,out);gl.uniform3fv(uniforms.uCamera,cam);
  }
  const quality=TorusPerformance.governor(),gpuTimer=TorusPerformance.gpuTimer(gl);
  const renderQuality=document.getElementById('renderQuality');
  const maxRaster=Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)||16384,gl.getParameter(gl.MAX_TEXTURE_SIZE)||16384);
  let width=0,height=0,ratio=0,lastPerspective=0,lastAspect=0,resizeNeeded=true;
  let frameRequest=0,last=0,visible=true,dirty=true,contextLost=false;
  function resize(){
    if(resizeNeeded){
      const rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;
      width=Math.max(1,rect.width);height=Math.max(1,rect.height);
      ratio=renderQuality.value==='fine'?2*dpr:renderQuality.value==='native'?dpr:Math.max(1,Math.min(dpr,2)*quality.scale);
      ratio=Math.min(ratio,maxRaster/width,maxRaster/height);
      const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);quality.suspend();gpuTimer.reset();}
      resizeNeeded=false;
    }
    if(lastPerspective!==state.perspective||lastAspect!==width/height){projection(width/height);lastPerspective=state.perspective;lastAspect=width/height;}
  }
  function requestDraw(){dirty=true;schedule();}
  function schedule(){if((!embedded||previewReady)&&!frameRequest&&!document.hidden&&visible&&!contextLost)frameRequest=requestAnimationFrame(frame);}
  function resetBudget(){quality.reset([studies[state.pattern][2],state.variation,state.recursion,state.layers,state.density,state.winding,state.textureMode].join(':'),String(studies[state.pattern][2]));resizeNeeded=true;}
  renderQuality.addEventListener('input',()=>{resizeNeeded=true;requestDraw();});
  function draw(){
    gl.useProgram(program);gl.bindVertexArray(vao);resize();render(state);
  }
  // The same renderer submits both a prepared study and its visible frames.
  // A candidate is immutable until its GPU work is ready for presentation.
  function render(state){
    gl.useProgram(program);gl.bindVertexArray(vao);TorusLight.bind(gl,program,state,state.time);
    const mode=studies[state.pattern][2];
    gl.uniform1f(uniforms.uTime,state.time);gl.uniform1f(uniforms.uInk,state.ink);gl.uniform1i(uniforms.uPalette,state.palette);
    if(mode===148&&phason){gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);phason.draw(viewProjection,state.time,state.wave,0,0,state.variation,state);return;}
    if(mode===147&&spinor){gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(uniforms.uPattern,21);gl.drawElements(gl.TRIANGLES,surfaceCount,gl.UNSIGNED_INT,0);spinor.draw(viewProjection,state.time,state.wave,state.density,0,state.variation,state);return;}
    if((mode===145||mode===146)&&revivals){gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);revivals.draw(viewProjection,state.time,state.wave,state.density,mode-145,state.variation,state);return;}
    if(mode>=141&&quasicrystal){gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);quasicrystal.draw(viewProjection,state.time,state.wave,state.density,mode-131,state.variation,state);return;}
    if(mode>=125&&transformations){gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);transformations.draw(viewProjection,state.time,state.wave,state.density,mode-125,state.variation,state);return;}
    if(mode>=121&&quasicrystal){gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);quasicrystal.draw(viewProjection,state.time,state.wave,state.density,mode-115,state.variation,state);return;}
    if(mode>=101&&tessellations){gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);tessellations.draw(viewProjection,state.time,state.wave,state.density,mode-101,state.variation,state);return;}
    if(metamorphosis&&(mode>=95||mode>=71&&mode<=85)){gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);metamorphosis.draw(viewProjection,state.time,state.wave,state.density,mode>=95?mode-80:mode-71,state.variation,state);return;}
    if(quasicrystal&&(mode>=92||mode>=68&&mode<=70)){gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(mode===70||mode>=92){gl.uniform1f(uniforms.uPattern,21);gl.drawElements(gl.TRIANGLES,surfaceCount,gl.UNSIGNED_INT,0);}quasicrystal.draw(viewProjection,state.time,state.wave,state.density,mode>=92?mode-89:mode-68,state.variation,state);return;}
    if(mechanisms&&(mode>=86||mode>=62&&mode<=67)){gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(uniforms.uPattern,21);gl.drawElements(gl.TRIANGLES,surfaceCount,gl.UNSIGNED_INT,0);mechanisms.draw(viewProjection,state.time,state.wave,state.density,mode>=86?mode-80:mode-62,state.variation,state);return;}
    if(chiaroscuro&&mode>=54){
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(uniforms.uPattern,21);gl.drawElements(gl.TRIANGLES,surfaceCount,gl.UNSIGNED_INT,0);
      chiaroscuro.draw(viewProjection,state.time,state.wave,state.density,mode-54,state.variation,state);return;
    }
    if(topology&&hasTopology(mode)){
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      topology.draw(viewProjection,state.time,state.wave,state.density,topologyKinds[mode],state.variation,state);return;
    }
    if(visionary&&mode>=46){gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);visionary.draw(viewProjection,state.time,state.wave,state.density,mode-46);return;}
    if(symmetry&&mode>=30&&mode<42){gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);symmetry.draw(viewProjection,state.time,state.wave,state.density,mode-30,state);return;}
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(uniforms.uTime,state.time);gl.uniform1f(uniforms.uWave,state.wave);gl.uniform1f(uniforms.uDensity,state.density);gl.uniform1f(uniforms.uPattern,mode>=27?21:mode);gl.drawElements(gl.TRIANGLES,surfaceCount,gl.UNSIGNED_INT,0);
    if(kinetic&&mode>20&&mode<26)kinetic.draw(viewProjection,state.time,state.wave,state.density,mode-21,state.variation,state);
    if(sculptures&&mode>=27&&mode<30)sculptures.draw(viewProjection,state.time,state.wave,state.density,mode-27,state.variation,state);
    if(cycles&&mode>=42&&mode<46)cycles.draw(viewProjection,state.time,state.wave,state.density,mode-42);
  }
  const icons={pause:'<path d="M8 5v14M16 5v14"/>',play:'<path d="m9 5 10 7-10 7Z"/>',settings:'<path d="M4 7h7m4 0h5M4 17h3m4 0h9M11 4v6M7 14v6"/>',previous:'<path d="m14 6-6 6 6 6"/>',next:'<path d="m10 6 6 6-6 6"/>',grid:'<rect x="4" y="4" width="5" height="5"/><rect x="15" y="4" width="5" height="5"/><rect x="4" y="15" width="5" height="5"/><rect x="15" y="15" width="5" height="5"/>',fullscreen:'<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/>'};
  function icon(name){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[name]+'</svg>';}
  const pause=document.getElementById('pause'),settings=document.getElementById('settings'),fullscreen=document.getElementById('fullscreen'),controls=document.getElementById('controls');
  function updatePause(){pause.innerHTML=icon(state.paused?'play':'pause');pause.setAttribute('aria-label',state.paused?'Play animation':'Pause animation');pause.title=state.paused?'Play (Space)':'Pause (Space)';}
  updatePause();settings.innerHTML=icon('settings');fullscreen.innerHTML=icon('fullscreen');
  pause.addEventListener('click',()=>{state.paused=!state.paused;last=0;updatePause();requestDraw();});
  settings.addEventListener('click',()=>{controls.hidden=!controls.hidden;if(!controls.hidden)closeCollection();settings.setAttribute('aria-expanded',String(!controls.hidden));wake();});
  async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await root.requestFullscreen();}catch(e){fullscreen.title='Fullscreen is unavailable in this view';}}
  fullscreen.addEventListener('click',toggleFullscreen);
  document.addEventListener('fullscreenchange',()=>{fullscreen.setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen');});

  const collection=document.getElementById('collection');
  const collectionToggle=document.getElementById('collection-toggle');
  const grid=document.getElementById('study-grid');
  const studyTitle=document.getElementById('study-title');
  const studyCount=document.getElementById('study-count');
  const studyDescription=document.getElementById('study-description');
  const variation=document.getElementById('variation');
  const variationDescription=document.getElementById('variation-description');
  document.getElementById('previous').innerHTML=icon('previous');
  document.getElementById('next').innerHTML=icon('next');
  root.querySelector('.grid-icon').innerHTML=icon('grid');
  const choices=studies.map((study,index)=>{
    const button=document.createElement('button');
    button.type='button';button.className='study-choice';
    if(!available(study[2])){button.disabled=true;button.title='Study unavailable on this device';button.setAttribute('aria-label',study[0]+': unavailable on this device');}
    button.setAttribute('aria-pressed',String(index===state.pattern));
    button.innerHTML='<img src="./studies/'+study[2]+'.webp?v=21" alt="" loading="lazy"><span class="choice-label"><span class="choice-number">'+String(index+1).padStart(2,'0')+'</span>'+study[0]+'</span>';
    button.addEventListener('click',()=>{choose(index);closeCollection();collectionToggle.focus({preventScroll:true});});
    if(collectionEntries[index].group){const heading=document.createElement('h3');heading.className='study-group';heading.textContent=collectionEntries[index].group;grid.appendChild(heading);}
    grid.appendChild(button);return button;
  });
  function closeCollection(){collection.hidden=true;collectionToggle.setAttribute('aria-expanded','false');}
  function variationNames(){
    const entry=collectionEntries[state.pattern];
    if(hasTopology(entry.id)&&!topology)return entry.variants.slice(0,1);
    return entry.variants;
  }
  function updateOptions(){
    const entry=collectionEntries[state.pattern], names=variationNames();
    variation.innerHTML='';names.forEach((name,i)=>{const option=document.createElement('option');option.value=i;option.textContent=name;variation.appendChild(option);});
    state.variation=Math.min(state.variation,names.length-1);variation.selectedIndex=state.variation;
    document.getElementById('variation-label').hidden=names.length<2;
    syncParameters();
    variationDescription.textContent=entry.family==='roll'?'Face shades stay attached to the cubes; the rotating faces create waves of dark and light.':['volume','quasi','mechanism','metamorphic'].includes(entry.family)||entry.id>=71?studies[state.pattern][1]:'';
    variationDescription.hidden=!variationDescription.textContent;
  }
  const parameterKeys=['speed','wave','density','perspective','ink','inkCycle','palette','turns','recursion','winding','layers','balance','spectral','textureMode','textureStrength','textureScale'];
  let parameterProfile={};
  function syncParameters(){
    const id=studies[state.pattern][2];
    TorusParameters.normalise(id,state.variation,state);
    parameterProfile=TorusParameters.profile(id,state.variation,state);
    // Fallback studies cannot expose options belonging to the unavailable renderer.
    if(hasTopology(id)&&!topology)for(const key of ['winding','layers','balance','spectral'])delete parameterProfile[key];
    for(const key of parameterKeys){
      const input=document.getElementById(key),label=document.getElementById(key+'-label'),spec=parameterProfile[key];
      label.hidden=!spec;if(!spec)continue;
      const name=document.getElementById(key+'-name');if(name)name.textContent=spec.label;
      const help=document.getElementById(key+'-help');if(help){help.textContent=spec.help||'';help.hidden=!spec.help;}
      let index=0;
      if(input.tagName==='SELECT'){
        if(spec.values){
          const signature=JSON.stringify([spec.values,spec.labels]);
          if(input.dataset.values!==signature){input.innerHTML='';spec.values.forEach((value,i)=>{const option=document.createElement('option');option.value=value;option.textContent=spec.labels[i];input.appendChild(option);});input.dataset.values=signature;}
          index=TorusParameters.closest(spec.values,state[key]);state[key]=spec.values[index];input.selectedIndex=index;
        }else input.selectedIndex=state[key];
      }else if(spec.values){
        input.min=0;input.max=spec.values.length-1;input.step=1;index=TorusParameters.closest(spec.values,state[key]);state[key]=spec.values[index];input.value=index;
      }else{
        input.min=spec.min;input.max=spec.max;input.step=spec.step;state[key]=Number((spec.min+Math.round((Math.max(spec.min,Math.min(spec.max,state[key]))-spec.min)/spec.step)*spec.step).toFixed(6));input.value=state[key];index=Math.round((state[key]-spec.min)/spec.step);
      }
      const output=document.getElementById(key+'-value');
      const text=spec.labels?spec.labels[index]:key==='perspective'?state[key]+'°':key==='speed'?state[key].toFixed(2)+'×':spec.step<1?state[key].toFixed(2):String(state[key]);
      if(output)output.value=text;input.setAttribute('aria-valuetext',text);
    }
  }
  for(const key of parameterKeys)document.getElementById(key).addEventListener('input',e=>{
    const spec=parameterProfile[key];if(!spec)return;
    const value=Number(e.target.value);
    state[key]=spec.values&&e.target.tagName!=='SELECT'?spec.values[Math.max(0,Math.min(spec.values.length-1,Math.round(value)))]:value;
    syncParameters();if(['density','recursion','layers','winding','textureMode'].includes(key))resetBudget();requestDraw();
  });
  function setVariation(index){
    const names=variationNames();state.variation=(index+names.length)%names.length;variation.selectedIndex=state.variation;syncParameters();resetBudget();requestDraw();wake();
  }
  let selectionTicket=0,requestedPattern=0,plannedRandom=-1;
  const warmed=new Set(),warming=new Map();
  let preparing=0;
  function recipeKey(candidate){return [studies[candidate.pattern][2],candidate.variation,candidate.recursion,candidate.layers,candidate.density,candidate.winding,candidate.textureMode].join(':');}
  function prepareGeometry(candidate){
    const mode=studies[candidate.pattern][2];let renderer,kind;
    if(mode===148){renderer=phason;kind=0;}
    else if(mode===147){renderer=spinor;kind=0;}
    else if(mode===145||mode===146)return;
    else if(mode>=141){renderer=quasicrystal;kind=mode-131;}
    else if(mode>=125)return;
    else if(mode>=121){renderer=quasicrystal;kind=mode-115;}
    else if(mode>=101||mode>=95||mode>=71&&mode<=85)return;
    else if(mode>=92||mode>=68&&mode<=70){renderer=quasicrystal;kind=mode>=92?mode-89:mode-68;}
    else if(mode>=86||mode>=62&&mode<=67){renderer=mechanisms;kind=mode>=86?mode-80:mode-62;}
    else if(mode>=54){renderer=chiaroscuro;kind=mode-54;}
    else if(mode>=42&&mode<=45){renderer=cycles;kind=mode-42;}
    else if(mode>=27&&mode<=29){renderer=sculptures;kind=mode-27;}
    else if(mode>=21&&mode<=25){renderer=kinetic;kind=mode-21;}
    renderer?.prepare?.(kind,candidate.variation,candidate,mode===148?0:candidate.density);
  }
  async function warmStudy(candidate){
    const key=recipeKey(candidate);
    const mode=studies[candidate.pattern][2];
    // A reloaded animal atlas has fresh GPU work even for a known recipe.
    if(warmed.has(key)&&!(mode>=130&&mode<=134))return;
    if(warming.has(key))return warming.get(key);
    const task=(async()=>{
      preparing++;
      try{
        prepareGeometry(candidate);
        gl.useProgram(program);gl.bindVertexArray(vao);resize();
        await TorusPrograms.stage(gl,()=>render(candidate),canvas.width,canvas.height);
        warmed.add(key);if(warmed.size>192)warmed.delete(warmed.values().next().value);
      }finally{preparing--;quality.suspend();}
    })();
    warming.set(key,task);
    try{await task;}finally{warming.delete(key);}
  }
  // Shader families are finite. Compile one at a time only when optional
  // parallel compilation and measured headroom make background work suitable.
  const canPrepare=()=>!document.hidden&&visible&&!contextLost&&root.getAttribute('aria-busy')!=='true'&&!preparing&&!TorusPrograms.pending(gl)&&TorusPrograms.parallel(gl)&&(state.paused||quality.headroom);
  const preparationQueue=TorusPrograms.idleQueue({
    canRun:canPrepare,
    onError:e=>console.warn('Background study preparation was deferred.',e)
  });
  function prefetch(index,priority=0){
    if(embedded)return;
    index=(index+studies.length)%studies.length;
    const mode=studies[index][2];
    // The detailed animal fields have their own two-entry residency policy.
    if(mode>=130&&mode<=134)return;
    preparationQueue.promote('warm:'+index,priority);
    return preparationQueue.enqueue('compile:'+index,async()=>{
      await prepare(mode);
      if(contextLost||!available(mode))return;
      // Compiling can take longer than the measured headroom remains valid.
      // A separate queued draw waits for fresh samples before touching the GPU.
      preparationQueue.enqueue('warm:'+index,()=>warmStudy({...state,...TorusPresets.get(mode),pattern:index,time:mode>=145&&mode<=148?0:state.time}),priority);
    },priority);
  }
  for(const [index,button] of choices.entries()){
    button.addEventListener('pointerenter',()=>prefetch(index,2));
    button.addEventListener('focus',()=>prefetch(index,2));
  }
  async function choose(index,extra=false){
    const ticket=++selectionTicket,direction=index<state.pattern?-1:1;
    let selected=(index+studies.length)%studies.length;requestedPattern=selected;
    root.setAttribute('aria-busy','true');
    do{
      await prepare(studies[selected][2]);if(ticket!==selectionTicket)return false;
      if(available(studies[selected][2]))break;
      selected=(selected+direction+studies.length)%studies.length;
    }while(true);
    const candidate={...state,...(extra?TorusSelection.parameters(studies[selected][2],collectionEntries[selected].variants.length):TorusPresets.get(studies[selected][2])),pattern:selected};
    // A square aperture needs a broad view of the chamber. Keep the study's
    // geometry and motion intact; framing is independent of its construction.
    if(embedded)candidate.perspective=Math.max(90,candidate.perspective);
    const startsCycle=studies[selected][2]>=145&&studies[selected][2]<=148;
    if(startsCycle)candidate.time=0;
    try{await warmStudy(candidate);}
    catch(e){if(contextLost)return false;console.warn('Study preparation could not finish; drawing directly.',e);}
    if(ticket!==selectionTicket)return false;
    // Preparation never advances the incoming animation. Its first visible
    // step starts at presentation, independently of shader/asset latency.
    Object.assign(state,candidate,{time:startsCycle?0:state.time,paused:state.paused});last=0;
    requestedPattern=selected;root.setAttribute('aria-busy','false');
    choices.forEach((button,i)=>{button.disabled=!available(studies[i][2]);if(button.disabled)button.title='Study unavailable on this device';});
    studyTitle.textContent=studies[state.pattern][0];
    document.getElementById('readme-link').href='./readme.html#study-'+studies[state.pattern][2];
    studyCount.textContent=String(state.pattern+1).padStart(2,'0')+' / '+studies.length;
    studyDescription.textContent=studies[state.pattern][1]+(available(studies[state.pattern][2])?'':' Some studies are unavailable on this device.');
    collectionToggle.setAttribute('aria-label','Choose study: '+studies[state.pattern][0]);
    canvas.setAttribute('aria-label',studies[state.pattern][0]+'. '+studies[state.pattern][1]+' Flowing over the inner wall of a toroidal chamber.');
    choices.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===state.pattern)));
    updateOptions();resetBudget();quality.suspend();
    requestDraw();wake();
    plannedRandom=TorusSelection.index(selected,studies.length,i=>available(studies[i][2]));
    prefetch(plannedRandom,3);prefetch(selected+1,1);prefetch(selected-1,1);return true;
  }
  async function randomStudy(extra=false){
    const index=plannedRandom>=0&&plannedRandom!==requestedPattern&&available(studies[plannedRandom][2])?plannedRandom:TorusSelection.index(requestedPattern,studies.length,i=>available(studies[i][2]));
    plannedRandom=-1;
    if(!await choose(index,extra))return;
    closeCollection();wake();
  }
  document.getElementById('random').addEventListener('click',()=>randomStudy());
  document.getElementById('extra-random').addEventListener('click',()=>randomStudy(true));
  document.getElementById('reset-defaults').addEventListener('click',()=>choose(state.pattern));
  variation.addEventListener('input',e=>setVariation(Number(e.target.value||e.target.selectedIndex||0)));
  document.getElementById('parameters-close').addEventListener('click',()=>{controls.hidden=true;settings.setAttribute('aria-expanded','false');settings.focus({preventScroll:true});});
  collectionToggle.addEventListener('click',()=>{
    collection.hidden=!collection.hidden;
    collectionToggle.setAttribute('aria-expanded',String(!collection.hidden));
    if(!collection.hidden){controls.hidden=true;settings.setAttribute('aria-expanded','false');choices[state.pattern].scrollIntoView({block:'nearest'});}
    wake();
  });
  document.getElementById('collection-close').addEventListener('click',()=>{closeCollection();collectionToggle.focus({preventScroll:true});});
  document.getElementById('previous').addEventListener('click',()=>choose(requestedPattern-1));
  document.getElementById('next').addEventListener('click',()=>choose(requestedPattern+1));
  document.addEventListener('keydown',e=>{
    if(embedded)return;
    if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;
    if(e.code==='ArrowRight'||e.code==='ArrowLeft'){e.preventDefault();choose(requestedPattern+(e.code==='ArrowRight'?1:-1));}
    else if(e.code==='Space'&&document.activeElement.tagName!=='BUTTON'){e.preventDefault();state.paused=!state.paused;last=0;updatePause();requestDraw();wake();}
    else if(e.key.toLowerCase()==='f')toggleFullscreen();
    else if(e.key.toLowerCase()==='r'){e.preventDefault();randomStudy(e.shiftKey);}
    else if(e.key.toLowerCase()==='h'){controls.hidden=true;closeCollection();settings.setAttribute('aria-expanded','false');document.activeElement.blur();root.classList.toggle('quiet');}
    else if(e.key==='Escape'){const hadCollection=!collection.hidden,hadControls=!controls.hidden;controls.hidden=true;closeCollection();settings.setAttribute('aria-expanded','false');if(hadCollection)collectionToggle.focus({preventScroll:true});else if(hadControls)settings.focus({preventScroll:true});}
  });
  let quietTimer;
  function wake(){
    if(embedded)return;
    root.classList.remove('quiet');clearTimeout(quietTimer);
    quietTimer=setTimeout(()=>{if(controls.hidden&&collection.hidden)root.classList.add('quiet');},4500);
  }
  root.addEventListener('pointermove',wake,{passive:true});
  root.addEventListener('pointerdown',wake,{passive:true});root.addEventListener('focusin',wake);
  canvas.addEventListener('pointerdown',()=>{closeCollection();controls.hidden=true;settings.setAttribute('aria-expanded','false');});
  function stopFrames(){if(frameRequest)cancelAnimationFrame(frameRequest);frameRequest=0;last=0;quality.suspend();}
  new ResizeObserver(()=>{resizeNeeded=true;requestDraw();}).observe(canvas);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)requestDraw();else stopFrames();}).observe(canvas);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopFrames();else requestDraw();});
  function frame(now){
    frameRequest=0;if(document.hidden||!visible||contextLost){last=0;return;}
    const elapsed=last?now-last:0;last=now;
    if(!state.paused){
      const timing=gpuTimer.poll();
      if(!preparing&&!TorusPrograms.pending(gl)&&quality.observe(elapsed,now,timing)&&renderQuality.value==='adaptive')resizeNeeded=true;
      state.time=(state.time+(elapsed/1000)*state.speed*Math.PI/16)%(Math.PI*2);
    }
    if(dirty||!state.paused){gpuTimer.begin(quality.tag);draw();gpuTimer.end();dirty=false;}
    if(!state.paused)schedule();else last=0;
  }
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;selectionTicket++;preparationQueue.dispose();gpuTimer.dispose();stopFrames();error.hidden=false;error.textContent='The graphics context was interrupted. Reload to resume the artwork.';previewMessage('torus-preview-error');});
  if(embedded)globalThis.addEventListener('message',event=>{
    if(event.source!==globalThis.parent||event.origin!==globalThis.location.origin||event.data?.type!=='torus-preview-state'||typeof event.data.paused!=='boolean')return;
    state.paused=event.data.paused;last=0;updatePause();requestDraw();
  });
  const linkedStudy=(globalThis.location?.search||'').match(/(?:^\?|&)study=(\d+)(?:&|$)/);
  const linkedIndex=linkedStudy?studies.findIndex(study=>study[2]===Number(linkedStudy[1])):-1;
  let initialIndex=linkedIndex>=0?linkedIndex:0;
  if(embedded){
    let previous=-1;try{const stored=sessionStorage.getItem('torus-preview-study');if(stored!==null)previous=studies.findIndex(study=>study[2]===Number(stored));}catch{}
    initialIndex=TorusSelection.index(previous,studies.length,i=>available(studies[i][2]));
  }
  if(!await choose(initialIndex))return;
  if(embedded){
    try{sessionStorage.setItem('torus-preview-study',String(studies[state.pattern][2]));}catch{}
    // A valid first frame is presented before the parent removes its poster.
    previewReady=true;draw();dirty=false;
    previewMessage('torus-preview-ready',{id:studies[state.pattern][2],title:studies[state.pattern][0]});
  }
  for(const mode of [101,76,21,27,56,86,68,19,30,46]){
    const index=studies.findIndex(study=>study[2]===mode);if(index>=0)prefetch(index);
  }
})();
