/* Twelve periodic choreographies. The torus itself supplies every visible surface. */
const TorusSymmetry = (() => {
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
uniform float uInk;
uniform highp int uPalette;
uniform highp int uKind;
in vec3 vPosition;
in vec2 vAngles;
out vec4 fragColor;
const float PI=3.14159265359;
const float TAU=6.28318530718;
float footprint=.001;
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
vec2 cis(float a){return vec2(cos(a),sin(a));}
float fill(float d){float w=clamp(fwidth(d)*.75,.00015,footprint*1.5);return 1.0-smoothstep(-w,w,d);}
float stroke(float d,float r){return torusStroke(d,r,clamp(fwidth(d)*.65,.00015,footprint*1.5));}
float box(vec2 p,vec2 b){vec2 q=abs(p)-b;return length(max(q,0.0))+min(max(q.x,q.y),0.0);}
float ring(vec2 p,float radius,float width){return stroke(length(p)-radius,width);}
vec2 divide(vec2 a,vec2 b){return vec2(dot(a,b),a.y*b.x-a.x*b.y)/dot(b,b);}
float phase(vec2 id,vec2 n,float t){return TAU*id.y/n.y-2.0*t;}
void main(){
 float t=uTime,a=uWave,u=vAngles.x,v=vAngles.y;
 float columns=max(16.0,4.0*floor(3.0+uDensity*.025));
 vec2 n=vec2(columns,columns*1.5);
 vec2 q=vec2(u,v+t)*n/TAU;
 footprint=max(.0002,max(length(dFdx(q)),length(dFdy(q))));
 vec2 id=floor(q),p=fract(q)-.5;
 float parity=mod(id.x+id.y,2.0)*2.0-1.0;
 float ph=phase(id,n,t),ink=0.0;
 if(uKind==0){
  // Alternating C4 actions; normalisation keeps corner contacts in each row.
  float theta=PI*.25+(.18+.065*a)*PI*sin(ph);
  vec2 z=rot(parity*theta)*p;
  float size=.478/(cos(theta)+sin(theta));
  ink=stroke(box(z,vec2(size)),.012);
  ink=max(ink,stroke(box(z,vec2(size*.72)),.006));
  float opening=.5+.5*cos(ph);
  ink=max(ink,fill(box(z,vec2(size*(.13+.19*opening)))));
  for(int k=0;k<4;k++){
   vec2 corner=vec2(k<2?-size:size,mod(float(k),2.0)<.5?-size:size);
   ink=max(ink,fill(length(z-corner)-.020));
  }
 }else if(uKind==1){
  // Radius 1/pi: translation by two pitches is one exact wheel revolution.
  float hand=mod(id.y,2.0)*2.0-1.0;
  float travel=hand*t/PI;
  vec2 z=vec2(fract(q.x-travel)-.5,p.y);
  float radius=1.0/PI;
  ink=ring(z,radius,.010);
  vec2 w=rot(hand*t)*z;
  ink=max(ink,ring(w-vec2(radius*.38,0),radius*(.42+.15*a),.009));
  ink=max(ink,ring(w+vec2(radius*.38,0),radius*(.42+.15*a),.009));
  ink=max(ink,fill(length(w-vec2(0,radius))-.026));
  ink=max(ink,stroke(abs(p.y)-radius,.005)*.45);
 }else if(uKind==2){
  // A rectangular period of the triangular lattice closes on the torus.
  vec2 hq=vec2(q.x,q.y*.8660254038),period=vec2(1,1.7320508076);
  vec2 h0=mod(hq,period)-period*.5,h1=mod(hq-period*.5,period)-period*.5;
  vec2 z=dot(h0,h0)<dot(h1,h1)?h0:h1;
  float row=(hq.y-z.y)/.8660254038;
  float opening=.5+.5*sin(TAU*row/n.y-2.0*t);
  float theta=atan(z.y,z.x),r=length(z);
  float sector=mod(theta+PI/6.0,PI/3.0)-PI/6.0;
  vec2 petal=vec2(r*cos(sector),r*sin(sector));
  petal=rot((opening-.5)*.7*a)*petal;
  float lens=max(length(petal-vec2(.24,.115)),length(petal-vec2(.24,-.115)))-(.135+.040*opening);
  ink=max(stroke(lens,.008),uInk*(.15+.74*mod(floor((theta+PI/6.0)/(PI/3.0))+float(uPalette),2.0))*fill(lens));
  ink=max(ink,ring(z,.075+.08*opening,.007));
  ink=max(ink,fill(length(z)-.025));
 }else if(uKind==3){
  // Each pair of rails exchanges order; a consistent parity chooses the upper rail.
  float y=q.y*.5;
  float x=q.x*.5;
  float local=fract(x)-.5,offset=.26*sin(TAU*y);
  float d0=abs(local-offset),d1=abs(local+offset);
  float over=step(0.0,cos(TAU*y));
  float upper=mix(d1,d0,over),lower=mix(d0,d1,over);
  float w=.018+.009*a;
  ink=stroke(lower-w*2.0,w*.27);
  ink=max(ink,stroke(lower+w*2.0,w*.27));
  ink*=1.0-fill(upper-w*3.2);
  ink=max(ink,stroke(upper-w*2.0,w*.27));
  ink=max(ink,stroke(upper+w*2.0,w*.27));
  ink=max(ink,stroke(upper,w*.21));
  float shade=mix(.15,.90,over);if(uPalette==1)shade=1.0-shade;
  ink=max(ink,uInk*shade*fill(upper-w*1.85));
  ink=max(ink,uInk*(1.0-shade)*fill(lower-w*1.85)*(1.0-fill(upper-w*3.2)));
 }else if(uKind==4){
  // A saddle level passes through its critical value in a single coherent cycle.
  vec2 angle=TAU*q;
  float f=cos(angle.x)+cos(angle.y)+(.38+.35*a)*sin(2.0*t);
  float d=f/max(length(vec2(sin(angle.x),sin(angle.y)))*TAU,.6);
  ink=stroke(d,.011);
  ink=max(ink,.86*stroke(abs(f)-.55,.034));
  ink=max(ink,.62*stroke(abs(f)-1.12,.025));
 }else if(uKind==5){
  // Four orbiting circles are related by a quarter turn, with counter-rotating interiors.
  float turn=ph*.5;
  vec2 z=rot(turn)*p;
  float radius=.145+.025*a*sin(ph);
  for(int k=0;k<4;k++){
   vec2 centre=.23*cis(PI*.5*float(k));
   vec2 w=z-centre;
   ink=max(ink,ring(w,radius,.010));
   ink=max(ink,ring(w,.092,.005));
   ink=max(ink,fill(length(w-radius*cis(-2.0*turn+PI*.5*float(k)))-.020));
  }
  ink=max(ink,ring(z,.038,.006));
 }else if(uKind==6){
  // A disk automorphism moves a circular pencil without breaking its incidence.
  vec2 z=p/.455;
  float radial=length(z);
  vec2 focus=(.22+.24*a)*cis(ph);
  vec2 denominator=vec2(1.0-dot(focus,z),focus.y*z.x-focus.x*z.y);
  vec2 w=divide(z-focus,denominator);
  float r=length(w);
  ink=ring(z,1.0,.015);
  ink=max(ink,stroke(r-.32,.018)*fill(radial-1.0));
  ink=max(ink,stroke(r-.56,.017)*fill(radial-1.0));
  ink=max(ink,stroke(r-.79,.016)*fill(radial-1.0));
  ink=max(ink,fill(length(z-focus)-.05));
 }else if(uKind==7){
  // Five logarithmic arms, with adjacent cells in opposite rotational representations.
  float r=length(p),theta=atan(p.y,p.x);
  float angle=5.0*theta+(.8+.7*a)*log(max(r,.025))-parity*ph;
  vec2 gradient=(5.0*vec2(-p.y,p.x)+(.8+.7*a)*p)/max(dot(p,p),.0001)/TAU;
  float aa=max(.0001,.70*(abs(dot(gradient,dFdx(p)))+abs(dot(gradient,dFdy(p)))));
  float dist=abs(fract(angle/TAU+.5)-.5);
  float arm=mix(1.0-smoothstep(.075-aa,.075+aa,dist),.15,smoothstep(.4,.95,aa));
  ink=arm*fill(r-.425)*(1.0-fill(r-.09));
  ink=max(ink,ring(p,.44,.006));
  ink=max(ink,ring(p,.067,.008));
 }else if(uKind==8){
  // All four edge midpoints remain fixed as the connection pairing changes.
  float h=(.40+.35*a)*sin(TAU*q.y/n.y-2.0*t);
  float f=p.x*p.y-h*(.25-dot(p,p));
  vec2 grad=vec2(p.y,p.x)+2.0*h*p;
  float d=f/max(length(grad),.06);
  ink=stroke(d,.015);
  ink=max(ink,.5*stroke(abs(d)-.050,.004));
 }else if(uKind==9){
  // Superelliptic level curves pass between circular and square symmetry.
  float exponent=2.0+(2.0+4.0*a)*(.5+.5*cos(ph));
  vec2 z=abs(rot(parity*PI*.125*(1.0+sin(ph)))*p);
  float r=pow(pow(z.x,exponent)+pow(z.y,exponent),1.0/exponent);
  ink=stroke(r-.375,.010);
  ink=max(ink,stroke(r-.27,.007));
  ink=max(ink,stroke(r-.16,.006));
  ink=max(ink,fill(r-.045));
 }else if(uKind==10){
  // Cassini ovals split into two components as the focus separation passes b.
  vec2 z=rot(parity*PI*.25)*p;
  float c=.07+(.20+.025*a)*(.5+.5*sin(ph));
  float d0=length(z-vec2(c,0)),d1=length(z+vec2(c,0));
  float product=d0*d1;
  ink=stroke(product-.31*.31,.0032);
  ink=max(ink,stroke(product-.235*.235,.0023));
  ink=max(ink,stroke(product-.16*.16,.0015));
  ink=max(ink,fill(min(d0,d1)-.013));
 }else{
  // Exact Villarceau circle coordinates for R=3, r=1.8, sqrt(R^2-r^2)=2.4.
  float beta=atan(1.8+3.0*cos(v),2.4*sin(v));
  float count=2.0*floor(8.0+uDensity*.055);
  float x=count*(u+beta)/TAU-t/PI,y=count*(u-beta)/TAU+t/PI;
  // Explicit phase gradients avoid derivatives across atan's branch cut.
  float db=-2.4/(3.0+1.8*cos(v));
  float aa0=count/TAU*(abs(dFdx(u)+db*dFdx(v))+abs(dFdy(u)+db*dFdy(v)))*.70;
  float aa1=count/TAU*(abs(dFdx(u)-db*dFdx(v))+abs(dFdy(u)-db*dFdy(v)))*.70;
  float d0=abs(fract(x+.5)-.5),d1=abs(fract(y+.5)-.5);
  float width=.030+.020*a;
  float first=mix(1.0-smoothstep(width-aa0,width+aa0,d0),2.0*width,smoothstep(.4,.95,aa0));
  float second=mix(1.0-smoothstep(width-aa1,width+aa1,d1),2.0*width,smoothstep(.4,.95,aa1));
  ink=max(first,second*.82);
 }
 float far=.14*smoothstep(4.5,9.0,length(vec3(3.65,0,0)-vPosition));
 fragColor=vec4(vec3(1.0-clamp(ink,0.0,1.0)*(.96-far)),1);
}`;
  async function create(gl,vao,count){

    const program=await TorusPrograms.link(gl,vertexSource,TorusLight.fragment(fragmentSource,false));
    const uniforms={};for(const key of ['uViewProjection','uTime','uWave','uDensity','uKind','uInk','uPalette'])uniforms[key]=gl.getUniformLocation(program,key);
    return {draw(matrix,time,wave,density,kind,options={ink:.86,palette:0}){
      gl.useProgram(program);TorusLight.bind(gl,program,options,time);gl.bindVertexArray(vao);gl.uniformMatrix4fv(uniforms.uViewProjection,false,matrix);
      gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uWave,wave);gl.uniform1f(uniforms.uDensity,density);gl.uniform1i(uniforms.uKind,kind);
      gl.uniform1f(uniforms.uInk,options.ink);gl.uniform1i(uniforms.uPalette,options.palette);
      gl.drawElements(gl.TRIANGLES,typeof count==='function'?count():count,gl.UNSIGNED_INT,0);
    }};
  }
  return {create};
})();
