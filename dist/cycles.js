/* Four sculptural cycles with one phase field and finite rotational symmetries. */
const TorusCycles = (() => {
 const vertexSource = `#version 300 es
precision highp float;
layout(location=0) in vec3 aParam;
uniform mat4 uViewProjection;
uniform float uTime;
uniform float uWave;
uniform vec2 uGrid;
uniform highp int uKind;
out vec3 vPosition;
out vec2 vParam;
flat out float vPart;
const float PI=3.14159265359;
const float TAU=6.28318530718;
mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,s,0,-s,c);}
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0,-s,c,0,0,0,1);}
float ease(float x){return x*x*x*(x*(x*6.0-15.0)+10.0);}
vec3 torus(float u,float v,float d){float r=1.8-d;return vec3((3.0+r*cos(v))*cos(u),r*sin(v),(3.0+r*cos(v))*sin(u));}
void main(){
 float parts=uKind==1?2.0:1.0;
 float id=floor(float(gl_InstanceID)/parts),part=mod(float(gl_InstanceID),parts);
 float i=mod(id,uGrid.x),j=floor(id/uGrid.x);
 float u=TAU*(i+.5)/uGrid.x,v0=TAU*(j+.5)/uGrid.y,v=v0-uTime;
 float phase=TAU*j/uGrid.y-2.0*uTime;
 float hand=mod(i,2.0)*2.0-1.0;
 float su=(3.0+1.8*cos(v))*TAU/uGrid.x,sv=1.8*TAU/uGrid.y,size=min(su,sv);
 vec3 p;
 vParam=aParam.xy;vPart=aParam.z;
 if(uKind==0){
  float progress=phase/PI;
  float angle=PI*(floor(progress)+mix(fract(progress),ease(fract(progress)),.25+.75*uWave));
  float y=(aParam.y-.5)*sv*.83;
  p=vec3((aParam.x-.5)*su*.84,y*cos(angle),.025+abs(sin(angle))*sv*.415+y*sin(angle));
 }else if(uKind==1){
  float opening=.5+.5*sin(phase+part*PI);
  float spread=.22+(.90+.12*uWave)*opening;
  float theta=(aParam.x-.5)*spread*PI;
  float r=.46*aParam.y;
  float pleat=1.0-abs(2.0*fract(aParam.x*12.0)-1.0);
  p=vec3(r*sin(theta),r*cos(theta)-.22,.028+r*.30*(1.0-opening*.72)*pleat);
  p=rz(part*PI)*p;
  p*=vec3(su,sv,size);vPart=part;
 }else if(uKind==2){
  float s=aParam.x*TAU,w=(aParam.y-.5)*.22;
  p=vec3((.31+w*cos(s*.5))*cos(s),(.31+w*cos(s*.5))*sin(s),hand*w*sin(s*.5));
  p=rz(phase)*rx((.38+.75*uWave)*sin(phase))*p;
  p.z+=.44;p*=vec3(su,sv,size);
 }else{
  int f=int(aParam.z+.1);
  vec3 signs=vec3((f&1)==0?1.0:-1.0,(f&2)==0?1.0:-1.0,(f&4)==0?1.0:-1.0);
  p=vec3(1.0-aParam.x-aParam.y,aParam.x,aParam.y)*signs;
  float progress=3.0*phase/TAU;
  float angle=hand*TAU/3.0*(floor(progress)+ease(fract(progress)));
  vec3 axis=normalize(vec3(1));
  p=p*cos(angle)+cross(axis,p)*sin(angle)+axis*dot(axis,p)*(1.0-cos(angle));
  p*=vec3(su,sv,size)*(.40+.025*uWave);p.z+=size*.46+.018;
 }
 vPosition=torus(u+p.x/(3.0+1.8*cos(v)),v+p.y/1.8,p.z);
 gl_Position=uViewProjection*vec4(vPosition,1);
}`;
 const fragmentSource = `#version 300 es
precision highp float;
uniform highp int uKind;
in vec3 vPosition;
in vec2 vParam;
flat in float vPart;
out vec4 fragColor;
float line(float p,float w){return torusPeriodic(p,w,fwidth(p));}
void main(){
 vec3 view=normalize(vec3(3.65,0,0)-vPosition);
 vec3 n=normalize(cross(dFdx(vPosition),dFdy(vPosition)));if(dot(n,view)<0.0)n=-n;
 float light=max(0.0,dot(n,normalize(vec3(1,1.8,-.6))));
 float paper=.92+.075*light,ink=0.0;
 vec2 aa=max(fwidth(vParam)*.8,vec2(.0001));
 vec2 edge=min(vParam,1.0-vParam);
 if(uKind==0){
  ink=1.0-min(smoothstep(.018-aa.x,.018+aa.x,edge.x),smoothstep(.018-aa.y,.018+aa.y,edge.y));
  float stripe=abs(vParam.x-.5);
  ink=max(ink,(1.0-smoothstep(.025-aa.x,.025+aa.x,stripe))*smoothstep(.10,.12,vParam.y)*(1.0-smoothstep(.88,.90,vParam.y)));
 }else if(uKind==1){
  ink=1.0-min(smoothstep(.012-aa.x,.012+aa.x,edge.x),smoothstep(.022-aa.y,.022+aa.y,edge.y));
  ink=max(ink,.86*line(vParam.x*12.0,.022));
  paper=.90+.095*light;
 }else if(uKind==2){
  ink=1.0-smoothstep(.095-aa.y,.095+aa.y,edge.y);
  ink=max(ink,.45*line(vParam.y*2.0,.025));
 }else{
  float d=min(min(vParam.x,vParam.y),1.0-vParam.x-vParam.y),w=max(fwidth(d)*.8,.0001);
  ink=1.0-smoothstep(.020-w,.020+w,d);
  if(vPart<.5){float marker=length(vec3(vParam,1.0-vParam.x-vParam.y)-vec3(1.0/3.0));ink=max(ink,1.0-smoothstep(.10-w,.10+w,marker));}
  paper=.88+.115*light;
 }
 float tone=mix(paper,.025,clamp(ink,0.0,1.0));
 float fog=.10*smoothstep(4.2,9.0,length(vec3(3.65,0,0)-vPosition));
 fragColor=vec4(vec3(mix(tone,1.0,fog)),1);
}`;
 async function create(gl){

  const program=await TorusPrograms.link(gl,vertexSource,TorusLight.fragment(fragmentSource,false));
  const uniforms={};for(const n of ['uViewProjection','uTime','uWave','uGrid','uKind'])uniforms[n]=gl.getUniformLocation(program,n);
  function upload(vertices,indices){
   const vao=gl.createVertexArray();gl.bindVertexArray(vao);
   const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
   gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
   const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);
   return {vao,count:indices.length};
  }
  function grid(nx,ny){
   const v=[],ix=[];
   for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++)v.push(i/nx,j/ny,0);
   for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const k=i*(ny+1)+j;ix.push(k,k+1,k+ny+1,k+1,k+ny+2,k+ny+1);}
   return upload(v,ix);
  }
  const meshes=[];
  function prepare(kind){
   if(meshes[kind])return meshes[kind];
   if(kind<3)return meshes[kind]=grid(...[[6,6],[48,6],[96,6]][kind]);
   const vertices=[],indices=[];
   for(let f=0;f<8;f++){vertices.push(0,0,f,1,0,f,0,1,f);indices.push(f*3,f*3+1,f*3+2);}
   return meshes[kind]=upload(vertices,indices);
  }
  return {prepare,draw(matrix,time,wave,density,kind){
   const mesh=prepare(kind);
   const nx=Math.max(16,4*Math.floor(3+density*.025)),ny=nx*1.5,parts=kind===1?2:1;
   gl.useProgram(program);gl.bindVertexArray(mesh.vao);gl.uniformMatrix4fv(uniforms.uViewProjection,false,matrix);
   gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uWave,wave);gl.uniform2f(uniforms.uGrid,nx,ny);gl.uniform1i(uniforms.uKind,kind);
   gl.drawElementsInstanced(gl.TRIANGLES,mesh.count,gl.UNSIGNED_INT,0,nx*ny*parts);
  }};
 }
 return {create};
})();
