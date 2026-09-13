/* Periodic substitutions, changing adjacency, and shared figure-ground dynamics. */
const TorusMetamorphosis = (()=>{
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
uniform float uTime,uWave,uDensity,uLayers,uBalance,uInk;
uniform highp int uKind,uVariant,uWinding,uSpectral;
uniform highp sampler2D uSpectrum;
in vec3 vPosition;
in vec2 vAngles;
out vec4 fragColor;
const float PI=3.14159265359,TAU=6.28318530718;
mat2 rot(float a){return mat2(cos(a),sin(a),-sin(a),cos(a));}
float fill(float d){float aa=max(.0002,.72*fwidth(d));return 1.0-smoothstep(-aa,aa,d);}
float stroke(float d,float w){return torusStroke(d,w,max(.0002,.65*fwidth(d)));}
float line(float d,float w){return torusPeriodic(d,w,fwidth(d));}
float box(vec2 p,float s){vec2 d=abs(p)-s;return length(max(d,0.0))+min(max(d.x,d.y),0.0);}
float lens(vec2 p,float h){float c=(1.0-h*h)/(2.0*h);return length(vec2(p.x,abs(p.y)+c))-(c+h);}
float boxCoverage(vec2 p,float halfSize,vec2 dx,vec2 dy){
 return torusCoverage(p.x,halfSize,vec2(dx.x,dy.x))*torusCoverage(p.y,halfSize,vec2(dx.y,dy.y));
}
float boxContour(vec2 p,float halfSize,float width,vec2 dx,vec2 dy){
 return max(0.0,boxCoverage(p,halfSize+width,dx,dy)-boxCoverage(p,halfSize-width,dx,dy));
}
vec2 radialGradient(vec2 p,vec2 dx,vec2 dy){return vec2(dot(p,dx),dot(p,dy))/max(length(p),1e-7);}
vec2 lensGradient(vec2 p,float h,vec2 dx,vec2 dy){
 float c=(1.0-h*h)/(2.0*h);vec2 v=vec2(p.x,abs(p.y)+c),normal=vec2(v.x,sign(p.y)*v.y)/max(length(v),1e-7);
 return vec2(dot(normal,dx),dot(normal,dy));
}
vec2 wind(){if(uWinding==0)return vec2(1,0);if(uWinding==1)return vec2(1,1);if(uWinding==2)return vec2(2,3);return vec2(3,5);}
vec2 shear(vec2 z,float t,float amount){
 z.x+=amount*sin(TAU*2.0*z.y+sin(t));z.y+=amount*.82*sin(TAU*3.0*z.x-cos(t));
 z.x+=amount*.46*sin(TAU*5.0*z.y+sin(2.0*t));return z;
}
float eyeTone(vec2 e,float ph,float level){
 float h=.32+.11*sin(ph),d=lens(e,h),r=length(e),theta=atan(e.y,e.x);
 float polar=.5+.5*cos(12.0*theta-2.0*ph+3.0*sin(5.0*r-ph));
 float iris=fill(r-(.27+.025*cos(ph))),pupil=fill(r-.078);
 float pigment=.16+.76*smoothstep(-.45,.45,sin(ph+level*1.6));
 float tone=mix(.98,.12+.70*polar,iris);tone=mix(tone,pigment,pupil);
 tone=mix(tone,.025,stroke(d,.018));tone=mix(tone,.07,stroke(r-.30,.012)*fill(d));
 return tone;
}
float lightWave(vec3 p);
float eyeToneFrame(vec2 e,vec2 ex,vec2 ey,float ph,vec2 pg,float level){
 float h=.32+.11*sin(ph),c=(1.0-h*h)/(2.0*h),d=lens(e,h),r=max(length(e),1e-7),theta=atan(e.y,e.x);
 vec2 dr=radialGradient(e,ex,ey),dt=vec2(e.x*ex.y-e.y*ex.x,e.x*ey.y-e.y*ey.x)/(r*r);
 float carrier=12.0*theta-2.0*ph+3.0*sin(5.0*r-ph);
 vec2 dc=12.0*dt-2.0*pg+3.0*cos(5.0*r-ph)*(5.0*dr-pg);
 float polar=.5+.5*lightWave(vec3(carrier,dc));
 float iris=torusEdgeCDF(.27+.025*cos(ph)-r,dr+.025*sin(ph)*pg),pupil=torusEdgeCDF(.078-r,dr);
 float pigment=.16+.76*smoothstep(-.45,.45,sin(ph+level*1.6));
 float tone=mix(.98,.12+.70*polar,iris);tone=mix(tone,pigment,pupil);
 float dh=((abs(e.y)+c)/max(length(vec2(e.x,abs(e.y)+c)),1e-7)-1.0)*(-.5-.5/(h*h))-1.0;
 vec2 dd=lensGradient(e,h,ex,ey)+dh*.11*cos(ph)*pg;
 tone=mix(tone,.025,torusCoverage(d,.018,dd));tone=mix(tone,.07,torusCoverage(r-.30,.012,dr)*torusEdgeCDF(-d,dd));
 return tone;
}
float wovenFrame(vec2 q,vec2 qx,vec2 qy,float phase,vec2 phaseGradient,float width,float detail){
 float x=q.x+.18*sin(TAU*q.y+phase),y=q.y+.18*sin(TAU*q.x-phase);
 vec2 dx=vec2(qx.x,qy.x)+.18*cos(TAU*q.y+phase)*(TAU*vec2(qx.y,qy.y)+phaseGradient);
 vec2 dy=vec2(qx.y,qy.y)+.18*cos(TAU*q.x-phase)*(TAU*vec2(qx.x,qy.x)-phaseGradient);
 float A=torusPeriodic(x,width,dx),B=torusPeriodic(y,width,dy);
 float evenX=torusPeriodic(x*.5,.25,.5*dx),evenY=torusPeriodic(y*.5,.25,.5*dy),order=evenX*evenY+(1.0-evenX)*(1.0-evenY);
 float one=mix(.09,.78,.5+.5*sin(phase)),two=mix(.78,.09,.5+.5*sin(phase));
 float tone=mix(1.0,one,A);tone=mix(tone,two,B*(1.0-A*order));
 float etch=max(torusPeriodic(x+width,.015,dx),torusPeriodic(x-width,.015,dx))+max(torusPeriodic(y+width,.015,dy),torusPeriodic(y-width,.015,dy));
 return mix(tone,.10,clamp(etch,0.0,1.0)*.75)+detail*.065*sin(TAU*3.0*x)*sin(TAU*3.0*y)*A*B;
}
float woven(vec2 q,float phase,float width,float detail){return wovenFrame(q,dFdx(q),dFdy(q),phase,vec2(dFdx(phase),dFdy(phase)),width,detail);}
vec4 spectrum(float v){float x=fract(v/TAU)*512.0;int i=int(x);return mix(texelFetch(uSpectrum,ivec2(i,uSpectral),0),texelFetch(uSpectrum,ivec2((i+1)%512,uSpectral),0),fract(x));}
void main(){
 float t=uTime,a=uWave;vec2 w=wind(),dual=vec2(-w.y,w.x);
 vec2 b=vec2(vAngles.x/TAU,(vAngles.y-2.0*atan(sin(vAngles.y)/(3.0+cos(vAngles.y))))/TAU+t/TAU);
 if(uVariant==1)b.x+=b.y;if(uVariant==2)b.x-=b.y;
 float X=TAU*dot(w,b),Y=TAU*dot(dual,b),ph=X-2.0*t+.65*sin(Y+t);
 vec2 phaseGradient=vec2(dFdx(ph),dFdy(ph));
 vec2 z=shear(b,t,.028+.032*a),n=vec2(2.0*floor(3.0+uDensity*.045));
 vec2 q=z*n,p=fract(q)-.5,id=floor(q);float tone=1.0;
 if(uKind==0||uKind==1){
  // Successive invertible shears make adjoining tile boundaries move together.
  vec2 e=q;e.x+=(.20+.08*a*sin(ph))*sin(TAU*e.y)+.07*cos(2.0*TAU*e.y+t);
  e.y+=(.19+.08*a*cos(ph))*sin(TAU*e.x)+.045*sin(2.0*TAU*e.x-t);
  vec2 tile=floor(e),local=fract(e)-.5;float parity=mod(tile.x+tile.y,2.0);
  float rhythm=.5+.5*sin(ph+PI*parity),dark=.08+.26*rhythm;
  tone=mix(dark,.98,parity);
  float rim=stroke(min(.5-abs(local.x),.5-abs(local.y)),.009);
  tone=mix(tone,1.0-tone,rim*.72);
  if(uKind==1){
   vec2 head=local-vec2(parity<.5?.25:-.25,.12);float eye=fill(length(head)-.031);
   float wing=stroke(local.y+.07-.18*cos(PI*local.x/.5),.012)*fill(abs(local.x)-.33);
   tone=mix(tone,1.0-tone,max(eye,wing));
  }else{
   float contour=box(rot(.28*sin(ph))*local,.31+.04*cos(ph));
   float shells=max(stroke(contour,.008),.65*stroke(contour+.095,.006));
   tone=mix(tone,1.0-tone,shells);
  }
 }else if(uKind==2){
  float A=PI*q.x,B=PI*q.y,m=.78*sin(ph);
  float f=cos(A)*cos(B)+m*sin(A)*sin(B);
  tone=mix(.98,.09,fill(f));
  float ribs=line(f*(3.0+uLayers),.026);
  tone=mix(tone,1.0-tone,ribs*.83);
  float centre=sin(A)*sin(B);tone=mix(tone,.58,fill(abs(f)-.17)*fill(-centre));
 }else if(uKind==3){
  vec2 weave=vec2(2.0*X+Y,2.0*Y-X)/TAU*2.0;
  float twist=.36*a*sin(t);weave.x+=twist*sin(TAU*weave.y);weave.y-=twist*sin(TAU*weave.x);
  tone=woven(weave,ph,.18+.055*sin(Y-t),1.0);
 }else if(uKind==4){
  vec2 e=b*vec2(n.x,2.0*floor(n.x/3.0));float mask=1.0;
  vec2 ex=dFdx(e),ey=dFdy(e);
  for(int j=0;j<5;j++){
   if(float(j)>=uLayers)break;float k=float(j);vec2 local=fract(e)-.5;
   mat2 rotation=rot(.25*sin(ph-k));vec2 f=rotation*local,da=.25*cos(ph-k)*phaseGradient;
   vec2 fx=rotation*ex+vec2(-f.y,f.x)*da.x,fy=rotation*ey+vec2(-f.y,f.x)*da.y;
   float visible=1.0-smoothstep(.06,.30,max(length(ex),length(ey)));
   float pigment=.12+.80*(.5+.5*cos(ph-k*1.2+PI*mod(floor(e.x)+floor(e.y),2.0)));
   tone=mix(tone,pigment,mask*boxCoverage(f,.36,fx,fy)*visible);tone=mix(tone,1.0-pigment,mask*boxContour(f,.36,.012,fx,fy)*visible);
   mask*=boxCoverage(f,.325,fx,fy);e=mat2(2,1,1,1)*e+vec2(.06*sin(t+k),.06*cos(t-k));ex=mat2(2,1,1,1)*ex;ey=mat2(2,1,1,1)*ey;
  }
 }else if(uKind==5){
  // A true ternary carpet, advected by a smooth periodic diffeomorphism.
  vec2 e=shear(b,t,.06*a)*max(2.0,2.0*floor(n.x/6.0));float surviving=1.0;
  vec2 carpetDx=dFdx(e),carpetDy=dFdy(e);
  tone=.10;
  for(int j=0;j<5;j++){
   if(float(j)>=uLayers)break;float k=float(j);
   // Retain both screen directions of the continuous chart. Collapsing them
   // to fwidth over-blurs oblique square edges and thins their distant rims.
   vec2 gx=vec2(carpetDx.x,carpetDy.x),gy=vec2(carpetDx.y,carpetDy.y);
   float hole=torusPeriodic(e.x-.5,1.0/6.0,gx)*torusPeriodic(e.y-.5,1.0/6.0,gy);
   float outer=torusPeriodic(e.x-.5,1.0/6.0+.014,gx)*torusPeriodic(e.y-.5,1.0/6.0+.014,gy);
   float inner=torusPeriodic(e.x-.5,1.0/6.0-.014,gx)*torusPeriodic(e.y-.5,1.0/6.0-.014,gy);
   float pigment=.16+.80*(.5+.5*sin(ph-k*1.35));
   tone=mix(tone,pigment,hole*surviving);tone=mix(tone,.97,max(0.0,outer-inner)*surviving);
   surviving*=1.0-hole;e*=3.0;carpetDx*=3.0;carpetDy*=3.0;
  }
 }else if(uKind==6){
  vec2 e=(2.0*max(1.0,floor(.8+uDensity*.012)))*vec2(X,Y)/TAU;float mask=1.0;
  vec2 ex=dFdx(e),ey=dFdy(e);
  for(int j=0;j<5;j++){
   if(float(j)>=uLayers)break;float k=float(j),edge=.22-.015*k;
   float pass=1.0-max(torusPeriodic(e.x,.30,vec2(ex.x,ey.x)),torusPeriodic(e.y,.30,vec2(ex.y,ey.y)));
   float v=1.0-smoothstep(.08,.35,max(length(ex),length(ey)));
   tone=mix(tone,wovenFrame(e,ex,ey,ph-k*.9,phaseGradient,edge,0.0),mask*v);mask*=pass;e=2.0*e+vec2(.07*sin(t+k),.07*cos(t-k));ex*=2.0;ey*=2.0;
  }
 }else if(uKind==7){
  float columns=4.0*floor(2.0+uDensity*.026);vec2 e=shear(b,t,.016*a)*vec2(columns,columns*.75);float parent=1.0;
  float connection=stroke(sin(TAU*e.y)-.27*sin(TAU*e.x)*sin(ph),.055);tone=mix(1.0,.15,connection*.7);
  vec2 ex=dFdx(e),ey=dFdy(e);
  for(int j=0;j<5;j++){
   if(float(j)>=uLayers)break;float k=float(j);vec2 local=(fract(e)-.5)/vec2(.49,.70);
   mat2 rotation=rot(.20*sin(ph-k));local=rotation*local;vec2 da=.20*cos(ph-k)*phaseGradient;
   vec2 lx=rotation*(ex/vec2(.49,.70))+vec2(-local.y,local.x)*da.x,ly=rotation*(ey/vec2(.49,.70))+vec2(-local.y,local.x)*da.y;
   vec2 dg=lensGradient(local,.44,lx,ly);float distance=lens(local,.44),body=torusEdgeCDF(-distance,dg);
   float vis=1.0-smoothstep(.06,.25,max(length(ex),length(ey)));
   tone=mix(tone,eyeToneFrame(local,lx,ly,ph-k*.9,phaseGradient,k),parent*body*vis);
   tone=mix(tone,.035,parent*torusCoverage(distance,.012,dg)*vis);
   parent*=torusEdgeCDF(-lens(local,.28),lensGradient(local,.28,lx,ly));e=3.0*e+vec2(.03*sin(t+k),0);ex*=3.0;ey*=3.0;
  }
 }else if(uKind==8){
  vec2 e=q;float radius=length(p),theta=atan(p.y,p.x)+ph;
  float sector=mod(theta+PI/6.0,PI/3.0)-PI/6.0;vec2 local=(radius*vec2(cos(sector),sin(sector))-vec2(.29,0))/vec2(.15,.20);
  tone=mix(tone,eyeTone(local,ph,0.0),fill(lens(local,.45)));
  float ring=stroke(radius-(.39+.022*cos(6.0*theta-ph)),.026);
  float lattice=sin(PI*e.x)*sin(PI*e.y);float connection=stroke(lattice,.075);
  float rhythm=.10+.78*(.5+.5*sin(ph+6.0*theta));tone=mix(tone,rhythm,max(ring,connection*(1.0-fill(radius-.40))));
  tone=mix(tone,.04,stroke(radius-.45,.005));
 }else if(uKind==9){
  vec2 e=q;vec2 local=fract(e)-.5;
  float width=(.14+.24*cos(PI*local.y)*cos(PI*local.y));
  float f=abs(local.x)/width+.20*sin(TAU*local.y+ph)+.08*sin(3.0*TAU*local.y-ph);
  float ribs=line(f*(4.0+uLayers),.075),dark=fill(cos(TAU*f*2.0-ph)-.1);
  tone=1.0-(.20+.73*dark)*fill(f-1.5);tone=mix(tone,1.0-tone,ribs);
  vec2 eye=vec2(local.x,local.y-.12)/vec2(.22,.27);tone=mix(tone,eyeTone(eye,ph,1.0),fill(lens(eye,.44)));
  float branches=stroke(sin(TAU*e.x)+.58*sin(2.0*TAU*e.y+ph),.025);tone=mix(tone,.05,branches*.65);
 }else if(uKind==10){
  vec4 f=spectrum(vAngles.y);vec4 angular=uSpectral==2?vec4(2,3,4,5):vec4(1,2,3,4);float mode=dot(f*cos(angular*vAngles.x+vec4(t,-t,2.0*t,-2.0*t)),vec4(.7,.45,.28,.15));
  vec2 e=vec2(X,Y)/TAU*(2.0*max(1.0,floor(uDensity*.025)));e.x+=.32*mode;e.y+=.20*sin(mode*3.0+t);
  tone=woven(e,ph+mode,.16+.035*sin(mode*4.0-t),1.0);tone=mix(tone,1.0-tone,stroke(mode,.012)*.8);
 }else if(uKind==11){
  vec2 e=vec2(cos(X),sin(X))+.72*vec2(cos(Y-t),sin(Y-t))+.30*vec2(cos(2.0*X-Y+t),sin(2.0*X-Y+t));
  float r=max(length(e),.0001),angle=atan(e.y,e.x),spiral=(6.0+2.0*uLayers)*angle+6.0*log(r)-2.0*t;
  float thread=.5+.5*sin(spiral);float sheet=smoothstep(.18,.82,thread);
  float aa=max(length(dFdx(e)),length(dFdy(e)))/r;sheet=mix(sheet,.5,smoothstep(.04,.18,aa));
  tone=.08+.90*sheet;tone=mix(tone,1.0-tone,stroke(sin(3.0*log(r)+t),.06));
 }else if(uKind==12){
  float frequency=max(1.0,floor(n.x/8.0));vec2 e=vec2(sin(frequency*X)+.42*sin(frequency*Y+t),sin(frequency*Y)+.42*sin(frequency*X-t));float r=max(length(e),.00001),theta=atan(e.y,e.x);
  float rho=log(r)/log(2.0)-2.0*t/TAU,level=floor(rho),s=fract(rho);
  float f=sin(TAU*s+1.6*sin(4.0*theta+t));tone=mix(.98,.10,fill(f));
  float detail=stroke(sin(8.0*theta-TAU*s+2.0*t),.07);tone=mix(tone,1.0-tone,detail*.8);
  tone=mix(tone,.95,smoothstep(.06,.2,fwidth(r)/r));
 }else if(uKind==13){
  vec2 e=b;float k=.10*a*sin(t);
  for(int j=0;j<4;j++){float l=float(j);e.x+=k*cos(TAU*(2.0+l)*e.y+t+l);e.y-=k*sin(TAU*(3.0+l)*e.x-t-l);}
  tone=woven(e*(4.0+2.0*floor(uDensity*.035)),ph,.21,1.0);
 }else if(uKind==14){
  vec2 e=q;float parent=1.0;
  vec2 ex=dFdx(e),ey=dFdy(e);
  for(int j=0;j<5;j++){
   if(float(j)>=uLayers)break;float k=float(j),A=PI*e.x,B=PI*e.y;
   float modulation=.76*sin(ph-k*.7),f=cos(A)*cos(B)+modulation*sin(A)*sin(B);
   vec2 gradient=PI*vec2(-sin(A)*cos(B)+modulation*cos(A)*sin(B),-cos(A)*sin(B)+modulation*sin(A)*cos(B));
   vec2 df=vec2(dot(gradient,ex),dot(gradient,ey))+.76*cos(ph-k*.7)*sin(A)*sin(B)*phaseGradient;
   float ribbon=torusCoverage(f,.22,df),rim=max(0.0,torusCoverage(f,.243,df)-torusCoverage(f,.197,df));float v=1.0-smoothstep(.08,.35,max(length(ex),length(ey)));
   float pigment=.12+.77*(.5+.5*sin(ph-k*1.6));tone=mix(tone,pigment,ribbon*parent*v);tone=mix(tone,1.0-pigment,rim*parent*v);
   parent*=1.0-ribbon;e=2.0*e;ex*=2.0;ey*=2.0;
  }
  }else if(uKind==15){
  // A moving quadratic Julia family pulled back along two torus characters.
  float repeats=2.0*max(1.0,floor(n.x/6.0));
  vec2 e=1.35*vec2(sin(repeats*X),sin(repeats*Y));
  vec2 c=vec2(-.69+.18*a*cos(t),.12+.36*a*sin(t));
  float count=0.0,trap=4.0,r2=0.0;
  for(int j=0;j<32;j++){
   if(float(j)>=uLayers)break;
   e=vec2(e.x*e.x-e.y*e.y,2.0*e.x*e.y)+c;
   r2=dot(e,e);trap=min(trap,abs(length(e)-.62));count+=1.0;
   if(r2>64.0)break;
  }
  float escaped=step(64.0,r2),smoothCount=count-log2(max(1.0,log2(max(r2,1.0001))));
  float bands=.5+.5*cos(PI*.82*smoothCount-ph);
  tone=mix(.10+.55*stroke(trap,.027),.10+.87*bands,escaped);
  tone=mix(tone,.97,stroke(sin(PI*smoothCount),.10)*escaped*.7);
 }else if(uKind==16){
  // Circle inversion after each square reflection, with finite AA-limited depth.
  vec2 e=shear(b,t,.018+.06*a)*2.0*max(1.0,floor(n.x/6.0));
  float weight=1.0;vec2 ex=dFdx(e),ey=dFdy(e);
  for(int j=0;j<4;j++){
   if(float(j)>=uLayers)break;float k=float(j);vec2 f=fract(e)-.5;
   mat2 rotation=rot(.18*sin(ph-k));f=rotation*f;vec2 da=.18*cos(ph-k)*phaseGradient;
   vec2 fx=rotation*ex+vec2(-f.y,f.x)*da.x,fy=rotation*ey+vec2(-f.y,f.x)*da.y;
   float r=length(f),size=.26+.055*sin(ph-k*.7);vec2 dr=radialGradient(f,fx,fy),ds=dr-.055*cos(ph-k*.7)*phaseGradient;
   float vis=1.0-smoothstep(.05,.35,max(length(ex),length(ey)));
   vec2 dp=sign(f.x*f.y)*vec2(f.y*fx.x+f.x*fx.y,f.y*fy.x+f.x*fy.y);
   float circle=torusCoverage(r-size,.013,ds),petal=torusCoverage(abs(f.x*f.y)-.029,.007,dp)*torusEdgeCDF(.44-r,dr);
   float pigment=.08+.82*(.5+.5*sin(ph-k*1.3));
   tone=mix(tone,pigment,max(circle,petal)*weight*vis);
   tone=mix(tone,.91,torusEdgeCDF(size-.03-r,ds)*weight*vis*.25);
   float rr=dot(f,f),denominator=max(rr,.003);vec2 dd=rr>.003?2.0*vec2(dot(f,fx),dot(f,fy)):vec2(0);
   ex=.18*(fx-f*dd.x/denominator)/denominator;ey=.18*(fy-f*dd.y/denominator)/denominator;
   e=.18*f/denominator+vec2(.03*sin(t+k),.03*cos(t-k));weight*=.82;
  }
 }else if(uKind==17){
  // Real and imaginary nodal domains share one evolving complex wave.
  vec2 e=vec2(X,Y)*(2.0*floor(1.0+uDensity/80.0));
  float A=sin(e.x+.52*a*sin(e.y+t)),B=sin(e.y-.52*a*sin(e.x-t));
  float f=A*B+.34*sin(ph)*cos(e.x)*cos(e.y),g=A*A-B*B;
  float region=fill(f),pigment=.07+.20*(.5+.5*cos(ph));tone=mix(.97,pigment,region);
  float contour=stroke(f,.040),filigree=line(g*3.0+.35*sin(ph),.030);
  tone=mix(tone,1.0-tone,max(contour,.75*filigree));
  float gate=stroke(g,.035)*fill(abs(f)-.20);tone=mix(tone,.07+.84*(.5+.5*sin(ph)),gate);
 }else if(uKind==18){
  // Binary paperfolding digits control crossing order at successive scales.
  vec2 e=shear(b,t,.05*a)*8.0;float parent=1.0;
  vec2 ex=dFdx(e),ey=dFdy(e);
  for(int j=0;j<4;j++){
   if(float(j)>=uLayers)break;float k=float(j),repeat=pow(2.0,k);vec2 c=floor(e),local=fract(e)-.5;
   float parity=mod(c.x+c.y+floor(c.x/2.0)+floor(c.y/2.0),2.0);
   mat2 rotation=rot((2.0*parity-1.0)*(.25+.52*sin(ph-k*.8)));vec2 f=rotation*local;
   vec2 da=(2.0*parity-1.0)*.52*cos(ph-k*.8)*phaseGradient;
   vec2 fx=rotation*ex+vec2(-f.y,f.x)*da.x,fy=rotation*ey+vec2(-f.y,f.x)*da.y;
   float frame=boxContour(f,.34,.045,fx,fy),hinge=torusCoverage(f.x-f.y,.022,vec2(fx.x-fx.y,fy.x-fy.y))*boxCoverage(f,.34,fx,fy);
   float vis=1.0-smoothstep(.08,.4,max(length(ex),length(ey)));
   float pigment=.08+.84*(.5+.5*cos(ph+PI*parity-k));
   tone=mix(tone,pigment,max(frame,hinge)*parent*vis);
   parent*=1.0-frame;e=2.0*e+vec2(.045*sin(t+k),.045*cos(t-k));ex*=2.0;ey*=2.0;
  }
 }else if(uKind==19){
  vec2 e=vec2(X,Y)/TAU*max(2.0,2.0*floor(uDensity/60.0));float parent=1.0;
  vec2 ex=dFdx(e),ey=dFdy(e),dp=vec2(dFdx(X),dFdy(X))+.65*cos(Y+t)*vec2(dFdx(Y),dFdy(Y));
  for(int j=0;j<4;j++){
   if(float(j)>=uLayers)break;float k=float(j);vec2 f=TAU*e;
   float h=cos(f.x)+cos(f.y)+(.35+.55*a)*sin(ph-k*.8);
   // Propagate the covering's Jacobian. Finite differences of a rapidly
   // oscillating cosine can cancel and falsely report a zero filter width.
   vec2 dh=-TAU*vec2(dot(sin(f),ex),dot(sin(f),ey))+(.35+.55*a)*cos(ph-k*.8)*dp;
   float aa=max(.00001,.5*(abs(dh.x)+abs(dh.y))+.125*TAU*TAU*(dot(ex,ex)+dot(ey,ey)));
   float region=1.0-smoothstep(-aa,aa,h),boundary=torusStroke(h,.055,aa),detail=torusPeriodic(h*2.6,.055,5.2*aa);
   // Coverage tends to its local average as a chamber becomes subpixel.
   // Dropping the whole level instead would turn its pigment into white gaps.
   float vis=1.0;
   float pigment=.10+.73*(.5+.5*cos(ph-k*1.4));
   tone=mix(tone,mix(pigment,.96,region),parent*vis);tone=mix(tone,1.0-tone,max(boundary,detail*.55)*parent*vis);
   parent*=torusStroke(h,.55,aa);e=mat2(2,1,1,1)*e+vec2(.04*sin(t+k),0);
   ex=mat2(2,1,1,1)*ex;ey=mat2(2,1,1,1)*ey;
  }
 }else if(uKind==20){
  // Eyes emerge in the gaps between conjugate ribbons, and recurse in their lids.
  vec2 e=shear(b,t,.002+.006*a)*vec2(n.x,n.x*.5);float parent=1.0;
  vec2 ex=dFdx(e),ey=dFdy(e);
  for(int j=0;j<4;j++){
   if(float(j)>=uLayers)break;float k=float(j);vec2 local=fract(e)-.5;
   float height=.18+.14*cos(TAU*local.x),sway=.11*sin(TAU*e.x+ph-k);
   vec2 ds=.11*cos(TAU*e.x+ph-k)*(TAU*vec2(ex.x,ey.x)+phaseGradient);
   vec2 dd=sign(local.y-sway)*(vec2(ex.y,ey.y)-ds)+.14*TAU*sin(TAU*local.x)*vec2(ex.x,ey.x);
   float d=abs(local.y-sway)-height,body=torusEdgeCDF(-d,dd);
   float vis=1.0-smoothstep(.07,.32,max(length(ex),length(ey)));
   float pigment=.09+.81*(.5+.5*cos(ph-k*1.4+PI*mod(floor(e.y),2.0)));
   tone=mix(tone,pigment,body*parent*vis);tone=mix(tone,1.0-pigment,torusCoverage(d,.018,dd)*parent*vis);
   vec2 pupil=vec2(local.x,local.y-sway);float radius=max(length(pupil),1e-7);
   vec2 dr=vec2(dot(pupil,vec2(ex.x,ex.y-ds.x)),dot(pupil,vec2(ey.x,ey.y-ds.y)))/radius;
   float iris=torusCoverage(radius-.105,.025,dr),centre=torusEdgeCDF(.042-radius,dr);
   tone=mix(tone,1.0-pigment,max(iris,centre)*parent*vis);
   parent*=body;e=3.0*e+vec2(.02*sin(t+k),0);ex*=3.0;ey*=3.0;
  }
 }

 float fade=.12*smoothstep(4.5,9.0,length(vec3(3.65,0,0)-vPosition));
 fragColor=vec4(vec3(mix(1.0,mix(clamp(tone,.025,1.0),1.0,fade),.30+.70*uInk)),1);
}`;
 async function create(gl,vao,count){
  // Compile only the requested construction. Leaving all 21 recursive fields
  // dynamic makes ANGLE expand every field's pixel filters on a first visit.
  const programs=new Map(),pending=new Map();
  function prepare(kind){
   if(!Number.isInteger(kind)||kind<0||kind>20)return Promise.reject(Error('Unknown metamorphosis study'));
   if(programs.has(kind))return Promise.resolve(programs.get(kind));
   if(pending.has(kind))return pending.get(kind);
   const fragment=TorusLight.fragment(TorusPrograms.specialize(fragmentSource,{uKind:kind}),false);
   const task=TorusPrograms.link(gl,vertexSource,fragment).then(program=>{
    const u={};for(const n of ['uViewProjection','uTime','uWave','uDensity','uLayers','uBalance','uInk','uKind','uVariant','uWinding','uSpectral','uSpectrum'])u[n]=gl.getUniformLocation(program,n);
    const value={program,u};programs.set(kind,value);return value;
   }).finally(()=>pending.delete(kind));
   pending.set(kind,task);return task;
  }
  const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,512,3,0,gl.RGBA,gl.FLOAT,new Float32Array(TORUS_SPECTRUM.samples));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  return {prepare,draw(matrix,time,wave,density,kind,variant,options){
   const ready=programs.get(kind);if(!ready)throw Error('Prepare the metamorphosis study before drawing');const {program,u}=ready;
   gl.useProgram(program);TorusLight.bind(gl,program,options,time);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.uniformMatrix4fv(u.uViewProjection,false,matrix);gl.uniform1f(u.uTime,time);gl.uniform1f(u.uWave,wave);gl.uniform1f(u.uDensity,density);gl.uniform1f(u.uLayers,options.layers);gl.uniform1f(u.uBalance,options.balance);gl.uniform1f(u.uInk,options.ink);gl.uniform1i(u.uKind,kind);gl.uniform1i(u.uVariant,variant);gl.uniform1i(u.uWinding,options.winding);gl.uniform1i(u.uSpectral,options.spectral);gl.uniform1i(u.uSpectrum,2);gl.drawElements(gl.TRIANGLES,typeof count==='function'?count():count,gl.UNSIGNED_INT,0);
  }};
 }
 return {create};
})();
