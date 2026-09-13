/* Linked frames, shared hinges, cubic exchanges and an eight-map recursive IFS. */
const TorusMechanisms=(()=>{
 const vertexSource = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aAnchor;
layout(location=2) in vec2 aUV;
layout(location=3) in vec3 aMeta;
layout(location=7) in float aInstance;
layout(location=4) in vec3 aOuter0;layout(location=5) in vec3 aOuter1;layout(location=6) in vec3 aOuter2;
layout(location=8) in vec3 aFirst0;layout(location=9) in vec3 aFirst1;layout(location=10) in vec3 aFirst2;
layout(location=11) in vec3 aSecond0;layout(location=12) in vec3 aSecond1;layout(location=13) in vec3 aSecond2;
layout(location=14) in vec4 aCentre;
uniform mat4 uViewProjection;
uniform vec2 uGrid;
uniform float uTime,uWave,uTurns;
uniform highp int uKind,uVariant;
uniform highp int uFrames;
out vec3 vPosition;
out vec2 vUV;
flat out vec3 vMeta;
const float PI=3.14159265359,TAU=6.28318530718;
mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,s,0,-s,c);}
mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0,-s,0,1,0,s,0,c);}
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0,-s,c,0,0,0,1);}
void main(){
 if(uKind==5&&uFrames==1){
  float code=aMeta.z;vec3 p=mat3(aOuter0,aOuter1,aOuter2)*aPosition;
  if(aMeta.y>0.0){float digit=mod(code,8.0);vec3 corner=vec3(mod(digit,2.0),mod(floor(digit/2.0),2.0),floor(digit/4.0))*2.0-1.0;p+=mat3(aFirst0,aFirst1,aFirst2)*corner;}
  if(aMeta.y>1.0){float digit=floor(code/8.0);vec3 corner=vec3(mod(digit,2.0),mod(floor(digit/2.0),2.0),floor(digit/4.0))*2.0-1.0;p+=mat3(aSecond0,aSecond1,aSecond2)*corner;}
  vPosition=aCentre.xyz+p;vUV=aUV;vMeta=vec3(aMeta.x,aMeta.z,aCentre.w);gl_Position=uViewProjection*vec4(vPosition,1);return;
 }
 float i=mod(aInstance,uGrid.x),j=floor(aInstance/uGrid.x),u=TAU*(i+.5)/uGrid.x,v0=TAU*(j+.5)/uGrid.y,v=v0-uTime;
 float t=uTime,hand=mod(i+j,2.0)*2.0-1.0,part=aMeta.z;
 float ph=2.0*u+3.0*v0-2.0*uTurns*t+.28*uWave*sin(3.0*u-2.0*v0+t);
 vec3 p=aPosition;float lift=.62;
 if(uKind==0){
  float side=part<.5?-1.0:1.0,angle=side*(ph-.7*uWave*sin(ph));
  p=rx(angle)*p+vec3(side*.245,.10*sin(ph+side*PI/2.0),0);
  if(uVariant==1)p=ry(.55*sin(ph))*p;if(uVariant==2)p=rz(hand*.45*sin(ph))*p;
 }else if(uKind==1){
  // Two disjoint rectangular loops in the configuration of a Hopf link.
  if(part>.5)p=rx(PI/2.0)*p;
  p.x+=part<.5?-.18:.18;
  p=rz(.30*sin(ph))*ry(ph)*p;
  if(uVariant==1)p=rx(hand*ph)*p;if(uVariant==2)p=rz(-ph)*p;
 }else if(uKind==2){
  float side=mod(part,2.0)*2.0-1.0,axis=floor(part/2.0);
  float angle=side*(.78+.78*sin(ph+axis*PI));
  vec3 anchor=axis<.5?vec3(side*.16,0,0):vec3(0,side*.16,0);
  p=(axis<.5?ry(angle):rx(-angle))*p+anchor;
  if(uVariant==1)p=rz(.35*sin(ph))*p;if(uVariant==2)p=ry(.5*sin(ph))*p;
 }else if(uKind==3){
  float parity=mod(part+floor(part/2.0)+floor(part/4.0),2.0)*2.0-1.0;
  p=rz(parity*ph)*ry(.35*sin(ph))*p+aAnchor*(.84+.22*uWave*sin(ph));
  p=ry(ph)*rx(uVariant==1?ph:.3*sin(ph))*p;
  if(uVariant==2)p=rz(-ph)*p;
 }else if(uKind==4){
  float family=floor(part/3.0),strand=mod(part,3.0)-1.0;
  p=rx(.32*uWave*sin(ph+strand))*p;
  p.y+=strand*.25;p.z+=family<.5?.10+.07*sin(ph):-.10-.07*sin(ph);
  if(family>.5)p=rz(PI/2.0)*p;
  if(uVariant==1)p=rz(.18*sin(ph))*p;if(uVariant==2)p=ry(.32*sin(ph))*p;
  lift=.38;
 }else if(uKind==5){
  // Repeated corner maps, with a common rotation at each recursive scale.
  float code=part,s=1.0;vec3 centre=vec3(0);
  for(int k=0;k<3;k++){
   if(float(k)>=aMeta.y)break;
   float digit=mod(code,8.0);code=floor(code/8.0);
   vec3 corner=vec3(mod(digit,2.0),mod(floor(digit/2.0),2.0),floor(digit/4.0))*2.0-1.0;
   mat3 turn=ry((mod(float(k),2.0)*2.0-1.0)*ph)*rx(.4*sin(ph-float(k)));
   if(uVariant==1)turn=rz(ph+float(k)*.6)*ry(.25*sin(ph));
   if(uVariant==2)turn=rx(ph)*rz(-ph+float(k)*.45);
   centre+=turn*corner*(s/3.0);s/=3.0;
  }
  p=ry(ph)*p+centre;lift=.88;
  }else if(uKind==6){
  // Three orthogonal pairs separate along their own axes, then counterturn.
  float axis=floor(part/2.0),side=mod(part,2.0)*2.0-1.0;
  float open=.18+(.08+.23*uWave)*(.5+.5*sin(ph+axis*TAU/3.0));
  p=rx(side*(ph+.22*sin(ph)))*p+vec3(0,side*open,side*.10);
  if(axis>.5&&axis<1.5)p=rz(PI/2.0)*p;if(axis>1.5)p=ry(PI/2.0)*p;
  p=ry(.40*sin(ph))*rz(uVariant==1?ph:.25*sin(ph))*p;
  if(uVariant==2)p=rx(-ph)*p;lift=.94;
 }else if(uKind==7){
  // A quartet of hinged elbow units turns about a moving square of pivots.
  float angle=part*PI/2.0,orbit=.22+.15*uWave*(.5+.5*sin(ph));
  vec3 centre=vec3(orbit*cos(angle),orbit*sin(angle),.08*cos(ph+angle));
  p=rz(-angle+ph)*rx(.55*sin(ph+angle))*p+centre;
  p=rz(-ph)*ry(uVariant==1?ph:.3*sin(ph))*p;
  if(uVariant==2)p=rx(ph)*p;lift=.84;
 }else if(uKind==8){
  // Six square petals turn about fixed edges of a cubic nucleus.
  float axis=floor(part/2.0),side=mod(part,2.0)*2.0-1.0;
  float angle=(.5+.5*sin(ph+axis*TAU/3.0))*(.7+1.2*uWave);
  p=ry(side*angle)*(p-vec3(.20,0,0))+vec3(.20,0,side*.20);
  if(axis>.5&&axis<1.5)p=rx(PI/2.0)*p;if(axis>1.5)p=ry(PI/2.0)*p;
  p=ry(ph)*rz(uVariant==1?ph:.24*sin(ph))*p;if(uVariant==2)p=rx(-ph)*p;lift=.92;
 }else if(uKind==9){
  float code=part,offset=0.0,scale=1.0;
  for(int k=0;k<3;k++){if(float(k)>=aMeta.y)break;offset+=(mod(code,2.0)*2.0-1.0)*scale/3.0;code=floor(code/2.0);scale/=3.0;}
  float angle=ph+offset*5.0;
  p=ry(angle)*p+vec3(offset,0,.13*sin(angle));
  if(uVariant==1)p=rz(ph)*p;if(uVariant==2)p=rx(-ph)*rz(.6*sin(ph))*p;lift=.80;
 }else if(uKind==10){
  float level=part,angle=ph+level*(PI/4.0+.52*uWave*sin(ph));
  p=rz(angle)*p+vec3(0,0,(level-(aMeta.y-1.0)*.5)*.13);
  p=ry(.7*sin(ph))*p;if(uVariant==1)p=rx(ph)*p;if(uVariant==2)p=ry(ph)*p;lift=.94;
 }else if(uKind==11){
  if(part<.5)p=ry(ph)*rz(.32*sin(ph))*p;
  else p=rx(-ph)*ry(.4*sin(ph))*p;
  p=rz(.3*uWave*sin(ph))*rx(uVariant==1?ph:.25*sin(ph))*p;
  if(uVariant==2)p=ry(-ph)*p;lift=.90;
 }

 float su=(3.0+1.8*cos(v))*TAU/uGrid.x,sv=1.8*TAU/uGrid.y,size=min(su,sv)*.88;
 if(uKind==4)p*=vec3(su*.98,sv*.98,size);else p*=size;
 vec3 tu=vec3(-sin(u),0,cos(u)),tv=vec3(-sin(v)*cos(u),cos(v),-sin(v)*sin(u));
 vec3 inward=-vec3(cos(v)*cos(u),sin(v),cos(v)*sin(u));
 vPosition=vec3((3.0+1.8*cos(v))*cos(u),1.8*sin(v),(3.0+1.8*cos(v))*sin(u))+tu*p.x+tv*p.y+inward*(lift*size+p.z);
 vUV=aUV;vMeta=vec3(aMeta.x,part,ph);gl_Position=uViewProjection*vec4(vPosition,1);
}`;
 const fragmentSource = `#version 300 es
precision highp float;
uniform float uInk;
uniform highp int uVariant,uPalette;
in vec3 vPosition;
in vec2 vUV;
flat in vec3 vMeta;
out vec4 fragColor;
void main(){
 vec3 view=normalize(vec3(3.65,0,0)-vPosition),n=normalize(cross(dFdx(vPosition),dFdy(vPosition)));if(dot(n,view)<0.0)n=-n;
 float face=vMeta.x,part=vMeta.y,ph=vMeta.z;
 float pigment=mod(face+part,3.0)<.5?.035:mod(face+part,3.0)<1.5?.94:.48;
 if(uPalette==1)pigment=mod(face+part,2.0)*.95;if(uPalette==2)pigment=.04+.16*mod(face+part,6.0);if(uPalette==3)pigment=.02;
 float travelling=.5+.5*sin(ph+part*1.2+face*1.57079632679);
 if(uVariant==2)pigment=mix(pigment,1.0-pigment,.85*travelling);
 float light=.80+.20*max(0.0,dot(n,normalize(vec3(-.6,1.4,-.8)))),tone=(.98-uInk*pigment)*light;
 vec2 edge=min(vUV,1.0-vUV),aa=max(fwidth(vUV)*.8,vec2(.0002));float rim=1.0-min(smoothstep(.028-aa.x,.028+aa.x,edge.x),smoothstep(.028-aa.y,.028+aa.y,edge.y));
 // A travelling pigment crosses middle grey smoothly; its rim must do so too.
 tone=mix(tone,mix(.025,.87,smoothstep(.35,.65,pigment)),rim*.85);
 fragColor=vec4(vec3(mix(tone,1.0,.10*smoothstep(4.5,9.0,length(vec3(3.65,0,0)-vPosition)))),1);
}`;
 function meshData(kind,depth=3){
  const vertices=[],indices=[];
  function box(c,size,part,level=0,anchor=[0,0,0]){
   for(let face=0;face<6;face++){
    const axis=Math.floor(face/2),other=(axis+1)%3,last=(axis+2)%3,o=vertices.length/11;
    [[0,0],[1,0],[1,1],[0,1]].forEach(([x,y])=>{const p=c.slice();p[axis]+=(face%2?1:-1)*size[axis]/2;p[other]+=(x-.5)*size[other];p[last]+=(y-.5)*size[last];vertices.push(...p,...anchor,x,y,face,level,part);});if(face%2)indices.push(o,o+1,o+2,o,o+2,o+3);else indices.push(o,o+2,o+1,o,o+3,o+2);
   }
  }
  function beam(a,b,width,part){
   const d=b.map((v,i)=>v-a[i]),len=Math.hypot(...d),x=d.map(v=>v/len),seed=Math.abs(x[2])<.9?[0,0,1]:[0,1,0];
   let y=[seed[1]*x[2]-seed[2]*x[1],seed[2]*x[0]-seed[0]*x[2],seed[0]*x[1]-seed[1]*x[0]],n=Math.hypot(...y);y=y.map(v=>v/n);
   const z=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]],o=vertices.length;
   box([0,0,0],[len,width,width],part);
   for(let k=o;k<vertices.length;k+=11){const p=vertices.slice(k,k+3);for(let j=0;j<3;j++)vertices[k+j]=(a[j]+b[j])/2+x[j]*p[0]+y[j]*p[1]+z[j]*p[2];}
  }
  if(kind===0)for(let k=0;k<2;k++)box([0,0,0],[.32,.32,.32],k);
  if(kind===1)for(let k=0;k<2;k++)for(let side=0;side<4;side++)box([side<2?(side===0?-.34:.34):0,side>=2?(side===2?-.34:.34):0,0],side<2?[.075,.755,.075]:[.605,.075,.075],k);
  if(kind===2)for(let k=0;k<4;k++){const side=k%2?1:-1;box(k<2?[side*.18,0,0]:[0,side*.18,0],k<2?[.36,.14,.08]:[.14,.36,.08],k);}
  if(kind===3)for(let k=0;k<8;k++)box([0,0,0],[.22,.22,.22],k,0,[k%2?1:-1,Math.floor(k/2)%2?1:-1,k<4?-1:1].map(x=>x*.24));
  if(kind===4)for(let k=0;k<6;k++)box([0,0,0],[.94,.105,.105],k);
  if(kind===5){const d=Math.max(0,Math.min(3,depth-1));for(let k=0;k<8**d;k++)box([0,0,0],Array(3).fill(.86/3**d),k,d);}
  if(kind===6)for(let k=0;k<6;k++)box([0,0,0],[.78,.10,.10],k);
  if(kind===7)for(let k=0;k<4;k++){box([.08,0,0],[.30,.09,.12],k);box([.19,.12,0],[.09,.24,.12],k);}
  if(kind===8)for(let k=0;k<6;k++)box([0,0,0],[.38,.38,.045],k);
  if(kind===9){const d=Math.max(1,Math.min(3,depth));for(let k=0;k<2**d;k++)box([0,0,0],[.74/3**d,.72,.08],k,d);}
  if(kind===10){const n=2*depth+1;for(let k=0;k<n;k++)box([0,0,0],[.57,.57,.040],k,n);}
  if(kind===11){
   const v=[[.48,0,0],[-.48,0,0],[0,.48,0],[0,-.48,0],[0,0,.48],[0,0,-.48]];
   for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)if(Math.floor(i/2)!==Math.floor(j/2))beam(v[i],v[j],.045,0);
   box([0,0,0],[.30,.30,.30],1);
  }
  return {vertices,indices};
 }
 async function create(gl){
  const visibility=TorusPerformance.instances(gl),cache=new Map(),configuredFrames=new WeakSet();
  const frameData=new Float32Array(8192*31),frameBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,frameBuffer);gl.bufferData(gl.ARRAY_BUFFER,frameData,gl.DYNAMIC_DRAW);
  const program=await TorusPrograms.link(gl,vertexSource,TorusLight.fragment(fragmentSource,true));
  const u={};for(const n of ['uViewProjection','uGrid','uTime','uWave','uTurns','uKind','uVariant','uInk','uPalette','uFrames'])u[n]=gl.getUniformLocation(program,n);
  function prepare(kind,variant=0,options={recursion:3}){
   const depth=Math.min(kind===10?4:3,options.recursion),key=kind+':'+([5,9,10].includes(kind)?depth:1);let m=cache.get(key);
   if(!m){const data=meshData(kind,depth),vao=gl.createVertexArray();gl.bindVertexArray(vao);const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.vertices),gl.STATIC_DRAW);let offset=0;[3,3,2,3].forEach((size,i)=>{gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,44,offset*4);offset+=size;});const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(data.indices),gl.STATIC_DRAW);m={vao,count:data.indices.length};cache.set(key,m);}
   return m;
  }
  return {prepare,draw(matrix,time,wave,density,kind,variant,options){
   const m=prepare(kind,variant,options);
   const nx=2*Math.round((10+density*.045)/2),ny=nx;gl.useProgram(program);TorusLight.bind(gl,program,options,time);
   gl.uniformMatrix4fv(u.uViewProjection,false,matrix);gl.uniform2f(u.uGrid,nx,ny);gl.uniform1f(u.uTime,time);gl.uniform1f(u.uWave,wave);gl.uniform1f(u.uTurns,options.turns);gl.uniform1i(u.uKind,kind);gl.uniform1i(u.uVariant,variant);gl.uniform1f(u.uInk,options.ink);gl.uniform1i(u.uPalette,options.palette);
   gl.uniform1i(u.uFrames,kind===5?1:0);
   const count=visibility.bind(m.vao,matrix,nx,ny,1,time,1.5);
   if(kind===5&&count){
    TorusPerformance.cornerFrames(visibility.ids,count,nx,ny,time,wave,options.turns,variant,frameData);
    gl.bindBuffer(gl.ARRAY_BUFFER,frameBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,frameData,0,count*31);
    if(!configuredFrames.has(m.vao)){const slots=[4,5,6,8,9,10,11,12,13,14];for(let i=0;i<slots.length;i++){gl.enableVertexAttribArray(slots[i]);gl.vertexAttribPointer(slots[i],i===9?4:3,gl.FLOAT,false,124,i*12);gl.vertexAttribDivisor(slots[i],1);}configuredFrames.add(m.vao);}
   }
   if(kind===5)gl.enable(gl.CULL_FACE);
      if(count)gl.drawElementsInstanced(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0,count);
      if(kind===5)gl.disable(gl.CULL_FACE);
  }};
 }
 return {create,meshData};
})();
