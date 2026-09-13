/* Periodic partitions of the chamber: polygons, shared cuts and exact substitutions. */
const TorusTessellations=(()=>{
 const vertexSource = `#version 300 es
precision highp float;
layout(location=0) in vec2 aUV;
uniform mat4 uViewProjection;
out vec3 vPosition;
out vec2 vAngles;
const float TAU=6.28318530718;
void main(){vAngles=aUV*TAU;vec2 a=vAngles;vPosition=vec3((3.0+1.8*cos(a.y))*cos(a.x),1.8*sin(a.y),(3.0+1.8*cos(a.y))*sin(a.x));gl_Position=uViewProjection*vec4(vPosition,1);}`;
 const fragmentSource = `#version 300 es
precision highp float;
uniform float uTime,uWave,uDensity,uLayers,uInk;
uniform highp int uKind,uVariant;
uniform highp sampler2D uChair;
in vec3 vPosition;
in vec2 vAngles;
out vec4 fragColor;
const float PI=3.14159265359,TAU=6.28318530718,SQ3=1.73205080757;
mat2 rot(float a){return mat2(cos(a),sin(a),-sin(a),cos(a));}
float fill(float d){float a=max(.0001,.7*fwidth(d));return 1.0-smoothstep(-a,a,d);}
float line(float d,float w){return torusStroke(d,w,max(.0001,.65*fwidth(d)));}
float stripes(float d,float w){return torusPeriodic(d,w,fwidth(d));}
float box(vec2 p,vec2 h){vec2 d=abs(p)-h;return length(max(d,0.0))+min(max(d.x,d.y),0.0);}
float segment(vec2 p,vec2 a,vec2 b){vec2 ab=b-a;return length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0));}
float visible(vec2 p){return 1.0-smoothstep(.07,.35,max(length(dFdx(p)),length(dFdy(p))));}
float colour(float index,float phase){float base=mod(index,3.0)<.5?.08:mod(index,3.0)<1.5?.96:.53;return mix(base,1.0-base,.30*(.5+.5*sin(phase)));}
float finishTile(float tone,float edge,float contour,vec2 local,float phase){
 tone=mix(tone,.025,line(edge,.008));
 if(uVariant>0){
  float detail=0.0;
  if(uVariant==1){for(int j=1;j<5;j++){if(float(j)>uLayers)break;detail=max(detail,line(contour-.055*float(j),.005));}}
  else detail=stripes((local.x+local.y)*(2.0+2.0*uLayers)+.35*sin(phase),.035)*fill(.022-edge);
  tone=mix(tone,1.0-tone,detail*.86);
 }
 return tone;
}
vec4 hexCell(vec2 q){
 vec2 period=vec2(1,SQ3),a=mod(q,period)-.5*period,b=mod(q-.5*period,period)-.5*period;
 vec2 p=dot(a,a)<dot(b,b)?a:b;return vec4(p,q-p);
}
float hexDistance(vec2 p){p=abs(p);return max(p.x,dot(p,vec2(.5,.86602540378)))-.5;}
float chairEdge(vec2 p){
 float d=segment(p,vec2(0,0),vec2(2,0));d=min(d,segment(p,vec2(2,0),vec2(2,1)));d=min(d,segment(p,vec2(2,1),vec2(1,1)));d=min(d,segment(p,vec2(1,1),vec2(1,2)));d=min(d,segment(p,vec2(1,2),vec2(0,2)));return min(d,segment(p,vec2(0,2),vec2(0,0)));
}
float triangleEdge(vec2 p){return min(min(p.x,p.y),(1.0-p.x-p.y)*.70710678118);}
// Differentiate the continuous chart, never abs/fract/min at a tile join.
// The latter can report zero width in a 2x2 fragment quad straddling an edge.
float rectangleCoverage(vec2 p,vec2 halfSize,vec2 dx,vec2 dy){
 return torusCoverage(p.x,halfSize.x,vec2(dx.x,dy.x))*torusCoverage(p.y,halfSize.y,vec2(dx.y,dy.y));
}
float rectangleLine(vec2 p,float halfSize,float width,vec2 dx,vec2 dy){
 float coverage=clamp(rectangleCoverage(p,vec2(halfSize+width),dx,dy)-rectangleCoverage(p,vec2(max(0.0,halfSize-width)),dx,dy),0.0,1.0);
 // Once a complete cell is subpixel, retain the area of its closed frame.
 return mix(coverage,clamp(16.0*halfSize*width,0.0,1.0),smoothstep(.55,1.25,max(length(dx),length(dy))));
}
float gridBoundary(vec2 p,float width,vec2 dx,vec2 dy){
 float x=torusPeriodic(p.x,width,vec2(dx.x,dy.x)),y=torusPeriodic(p.y,width,vec2(dx.y,dy.y));
 return x+y-x*y;
}
float triangleContour(vec2 p,float inset,float width,vec2 dx,vec2 dy){
 vec3 d=vec3(p,(1.0-p.x-p.y)*.70710678118);
 vec2 gradient=d.x<min(d.y,d.z)?vec2(dx.x,dy.x):d.y<d.z?vec2(dx.y,dy.y):-.70710678118*vec2(dx.x+dx.y,dy.x+dy.y);
 return torusCoverage(min(d.x,min(d.y,d.z))-inset,width,gradient);
}
float carpetTile(vec2 q,vec2 dx,vec2 dy,float phase,vec2 phaseGradient){
 vec2 e=fract(q);float ancestry=0.0,tone=1.0;
 for(int j=0;j<4;j++){
  float k=float(j);vec2 digit=floor(e*3.0);tone=colour(ancestry+k,phase-k*.8);
  if(k>=uLayers-1.0){tone=mix(tone,.025,gridBoundary(e,.012,dx,dy));break;}
  if(digit.x==1.0&&digit.y==1.0){e=e*3.0-1.0;dx*=3.0;dy*=3.0;tone=colour(k+1.0,phase+k);tone=mix(tone,.025,gridBoundary(e,.018,dx,dy));break;}
  ancestry+=mod(digit.x+digit.y,2.0);e=fract(e*3.0);dx*=3.0;dy*=3.0;
 }
 if(uVariant==1)tone=mix(tone,1.0-tone,rectangleLine(e-.5,.30,.008,dx,dy));
 if(uVariant==2)tone=mix(tone,1.0-tone,torusPeriodic((e.x+e.y)*3.0+.30*sin(phase),.035,3.0*vec2(dx.x+dx.y,dy.x+dy.y)+.30*cos(phase)*phaseGradient));
 return tone;
}
void main(){
 float t=uTime,a=uWave,m=floor(1.0+uDensity/48.0);
 vec2 b=vec2(vAngles.x/TAU,(vAngles.y-2.0*atan(sin(vAngles.y)/(3.0+cos(vAngles.y))))/TAU+t/TAU);
 float phase=TAU*(2.0*b.x+3.0*b.y)-2.0*t;
 // A composition of periodic shears moves complete shared boundaries together.
 vec2 chart=b;chart.x+=.010*a*sin(TAU*2.0*chart.y+sin(t));chart.y+=.010*a*sin(TAU*3.0*chart.x-cos(t));
 vec2 rootDx=dFdx(chart*(2.0*m)),rootDy=dFdy(chart*(2.0*m));
 vec2 tilePhaseGradient=vec2(dFdx(phase),dFdy(phase));
 float n=8.0*m;bool triangular=uKind==1||uKind==2||uKind==3||uKind==7;
 if(triangular)n=12.0*m;
 vec2 q=chart*vec2(n,.75*n),p=fract(q)-.5,id=floor(q);float tone=1.0;
 if(uKind==2)q=chart*vec2(n,.5*n);
 if(uKind==0){
  vec2 dx=dFdx(q),dy=dFdy(q),phaseGradient=vec2(dFdx(phase),dFdy(phase));
  float parity=mod(id.x+id.y,2.0);
  float ex=torusPeriodic(q.x*.5-.25,.25,.5*vec2(dx.x,dy.x));
  float ey=torusPeriodic(q.y*.5-.25,.25,.5*vec2(dx.y,dy.y));
  float odd=ex*(1.0-ey)+ey*(1.0-ex);
  tone=mix(colour(0.0,phase),colour(1.0,phase+PI),odd);
  float angle=(2.0*parity-1.0)*.30*a*sin(phase);
  vec2 f=rot(angle)*p,da=(2.0*parity-1.0)*.30*a*cos(phase)*phaseGradient;
  vec2 fx=rot(angle)*dx+vec2(-f.y,f.x)*da.x,fy=rot(angle)*dy+vec2(-f.y,f.x)*da.y;
  if(uVariant==0)tone=mix(tone,1.0-tone,rectangleLine(f,.32,.012,fx,fy));
  float rimX=torusPeriodic(q.x,.008,vec2(dx.x,dy.x)),rimY=torusPeriodic(q.y,.008,vec2(dx.y,dy.y));
  tone=mix(tone,.025,rimX+rimY-rimX*rimY);
  if(uVariant>0){
   float detail=0.0;
   if(uVariant==1){for(int j=1;j<5;j++){if(float(j)>uLayers)break;detail+=rectangleLine(p,.5-.055*float(j),.005,dx,dy);}detail=min(detail,1.0);}
   else{
    float scale=2.0+2.0*uLayers,carrier=(f.x+f.y)*scale+.35*sin(phase);
    vec2 gradient=scale*vec2(fx.x+fx.y,fy.x+fy.y)+.35*cos(phase)*phaseGradient;
    detail=torusPeriodic(carrier,.035,gradient)*rectangleCoverage(p,vec2(.478),dx,dy);
   }
   tone=mix(tone,1.0-tone,detail*.86);
  }
 }else if(uKind==1||uKind==3||uKind==7){
  vec4 h=hexCell(q*vec2(1,SQ3));vec2 local=h.xy,centre=h.zw;
  float row=round(centre.y/(SQ3*.5)),col=round(centre.x-.5*row),category=mod(col+2.0*row,3.0);
  float edge=-hexDistance(local);tone=colour(category,phase+category*TAU/3.0);
  if(uKind==3){
   // Three lozenges partition each hexagon, giving the familiar cube illusion.
   float sector=floor(mod(atan(local.y,local.x)+PI/6.0,TAU)/(TAU/3.0));
   tone=colour(sector,phase+category*.7);
   float ray=abs(sin(1.5*(atan(local.y,local.x)+PI/6.0)))*length(local);
   tone=mix(tone,.025,line(ray,.007));
  }else if(uKind==7){
   // Hexagons meeting at vertices leave congruent triangular regions.
   vec2 e=abs(local);float d=max(e.y,dot(e,vec2(.86602540378,.5)))-.43301270189;
   tone=colour(d<0.0?category:1.0,phase);edge=abs(d);
   if(d>0.0)tone=colour(1.0,phase);
  }
  tone=finishTile(tone,edge,edge,local,phase);
 }else if(uKind==2){
  vec2 e=vec2(q.x-q.y*.5,q.y),cell=floor(e),f=fract(e);float upper=step(1.0,f.x+f.y);
  if(upper>.5)f=1.0-f;
  float edge=triangleEdge(f);tone=colour(mod(cell.x-cell.y+upper,3.0),phase+upper*PI);
  vec2 local=vec2(f.x+.5*f.y,.86602540378*f.y)-vec2(.5,.2886751346);
  tone=finishTile(tone,edge,edge,local,phase);
 }else if(uKind==4){
  float oct=.70710678118-(abs(p.x)+abs(p.y)),edge;
  if(oct>=0.0){edge=min(.5-max(abs(p.x),abs(p.y)),oct*.70710678118);tone=colour(mod(id.x+id.y,2.0),phase);}
  else{vec2 local=q-floor(q+.5);edge=.29289321881-(abs(local.x)+abs(local.y));p=local;tone=colour(2.0,phase+PI);}
  tone=finishTile(tone,edge,edge,p,phase);
 }else if(uKind==5){
  // The Voronoi dual of a fourfold seed orbit gives congruent Cairo pentagons.
  vec2 base=floor(q),nearest=vec2(0),local=vec2(0);float best=10.0,second=10.0,which=0.0;
  float sy=.10+.035*a*sin(t);vec2 seed=vec2(.30,sy);
  // The nearest member of each of the four lattice orbits is analytic.
  // Throughout the permitted seed motion no Voronoi edge joins one orbit to itself.
  for(int j=0;j<4;j++){
   vec2 offset=rot(float(j)*PI/2.0)*seed,site=floor(q-offset+.5)+offset,delta=q-site;float d=dot(delta,delta);
   if(d<best){second=best;best=d;nearest=site;local=delta;which=float(j);}else second=min(second,d);
  }
  float edge=.5*(sqrt(second)-sqrt(best));tone=colour(which+mod(floor(nearest.x)+floor(nearest.y),2.0),phase+which*PI/2.0);
  tone=finishTile(tone,edge,edge,rot(-which*PI/2.0)*local,phase);
 }else if(uKind==6){
  // A four-diagonal domino rule covers every unit square exactly once.
  q=chart*vec2(n,n*.5);id=floor(q);float code=mod(id.x-id.y,4.0);vec2 centre=id+.5,halfSize;
  if(code<2.0){centre.x+=code<.5?.5:-.5;halfSize=vec2(1,.5);}else{centre.y+=code<2.5?-.5:.5;halfSize=vec2(.5,1);}
  vec2 local=q-centre;float edge=-box(local,halfSize);tone=colour(code<2.0?0.0:1.0,phase);
  if(code>=2.0)local=rot(PI/2.0)*local;
  tone=finishTile(tone,edge,edge,local,phase);
 }else if(uKind>=8&&uKind<=12){
  // Opposite-edge cuts are paired by translation; row reflection fixes the joins.
  vec2 e=q;float bend=(.10+.12*a)*(.80+.20*sin(phase));
  if(uKind==12)bend*=.5+.5*sin(phase);
  float cut=sin(TAU*e.x);
  if(uKind==9)cut=.85*sin(TAU*e.x)-.34*sin(2.0*TAU*e.x);
  if(uKind==10)cut=.85*sin(TAU*e.x)+.22*sin(3.0*TAU*e.x);
  if(uKind==11)cut=1.1*sin(TAU*e.x)+.25*sin(2.0*TAU*e.x);
  e.y-=bend*cut+.025*sin(2.0*TAU*e.x+t);
  float row=floor(e.y),hand=mod(row,2.0)*2.0-1.0;
  float sideCut=bend*sin(TAU*e.y)+.055*sin(2.0*TAU*e.y);
  if(uKind==9)sideCut=.08*sin(TAU*e.y)-.11*sin(2.0*TAU*e.y);
  if(uKind==10)sideCut=.16*sin(TAU*e.y)+.025*sin(3.0*TAU*e.y);
  if(uKind==11)sideCut=.14*sin(TAU*e.y)-.075*sin(2.0*TAU*e.y);
  e.x-=hand*sideCut;
  if(uKind==8)e.y-=.12*sin(TAU*e.x-t);
  vec2 cell=floor(e),local=fract(e)-.5;float parity=mod(cell.x+cell.y,2.0);
  local.x*=hand;float edge=.5-max(abs(local.x),abs(local.y));tone=colour(parity,phase+PI*parity);
  float mark=0.0;
  if(uKind==8){float d=box(rot(.4*a*sin(phase))*local,vec2(.30));mark=line(d,.010);}
  else if(uKind==9){
   float wing=local.y+.08-.26*cos(PI*(local.x+.05));mark=line(wing,.014)*fill(abs(local.x)-.37);
   mark=max(mark,fill(length(local-vec2(.26,.12))-.027));
   mark=max(mark,line(local.y+.29-.45*abs(local.x+.22),.013)*fill(abs(local.x+.22)-.14));
  }else if(uKind==10){
   mark=fill(length(local-vec2(.28,.08))-.030);
   mark=max(mark,line(length((local-vec2(.06,0))*vec2(1,1.4))-.23,.012)*fill(-local.x+.04));
   mark=max(mark,line(abs(local.y)-.65*(local.x+.46),.012)*fill(local.x+.22));
  }else if(uKind==11){
   mark=line(local.x,.013)*fill(abs(local.y)-.36);
   mark=max(mark,line(abs(local.x)-.22*cos(PI*local.y),.013)*fill(abs(local.y)-.34));
   mark=max(mark,fill(length(local-vec2(.06,.29))-.024));mark=max(mark,fill(length(local-vec2(-.06,.29))-.024));
  }else{
   float wing=box(rot(.45*sin(phase))*local,vec2(.30,.17));mark=line(wing,.014);
   mark=max(mark,fill(length(local-vec2(.23,.09))-.028));
  }
  if(uVariant==1){float veins=stripes((uKind==10?local.x:local.y)*(3.0+2.0*uLayers)+2.5*abs(local.x),.030);mark=max(mark,veins*fill(box(local,vec2(.29,.24))));}
  if(uVariant==2){vec2 f=fract((local+.5)*2.0)-.5;mark=max(mark,line(box(f,vec2(.22+.025*uLayers)),.009));}
  tone=mix(tone,1.0-tone,mark*.94);tone=mix(tone,.035,line(edge,.010));
 }else if(uKind==14){
  vec2 root=chart*m;float n=exp2(uLayers),offset=3.0*(n-2.0);vec2 cell=fract(root)*vec2(2.0*n,3.0*n);
  vec4 data=texelFetch(uChair,ivec2(int(floor(cell.x)),int(offset+floor(cell.y))),0);
  vec2 local=rot(-data.z*PI/2.0)*(cell-data.xy);float edge=chairEdge(local);
  tone=colour(data.w,phase+data.z*PI/2.0);tone=mix(tone,.025,line(edge,.027));
  if(uVariant==1)tone=mix(tone,1.0-tone,line(edge-.16,.018));
  if(uVariant==2)tone=mix(tone,1.0-tone,stripes((local.x+local.y)*2.0+.30*sin(phase),.040)*fill(.06-edge));
 }else if(uKind==15){
  vec2 e=chart*(2.0*m),f=fract(e),dx=rootDx,dy=rootDy;if(f.x+f.y>1.0){f=1.0-f;dx=-dx;dy=-dy;}
  float ancestry=0.0;
  for(int j=0;j<4;j++){
   float k=float(j),vis=1.0-smoothstep(.07,.35,max(length(dx),length(dy)));tone=colour(ancestry+k,phase-k*.75);
   if(k>=uLayers-1.0){tone=mix(tone,.025,triangleContour(f,0.0,.016,dx,dy)*vis);break;}
   if(f.x>.5){f=2.0*f-vec2(1,0);ancestry+=1.0;}
   else if(f.y>.5){f=2.0*f-vec2(0,1);ancestry+=2.0;}
   else if(f.x+f.y<.5){f*=2.0;}
   else{tone=colour(k+float(uVariant),phase-k*.7);tone=mix(tone,.025,triangleContour(1.0-2.0*f,0.0,.018,-2.0*dx,-2.0*dy)*vis);break;}
   dx*=2.0;dy*=2.0;
  }
  if(uVariant==1)tone=mix(tone,1.0-tone,triangleContour(f,.10,.007,dx,dy));
  if(uVariant==2)tone=mix(tone,1.0-tone,torusPeriodic((f.x-f.y)*4.0+.25*sin(phase),.035,4.0*vec2(dx.x-dx.y,dy.x-dy.y)+.25*cos(phase)*tilePhaseGradient));
 }else if(uKind==16){
  // Ancestry changes pigment discontinuously at a retained leaf. Integrate
  // four subregions of the pixel, each with its own analytic edge footprint,
  // so different generations on opposite sides of a pixel share its colour.
  vec2 centre=chart*(2.0*m),dx=rootDx*.5,dy=rootDy*.5,pg=tilePhaseGradient*.5;
  tone=.25*(carpetTile(centre-.5*dx-.5*dy,dx,dy,phase-.5*pg.x-.5*pg.y,pg)
   +carpetTile(centre+.5*dx-.5*dy,dx,dy,phase+.5*pg.x-.5*pg.y,pg)
   +carpetTile(centre-.5*dx+.5*dy,dx,dy,phase-.5*pg.x+.5*pg.y,pg)
   +carpetTile(centre+.5*dx+.5*dy,dx,dy,phase+.5*pg.x+.5*pg.y,pg));
 }else{
  // Recursive rectangular partitions cover their parent exactly, including leaves
  // retained at earlier generations. No overlaid independent fractal sprites.
  vec2 e=fract(chart*(2.0*m)),size=vec2(1),dx=rootDx,dy=rootDy;float ancestry=0.0,depth=0.0;
  for(int j=0;j<4;j++){
   if(float(j)>=uLayers)break;float k=float(j);depth=k;
   if(uKind==17){
    float split=.5+.13*a*sin(t-k*.7),axis=mod(k,2.0);float side=axis<.5?step(split,e.x):step(split,e.y);
    float childWidth=side<.5?split:1.0-split;
    if(axis<.5){e.x=side<.5?e.x/split:(e.x-split)/(1.0-split);size.x*=childWidth;dx.x/=childWidth;dy.x/=childWidth;}
    else{e.y=side<.5?e.y/split:(e.y-split)/(1.0-split);size.y*=childWidth;dx.y/=childWidth;dy.y/=childWidth;}
    ancestry=2.0*ancestry+side;
   }else{
    vec2 digit=floor(e*2.0);e=fract(e*2.0);size*=.5;dx*=2.0;dy*=2.0;float code=digit.x+2.0*digit.y;
    ancestry+=code;
    if(uKind==18){int turn=int(mod(code+k,4.0));if(turn==1){e=vec2(1.0-e.y,e.x);dx=vec2(-dx.y,dx.x);dy=vec2(-dy.y,dy.x);}else if(turn==2){e=1.0-e;dx=-dx;dy=-dy;}else if(turn==3){e=vec2(e.y,1.0-e.x);dx=vec2(dx.y,-dx.x);dy=vec2(dy.y,-dy.x);}}
    if(uKind==19){vec2 direction=vec2(sin(t-k),cos(t+k)),gradient=.06*a*PI*vec2(cos(PI*e.x)*sin(PI*e.y),sin(PI*e.x)*cos(PI*e.y));dx+=direction*dot(gradient,dx);dy+=direction*dot(gradient,dy);e+=.06*a*sin(PI*e.x)*sin(PI*e.y)*direction;}
    if(uKind==13&&code==mod(k+float(uVariant),4.0))break;
    if(uKind==18&&mod(code+k,3.0)==0.0)break;
   }
  }
  float edge=min(min(e.x,1.0-e.x),min(e.y,1.0-e.y));tone=colour(ancestry+depth,phase-depth*.8);
  tone=mix(tone,.025,gridBoundary(e,.015,dx,dy));
  if(uKind==19){vec2 radial=length(e)<length(e-1.0)?e:e-1.0;float arc=max(length(radial),1e-7);tone=mix(tone,1.0-tone,torusCoverage(arc-.5,.038,vec2(dot(radial,dx),dot(radial,dy))/arc));}
  if(uVariant==1)tone=mix(tone,1.0-tone,rectangleLine(e-.5,.32,.010,dx,dy));
  if(uVariant==2)tone=mix(tone,1.0-tone,torusPeriodic((e.x+e.y)*3.0+.32*sin(phase),.045,3.0*vec2(dx.x+dx.y,dy.x+dy.y)+.32*cos(phase)*tilePhaseGradient)*rectangleCoverage(e-.5,vec2(.45),dx,dy));
 }
 float fade=.12*smoothstep(4.5,9.0,length(vec3(3.65,0,0)-vPosition));
 fragColor=vec4(vec3(mix(1.0,mix(clamp(tone,.025,1.0),1.0,fade),.20+.80*uInk)),1);
}`;
 async function create(gl,vao,count){
  // Study identity is fixed; variation, density, recursion and animation stay
  // uniforms. Unrelated polygon/fractal branches never enter the driver build.
  const programs=new Map(),pending=new Map();
  function prepare(kind){
   if(!Number.isInteger(kind)||kind<0||kind>19)return Promise.reject(Error('Unknown tessellation study'));
   if(programs.has(kind))return Promise.resolve(programs.get(kind));
   if(pending.has(kind))return pending.get(kind);
   const fragment=TorusLight.fragment(TorusPrograms.specialize(fragmentSource,{uKind:kind}),false);
   const task=TorusPrograms.link(gl,vertexSource,fragment).then(program=>{
    const u={};for(const name of ['uViewProjection','uTime','uWave','uDensity','uLayers','uInk','uKind','uVariant','uChair'])u[name]=gl.getUniformLocation(program,name);
    const value={program,u};programs.set(kind,value);return value;
   }).finally(()=>pending.delete(kind));
   pending.set(kind,task);return task;
  }
  const chair=gl.createTexture();gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,chair);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,TORUS_CHAIR.width,TORUS_CHAIR.height,0,gl.RGBA,gl.FLOAT,new Float32Array(TORUS_CHAIR.samples));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  return {prepare,draw(matrix,time,wave,density,kind,variant,options){const ready=programs.get(kind);if(!ready)throw Error('Prepare the tessellation study before drawing');const {program,u}=ready;gl.useProgram(program);TorusLight.bind(gl,program,options,time);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,chair);gl.uniform1i(u.uChair,3);gl.uniformMatrix4fv(u.uViewProjection,false,matrix);gl.uniform1f(u.uTime,time);gl.uniform1f(u.uWave,wave);gl.uniform1f(u.uDensity,density);gl.uniform1f(u.uLayers,options.layers);gl.uniform1f(u.uInk,options.ink);gl.uniform1i(u.uKind,kind);gl.uniform1i(u.uVariant,variant);gl.drawElements(gl.TRIANGLES,typeof count==='function'?count():count,gl.UNSIGNED_INT,0);}};
 }
 return {create};
})();
