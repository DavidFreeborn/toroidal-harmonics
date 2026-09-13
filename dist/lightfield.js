/* A shared, periodic light field. The geometry keeps its own figure and ground. */
const TorusLight = (()=>{
 // Coverage, rather than an opaque centre sample, keeps subpixel lines honest.
 // The periodic primitive integrates a pulse over its unwrapped pixel footprint.
 const sampling=`
float torusStroke(float d,float width,float aa){
 aa=max(aa,1e-7);
 return clamp(smoothstep(-width-aa,-width+aa,d)-smoothstep(width-aa,width+aa,d),0.0,1.0);
}
float torusPeriodic(float p,float width,float footprint){
 float w=clamp(width,0.0,.5),f=max(footprint,1e-5),centre=fract(fract(p)+w);
 vec2 ends=vec2(centre-.5*f,centre+.5*f);
 vec2 integral=floor(ends)*(2.0*w)+min(fract(ends),vec2(2.0*w));
 float coverage=clamp((integral.y-integral.x)/f,0.0,1.0);
 // A box filter has weak stop-band rejection. Suppress its residual aliases
 // as a full repeat becomes smaller than a pixel, retaining average pigment.
 return mix(coverage,2.0*w,smoothstep(.45,1.0,f));
}
// Exact marginal coverage of a straight edge across a square screen pixel.
// A screen pixel projects to the sum of two uniform intervals, not a single
// interval of length fwidth. Keeping both derivatives preserves oblique detail.
float torusEdgeCDF(float d,vec2 gradient){
 vec2 f=abs(gradient)*.5;float a=max(max(f.x,f.y),1e-7),b=min(f.x,f.y);
 if(b<1e-5*a)return clamp(.5+d/(2.0*a),0.0,1.0);
 float tail=max(a+b-abs(d),0.0);
 float c=abs(d)<a-b?.5-abs(d)/(2.0*a):tail*tail/(8.0*a*b);
 return d<0.0?c:1.0-c;
}
float torusCoverage(float d,float width,vec2 gradient){
 return clamp(torusEdgeCDF(width-d,gradient)-torusEdgeCDF(-width-d,gradient),0.0,1.0);
}
float torusPeriodic(float p,float width,vec2 gradient){
 float w=clamp(width,0.0,.5),f=abs(gradient.x)+abs(gradient.y);
 if(f>=1.0)return 2.0*w;
 float d=fract(p+.5)-.5,coverage=torusCoverage(d,w,gradient);
 // A wide pixel may intersect the neighbouring repeat as well as the centre.
 if(.5*f+w>.5)coverage+=torusCoverage(d-1.0,w,gradient)+torusCoverage(d+1.0,w,gradient);
 return mix(clamp(coverage,0.0,1.0),2.0*w,smoothstep(.45,1.0,f));
}
`;
 const source=`
uniform highp int uTextureMode;
uniform float uTextureStrength,uTextureScale;
// A phase and its two screen derivatives. Product-to-sum filtering preserves
// slow interference beats even when the two carrier waves are too fine to see.
vec3 lightSin(vec3 p){return vec3(sin(p.x),cos(p.x)*p.yz);}
vec3 lightCos(vec3 p){return vec3(cos(p.x),-sin(p.x)*p.yz);}
float lightSinc(float x){
 if(abs(x)<1.0){float s=x*x;return 1.0+s*(-1.0/6.0+s*(1.0/120.0-s/5040.0));}
 return sin(x)/x;
}
float lightWave(vec3 p){return cos(p.x)*lightSinc(.5*p.y)*lightSinc(.5*p.z)*(1.0-smoothstep(3.14159265359,6.28318530718,max(abs(p.y),abs(p.z))));}
float lightProduct(vec3 a,vec3 b){return .5*(lightWave(a+b)+lightWave(a-b));}
float torusLighting(float tone,vec3 position){
 if(uTextureMode==0||uTextureStrength<.001)return tone;
 #ifdef TORUS_SURFACE_CHART
 vec3 U=vec3(vAngles.x,dFdx(vAngles.x),dFdy(vAngles.x));
 vec3 V=vec3(vAngles.y+uTime,dFdx(vAngles.y),dFdy(vAngles.y));
 #else
 vec3 px=dFdx(position),py=dFdy(position);
 #endif
 #ifndef TORUS_SOLID_LIGHT
 if(tone>=1.0)return tone;
 #endif
 const float LTAU=6.28318530718;
 #ifndef TORUS_SURFACE_CHART
 vec2 q=vec2(atan(position.z,position.x),atan(position.y,length(position.xz)-3.0))/LTAU;
 q.y+=uTime/LTAU;
 float radial=max(length(position.xz),.0001),tube=radial-3.0;
 vec3 gu=vec3(-position.z,0,position.x)/(radial*radial);
 vec3 gv=vec3(-position.y*position.x/radial,tube,-position.y*position.z/radial)/max(tube*tube+position.y*position.y,.0001);
 vec3 U=vec3(LTAU*q.x,dot(gu,px),dot(gu,py)),V=vec3(LTAU*q.y,dot(gv,px),dot(gv,py));
 #endif
 vec3 X=3.0*U+2.0*V,Y=2.0*U-3.0*V,T=vec3(uTime,0,0);
 float n=uTextureScale,f=0.0;
 if(uTextureMode==1)f=lightProduct(n*X-2.0*T+.75*lightSin(Y+T)-vec3(1.57079632679,0,0),Y+T+.4*lightSin(X-T));
 else if(uTextureMode==2)f=(lightWave(n*X-T)+lightWave(n*Y+2.0*T)+.6*lightWave(X-Y+T))/2.6;
 else if(uTextureMode==3){
  vec3 A=n*X,B=n*Y;float weight=.58;
  for(int j=0;j<4;j++){vec3 K=vec3(float(j),0,0);f+=weight*lightProduct(A-T-K,B+T+K);vec3 next=2.0*A+B;B=A+B;A=next;weight*=.48;}
 }else if(uTextureMode==4){
  vec3 A=n*X+.9*lightSin(Y-T)+T,B=n*Y+.9*lightSin(X+T)-T;
  f=.5*(lightWave(A-B)-lightWave(A+B))+.30*lightWave(X-Y-2.0*T-vec3(1.57079632679,0,0));
 }else if(uTextureMode==5)f=.6*lightProduct(n*X+Y-T,(n+1.0)*X-Y+T)+.4*lightWave(Y+2.0*T-vec3(1.57079632679,0,0));
 else f=.52*lightProduct(n*X+T,2.0*n*Y-T)+.32*lightProduct(3.0*n*X-2.0*T-vec3(1.57079632679,0,0),n*Y+T)+.16*lightWave(5.0*n*X+3.0*n*Y+T);
 float beat=smoothstep(-.36,.36,f),engraving=.5+.5*lightWave(3.0*n*X+2.0*Y+2.0*lightSin(Y-T));
 float light=.16+.84*(.86*beat+.14*engraving);
 #ifdef TORUS_SOLID_LIGHT
 return mix(tone,1.0-tone,smoothstep(.1,.9,uTextureStrength)*smoothstep(.34,.66,1.0-light));
 #else
 return 1.0-(1.0-tone)*mix(1.0,light,uTextureStrength);
 #endif
}
`;
 const locations=new WeakMap();
 function fragment(text,solid=false){
  const clock=/uniform[^;]*\buTime\b/.test(text)?'':'uniform float uTime;\n';
  const chart=/in\s+vec2\s+vAngles\b/.test(text)?'#define TORUS_SURFACE_CHART\n':'';
  return text.replace('precision highp float;','precision highp float;\n'+sampling).replace('void main(){',chart+(solid?'#define TORUS_SOLID_LIGHT\n':'')+clock+source+'\nvoid torusBase(){')+'\nvoid main(){torusBase();fragColor.rgb=vec3(torusLighting(fragColor.r,vPosition));}\n';
 }
 function bind(gl,program,options,time){
  let u=locations.get(program);if(!u){u={};for(const n of ['uTextureMode','uTextureStrength','uTextureScale','uTime'])u[n]=gl.getUniformLocation(program,n);locations.set(program,u);}
  gl.uniform1i(u.uTextureMode,options.textureMode??0);gl.uniform1f(u.uTextureStrength,options.textureStrength??.65);gl.uniform1f(u.uTextureScale,options.textureScale??2);gl.uniform1f(u.uTime,time);
 }
 return {fragment,bind};
})();
