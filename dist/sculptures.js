/* Periodic folded, interlaced and bicontinuous surfaces. */
const TorusSculptures = (() => {
  const vertexSource = `#version 300 es
precision highp float;
layout(location=7) in float aInstance;
layout(location=0) in vec3 aParam;
uniform mat4 uViewProjection;
uniform float uTime;
uniform float uWave;
uniform highp int uKind;
uniform highp int uVariant;
uniform highp int uChunked;
uniform vec2 uGrid;
out vec3 vPosition;
out vec3 vNormal;
out vec3 vLocal;
out vec2 vParam;
flat out float vPart;
const float PI=3.14159265359;
const float TAU=6.28318530718;
vec2 rotate(vec2 p,float a){return mat2(cos(a),sin(a),-sin(a),cos(a))*p;}
vec3 torus(float u,float v,float depth){float r=1.8-depth;return vec3((3.0+r*cos(v))*cos(u),r*sin(v),(3.0+r*cos(v))*sin(u));}
vec2 square(float s){
 float e=fract(s)*4.0,f=fract(e);int side=int(floor(e));
 if(side==0)return vec2(1.0,mix(-1.0,1.0,f));
 if(side==1)return vec2(mix(1.0,-1.0,f),1.0);
 if(side==2)return vec2(-1.0,mix(1.0,-1.0,f));
 return vec2(mix(-1.0,1.0,f),-1.0);
}
vec3 labyrinth(vec3 q,vec2 cell,out vec3 normal){
  float u=TAU*(cell.x+q.x)/uGrid.x,v0=TAU*(cell.y+q.y)/uGrid.y;
 // Two invertible periodic shears carry the entire connected sheet.
 float b=.26*uWave*cos(2.0*v0-uTime);
 u+=.13*uWave*sin(2.0*v0-uTime);
 float c=.39*uWave*cos(3.0*u+uTime);
 v0+=.13*uWave*sin(3.0*u+uTime);
 float envelope=.5+.5*sin(3.0*u+2.0*v0-2.0*uTime);
 float thickness=.16+.19*uWave*envelope;
 float depth=.02+thickness*q.z,v=v0-uTime,r=1.8-depth;
 vec3 tu=vec3(-(3.0+r*cos(v))*sin(u),0,(3.0+r*cos(v))*cos(u));
 vec3 tv=vec3(-r*sin(v)*cos(u),r*cos(v),-r*sin(v)*sin(u));
 vec3 td=-vec3(cos(v)*cos(u),sin(v),cos(v)*sin(u));
 float dh=.095*uWave*cos(3.0*u+2.0*v0-2.0*uTime)*q.z;
 vec3 jx=(tu+c*tv+dh*(3.0+2.0*c)*td)*TAU/uGrid.x;
 vec3 jy=(b*tu+(1.0+c*b)*tv+dh*(3.0*b+2.0*(1.0+c*b))*td)*TAU/uGrid.y;
 vec3 jz=thickness*td;
 vec3 angle=TAU*q+vec3(.17,.31,.13),co=cos(angle),si=sin(angle);
 vec3 gradient=vec3(co.x*co.y-si.z*si.x,co.y*co.z-si.x*si.y,co.z*co.x-si.y*si.z);
 normal=normalize(gradient.x*cross(jy,jz)+gradient.y*cross(jz,jx)+gradient.z*cross(jx,jy));
  return torus(u,v0-uTime,depth);
}
void main(){
 vParam=aParam.xy;vLocal=aParam;vNormal=vec3(0);vPart=0.0;
 vec3 world;
 if(uKind==0){
  float id=floor(aInstance/5.0),level=mod(aInstance,5.0);
  float i=mod(id,uGrid.x),j=floor(id/uGrid.x);
  float u=TAU*(i+.5)/uGrid.x,v0=TAU*(j+.5)/uGrid.y,v=v0-uTime;
  float parity=mod(i+j,2.0)*2.0-1.0;
  float variant=float(uVariant);
  float phase=2.0*u+3.0*v0-2.0*uTime+.48*sin(3.0*u-2.0*v0+uTime);
  float opening=.5+.5*sin(phase-level*.62);
  float scale=pow(.74+.012*variant,level),s=aParam.x,r=aParam.y;
  float twist=parity*(.04+.48*uWave*opening+.11*variant*sin(phase-level));
  vec2 outside=rotate(square(s),parity*(.22+.04*variant)*level);
  vec2 inside=rotate(square(s),parity*(.22+.04*variant)*level+twist)*(.81-.018*variant);
  vec2 xy=mix(inside,outside,r)*(.485*scale);
  float pleat=1.0-abs(2.0*fract(s*(16.0+4.0*variant))-1.0);
  float z=.035+level*(.035+.008*variant)+scale*(.12+.28*uWave*opening)*(1.0-r)
          +.045*scale*uWave*pleat*sin(PI*r+variant*.3);
  float su=(3.0+1.8*cos(v))*TAU/uGrid.x,sv=1.8*TAU/uGrid.y;
  world=torus(u+xy.x*TAU/uGrid.x,v+xy.y*TAU/uGrid.y,z*min(su,sv));
  vPart=level;
 }else if(uKind==1){
  // Level sets X=3u+2v and Y=2u-3v have determinant -13.
  // Even family counts close both the curves and crossing parity at every seam.
  float instance=uChunked==1?floor(aInstance/64.0):aInstance;
  float filament=mod(instance,9.0);
  float ribbon=floor(instance/9.0);
  float family=floor(ribbon/uGrid.x),k=mod(ribbon,uGrid.x);
  float path=uChunked==1?(mod(aInstance,64.0)*(3.0*uGrid.x)+aParam.x)/(192.0*uGrid.x):aParam.x;
  vParam.x=path;
  float s=path*TAU,offset=TAU*k/uGrid.x;
  vec2 uv=family<.5?vec2(2.0*s+offset/3.0,-3.0*s):vec2(3.0*s+offset/2.0,2.0*s);
  float transverse=family<.5?2.0*uv.x-3.0*uv.y:3.0*uv.x+2.0*uv.y;
  float crossing=.5*uGrid.x*transverse+PI*k;
  float weave=(family<.5?1.0:-1.0)*cos(crossing);
  float height=.19+(.085+.015*uWave)*weave;
  float carrier=2.0*uv.x+uv.y-2.0*uTime;
  float spread=.065+.017*uWave*sin(carrier);
  float group=floor(filament/3.0)-1.0,strand=mod(filament,3.0);
  float braid=3.0*crossing-2.0*uTime+group*TAU/3.0+strand*TAU/3.0;
  float across=spread*(group*.72+.20*cos(braid)+(aParam.y-.5)*.12);
  height+=.014*sin(braid);
  float metric=3.0+(1.8-height)*cos(uv.y-uTime);
  vec2 direction=family<.5?vec2(2.0,-3.0):vec2(3.0,2.0);
  vec2 tangent=normalize(direction*vec2(metric,1.8-height));
  uv+=vec2(-tangent.y/metric,tangent.x/(1.8-height))*across;
  // A gentle common diffeomorphism makes the fabric breathe as a whole.
  uv.x+=.065*uWave*sin(2.0*uv.y-uTime);
  uv.y+=.065*uWave*sin(3.0*uv.x+uTime);
  height+=.006*uWave*cos(crossing*2.0+filament*.65)*sin(PI*aParam.y);
  world=torus(uv.x,uv.y-uTime,height);
  vPart=filament;vLocal=vec3(aParam.xy,crossing);
 }else{
  vec2 cell=vec2(mod(aInstance,uGrid.x),floor(aInstance/uGrid.x));
  world=labyrinth(aParam,cell,vNormal);
 }
 vPosition=world;gl_Position=uViewProjection*vec4(world,1);
}`;
  const fragmentSource = `#version 300 es
precision highp float;
uniform highp int uKind;
uniform highp int uVariant;
uniform float uInk;
uniform highp int uPalette;
in vec3 vPosition;
in vec3 vNormal;
in vec3 vLocal;
in vec2 vParam;
flat in float vPart;
out vec4 fragColor;
float line(float p,float width){return torusPeriodic(p,width,fwidth(p));}
void main(){
 vec3 view=normalize(vec3(3.65,0,0)-vPosition);
 vec3 n=uKind==2?normalize(vNormal):normalize(cross(dFdx(vPosition),dFdy(vPosition)));
 if(dot(n,view)<0.0)n=-n;
 float facing=max(0.0,dot(n,view));
 float light=max(0.0,dot(n,normalize(vec3(1.0,1.8,-.8))));
 float paper=.90+.095*light,ink=0.0;
 if(uKind==0){
  float d=min(vParam.y,1.0-vParam.y),aa=max(fwidth(vParam.y),.0001);
  ink=1.0-smoothstep(.028-aa,.028+aa,d);
  ink=max(ink,.9*line(vParam.x*16.0,.020));
  ink=max(ink,.48*line(vParam.y*4.0,.022));
  paper-=(.025+.012*float(uVariant))*vPart;
  if(uVariant>=2)ink=max(ink,.32*line(vParam.x*(16.0+4.0*float(uVariant)),.014));
 }else if(uKind==1){
  float d=min(vParam.y,1.0-vParam.y),aa=max(fwidth(vParam.y),.0001);
  ink=1.0-smoothstep(.22-aa,.22+aa,d);
  ink=max(ink,.32*line(vParam.x*156.0,.065));
  paper=.88+.115*light;
 }else{
  float rim=min(vLocal.z,1.0-vLocal.z),aa=max(fwidth(vLocal.z),.0001);
  ink=1.0-smoothstep(.022-aa,.022+aa,rim);
  ink=max(ink,.88*(1.0-smoothstep(.06,.22,facing)));
  ink=max(ink,(.16+.32*(1.0-light))*line(vLocal.z*18.0,.045));
  paper=.90+.095*light;
 }
 float pigment=uKind==0?mod(vPart,2.0)*.90:mod(vPart,3.0)<.5?.92:.08;
 if(uPalette==1)pigment=1.0-pigment;
 if(uPalette==2)pigment=.14*mod(vPart,6.0);
 if(uPalette==3)pigment=.02;
 paper*=1.0-uInk*pigment;
 float tone=mix(paper,mix(.028,.76,smoothstep(.35,.65,pigment*uInk)),clamp(ink,0.0,1.0));
 float fog=.10*smoothstep(4.2,9.0,length(vec3(3.65,0,0)-vPosition));
 fragColor=vec4(vec3(mix(tone,1.0,fog)),1);
}`;
  async function create(gl){
    const visibility=TorusPerformance.instances(gl),jacquard=TorusPerformance.jacquard(gl);

    const program=await TorusPrograms.link(gl,vertexSource,TorusLight.fragment(fragmentSource,true));
    const uniforms={};for(const n of ['uViewProjection','uTime','uWave','uKind','uVariant','uGrid','uInk','uPalette','uChunked'])uniforms[n]=gl.getUniformLocation(program,n);
    function mesh(vertices,indices){
      const vao=gl.createVertexArray();gl.bindVertexArray(vao);
      const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
      const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);
      return {vao,count:indices.length};
    }
    function grid(nx,ny,raw=false){
      const vertices=[],indices=[];
      for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++)vertices.push(raw?i:i/nx,j/ny,0);
      for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const n=i*(ny+1)+j;indices.push(n,n+1,n+ny+1,n+1,n+ny+2,n+ny+1);}
      return mesh(vertices,indices);
    }
    const meshes=new Map();
    function prepare(kind,variant=0,options={},density=88){
      // Allocate the selected construction before the transition commits.
      // Keep pleat peaks aligned with vertices at every construction.
      const segments=3*(2*Math.round((6+density*.025)/2));
      const key=kind===0?kind+":"+variant:kind===1?kind+":"+segments:String(kind);
      let m=meshes.get(key);if(!m){m=kind===0?grid(2*(16+4*variant),2):kind===1?grid(segments,1,true):mesh(TORUS_GYROID.vertices,TORUS_GYROID.indices);meshes.set(key,m);}
      return m;
    }
    return {
      prepare,
      draw(matrix,time,wave,density,kind,variant=0,options={ink:.86,palette:0}){
        const m=prepare(kind,variant,options,density);
        const even=x=>Math.round(x/2)*2;
        let nx=even(14+density*.045),ny=16,parts=5;
        if(kind===1){nx=even(6+density*.025);ny=1;parts=18;}
        if(kind===2){nx=even(10+density*.045);ny=12;parts=1;}
        gl.useProgram(program);TorusLight.bind(gl,program,options,time);gl.uniformMatrix4fv(uniforms.uViewProjection,false,matrix);
        gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uWave,wave);gl.uniform1i(uniforms.uKind,kind);gl.uniform1i(uniforms.uVariant,variant);gl.uniform2f(uniforms.uGrid,nx,ny);
        gl.uniform1f(uniforms.uInk,options.ink);gl.uniform1i(uniforms.uPalette,options.palette);
        gl.uniform1i(uniforms.uChunked,kind===1?1:0);
        const count=kind===1?jacquard.bind(m.vao,matrix,nx,time):visibility.bind(m.vao,matrix,nx,ny,parts,time,kind===0?.8:0);
        if(count)gl.drawElementsInstanced(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0,count);
      }
    };
  }
  return {create};
})();
