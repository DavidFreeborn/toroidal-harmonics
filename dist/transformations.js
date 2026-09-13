/* Shared-boundary metamorphoses and finite recursive partitions.
   All apparent births occupy geometrically growing regions, not image blends. */
const TorusTransformations=(()=>{
 const vertexSource = `#version 300 es
precision highp float;
layout(location=0) in vec2 aUV;
uniform mat4 uViewProjection;
out vec3 vPosition;out vec2 vAngles;
const float TAU=6.28318530718;
void main(){vAngles=aUV*TAU;vec2 a=vAngles;vPosition=vec3((3.0+1.8*cos(a.y))*cos(a.x),1.8*sin(a.y),(3.0+1.8*cos(a.y))*sin(a.x));gl_Position=uViewProjection*vec4(vPosition,1);}`;
 const fragmentSource = `#version 300 es
precision highp float;
uniform float uTime,uDensity,uWave,uLayers,uTurns,uBalance,uInk;
uniform highp int uKind,uVariant,uWinding,uCreatureReady;
uniform highp sampler2DArray uCreature;
in vec3 vPosition;in vec2 vAngles;out vec4 fragColor;
const float PI=3.14159265359,TAU=6.28318530718;
float footprint=.001;
mat2 rot(float a){return mat2(cos(a),sin(a),-sin(a),cos(a));}
float line(float d,float w){float aa=clamp(.65*fwidth(d),.30*footprint,1.5*footprint);return torusStroke(d,w,aa);}
float fill(float d){float aa=clamp(.7*fwidth(d),.30*footprint,1.5*footprint);return 1.0-smoothstep(-aa,aa,d);}
float boxEdge(vec2 e){return min(min(e.x,e.y),min(1.0-e.x,1.0-e.y));}
vec2 boxGradient(vec2 e){vec2 d=min(e,1.0-e);return d.x<d.y?vec2(e.x<.5?1.0:-1.0,0):vec2(0,e.y<.5?1.0:-1.0);}
vec2 pixelGradient(vec2 gradient,vec2 dx,vec2 dy){return vec2(dot(gradient,dx),dot(gradient,dy));}
vec2 radialGradient(vec2 p){return p/max(length(p),1e-7);}
float sdBox(vec2 p,vec2 h){vec2 d=abs(p)-h;return length(max(d,0.0))+min(max(d.x,d.y),0.0);}
float segment(vec2 p,vec2 a,vec2 b){vec2 v=b-a;return length(p-a-v*clamp(dot(p-a,v)/max(dot(v,v),.000001),0.0,1.0));}
float ink(float id){float c=mod(id,4.0);return c<.5?.045:c<1.5?.96:c<2.5?.30:.79;}
float phaseAt(vec2 b){
 if(uKind>=5&&uKind<=9&&uWinding==4)return 1.0;
 if(uWinding==3)return uBalance;
 float phase=uTurns*uTime;
 if(uWinding==1)phase-=TAU*b.y;
 if(uWinding==2)phase-=TAU*(2.0*b.x+3.0*b.y);
 return .5-.5*cos(phase);
}
float generation(float stage,float depth){
 // Bias the progress of each generation without switching levels on and off.
 // Every level uses the entire journey, with the same two exact endpoints.
 float lag=(.30+1.10*uWave)*(2.0*depth-(uLayers-1.0))/max(1.0,uLayers-1.0);
 return stage/(stage+(1.0-stage)*exp2(lag));
}
vec2 quarter(vec2 e,int turn){if(turn==1)return vec2(1.0-e.y,e.x);if(turn==2)return 1.0-e;if(turn==3)return vec2(e.y,1.0-e.x);return e;}
vec2 quarterDirection(vec2 e,int turn){if(turn==1)return vec2(-e.y,e.x);if(turn==2)return -e;if(turn==3)return vec2(e.y,-e.x);return e;}
float featherCut(float x){return .25*sin(TAU*x)-.14*sin(2.0*TAU*x)+.035*sin(3.0*TAU*x);}
float fishCut(float x){return .20*sin(TAU*x)+.075*sin(2.0*TAU*x)-.04*sin(3.0*TAU*x);}
float reptileCut(float x){return .19*sin(TAU*x)+.09*sin(3.0*TAU*x)+.035*sin(5.0*TAU*x);}
float wingCut(float x){return .26*sin(TAU*x)-.055*sin(3.0*TAU*x);}
// The atlas stores distances to vector contours at 49 geometric stages.
// Four bilinear reads interpolate contours and engraving separately. No per-pixel path loops or
// per-frame geometry, canvas work, allocations, or image crossfades are needed.
vec4 creatureFrame(vec2 uv,float frame){
 vec2 cell=vec2(mod(frame,7.0),floor(frame/7.0));
 vec2 at=(cell*260.0+2.0+fract(uv)*256.0)/vec2(1820.0);
 return vec4(texture(uCreature,vec3(at,0)).rgb,texture(uCreature,vec3(at,1)).r);
}
float distanceFill(float d){float aa=max(.007,.85*fwidth(d));return smoothstep(.5-aa,.5+aa,d);}
float creatureTone(vec2 q,float stage){
 if(uVariant==1)q=vec2(q.y,-q.x);
 // An integer shear of the repeating tile chart closes at every density.
 // The old half shear changed checkerboard parity at odd repeat counts.
 else if(uVariant==2)q=vec2(q.x+q.y,q.y);
 // The cosine clock already eases to rest at both complete forms. A second
 // narrow easing window rushed the transformation and resembled a reset.
 float form=stage;
 float frame=48.0*form;vec2 uv=uKind==7?vec2(q.x-q.y,2.0*q.y)/4.0:q/2.0;
 vec4 d=mix(creatureFrame(uv,floor(frame)),creatureFrame(uv,min(48.0,floor(frame)+1.0)),fract(frame));
 float a=distanceFill(d.r),tone;
 if(uKind==7){float b=distanceFill(d.g)*(1.0-a);tone=.045*a+.96*b+.44*max(0.0,1.0-a-b);}
 else tone=mix(.96,.045,a);
 float marks=max(distanceFill(d.b),distanceFill(d.a)*uWave);
 // Engraving follows the deformed body and has its own detail control.
 tone=mix(tone,mix(.97,.025,smoothstep(.30,.50,tone)),marks*.95);
 return tone;
}
vec2 recursiveSample(vec2 q,vec2 dx,vec2 dy,float roots){
  // Recursive dissections. Children appear from zero width or area and then
  // receive their own subdivision wave. Parent and child colours are fixed.
  vec2 id=floor(q),e=fract(q),edgePixel=vec2(0);float parity=mod(id.x+id.y,2.0),stage=phaseAt((id+.5)/roots),tone=.96,edge=1.0,detail=0.0;
  // The selected leaf coordinate is discontinuous across siblings. Carry the
  // chart Jacobian through each exact affine subdivision before filtering it.
  float ancestry=parity;vec2 f=e;edge=boxEdge(f);
  for(int j=0;j<4;j++){
   if(float(j)>=uLayers)break;float k=float(j),g=generation(stage,k);
   if(g<=0.0){tone=ink(ancestry);break;}
   if(uKind==10||uKind==15){
    int turn=uVariant==0?0:uVariant==1?int(mod(k,4.0)):int(mod(ancestry+k,4.0));f=quarter(f,turn);dx=quarterDirection(dx,turn);dy=quarterDirection(dy,turn);
    vec2 split=vec2(1.0-.5*g);
    if(uKind==15)split=vec2(1.0-.61803398875*g,1.0-.38196601125*g);
    vec2 digit=step(split,f),width=mix(split,1.0-split,digit);f=(f-digit*split)/max(width,vec2(.000001));
    dx/=max(width,vec2(.000001));dy/=max(width,vec2(.000001));ancestry+=digit.x+2.0*digit.y;
    edge=boxEdge(f);tone=ink(ancestry);
    if(digit.x>.5&&digit.y>.5)break;
   }else if(uKind==11||uKind==14){
    float a=g/3.0;vec2 digit=step(vec2(a),f)+step(vec2(1.0-a),f);
    vec2 start=vec2(digit.x<.5?0.0:digit.x<1.5?a:1.0-a,digit.y<.5?0.0:digit.y<1.5?a:1.0-a);
    vec2 width=vec2(digit.x==1.0?1.0-2.0*a:a,digit.y==1.0?1.0-2.0*a:a);
    f=(f-start)/max(width,vec2(.000001));dx/=max(width,vec2(.000001));dy/=max(width,vec2(.000001));edge=boxEdge(f);
    if(digit.x==1.0&&digit.y==1.0){tone=ink(ancestry);break;}
    ancestry+=1.0+mod(digit.x+digit.y,2.0);tone=ink(ancestry);
   }else{
    bool axis=mod(k+float(uVariant),2.0)<.5;float a=g/3.0,x=axis?f.x:f.y;
    float digit=step(a,x)+step(1.0-a,x),start=digit<.5?0.0:digit<1.5?a:1.0-a,width=digit==1.0?1.0-2.0*a:a;
    x=(x-start)/max(width,.000001);if(axis){f.x=x;dx.x/=max(width,.000001);dy.x/=max(width,.000001);}else{f.y=x;dx.y/=max(width,.000001);dy.y/=max(width,.000001);}edge=boxEdge(f);
    if(digit==1.0){tone=ink(ancestry);break;}
    ancestry+=digit<.5?1.0:2.0;tone=ink(ancestry);
   }
  }
  edgePixel=pixelGradient(boxGradient(f),dx,dy);
  if(uKind==14){
   // Each retained cell becomes an almond chamber, its aperture follows the
   // same generation wave that opens the surrounding recursive frame.
   vec2 local=f-.5;float aperture=.03+.25*stage;
   float almond=abs(local.y)-aperture*(1.0-pow(abs(local.x)*2.0,1.5));
   vec2 almondPixel=pixelGradient(vec2(aperture*3.0*sqrt(2.0*abs(local.x))*sign(local.x),sign(local.y)),dx,dy);
   vec2 horizontalPixel=pixelGradient(vec2(1,0),dx,dy);
   detail=torusCoverage(almond,.009,almondPixel)*torusEdgeCDF(.46-abs(local.x),horizontalPixel);
   vec2 pupil=local*vec2(1,1.15),pupilPixel=pixelGradient(radialGradient(pupil)*vec2(1,1.15),dx,dy);
   detail=max(detail,torusEdgeCDF(.075*stage-length(pupil),pupilPixel));
   if(uVariant==1)detail=max(detail,torusCoverage(length(local)-.15*stage,.009,pixelGradient(radialGradient(local),dx,dy)));
   if(uVariant==2)detail=max(detail,torusCoverage(abs(almond)-.065,.009,almondPixel)*torusEdgeCDF(.44-abs(local.x),horizontalPixel));
  }else if(uVariant==1)detail=torusCoverage(boxEdge(f)-.12,.009,edgePixel);
  else if(uVariant==2){
   // A new diagonal grows from its centre; it must not suddenly replace the
   // parent's diagonal when an arbitrarily small child is first admitted.
   detail=torusCoverage(f.x-f.y,.015,pixelGradient(vec2(1,-1),dx,dy))*torusEdgeCDF(.72*stage-length(f-.5),pixelGradient(radialGradient(f-.5),dx,dy));
  }
  tone=mix(tone,1.0-tone,detail*.94);tone=mix(tone,.025,torusCoverage(edge,.008,edgePixel));
  vec2 boundaryDistance=min(f,1.0-f),reach=.6*(abs(dx)+abs(dy));
  return vec2(tone,max(step(boundaryDistance.x,reach.x),step(boundaryDistance.y,reach.y)));
}
void main(){
 // An unwrapped conformal angle avoids a branch in the meridional derivatives.
 float t=uTime;vec2 b=vec2(vAngles.x/TAU,(vAngles.y-2.0*atan(sin(vAngles.y)/(3.0+cos(vAngles.y))))/TAU+t/TAU);
 float stage=phaseAt(b),m=1.0+floor(uDensity/48.0),n=8.0*m;
 vec2 chart=b;
 if(uKind<5){chart.x+=.012*uWave*sin(TAU*2.0*chart.y);chart.y+=.012*uWave*sin(TAU*3.0*chart.x);}
 vec2 q=chart*vec2(n,.75*n);footprint=max(.0002,max(length(dFdx(q)),length(dFdy(q))));
 vec2 id=floor(q),e=fract(q),p=e-.5,edgePixel=vec2(0);float parity=mod(id.x+id.y,2.0),tone=.96,edge=1.0,detail=0.0;
 if(uKind==0){
  // Each moving seed has a single phase, so its Voronoi edges stay straight
  // in the chart while the transformation wave crosses the lattice.
  q=chart*vec2(n,n);
  vec2 cell=floor(q),nearest=vec2(0),local=vec2(0);float best=20.0,second=20.0,nearStage=0.0;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
   vec2 index=cell+vec2(i,j);float g=phaseAt(index/n);
   vec2 site=index+vec2(.5*mod(index.y,2.0)*g,0),delta=q-site;float d=dot(delta,delta);
   if(d<best){second=best;best=d;nearest=index;local=delta;nearStage=g;}else second=min(second,d);
  }
  edge=.5*(sqrt(second)-sqrt(best));tone=ink(mod(nearest.x,2.0)+2.0*mod(nearest.y,2.0));
  if(uVariant==1)detail=line(edge-.11,.009);
  if(uVariant==2)detail=line(length(local)-mix(.24,.37,nearStage),.012);
 }else if(uKind==1){
  vec2 local=vec2(0);float best=20.0,second=20.0,which=0.0;
  if(uWinding==0||uWinding==3){
   vec2 seed=mix(vec2(.25,.25),vec2(.30,.10),stage);
   for(int j=0;j<4;j++){
    vec2 offset=quarter(seed+.5,j)-.5,site=floor(q-offset+.5)+offset,delta=q-site;float d=dot(delta,delta);
    if(d<best){second=best;best=d;local=delta;which=float(j);}else second=min(second,d);
   }
  }else{
   for(int yy=-1;yy<=1;yy++)for(int xx=-1;xx<=1;xx++){
    vec2 base=floor(q)+vec2(xx,yy);float g=phaseAt(base/vec2(n,.75*n));vec2 seed=mix(vec2(.25,.25),vec2(.30,.10),g);
    for(int j=0;j<4;j++){
     vec2 site=base+quarter(seed+.5,j)-.5,delta=q-site;float d=dot(delta,delta);
     if(d<best){second=best;best=d;local=delta;which=float(j);}else second=min(second,d);
    }
   }
  }
  edge=.5*(sqrt(second)-sqrt(best));tone=ink(which);
  if(uVariant==1)detail=max(line(edge-.055,.006),line(edge-.13,.006));
  if(uVariant==2)detail=line(dot(rot(which*PI/2.0)*local,vec2(1,1)),.015);
 }else if(uKind==2){
  // Four clipped corners create a shared diamond whose area starts at zero.
  stage=phaseAt(floor(q+.5)/vec2(n,.75*n));
  float radius=.29289321881*stage,cut=1.0-radius-abs(p.x)-abs(p.y);
  if(cut>=0.0){edge=min(boxEdge(e),cut*.70710678118);tone=ink(parity);}
  else{vec2 f=q-floor(q+.5);edge=(radius-abs(f.x)-abs(f.y))*.70710678118;tone=ink(2.0);p=f;}
  if(uVariant==1)detail=line(edge-.08,.008);
  if(uVariant==2)detail=line(abs(p.x)-abs(p.y),.012)*fill(.035-edge);
 }else if(uKind==3||uKind==13){
  // The inscribed square turns through a right angle. Four corner triangles
  // grow from zero area and return to zero; every point belongs to one tile.
  stage=phaseAt((id+.5)/vec2(n,.75*n));
  vec2 f=e;float ancestry=parity,scale=1.0;int limit=uKind==13?int(uLayers):1;
  for(int j=0;j<4;j++){
   if(j>=limit)break;float k=float(j),g=uKind==13?generation(stage,k):stage;
   if(uVariant==1)g=1.0-g;
   if(uVariant==2&&mod(k+parity,2.0)>.5)g=1.0-g;
   vec2 A=vec2(g,0),v=vec2(1.0-g,g),d=f-A;float denom=dot(v,v);
   vec2 child=vec2(dot(d,v),dot(d,vec2(-v.y,v.x)))/denom;
   float cut=boxEdge(child);edge=max(0.0,cut)*sqrt(denom);
   if(cut<0.0){
    vec4 outside=vec4(-child.x,child.x-1.0,-child.y,child.y-1.0);float maxD=max(max(outside.x,outside.y),max(outside.z,outside.w));
    float side=outside.x==maxD?0.0:outside.y==maxD?1.0:outside.z==maxD?2.0:3.0;
    edge=min(boxEdge(f),-cut*sqrt(denom));ancestry+=side+1.0;tone=ink(ancestry);break;
   }
   ancestry+=2.0;f=child;scale/=sqrt(denom);tone=ink(ancestry);
   if(j==limit-1){edge=boxEdge(f);if(uVariant==1)detail=line(edge-.11,.010);}
  }
  footprint*=scale;
  if(uKind==3&&uVariant==2)detail=line(sdBox(p,vec2(.13+.12*stage)),.009);
 }else if(uKind==4){
  // A saddle changes the pairing of four fixed midpoint endpoints.
  stage=phaseAt((id+.5)/vec2(n,.75*n));
  float g=.42*(2.0*stage-1.0),s=p.x*p.y+g*sin(PI*e.x)*sin(PI*e.y);
  float signedField=(parity<.5?1.0:-1.0)*s;
  if(uVariant==0){tone=.96;detail=line(s,.035);}
  else if(uVariant==1)tone=mix(.96,.045,fill(signedField));
  else{tone=mix(.89,.20,fill(signedField));detail=line(s,.012);detail=max(detail,line(abs(s)-.045,.008));}
  edge=10.0;
 }else if(uKind>=5&&uKind<=9&&uCreatureReady==1){
  if(uKind==7)q=chart*vec2(n,.5*n);
  tone=creatureTone(q,stage);edge=10.0;
 }else if(uKind>=5&&uKind<=9){
  // Moving upper/lower row boundaries are paired exactly. Their separation
  // stays positive, and an explicit inverse locates the owning row.
  if(uVariant==1)q=vec2(q.x+q.y,q.y-q.x);
  else if(uVariant==2)q=vec2(q.x+2.0*q.y,q.y);
  float shape=stage,harmonic=.035+.055*uWave;
  float fish=.23*cos(TAU*q.x),bird=.15*cos(TAU*q.x)+harmonic*cos(3.0*TAU*q.x),moth=.18*cos(2.0*TAU*q.x)+(.035+.04*uWave)*cos(4.0*TAU*q.x);
  float cutH=0.0;
  if(uKind==5)cutH=shape*bird;
  if(uKind==6)cutH=mix(fish,bird,shape);
  if(uKind==7)cutH=shape*(.12*cos(TAU*q.x)+harmonic*cos(3.0*TAU*q.x));
  if(uKind==8)cutH=shape*moth;
  if(uKind==9)cutH=mix(fish,moth,shape);
  float row=floor(q.y),hand=mod(row,2.0)<.5?1.0:-1.0;
  if(q.y<row+hand*cutH)row-=1.0;
  else if(q.y>=row+1.0-hand*cutH)row+=1.0;
  hand=mod(row,2.0)<.5?1.0:-1.0;
  vec2 f=vec2(q.x,row+(q.y-row-hand*cutH)/(1.0-2.0*hand*cutH));
  float y=fract(f.y),nose=sin(PI*y)*sin(PI*y),cutV=0.0;
  if(uKind==5)cutV=shape*(.19*nose+.065*sin(TAU*y));
  if(uKind==6)cutV=mix(.27*nose,.19*nose+.065*sin(TAU*y),shape);
  if(uKind==7)cutV=shape*(.21*nose+.035*sin(2.0*TAU*y));
  if(uKind==8)cutV=shape*(.17*nose-.075*sin(2.0*TAU*y));
  if(uKind==9)cutV=mix(.27*nose,.17*nose-.075*sin(2.0*TAU*y),shape);
  f.x-=hand*cutV;
  id=floor(f);e=fract(f);p=e-.5;parity=mod(id.x+id.y,2.0);p.x*=hand;
  tone=ink(parity);edge=boxEdge(e);
  float emergence=(uKind==6||uKind==9)?1.0:stage;
  // Marks lengthen geometrically from points as the creature emerges.
  float eye=length(p-vec2(.29,.07));detail=fill(eye-.032*emergence);
  if(uKind==5||uKind==6){
   float bird=uKind==6?shape:emergence;
   float wing=p.y+.035-(.10+.16*bird)*cos(PI*(p.x+.05));
   detail=max(detail,line(wing,.012)*fill(abs(p.x)-.35*emergence));
   detail=max(detail,line(p.y+.20-.65*abs(p.x+.20),.010)*fill(abs(p.x+.20)-.13*bird));
  }
  if(uKind==6||uKind==9){
   float gill=length((p-vec2(.05,0))*vec2(1,1.5))-(.19+.07*shape);
   detail=max(detail,line(gill,.011)*fill(.015-p.x));
   float fins=abs(p.y)-(.10+.09*shape)-.12*cos(TAU*p.x);
   detail=max(detail,line(fins,.009)*fill(abs(p.x+.08)-.22));
  }
  if(uKind==7){
   detail=max(detail,line(p.y-.05*sin(TAU*p.x),.012)*fill(abs(p.x)-.34*emergence));
   float toes=abs(p.y)-(.23-.12*cos(TAU*p.x));
   detail=max(detail,line(toes,.009)*fill(abs(p.x+.08)-.25*emergence));
  }
  if(uKind==8){
   detail=max(detail,line(p.x,.013)*fill(abs(p.y)-.34*emergence));
   detail=max(detail,line(abs(p.x)-.24*emergence*cos(PI*p.y),.011)*fill(abs(p.y)-.30*emergence));
  }
  if(emergence<.0001)detail=0.0;
 }else{
  vec2 root=chart*(2.0*m),dx=dFdx(root),dy=dFdy(root);
  vec2 first=recursiveSample(root,dx,dy,2.0*m);tone=first.x;
  // Only pixels touching a leaf boundary need four subpixel area samples.
  // Each receives its own half-size footprint and the same finite recursion.
  // This integrates contrasting child colours as well as their fine outlines.
  if(first.y>0.0){
   tone=0.0;
   for(int sampleIndex=0;sampleIndex<4;sampleIndex++){
    vec2 offset=vec2(sampleIndex%2==0?-.25:.25,sampleIndex<2?-.25:.25);
    tone+=.25*recursiveSample(root+offset.x*dx+offset.y*dy,.5*dx,.5*dy,2.0*m).x;
   }
  }
  edge=10.0;

 }
 tone=mix(tone,1.0-tone,detail*.94);tone=mix(tone,.025,uKind>=10?torusCoverage(edge,.008,edgePixel):line(edge,.008));
 float fade=.09*smoothstep(4.5,9.0,length(vec3(3.65,0,0)-vPosition));
 fragColor=vec4(vec3(mix(1.0,mix(clamp(tone,.025,.985),1.0,fade),.20+.80*uInk)),1);
}`;
 async function create(gl,vao,count,onReady=()=>{}){
  const program=await TorusPrograms.link(gl,vertexSource,TorusLight.fragment(fragmentSource,false));
  const u={};for(const name of ['uViewProjection','uTime','uDensity','uWave','uLayers','uTurns','uBalance','uInk','uKind','uVariant','uWinding','uCreature','uCreatureReady'])u[name]=gl.getUniformLocation(program,name);
  // Two full-resolution array layers fit WebGL 2's 2048 minimum texture
  // dimension. No resampling of the 49 contour stages is necessary.
  const target=gl.TEXTURE_2D_ARRAY;
  const placeholder=gl.createTexture();gl.activeTexture(gl.TEXTURE4);gl.bindTexture(target,placeholder);
  gl.texStorage3D(target,1,gl.RGBA8,1,1,2);
  gl.texParameteri(target,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(target,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  const volumes=new Map();let serial=0;
  function volume(kind){
   if(kind<5||kind>9)return null;
   let v=volumes.get(kind);if(v){v.used=++serial;return v;}
   let settle;v={ready:false,texture:null,used:++serial,promise:new Promise(resolve=>{settle=resolve})};volumes.set(kind,v);
   // Bound both pending loads and GPU residency, even during rapid selection.
   while(volumes.size>2){let oldest=null;for(const entry of volumes)if(entry[0]!==kind&&(!oldest||entry[1].used<oldest[1].used))oldest=entry;if(oldest[1].texture)gl.deleteTexture(oldest[1].texture);oldest[1].settle(false);volumes.delete(oldest[0]);}
   v.settle=settle;const im=new Image();im.decoding='async';
   im.onload=()=>{
    if(volumes.get(kind)!==v){settle(false);return;}
    try{
     const layer=document.createElement('canvas');layer.width=im.width/2;layer.height=im.height;const paint=layer.getContext('2d');
     v.texture=gl.createTexture();gl.activeTexture(gl.TEXTURE4);gl.bindTexture(target,v.texture);
     gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
     gl.texStorage3D(target,1,gl.RGBA8,layer.width,layer.height,2);
     for(let i=0;i<2;i++){paint.drawImage(im,i*layer.width,0,layer.width,layer.height,0,0,layer.width,layer.height);gl.texSubImage3D(target,0,0,0,i,layer.width,layer.height,1,gl.RGBA,gl.UNSIGNED_BYTE,layer);}
     gl.texParameteri(target,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(target,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
     gl.texParameteri(target,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(target,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
     v.ready=true;settle(true);onReady();
    }catch(error){if(v.texture)gl.deleteTexture(v.texture);v.texture=null;settle(false);console.warn('The detailed contour field is unavailable.',error);}
   };
   im.onerror=()=>{settle(false);console.warn('The detailed creature field could not be loaded; the geometric study remains available.');};
   im.src='./escher/'+(kind+125)+'.png?v=17';return v;
  }
  return {prepare(kind){return volume(kind)?.promise||Promise.resolve();},draw(matrix,time,wave,density,kind,variant,options){const field=volume(kind);gl.useProgram(program);gl.uniform1i(u.uCreatureReady,field&&field.ready?1:0);gl.uniform1i(u.uCreature,4);if(field&&field.ready){gl.activeTexture(gl.TEXTURE4);gl.bindTexture(target,field.texture);}TorusLight.bind(gl,program,options,time);gl.bindVertexArray(vao);gl.uniformMatrix4fv(u.uViewProjection,false,matrix);gl.uniform1f(u.uTime,time);gl.uniform1f(u.uDensity,density);gl.uniform1f(u.uWave,wave);gl.uniform1f(u.uLayers,options.layers);gl.uniform1f(u.uTurns,options.turns);gl.uniform1f(u.uBalance,options.balance);gl.uniform1f(u.uInk,options.ink);gl.uniform1i(u.uKind,kind);gl.uniform1i(u.uVariant,variant);gl.uniform1i(u.uWinding,options.winding);gl.drawElements(gl.TRIANGLES,typeof count==='function'?count():count,gl.UNSIGNED_INT,0);}};
 }
 return {create};
})();
