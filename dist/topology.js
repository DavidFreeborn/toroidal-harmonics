/* Closed winding families, toral coverings, and intrinsic spectral geometry. */
const TorusTopology = (() => {
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
uniform float uTime,uWave,uDensity,uLayers,uBalance,uInk;
uniform highp int uContrastCycle;
uniform highp int uKind,uVariant,uWinding,uSpectral,uPalette;
uniform highp sampler2D uSpectrum;
in vec3 vPosition;
in vec2 vAngles;
out vec4 fragColor;
const float PI=3.14159265359,TAU=6.28318530718;
float footprint=.001,cellFilterLimit=1e10;
mat2 rot(float a){return mat2(cos(a),sin(a),-sin(a),cos(a));}
vec2 cis(float a){return vec2(cos(a),sin(a));}
vec2 mul(vec2 a,vec2 b){return vec2(a.x*b.x-a.y*b.y,a.x*b.y+a.y*b.x);}
vec2 divc(vec2 a,vec2 b){return vec2(dot(a,b),a.y*b.x-a.x*b.y)/max(dot(b,b),1e-15);}
float fill(float d){float w=min(max(fwidth(d)*.75,.0002),cellFilterLimit);return 1.0-smoothstep(-w,w,d);}
float stroke(float d,float width){return torusStroke(d,width,min(max(fwidth(d)*.65,.0002),cellFilterLimit));}
float repeatLine(float p,float w){return torusPeriodic(p,w,fwidth(p));}
float boxAA(vec2 p,vec2 h,vec2 dx,vec2 dy){
 vec2 d=abs(p)-h,g=max(d,0.0);
 g=dot(g,g)>1e-12?normalize(g):d.x>d.y?vec2(1,0):vec2(0,1);
 g*=sign(p);return max(.00001,.6*(abs(dot(g,dx))+abs(dot(g,dy))));
}
float ring(vec2 p,float r,float w){return stroke(length(p)-r,w);}
float box(vec2 p,vec2 b){vec2 q=abs(p)-b;return length(max(q,0.0))+min(max(q.x,q.y),0.0);}
float lens(vec2 p,float h){float c=(1.0-h*h)/(2.0*h);return length(vec2(p.x,abs(p.y)+c))-(c+h);}
float eye(vec2 p,float phase,float pupil){
 float h=.33+.075*sin(phase),d=lens(p,h);
 float r=length(p),ink=stroke(d,.019);
 ink=max(ink,.48*stroke(lens(p/1.095,h),.009));
 ink=max(ink,ring(p,.29+.025*cos(phase),.020)*fill(d));
 ink=max(ink,ring(p,.19,.010)*fill(d));
 ink=max(ink,pupil*(.24+.76*(.5+.5*sin(phase)))*fill(r-(.09+.025*sin(phase)))*fill(d));
 float iris=fill(r-.29)*fill(d);
 float crescent=fill(lens(p,h))*fill(-p.y)*(.5+.5*sin(phase));
 float theta=atan(p.y,p.x),filigree=.5+.5*cos(14.0*theta+4.0*sin(6.0*r-phase)+2.0*phase);
 float pulse=.5+.5*sin(phase+2.0*cos(3.0*phase));
 ink=max(ink,uInk*((.24+.66*pulse)*iris*(.35+.65*filigree)*(1.0-ring(p,.20,.015))+.58*crescent*(1.0-iris)));
 return ink;
}
float conformalY(float v){return (v-2.0*atan(sin(v)/(3.0+cos(v))))/TAU;}
vec2 winding(){if(uWinding==0)return vec2(1,0);if(uWinding==1)return vec2(1,1);if(uWinding==2)return vec2(2,3);return vec2(3,5);}
vec2 moveDisk(vec2 z,vec2 a){return divc(z-a,vec2(1.0-dot(a,z),a.y*z.x-a.x*z.y));}
vec2 hyperFold(vec2 z,float p,float q){
 float c=cos(PI/q)/sqrt(pow(cos(PI/q),2.0)-pow(sin(PI/p),2.0)),rr=c*c-1.0;
 for(int k=0;k<20;k++){
  float a=mod(atan(z.y,z.x)+PI/p,TAU/p)-PI/p;z=length(z)*cis(abs(a));
  vec2 d=z-vec2(c,0);float dd=dot(d,d);
  if(dd<rr)z=vec2(c,0)+d*rr/max(dd,1e-12);
 }
 return z;
}
vec2 theta1(vec2 z){
 // Jacobi theta_1(pi*z | 0.75i), five exponentially convergent terms.
 vec2 sum=vec2(0);
 for(int j=0;j<5;j++){
  float n=float(j),k=2.0*n+1.0,x=k*PI*z.x,y=k*PI*z.y;
  float ch=.5*(exp(y)+exp(-y)),sh=.5*(exp(y)-exp(-y));
  float a=2.0*exp(-PI*.75*pow(n+.5,2.0))*(j%2==0?1.0:-1.0);
  sum+=a*vec2(sin(x)*ch,cos(x)*sh);
 }
 return sum;
}
vec2 elliptic(vec2 q){
 // Squaring cancels the sign change under the imaginary lattice period.
 vec2 z=vec2(fract(q.x)-.5,(fract(q.y)-.5)*.75);
 vec2 r=divc(theta1(z-vec2(.25,0)),theta1(z+vec2(.25,0)));
 // The ratio is meromorphic, so compactify its poles before using it as a
 // drawing coordinate. Infinity is sent smoothly to the unit boundary.
 r=r/(1.0+length(r));
 return mul(r,r);
}
vec2 shear(vec2 z,float t,float a,int count){
 for(int j=0;j<6;j++){
  if(j<count){float n=float(j),f=2.0+n;
   z.x+=(.045+.035*a)*pow(.78,n)*sin(TAU*f*z.y+sin(t+n));
   z.y+=(.037+.025*a)*pow(.78,n)*sin(TAU*(f+1.0)*z.x-cos(t-n));
  }
 }
 return z;
}
void shearFrame(inout vec2 z,inout vec2 dx,inout vec2 dy,float t,float a,int count){
 for(int j=0;j<6;j++)if(j<count){
  float n=float(j),f=2.0+n,A=(.045+.035*a)*pow(.78,n),B=(.037+.025*a)*pow(.78,n);
  float phase=TAU*f*z.y+sin(t+n),g=A*TAU*f*cos(phase);
  dx.x+=g*dx.y;dy.x+=g*dy.y;z.x+=A*sin(phase);
  phase=TAU*(f+1.0)*z.x-cos(t-n);g=B*TAU*(f+1.0)*cos(phase);
  dx.y+=g*dx.x;dy.y+=g*dy.x;z.y+=B*sin(phase);
 }
}
float filteredLine(float phase,float width,vec2 gradient){return torusPeriodic(phase,width,abs(gradient.x)+abs(gradient.y));}
float contours(float field,float scale,float width){return repeatLine(field*scale,width);}
vec4 spectrum(float v){
 float x=fract(v/TAU)*512.0;int i=int(floor(x));
 return mix(texelFetch(uSpectrum,ivec2(i,uSpectral),0),texelFetch(uSpectrum,ivec2((i+1)%512,uSpectral),0),fract(x));
}
float eyeCascade(vec2 z,float ph,int variant){
 float ink=0.0,mask=1.0;
 for(int j=0;j<5;j++){
  if(float(j)>=uLayers)break;
  vec2 p=fract(z)-.5,e=p/vec2(.465,.66);
  float level=float(j),f=max(length(dFdx(z)),length(dFdy(z)));
  float visible=1.0-smoothstep(.055,.22,f);
  float detail=eye(e,ph-level*.55,j==int(uLayers)-1?1.0:0.0);
  if(float(j)<uLayers)ink=max(ink,mask*detail*visible*pow(.87,level));
  mask*=fill(lens(e,.45));
  if(variant==3)z=mat2(2,1,1,1)*z+vec2(.0,.08*sin(ph-level));
  else z=mat2(2,1,1,2)*z+vec2(.1*cos(ph-level),0);
 }
 return ink;
}
float toralRails(vec2 b,vec2 wind,vec2 dual,float phase,float amount){
 float x=dot(wind,b),y=dot(dual,b),ink=0.0;
 ink=max(ink,amount*stroke(sin(TAU*x)+.42*sin(TAU*(x+y)+phase),.028));
 ink=max(ink,.72*amount*stroke(sin(TAU*y)-.36*sin(TAU*(x-y)-phase),.022));
 return ink;
}
void main(){
 float t=uTime,a=uWave;vec2 wind=winding(),dual=vec2(-wind.y,wind.x);
 vec2 chart=vec2(vAngles.x/TAU,conformalY(vAngles.y));
 vec2 b=chart+vec2(0,t/TAU),area=vec2(vAngles.x,vAngles.y+.6*sin(vAngles.y)+t)/TAU;
 // Integer shears change the winding class without breaking either torus seam.
 if(uVariant==1){b.x+=b.y;area.x+=area.y;}
 if(uVariant==3){b.x-=b.y;area.x-=area.y;}
 float columns=8.0*floor(1.5+uDensity*.009);vec2 n=vec2(columns,columns*.75);
 vec2 q=b*n,id=floor(q),p=fract(q)-.5;
 float phase=TAU*dot(wind,b)-2.0*t,parity=mod(id.x+id.y,2.0)*2.0-1.0;
 footprint=max(length(dFdx(q)),length(dFdy(q)));float ink=0.0,wash=0.0;
 if(uKind==53){
   float X=TAU*b.x,Y=TAU*b.y;
   if(uVariant==2){
    vec2 z=elliptic(b*vec2(2,2)+vec2(.04*a*sin(t),.035*a*cos(t)));
    float rr=max(length(z),1e-8),th=atan(z.y,z.x);
    float logR=log(rr)/log(4.0)-t/TAU;
    vec2 e=vec2(fract(3.0*th/TAU-logR+.5)-.5,fract(logR)-.5)/vec2(.43,.53);
    ink=eye(e,phase,1.0);
    float grad=max(length(dFdx(e)),length(dFdy(e)));
    ink*=1.0-smoothstep(.4,1.5,grad);
    ink=max(ink,.38*repeatLine(logR,.018));
   }else if(uVariant==0){
    // Finite torus coverings at successive powers of two, with each eye
    // nested inside the previous eye's cell.
    for(int j=0;j<5;j++){
  if(float(j)>=uLayers)break;
     float k=float(j),m=pow(2.0,k),s=pow(.68,k);
     vec2 p=fract(vec2(m*(2.0*b.x+3.0*b.y)+.06*sin(t+k),m*(3.0*b.x-2.0*b.y)+.05*cos(t-k)))-.5;
     float local=eye(p/vec2(.31+.025*k,.43+.022*k),phase-k*.57,1.0);
     float halo=stroke(length(p)-(.285-.022*k),.0045);
     if(k<uLayers)ink=max(ink,s*(local+.16*halo));
    }
    ink=max(ink,.10*toralRails(b,wind,dual,phase,.48));
   }else if(uVariant==1){
    // A bounded complex cascade on two conjugate torus characters.
    vec2 z=.46*cis(2.0*X+3.0*Y-t)+.30*cis(3.0*X-2.0*Y+2.0*t)+.14*cis(5.0*X+Y-t);
    vec2 z2=.42*cis(2.0*X-3.0*Y+t)+.26*cis(3.0*X+2.0*Y-t);
    for(int j=0;j<5;j++){
  if(float(j)>=uLayers)break;
     float k=float(j),s=pow(.66,k),r=.34*pow(.66,k);
     vec2 p=z/vec2(r,r*.78),p2=z2/vec2(r,r*.78);
     float local=eye(p,phase-k*.55,1.0)+.52*eye(p2,-phase+k*.4,1.0);
     float shell=stroke(length(z)-r,.004);
     if(k<uLayers)ink=max(ink,s*(local+.18*shell));
     z=mul(z,z)+.16*cis(phase-k*.75);z=z/(1.0+length(z));
     z2=mul(z2,vec2(z2.x,-z2.y))+.13*cis(-phase+k*.6);z2=z2/(1.0+length(z2));
    }
    ink=max(ink,.15*toralRails(b,wind,dual,phase,.52));
   }else{
    // Winding eyes, nested pupils carried along two coprime cycles.
    vec2 c1=vec2(fract(2.0*b.x+3.0*b.y+t/TAU)-.5,fract(3.0*b.x-2.0*b.y-t/TAU)-.5);
    vec2 c2=vec2(fract(3.0*b.x-5.0*b.y-t/TAU)-.5,fract(5.0*b.x+2.0*b.y+t/TAU)-.5);
    for(int j=0;j<5;j++){
  if(float(j)>=uLayers)break;
     float k=float(j),s=pow(.70,k),turn=mod(k,2.0)*2.0-1.0;
     vec2 p=rot(turn*((.65*sin(phase))+k*.42))*c1/vec2(.36+.04*k,.50+.03*k);
     vec2 q2=rot(-turn*((.52*sin(phase))-k*.31))*c2/vec2(.30+.03*k,.43+.025*k);
     if(k<uLayers)ink=max(ink,s*(eye(p,phase-k*.5,1.0)+.6*eye(q2,-phase+k*.4,1.0)));
    }
    ink=max(ink,.13*toralRails(b,wind,dual,phase,.58));
   }
 }else if(uKind==47){
  float cover=uVariant==3?3.0:2.0;
  vec2 e=elliptic(b*cover+vec2(.07*a*sin(t),.04*a*cos(t)));
  float r=length(e),th=atan(e.y,e.x);
  vec2 z=(2.0/PI*atan(r))*.974*cis(th+(uVariant==2?t:-t));
  z=moveDisk(z,(.05+.28*uBalance)*cis(t));
  float sides=uVariant==1?7.0:(uVariant==2?5.0:8.0),valence=uVariant==2?4.0:3.0;
  vec2 h=hyperFold(z,sides,valence);
  float c=cos(PI/valence)/sqrt(pow(cos(PI/valence),2.0)-pow(sin(PI/sides),2.0));
  float rad=sqrt(c*c-1.0),ap=c-rad;
  float f=max(length(dFdx(h)),length(dFdy(h)));
  ink=stroke(length(h-vec2(c,0))-rad,.004);
  ink=max(ink,eye((h-vec2(ap*.52,0))/vec2(ap*.37,ap*.48),t,1.0));
    for(int j=1;j<5;j++)if(float(j)<uLayers)ink=max(ink,pow(.66,float(j))*stroke(length(h-vec2(c,0))-(rad+.026*float(j)),.003));
  ink*=1.0-smoothstep(.035,.13,f);
 }else if(uKind==49){
  vec2 z=q;z.x+=t/TAU+.065*a*sin(phase);
  if(uVariant==2)z=mat2(1,0,1,1)*z;
  // These local circles and squircles have bounded distance gradients. Cell
  // identity changes must not be mistaken for a many-pixel geometric edge.
  cellFilterLimit=max(.0002,1.5*(length(dFdx(z))+length(dFdy(z))));
  float row=floor(z.y),yy=fract(z.y),hand=mod(row,2.0)*2.0-1.0;
  yy=hand<0.0?yy:1.0-yy;
  if(uVariant==3)z.x+=hand*t/TAU;else z.x+=.5*mod(row,2.0);
  for(int j=1;j<=16;j++){
   if(float(j)>3.0+2.5*uLayers)break;
   float den=float(j),num=floor(z.x*den+.5);
   // Exact coprimality for the sixteen supported denominators.
   const int primitive[16]=int[](1,2,6,10,30,34,126,170,438,650,2046,2210,8190,10794,27030,43690);
   int aa=int(mod(abs(num),den));bool coprime=((primitive[j-1]>>aa)&1)==1;
   float rad=.5/(den*den);vec2 v=vec2(z.x-num/den,yy-rad);
   float visible=(coprime&&float(j)<=3.0+2.5*uLayers?1.0:0.0)*(1.0-smoothstep(.045,.18,footprint/rad));
   float e=eye(v/(rad*.78),t+float(j)*.3,1.0);
   ink=max(ink,max(stroke(length(v)-rad,.002),e)*visible);
  }
  ink=max(ink,.3*stroke(yy,.002));
  ink=max(ink,toralRails(b,wind,dual,phase,.18));
 }else if(uKind==50){
  vec2 z=q;
  if(uVariant==2){z.x+=.24*sin(TAU*z.y/2.0+t);z.y+=.07*a*sin(TAU*dot(wind,b)-t);}
  vec2 w=fract(z)-.5;float ph=TAU*dot(wind,b)-t;
  float radius=length(w),angle=atan(w.y,w.x)+ph;
  float sector=mod(angle+PI/6.0,PI/3.0)-PI/6.0;
  vec2 petal=radius*cis(sector);
  ink=eye((petal-vec2(.29,0))/vec2(.12,.17),ph,1.0);
  for(int j=0;j<5;j++)if(float(j)<uLayers){
   float l=float(j),r=.385+.018*l+.009*cos(12.0*angle-ph-.3*l);
   ink=max(ink,pow(.77,l)*stroke(radius-r,.003));
  }
  ink=max(ink,eye(rot(-ph)*w/.12,ph,1.0));
  float link=cos(TAU*z.x)-cos(TAU*z.y);
  ink=max(ink,.42*stroke(link,.018)*(1.0-fill(radius-.43)));
  ink=max(ink,toralRails(b,wind,dual,ph,.22));
  if(uVariant==3){vec2 small=fract(mat2(2,1,1,2)*z)-.5;ink=max(ink,.64*eye(small/vec2(.40,.54),-ph,1.0)*fill(radius-.18));}
 }else if(uKind==51){
  vec2 z=q;z.x+=.045*a*sin(TAU*dot(wind,b)-t);
  if(uVariant==2)z.x+=.12*sin(TAU*z.y/2.0+t);
  vec2 w=fract(z)-.5;w.y=-w.y;
  float ph=TAU*dot(wind,b)-t;
  for(int j=0;j<15;j++)if(float(j)<6.0+2.0*uLayers){
   float k=float(j),f=k/(4.0+2.0*uLayers);
   float edge=(.035+.40*f)*(.46+.54*cos(PI*w.y)*cos(PI*w.y));
   edge+=.015*a*sin(TAU*w.y+ph-.27*k)*pow(cos(PI*w.y),2.0)*sin(PI*f);
   if(uVariant==3)edge+=.017*sin(4.0*PI*w.y-ph)*sin(PI*f);
   ink=max(ink,(.95-.42*f)*stroke(abs(w.x)-edge,.0027));
   wash=max(wash,(j%3==0?.83:.07)*fill(abs(abs(w.x)-edge)-.0085));
  }
  for(int j=0;j<5;j++)if(float(j)<uLayers){
   float k=float(j),s=pow(.58,k),y=.19-.34*(1.0-s);
   ink=max(ink,eye((w-vec2(0,y))/(vec2(.175,.22)*s),ph-k*.65,1.0));
   vec2 branch=(w-vec2(0,.32))*vec2(1,1.3)/s;
   float f=abs(branch.x)-(.014+.7*abs(branch.y));
   ink=max(ink,.63*stroke(f,.0035)*fill(abs(branch.y)-.15));
  }
  float nerves=sin(TAU*z.x)*sin(TAU*z.y)+.27*sin(TAU*(z.x+z.y));
  if(uVariant==2)ink=max(ink,.35*repeatLine(nerves*(2.0+uLayers),.022)*(1.0-fill(abs(w.x)-.27)));
  ink=max(ink,toralRails(b,wind,dual,ph,.22));
 }else if(uKind==30||uKind==35||uKind==39||uKind==7){
  vec2 z=q;
  z.x+=.08*a*sin(TAU*dot(wind,b)-t);z.y+=.08*a*sin(TAU*dot(dual,b)+t);
  if(uVariant==2)z=mat2(1,0,1,1)*z;
  vec2 cell=floor(z),w=fract(z)-.5;float hand=mod(cell.x+cell.y,2.0)*2.0-1.0;
  vec2 carrier=cell;if(uVariant==2)carrier.x-=carrier.y;
  float ph=TAU*dot(wind,carrier/n)-2.0*t;
  if(uKind==30){
   float theta=PI*.25+(.15+.085*a)*PI*sin(ph);
   vec2 e=rot(hand*theta)*w;float size=.475/(abs(cos(theta))+abs(sin(theta)));
   vec2 dx=rot(hand*theta)*dFdx(z),dy=rot(hand*theta)*dFdy(z);
   for(int j=0;j<5;j++)if(float(j)<uLayers){
    float k=float(j);mat2 turn=rot((uVariant==3?hand*.17*sin(ph-k*.7):0.0));vec2 v=turn*e;
    vec2 outer=vec2(size*pow(.72,k)),inner=outer*.72;
    float d=box(v,outer),di=box(v,inner),aa=boxAA(v,outer,turn*dx,turn*dy),ai=boxAA(v,inner,turn*dx,turn*dy);
    ink=max(ink,pow(.78,k)*torusStroke(d,j==0?.009:.004,aa));
    wash=max(wash,(j%2==0?.91:.12)*max(0.0,smoothstep(-ai,ai,di)-smoothstep(-aa,aa,d)));
   }
   for(int j=0;j<4;j++){
    vec2 c=vec2(j<2?-size:size,j%2==0?-size:size),delta=e-c;
    vec2 g=delta/max(length(delta),.00001);float aa=max(.00001,.6*(abs(dot(g,dx))+abs(dot(g,dy))));
    ink=max(ink,1.0-smoothstep(.016-aa,.016+aa,length(delta)));
   }
   if(uVariant==2)ink=max(ink,.4*stroke(cos(TAU*z.x)+cos(TAU*z.y),.02));
  }else if(uKind==39){
   float exponent=2.0+(2.0+4.0*a)*(.5+.5*cos(ph));
   vec2 e=abs(rot(hand*(PI*.125+PI*.10*sin(ph)))*w);
   float r=pow(pow(e.x,exponent)+pow(e.y,exponent),1.0/exponent);
   for(int j=0;j<5;j++)if(float(j)<uLayers)ink=max(ink,pow(.80,float(j))*stroke(r-(.40-.075*float(j)),j==0?.01:.005));
   wash=(fill(r-.40)-fill(r-.325))*.91+(fill(r-.25)-fill(r-.175))*.68;
   if(uVariant==3){vec2 f=fract(mat2(2,1,1,2)*z)-.5;ink=max(ink,.55*ring(f,.12,.005)*fill(r-.17));}
  }else if(uKind==35){
   float turn=ph;vec2 e=rot(turn)*w;
   for(int j=0;j<4;j++){
    float k=float(j),angle=PI*.5*k;
    vec2 centre=.23*cis(angle);
    if(uVariant==3)centre=vec2(.23*cos(angle+ph),.23*sin(angle+2.0*ph));
    for(int l=0;l<5;l++)if(float(l)<uLayers)ink=max(ink,pow(.67,float(l))*ring(e-centre,.135-.020*float(l),l==0?.009:.0035));
    vec2 orbit=e-centre;
    wash=max(wash,(.12+.76*(.5+.5*cos(angle-ph)))*fill(length(orbit)-.135));
    ink=max(ink,fill(length(e-centre-.135*cis(-ph+angle))-.018));
   }
  ink=max(ink,.42*stroke(cos(TAU*z.x)-cos(TAU*z.y),.019)*(1.0-fill(length(w)-.38)));
  ink=max(ink,toralRails(b,wind,dual,ph,.25));
  }else{
   // Cell identity and its orbital phase jump across the periodic seams.
   // Differentiate the continuous chart once, then the circles analytically.
   // Differentiating w-centre instead creates stray square-shaped boundaries.
   vec2 dx=dFdx(z),dy=dFdy(z),radial=w/max(length(w),1e-7);
   vec2 radialPixel=vec2(dot(radial,dx),dot(radial,dy));
   for(int j=0;j<5;j++)if(float(j)<uLayers){
    float k=float(j),theta=ph+TAU*k/uLayers;
    vec2 centre;
    if(uVariant==1)centre=vec2(.32*cos(theta),.25*sin(2.0*theta));
    else if(uVariant==2)centre=(.20+.035*k)*cis(theta);
    else centre=vec2(.34*sin(theta),.28*sin(theta+PI*.5*cos(ph)));
    float radius=.050+.042*(.5+.5*sin(ph-k));
    vec2 delta=w-centre,g=delta/max(length(delta),1e-7);
    vec2 pixel=vec2(dot(g,dx),dot(g,dy));
    float d=length(delta)-radius;
    ink=max(ink,(.25+.75*mod(k,2.0))*torusEdgeCDF(-d,pixel));
    ink=max(ink,torusCoverage(d,.004,pixel));
    wash=max(wash,.7*torusCoverage(length(w)-length(centre),.008,radialPixel));
    ink=max(ink,.50*torusCoverage(d-.025,.003,pixel));
   }
   if(uVariant==2)ink=max(ink,.38*torusCoverage(length(w)-.26,.003,radialPixel));
   else{
    vec2 g=vec2(-.22*TAU*cos(TAU*w.x+ph),1);
    ink=max(ink,.40*torusCoverage(w.y-.22*sin(TAU*w.x+ph),.003,vec2(dot(g,dx),dot(g,dy))));
   }
  }
 }else if(uKind==34||uKind==38||uKind==10){
  vec2 z=TAU*shear(b,t,.35*a,uVariant==2?2:1);
  float X=dot(wind,z),Y=dot(dual,z),f;
  if(uKind==38){
   vec2 c=fract(q)-.5;float h=(.35+.32*a)*sin(phase);
   float g=c.x*c.y-h*(.25-dot(c,c));vec2 grad=vec2(c.y,c.x)+2.0*h*c;
   float d=g/max(length(grad),.06);
   for(int j=0;j<5;j++)if(float(j)<uLayers){float k=float(j);ink=max(ink,pow(.69,k)*stroke(abs(d)-.032*k,j==0?.010:.004));}
   if(uVariant==2)ink=max(ink,.6*stroke(c.x*c.x-c.y*c.y+.10*sin(phase),.004));
   if(uVariant==3){float order=step(0.0,sin(phase));ink*=.60+.40*mix(step(0.0,c.x*c.y),step(c.x*c.y,0.0),order);}
   wash=fill(abs(d)-.032*(uLayers-.25))*(.18+.75*fill(-g));
   ink=max(ink,toralRails(b,wind,dual,phase,.38));
  }else{
   float C=uKind==34?3.0:4.0;
   f=cos(C*X)+cos(C*Y)+(.2+.65*a)*sin(t);
   if(uVariant>=2)f+=(.25+.20*uBalance)*cos(C*(X+Y)-t);
   if(uVariant==3)for(int j=1;j<5;j++)if(float(j)<uLayers)f+=pow(.29,float(j))*cos(C*pow(2.0,float(j))*X+float(j)*t)*cos(C*pow(2.0,float(j))*Y);
   ink=max(stroke(f,.046),.76*contours(f,2.0+1.5*uLayers,.033));
   wash=.86*fill(f-.18)*fill(-f-1.25);
   ink=max(ink,.28*toralRails(b,wind,dual,phase,.65));
  }
 }else if(uKind==41){
  float u=vAngles.x,v=vAngles.y,beta=atan(1.8+3.0*cos(v),2.4*sin(v));
  float density=uVariant==1?1.0:2.0*floor(2.0+uDensity*.025);
  float h=density*(u+beta)/TAU-t/TAU,k=density*(u-beta)/TAU+t/TAU;
  float db=-2.4/(3.0+1.8*cos(v));
  float aa0=max(.0001,.7*density/TAU*(abs(dFdx(u)+db*dFdx(v))+abs(dFdy(u)+db*dFdy(v))));
  float aa1=max(.0001,.7*density/TAU*(abs(dFdx(u)-db*dFdx(v))+abs(dFdy(u)-db*dFdy(v))));
  float width=uVariant==1?.006:.019+uInk*.085;
  float one=1.0-smoothstep(width-aa0,width+aa0,abs(fract(h+.5)-.5));
  float two=1.0-smoothstep(width-aa1,width+aa1,abs(fract(k+.5)-.5));
  one=mix(one,2.0*width,smoothstep(.3,.8,aa0));two=mix(two,2.0*width,smoothstep(.3,.8,aa1));
  if(uVariant==3){one=max(one,repeatLine(3.0*h,.024));two=max(two,repeatLine(3.0*k,.024));}
  ink=max(one*smoothstep(0.0,.45,1.0-uBalance),two*smoothstep(0.0,.45,uBalance));
  if(uVariant==2){float bead=length(vec2(sin(TAU*h),sin(TAU*k)));ink=max(ink,fill(bead-.15));}
 }else if(uKind==19){
  vec4 f=spectrum(vAngles.y);vec4 m=uSpectral==2?vec4(2,3,4,5):vec4(1,2,3,4);
  vec4 angles=m*vAngles.x+vec4(-t,t,-2.0*t,2.0*t);
  float field;
  if(uVariant==1)field=mix(f.x*cos(angles.x),f.y*cos(angles.y),uBalance);
  else if(uVariant==3)field=f[int(floor(uBalance*3.999))]*cos(angles[int(floor(uBalance*3.999))]);
  else field=dot(f*cos(angles),vec4(.7,.45+.2*a*sin(t),.28+.12*a*cos(t),.17));
  float spacing=(3.0+uLayers*2.5)*sqrt(uDensity/88.0);
  if(uVariant==2)ink=max(stroke(field,.008),.57*contours(field,spacing,.026));
  else if(uVariant==4){vec2 z=vec2(field,dot(f*sin(angles),vec4(.7,.45,.28,.17)));float ph=atan(z.y,z.x);ink=max(repeatLine(ph*4.0/TAU,.035),.4*contours(length(z),spacing,.024));}
  else ink=contours(field,spacing,.052);
  wash=.87*fill(field+.08)*fill(-field-.58);
  ink=max(ink,.24*toralRails(b,wind,dual,phase,.70));
 }else if(uKind==15||uKind==16||uKind==18){
  vec2 z=area,zx=dFdx(area),zy=dFdy(area);shearFrame(z,zx,zy,t,a,1+int(uLayers));
  vec2 angles=z*TAU;
  float X=dot(wind,angles),Y=dot(dual,angles);
  vec2 xd=TAU*vec2(dot(wind,zx),dot(wind,zy)),yd=TAU*vec2(dot(dual,zx),dot(dual,zy));
  if(uKind==15){
   float f=(uVariant==2?X+.18*sin(3.0*Y-t):X);
   vec2 fd=xd;if(uVariant==2)fd+=.54*cos(3.0*Y-t)*yd;
   if(uVariant==3){f+=.13*sin(5.0*X+2.0*Y+t);fd+=.13*cos(5.0*X+2.0*Y+t)*(5.0*xd+2.0*yd);}
   float count=2.0*floor(5.0+.20*uDensity);
   ink=filteredLine(f/TAU*count,.052+uInk*.26*pow(.5+.5*cos(2.0*Y-t),2.0),fd/TAU*count);
   if(uVariant==2){float count=2.0*floor(4.0+.125*uDensity);ink=max(ink,.5*filteredLine(Y/TAU*count,.023,yd/TAU*count));}
   ink=max(ink,.24*toralRails(b,wind,dual,t,.70));
  }else if(uKind==16){
   float f=cos(X)+(.35+.4*uBalance)*cos(2.0*Y)+.21*a*cos(3.0*X-2.0*Y+t);
   vec2 fd=-sin(X)*xd-2.0*(.35+.4*uBalance)*sin(2.0*Y)*yd-.21*a*sin(3.0*X-2.0*Y+t)*(3.0*xd-2.0*yd);
   float curvature=dot(xd,xd)+4.0*(.35+.4*uBalance)*dot(yd,yd)+.21*a*dot(3.0*xd-2.0*yd,3.0*xd-2.0*yd);
   if(uVariant==2){f+=.31*a*sin(2.0*X+Y-t);fd+=.31*a*cos(2.0*X+Y-t)*(2.0*xd+yd);curvature+=.31*a*dot(2.0*xd+yd,2.0*xd+yd);}
   if(uVariant==3)for(int j=1;j<5;j++)if(float(j)<uLayers){
    float k=float(j),m=pow(2.0,k),weight=pow(.3,k),A=m*X+t,B=m*Y;
    f+=weight*cos(A)*cos(B);fd-=weight*m*(sin(A)*cos(B)*xd+cos(A)*sin(B)*yd);
    curvature+=weight*m*m*(dot(xd,xd)+dot(yd,yd));
   }
   float aa=max(.00001,.5*(abs(fd.x)+abs(fd.y))+.125*curvature),spacing=(6.0+4.0*uLayers)*sqrt(uDensity/88.0);
   ink=max(torusStroke(f,.012,aa),.90*torusPeriodic(f*spacing,.038,2.0*aa*spacing));
   wash=.84*(1.0-smoothstep(-aa,aa,f+.06))*(1.0-smoothstep(-aa,aa,-f-.72));
   ink=max(ink,.20*toralRails(b,wind,dual,t,.75));
  }else{
   vec2 e=cis(X)+(.68+.13*a*cos(t))*cis(Y-2.0*t)+.27*cis(2.0*X-Y+t);
   vec2 dX=cis(X+PI*.5),dY=(.68+.13*a*cos(t))*cis(Y-2.0*t+PI*.5),dZ=.27*cis(2.0*X-Y+t+PI*.5);
   vec2 dx=dX*xd.x+dY*yd.x+dZ*(2.0*xd.x-yd.x),dy=dX*xd.y+dY*yd.y+dZ*(2.0*xd.y-yd.y);
   if(uVariant==2){e+=.31*cis(3.0*X+Y-t);vec2 g=.31*cis(3.0*X+Y-t+PI*.5);dx+=g*(3.0*xd.x+yd.x);dy+=g*(3.0*xd.y+yd.y);}
   if(uVariant==3)for(int j=1;j<5;j++)if(float(j)<uLayers){float k=float(j),m=pow(2.0,k),weight=pow(.27,k);e+=weight*cis(m*X+Y+k*t);vec2 g=weight*cis(m*X+Y+k*t+PI*.5);dx+=g*(m*xd.x+yd.x);dy+=g*(m*xd.y+yd.y);}
   float rr=max(dot(e,e),.00001),r=sqrt(rr),arms=4.0+2.0*uLayers;
   float ph=arms*atan(e.y,e.x)+(3.0+8.0*a)*log(r)+t;
   float twist=3.0+8.0*a;
   float gx=(arms*(e.x*dx.y-e.y*dx.x)+twist*dot(e,dx))/rr;
   float gy=(arms*(e.x*dy.y-e.y*dy.x)+twist*dot(e,dy))/rr;
   ink=filteredLine(ph/PI,asin(.13)/PI,vec2(gx,gy)/PI)*smoothstep(.01,.08,r);
   wash=.76*fill(cos(2.0*atan(e.y,e.x)+t)-.52);
   ink=max(ink,.22*toralRails(b,wind,dual,t,.70));
  }
 }else{
  // Integer winding phases close around both non-contractible torus cycles.
  vec2 z=area,zx=dFdx(area),zy=dFdy(area);shearFrame(z,zx,zy,t,a,uVariant==3?3:1);vec2 angle=TAU*z;
  float X=dot(wind,angle),Y=dot(dual,angle),D=2.0*floor(1.0+uDensity*.013);
  vec2 xd=TAU*vec2(dot(wind,zx),dot(wind,zy)),yd=TAU*vec2(dot(dual,zx),dot(dual,zy));
  if(uKind==0){
   float x=q.x+.10*sin(TAU*dot(wind,b)),y=q.y/2.0;float one=0.0,two=0.0;
   float sway=(.20+.1*a)*sin(TAU*y+.28*sin(phase));
   float count=uVariant==2?5.0:3.0;
   for(int j=0;j<5;j++)if(float(j)<count){float offset=(float(j)-(count-1.0)*.5)*.047;one=max(one,repeatLine(x+sway+offset,.012));two=max(two,repeatLine(x-sway+offset,.012));}
   float ca=repeatLine(x+sway,.15),cb=repeatLine(x-sway,.15);float order=step(0.0,cos(TAU*y));
   one=mix(one,.88*ca*(1.0-.65*one),uInk);two=mix(two,.18*cb+.82*two,uInk);
   ink=mix(one+two*(1.0-ca),two+one*(1.0-cb),order);
   if(uVariant==3)ink=max(ink,.40*repeatLine(3.0*x+.3*sin(TAU*y+phase),.015));
  }else if(uKind==17||uKind==13){
   float x=D*X/TAU,y=D*Y/TAU;
   if(uVariant==2){x+=.22*sin(2.0*Y-t);y+=.22*sin(2.0*X+t);}
   float dh=abs(fract(x+.5)-.5),dk=abs(fract(y+.5)-.5);
   float strands=2.0*uLayers+1.0;
   float one=repeatLine((fract(x+.5)-.5)*(strands-1.0)/.27,.070)*fill(dh-.15);
   float two=repeatLine((fract(y+.5)-.5)*(strands-1.0)/.27,.070)*fill(dk-.15);
   float shadeOne=uKind==13?.22:.84,shadeTwo=uKind==13?.88:.20;
   if(uPalette==1){float swap=shadeOne;shadeOne=shadeTwo;shadeTwo=swap;}
   one=mix(one,shadeOne*(1.0-.62*one)*fill(dh-.15),uInk);
   two=mix(two,shadeTwo*(1.0-.62*two)*fill(dk-.15),uInk);
   float order=mod(floor(x+.5)+floor(y+.5),2.0);
   if(uKind==13&&uVariant==1){ink=max(repeatLine(x,.040),repeatLine(y,.040));}
   else ink=mix(one+two*(1.0-fill(dh-.18)),two+one*(1.0-fill(dk-.18)),order);
   if(uVariant==3)ink=max(ink,.43*repeatLine((X+Y)*D/TAU,.020));
   ink=max(ink,.18*toralRails(b,wind,dual,phase,.80));
  }else if(uKind==4){
   float f=X+.24*a*sin(3.0*Y-t)+.13*sin(5.0*X+2.0*Y+t);
   vec2 fd=xd+.72*a*cos(3.0*Y-t)*yd+.13*cos(5.0*X+2.0*Y+t)*(5.0*xd+2.0*yd);
   if(uVariant==2){f=X+.20*sin(4.0*Y+t)*cos(3.0*X-t);fd=xd+.8*cos(4.0*Y+t)*cos(3.0*X-t)*yd-.6*sin(4.0*Y+t)*sin(3.0*X-t)*xd;}
   if(uVariant==3){f=X+.24*sin(3.0*Y-t)+.13*sin(6.0*Y+2.0*t)+.07*sin(12.0*Y-3.0*t);fd=xd+(.72*cos(3.0*Y-t)+.78*cos(6.0*Y+2.0*t)+.84*cos(12.0*Y-3.0*t))*yd;}
   float count=2.0*floor(8.0+.275*uDensity);
   ink=filteredLine(f/TAU*count,.046+uInk*.22*pow(.5+.5*cos(2.0*Y-t),2.0),fd/TAU*count);
   ink=max(ink,.40*filteredLine((Y+.17*sin(4.0*X+t))/TAU*(6.0+2.0*uLayers),.024,(yd+.68*cos(4.0*X+t)*xd)/TAU*(6.0+2.0*uLayers)));
   ink=max(ink,.22*toralRails(b,wind,dual,t,.75));
  }else{
   float f=X+.07*a*sin(3.0*Y-t);
   vec2 fd=xd+.21*a*cos(3.0*Y-t)*yd;
   if(uVariant>=2){f+=.05*sin(7.0*Y+2.0*t);fd+=.35*cos(7.0*Y+2.0*t)*yd;}
   if(uVariant==3){f+=.026*sin(13.0*Y-3.0*t);fd+=.338*cos(13.0*Y-3.0*t)*yd;}
   float count=2.0*floor(6.0+.225*uDensity);
   ink=filteredLine(f/TAU*count,.046+uInk*.23*pow(.5+.5*cos(3.0*Y-t),2.0),fd/TAU*count);
   if(uVariant>=2)ink=max(ink,.55*filteredLine((f+.035)/TAU*count,.018,fd/TAU*count));
   ink=max(ink,.20*toralRails(b,wind,dual,t,.78));
  }
 }
 if(uPalette==2)wash*=.68;
 if(uPalette==3)wash*=.05;
 // One contrast breath per flow lap; the selected fourth degenerate mode
 // completes two temporal periods in the same interval.
 float contrast=uKind==19&&uContrastCycle==1?.5-.5*cos(t):uInk;
 ink=mix(ink,max(wash,ink*(1.0-wash*.80)),contrast);
 float fade=.12*smoothstep(4.5,9.0,length(vec3(3.65,0,0)-vPosition));
 fragColor=vec4(vec3(1.0-clamp(ink,0.0,1.0)*(.96-fade)),1);
}`;
  async function create(gl,vao,count){
    // A study keeps its full dynamic parameter space. Only its identity is
    // constant, removing unrelated spectral/recursive fields from the driver
    // program and avoiding their register and compilation costs.
    const kinds=new Set([0,4,7,10,13,14,15,16,17,18,19,30,34,35,38,39,41,47,49,50,51,53]),programs=new Map(),pending=new Map();
    const names=['uViewProjection','uTime','uWave','uDensity','uKind','uVariant','uWinding','uLayers','uBalance','uSpectral','uSpectrum','uInk','uPalette','uContrastCycle'];
    function prepare(kind){
      if(!kinds.has(kind))return Promise.reject(Error('Unknown topology study'));
      if(programs.has(kind))return Promise.resolve(programs.get(kind));
      if(pending.has(kind))return pending.get(kind);
      const fragment=TorusLight.fragment(TorusPrograms.specialize(fragmentSource,{uKind:kind}),false);
      const task=TorusPrograms.link(gl,vertexSource,fragment).then(program=>{
        const uniforms={};for(const key of names)uniforms[key]=gl.getUniformLocation(program,key);
        const value={program,uniforms};programs.set(kind,value);return value;
      }).finally(()=>pending.delete(kind));
      pending.set(kind,task);return task;
    }
    const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,512,3,0,gl.RGBA,gl.FLOAT,new Float32Array(TORUS_SPECTRUM.samples));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    return {prepare,draw(matrix,time,wave,density,kind,variant,options){
      const ready=programs.get(kind);if(!ready)throw Error('Prepare the topology study before drawing');const {program,uniforms}=ready;
      gl.useProgram(program);TorusLight.bind(gl,program,options,time);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.uniformMatrix4fv(uniforms.uViewProjection,false,matrix);gl.uniform1i(uniforms.uSpectrum,2);
      gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uWave,wave);gl.uniform1f(uniforms.uDensity,density);
      gl.uniform1i(uniforms.uKind,kind);gl.uniform1i(uniforms.uVariant,variant);gl.uniform1i(uniforms.uWinding,options.winding);
      gl.uniform1f(uniforms.uLayers,options.layers);gl.uniform1f(uniforms.uBalance,options.balance);gl.uniform1i(uniforms.uSpectral,options.spectral);
      gl.uniform1f(uniforms.uInk,options.ink);gl.uniform1i(uniforms.uPalette,options.palette);
      gl.uniform1i(uniforms.uContrastCycle,kind===19?options.inkCycle||0:0);
      gl.drawElements(gl.TRIANGLES,typeof count==='function'?count():count,gl.UNSIGNED_INT,0);
    }};
  }
  return {create};
})();
