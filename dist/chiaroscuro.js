/* Finite self-similar constructions, physical facets, and closed torus windings. */
const TorusChiaroscuro = (() => {
  const vertexSource = `#version 300 es
precision highp float;
layout(location=7) in float aInstance;
layout(location=8) in vec3 aTurn0;
layout(location=9) in vec3 aTurn1;
layout(location=10) in vec3 aTurn2;
layout(location=11) in vec4 aCell;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
layout(location=3) in vec3 aAnchor;
layout(location=4) in vec3 aMeta;
uniform mat4 uViewProjection;
uniform vec2 uGrid;
uniform float uTime,uWave,uTurns;
uniform highp int uKind,uVariant,uWinding;
out vec3 vPosition;
out vec3 vNormal;
out vec2 vUV;
flat out vec3 vMeta;
const float PI=3.14159265359,TAU=6.28318530718;
mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,s,0,-s,c);}
mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0,-s,0,1,0,s,0,c);}
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0,-s,c,0,0,0,1);}
vec3 axisRotate(vec3 p,vec3 axis,float a){float c=cos(a),s=sin(a);return p*c+cross(axis,p)*s+axis*dot(axis,p)*(1.0-c);}
vec3 torus(float u,float v,float h){float r=1.8-h;return vec3((3.0+r*cos(v))*cos(u),r*sin(v),(3.0+r*cos(v))*sin(u));}
mat3 basis(float u,float v){return mat3(vec3(-sin(u),0,cos(u)),vec3(-sin(v)*cos(u),cos(v),-sin(v)*sin(u)), -vec3(cos(v)*cos(u),sin(v),cos(v)*sin(u)));}
vec2 winding(){if(uWinding==0)return vec2(1,0);if(uWinding==1)return vec2(1,1);if(uWinding==2)return vec2(2,3);return vec2(3,5);}
// Analytic derivative of both nested braids and their moving torus frame.
vec3 cable(float s,float group,float strand,out vec3 derivative,out vec3 normal){
 vec2 pq=winding();float P=pq.x,Q=pq.y;
 float u=P*s+TAU*group/uGrid.x,v=Q*s-uTime,cu=cos(u),su=sin(u),cv=cos(v),sv=sin(v);
 normal=-vec3(cv*cu,sv,cv*su);
 vec3 tu=vec3(-su,0,cu),tv=vec3(-sv*cu,cv,-sv*su);
 vec3 dn=-P*cv*tu-Q*tv,dtu=P*(cv*normal+sv*tv),dtv=Q*normal-P*sv*tu;
 float A=P*(3.0+1.58*cv),B=Q*1.58,L=length(vec2(A,B));
 vec3 tangent=(A*tu+B*tv)/L;
 vec3 dT=-P*1.58*Q*sv*tu+A*dtu+B*dtv;dT=(dT-tangent*dot(tangent,dT))/L;
 vec3 across=cross(tangent,normal),dAcross=cross(dT,normal)+cross(tangent,dn);
 float parent=floor(strand/3.0),child=mod(strand,3.0),k=uVariant==1?9.0:6.0,f=uVariant==2?-18.0:18.0;
 float twist=k*s-uTurns*uTime+parent*TAU/3.0,fine=f*s+2.0*uTurns*uTime+child*TAU/3.0+parent*TAU/9.0;
 vec2 off=.083*vec2(cos(twist),sin(twist))+.027*vec2(cos(fine),sin(fine));
 vec2 dOff=.083*k*vec2(-sin(twist),cos(twist))+.027*f*vec2(-sin(fine),cos(fine));
 derivative=P*(3.0+1.55*cv)*tu+Q*1.55*tv+dOff.x*across+off.x*dAcross+dOff.y*normal+off.y*dn;
 return vec3((3.0+1.55*cv)*cu,1.55*sv,(3.0+1.55*cv)*su)+off.x*across+off.y*normal;
}
void main(){
 float t=uTime,a=uWave,l=aMeta.y,part=aMeta.z;
 vUV=aUV;vMeta=aMeta;vec3 world,N;
 if(uKind==0){
  mat3 turn=mat3(aTurn0,aTurn1,aTurn2);
  vec3 p=turn*(aPosition+aAnchor*aCell.w)*(.75*aCell.z);
  mat3 frame=basis(aCell.x,aCell.y);
  world=torus(aCell.x,aCell.y,0.0)+frame*(p+vec3(0,0,.68*aCell.z));N=frame*turn*aNormal;
 }else if(uKind==6){
  float family=aMeta.z,hand=family<.5?1.0:-1.0;
  float v=aUV.x*TAU,offset=TAU*aInstance/uGrid.x+hand*t*uTurns;
  float beta=atan(1.8+3.0*cos(v),2.4*sin(v));
  float u=hand*beta+offset;
  float other=u+hand*beta;
  float across=(aUV.y-.5)*(.12+.10*a)/max(1.2,3.0+1.8*cos(v));
  float height=.095+hand*.038*cos(uGrid.x*(other+hand*t*uTurns));
  if(uVariant==1)height+=.018*sin(4.0*v-2.0*t);
  if(uVariant==2)across*=.6+.25*cos(6.0*v-2.0*t);
  world=torus(u+across,v,height);N=basis(u,v)[2];
  vMeta=vec3(family*3.0,0,family);
 }else if(uKind==7){
  float group=aInstance,s=aUV.x*TAU;
  vec3 derivative,normal;vec3 c=cable(s,group,part,derivative,normal),tangent=normalize(derivative);
  normal=normalize(normal-tangent*dot(normal,tangent));
  N=cos(aUV.y*TAU)*normal+sin(aUV.y*TAU)*cross(tangent,normal);
  world=c+.012*N;vMeta=vec3(mod(part,3.0)*2.0,floor(part/3.0),part);
 }else{
  float id=aInstance,i=mod(id,uGrid.x),j=floor(id/uGrid.x);
  float u=TAU*(i+.5)/uGrid.x,v0=TAU*(j+.5)/uGrid.y,v=v0-t;
  float hand=mod(i+j,2.0)*2.0-1.0;
  float clock=2.0*u+2.0*v0-uTurns*t;
  float ph=clock+.24*a*sin(3.0*u-2.0*v0+t);
  vec3 p=aPosition;N=aNormal;
  mat3 turn=mat3(1);
  float lift=.56,scale=1.0;
  if(uKind==0){
   // Removing the middle slab in two or more axes gives the Menger IFS.
   turn=rz(.22*a*sin(ph))*ry(.22+.34*a*sin(ph))*rx(ph-.72*a*sin(ph));
   if(uVariant==1)p+=aAnchor*.32*a*(.5+.5*sin(ph));
   if(uVariant==2)turn=rz(ph)*ry(ph-.6*sin(ph))*rx(.35*sin(2.0*ph));
   p=turn*p;N=turn*N;scale=.75;lift=.68;
  }else if(uKind==1){
   if(uVariant==1){mat3 small=rz(.38*a*sin(ph-l*.65));p=small*(p-aAnchor)+aAnchor*(1.0+.18*a*sin(ph));N=small*N;}
   turn=rz(.16*sin(ph))*ry(ph)*rx(.45+.20*a*cos(ph));
   if(uVariant==2)turn=rz(-ph)*ry(.45*sin(ph))*rx(ph);
   p=turn*p;N=turn*N;scale=.90;lift=.56;
  }else if(uKind==2){
   float angle=(mod(l,2.0)*2.0-1.0)*(ph+.55*l);
   turn=rz(.23*l)*ry(angle)*rx(.34*a*sin(ph-l*.6));
   if(uVariant==1)turn=rx(angle)*ry(.32*l)*rz(-angle);
   if(uVariant==2)turn=rz(angle)*ry(angle)*rx(.24*l);
   p=turn*p;N=turn*N;scale=.84;lift=.67;
  }else if(uKind==3){
   float s=aUV.x,w=aUV.y-.5,r=(.14+.36*s)*pow(.82,l);
   float theta=TAU*s+part*TAU/3.0+l*.58;
   float twist=(uVariant==1?-1.0:1.0)*(.7+1.1*a*sin(ph-l*.65));
   float width=.085*pow(.82,l);
   p=vec3((r+w*width*cos(twist*PI*s))*cos(theta),(r+w*width*cos(twist*PI*s))*sin(theta),.055*l+w*width*sin(twist*PI*s));
   float beta=twist*PI*s,R=r+w*width*cos(beta),dr=.36*pow(.82,l)-w*width*twist*PI*sin(beta);
   vec3 ds=vec3(dr*cos(theta)-TAU*R*sin(theta),dr*sin(theta)+TAU*R*cos(theta),w*width*twist*PI*cos(beta));
   vec3 dw=width*vec3(cos(beta)*cos(theta),cos(beta)*sin(theta),sin(beta));
   turn=rz(ph*(uVariant==2?-1.0:1.0)+l*.3)*rx(ph-.65*a*sin(ph)-l*.5);
   p=turn*p;N=turn*normalize(cross(ds,dw));scale=1.05;lift=.64;
  }else if(uKind==4){
   vec3 axis=normalize(cross(aNormal,aAnchor));
   float open=(.5+.5*sin(ph-l*.65))*(1.3+.30*a);
   if(uVariant==1)open*=.65;if(uVariant==2)open=(.5+.5*cos(ph+part*PI-l*.7))*1.7;
   p=aAnchor+axisRotate(p-aAnchor,axis,open);N=axisRotate(N,axis,open);
   turn=rz(.3*l+.2*a*sin(ph))*ry(.28*sin(ph));p=turn*p;N=turn*N;scale=.85;lift=.66;
  }else{
   float phase=ph+3.0*aAnchor.x-2.0*aAnchor.y;
   turn=ry((uVariant==1?1.0:-1.0)*phase)*rx(uVariant==2?.5*a*sin(phase):0.0);
   p=aAnchor+turn*(p-aAnchor);N=turn*N;
   p.z+=.035*sin(phase);scale=1.3;lift=.08;
  }
  float su=(3.0+1.8*cos(v))*TAU/uGrid.x,sv=1.8*TAU/uGrid.y;
  // Constant proportions within each solid, with a bounded local size.
  float size=min(su,sv)*scale;p*=size;
  // Preserve straight beams, planar faces and recursive Euclidean ratios.
  mat3 frame=basis(u,v);
  world=torus(u,v,0.0)+frame*(p+vec3(0,0,lift*min(su,sv)));
  N=frame*N;
 }
 vPosition=world;vNormal=N;gl_Position=uViewProjection*vec4(world,1);
}`;
  const fragmentSource = `#version 300 es
precision highp float;
uniform float uInk;
uniform highp int uKind,uPalette;
in vec3 vPosition,vNormal;
in vec2 vUV;
flat in vec3 vMeta;
out vec4 fragColor;
float stroke(float d,float width){return torusStroke(d,width,max(fwidth(d)*.65,.0001));}
void main(){
 vec3 view=normalize(vec3(3.65,0,0)-vPosition);
 // Curved ribbons and cables already carry their analytic surface normals.
 // Facet derivatives make their highlights jump at every triangle boundary.
 vec3 n=normalize(uKind==3||uKind==7?vNormal:cross(dFdx(vPosition),dFdy(vPosition)));if(dot(n,view)<0.0)n=-n;
 float light=.65+.35*max(0.0,dot(n,normalize(vec3(-.6,1.4,-.8))));
 float face=vMeta.x,level=vMeta.y,part=vMeta.z;
 float pigment=face<.5?.03:face<1.5?.95:face<2.5?.36:face<3.5?.90:face<4.5?.08:.60;
 if(uPalette==1)pigment=mod(face+level,2.0)*.95;
 if(uPalette==2)pigment=.03+.17*mod(face+level,6.0);
 if(uPalette==3)pigment=.035;
 if(uKind==2)pigment=mix(.06,.94,mod(level,2.0))*(.60+.40*mod(face,2.0));
 if(uKind==3||uKind==4||uKind==5){
  float reverse=step(dot(vNormal,view),0.0);
  pigment=mix(.035,.96,reverse);
  if(uPalette==1)pigment=mix(.06,.94,mod(level+part,2.0));
  if(uPalette==2)pigment=.08+.15*mod(level+part,6.0);
  if(uPalette==3)pigment=.035;
 }
 if(uKind==6)pigment=part<.5?.04:.94;
 if(uKind==7)pigment=mod(part,3.0)<.5?.94:mod(part,3.0)<1.5?.03:.37;
 if(uKind>=6){if(uPalette==1)pigment=1.0-pigment;if(uPalette==2)pigment=.12+.13*mod(part,6.0);if(uPalette==3)pigment=.02;}
 float tone=(.96-uInk*pigment)*light;
 float edge=0.0;
 if(uKind==1||uKind==4)edge=max(stroke(vUV.x,.017),max(stroke(vUV.y,.017),stroke(1.0-vUV.x-vUV.y,.017)));
 else if(uKind==3||uKind==6||uKind==7)edge=max(stroke(vUV.y,.02),stroke(1.0-vUV.y,.02));
 else if(uKind==2&&part<.5){
  float outer=min(min(vUV.x,1.0-vUV.x),min(vUV.y,1.0-vUV.y));
  vec2 q=abs(vUV-.5)-vec2((.83-.051)/(2.0*(.83+.051)));
  float hole=length(max(q,0.0))+min(max(q.x,q.y),0.0);
  edge=max(stroke(outer,.003),stroke(hole,.003));
 }else edge=max(stroke(min(vUV.x,1.0-vUV.x),.025),stroke(min(vUV.y,1.0-vUV.y),.025));
 // Thin pale rims on dark faces retain the recursive edges without filling the voids.
 float edgeTone=mix(.025,.78,smoothstep(.35,.65,pigment*uInk));
 tone=mix(tone,edgeTone,edge*.78);
 float fog=.13*smoothstep(4.4,8.0,length(vec3(3.65,0,0)-vPosition));
 fragColor=vec4(vec3(mix(clamp(tone,.025,1.0),1.0,fog)),1);
}`;

  // Attributes: position, normal, UV, pivot, face / recursion level / component.
  function meshData(kind,depth,variant=0){
    const vertices=[],indices=[];
    const add=(p,n,uv,anchor,meta)=>vertices.push(...p,...n,...uv,...anchor,...meta);
    const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const minus=(a,b)=>a.map((x,i)=>x-b[i]);
    function triangle(p0,p1,p2,anchor,meta){
      let n=cross(minus(p1,p0),minus(p2,p0)),len=Math.hypot(...n);n=n.map(x=>x/len);
      const o=vertices.length/14;add(p0,n,[0,0],anchor,meta);add(p1,n,[1,0],anchor,meta);add(p2,n,[0,1],anchor,meta);indices.push(o,o+1,o+2);
    }
    function quad(points,n,anchor,meta,uvs){
      const o=vertices.length/14;points.forEach((p,i)=>add(p,n,(uvs||[[0,0],[1,0],[1,1],[0,1]])[i],anchor,meta));indices.push(o,o+1,o+2,o,o+2,o+3);
    }
    let frameOuter=0;
    const directions=[[0,0,1],[0,0,-1],[0,1,0],[0,-1,0],[1,0,0],[-1,0,0]];
    function cuboid(c,size,level,part,visible=()=>true){
      for(let face=0;face<6;face++){
        if(!visible(face))continue;
        const n=directions[face],axis=face<2?2:face<4?1:0,ax=(axis+1)%3,ay=(axis+2)%3;
        const pts=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>{const p=c.slice();p[axis]+=n[axis]*size[axis]/2;p[ax]+=x*size[ax]/2;p[ay]+=y*size[ay]/2;return p;});
        if(n[axis]<0)pts.reverse();
        const frameFace=kind===2,outer=frameFace&&Math.abs(Math.abs(pts[0][axis])-frameOuter)<1e-9;
        quad(pts,n,c,[face,level,frameFace?(outer?0:1):part],outer?pts.map(p=>[p[ax]/(2*frameOuter)+.5,p[ay]/(2*frameOuter)+.5]):undefined);
      }
    }
    if(kind===0){
      const level=Math.min(2,depth-1),N=3**level,cells=[];
      for(let x=0;x<N;x++)for(let y=0;y<N;y++)for(let z=0;z<N;z++){
        let valid=true;for(let s=1;s<N;s*=3)if([x,y,z].filter(v=>Math.floor(v/s)%3===1).length>1)valid=false;
        if(valid)cells.push([x,y,z]);
      }
      const occupied=new Set(cells.map(c=>c.join(',')));
      for(const c of cells)cuboid(c.map(v=>(v+.5)/N-.5),[1/N,1/N,1/N],level,0,face=>variant===1||!occupied.has(c.map((v,i)=>v+directions[face][i]).join(',')));
    }else if(kind===1){
      const corners=[[1,1,1],[-1,-1,1],[-1,1,-1],[1,-1,-1]].map(c=>c.map(x=>x*.31));
      let leaves=[{c:[0,0,0],s:1}];for(let l=1;l<depth;l++)leaves=leaves.flatMap(({c,s})=>corners.map(v=>({c:c.map((x,i)=>x+v[i]*s/2),s:s/2})));
      leaves.forEach(({c,s},part)=>{const p=corners.map(v=>v.map((x,i)=>c[i]+s*x));[[0,2,1],[0,1,3],[0,3,2],[1,2,3]].forEach((ids,f)=>triangle(...ids.map(i=>p[i]),c,[f,depth-1,part]));});
    }else if(kind===2){
      for(let l=0;l<depth;l++){
        const s=.83*.66**l,w=.051*.66**l;
        // Exact union of the twelve beams. The old full-length cuboids
        // overlapped at all eight corners, leaving coplanar competing faces.
        frameOuter=(s+w)/2;const inner=(s-w)/2,grid=[-frameOuter,-inner,inner,frameOuter];
        const occupied=(p)=>p.every(v=>v>=0&&v<3)&&p.filter(v=>v!==1).length>=2;
        for(let x=0;x<3;x++)for(let y=0;y<3;y++)for(let z=0;z<3;z++){
          const cell=[x,y,z];if(!occupied(cell))continue;
          const c=cell.map(i=>(grid[i]+grid[i+1])/2),size=cell.map(i=>grid[i+1]-grid[i]);
          cuboid(c,size,l,0,face=>!occupied(cell.map((v,i)=>v+directions[face][i])));
        }
      }
    }else if(kind===4){
      const pts=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
      for(let l=0;l<depth;l++)for(let oct=0;oct<8;oct++){
        let p=[pts[oct&1?1:0],pts[oct&2?3:2],pts[oct&4?5:4]].map(v=>v.map(x=>x*.45*.68**l));
        const normal=cross(minus(p[1],p[0]),minus(p[2],p[0]));if(normal.reduce((s,n,i)=>s+n*p[0][i],0)<0)[p[1],p[2]]=[p[2],p[1]];
        const anchor=p[1].map((x,i)=>(x+p[2][i])/2);triangle(...p,anchor,[oct%6,l,oct]);
      }
    }else if(kind===5){
      let cells=[{x:0,y:0,s:1,part:0}];
      for(let l=1;l<depth;l++)cells=cells.flatMap(c=>{const out=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)if(variant===1?x&&y:x||y)out.push({x:c.x+x*c.s/3,y:c.y+y*c.s/3,s:c.s/3,part:(x+1)*3+y+1});return out;});
      for(const c of cells){const w=c.s*.48;quad([[c.x-w,c.y-w,0],[c.x+w,c.y-w,0],[c.x+w,c.y+w,0],[c.x-w,c.y+w,0]],[0,0,1],[c.x,c.y,0],[0,depth-1,c.part]);}
    }else{
      const nx=kind===3?48:kind===6?384:512,ny=kind===7?6:kind===3?1:2,parts=kind===3?3*depth:kind===6?2:9;
      for(let p=0;p<parts;p++){
        const o=vertices.length/14;
        for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++)add([0,0,0],[0,0,1],[i/nx,j/ny],[0,0,0],[0,kind===3?Math.floor(p/3):0,kind===3?p%3:p]);
        for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const k=o+i*(ny+1)+j;indices.push(k,k+1,k+ny+1,k+1,k+ny+2,k+ny+1);}
      }
    }
    return {vertices,indices};
  }
  async function create(gl){
    const visibility=TorusPerformance.instances(gl);
    const frameData=new Float32Array(8192*13),frameBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,frameBuffer);gl.bufferData(gl.ARRAY_BUFFER,frameData,gl.DYNAMIC_DRAW);

    const program=await TorusPrograms.link(gl,vertexSource,TorusLight.fragment(fragmentSource,true));
    const uniforms={};for(const name of ['uViewProjection','uGrid','uTime','uWave','uTurns','uKind','uVariant','uWinding','uInk','uPalette'])uniforms[name]=gl.getUniformLocation(program,name);
    const meshes=new Map(),configuredFrames=new WeakSet();
    function mesh(kind,depth,variant){
      const key=kind+':'+depth+':'+((kind===0||kind===5)&&variant===1?1:0);if(meshes.has(key))return meshes.get(key);
      const data=meshData(kind,depth,variant),vao=gl.createVertexArray();gl.bindVertexArray(vao);
      const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.vertices),gl.STATIC_DRAW);
      let offset=0;[3,3,2,3,3].forEach((size,i)=>{gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,56,offset*4);offset+=size;});
      const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(data.indices),gl.STATIC_DRAW);
      const value={vao,count:data.indices.length};meshes.set(key,value);return value;
    }
    function prepare(kind,variant=0,options={recursion:3}){
      const depth=kind===0||kind===5?Math.min(3,options.recursion):options.recursion;
      return mesh(kind,kind>=6?1:depth,variant);
    }
    return {prepare,draw(matrix,time,wave,density,kind,variant,options){
      const m=prepare(kind,variant,options);
      const n=2*Math.round((10+density*.045)/2);let nx=n,ny=n;
      if(kind===6){nx=2*Math.round((3+density*.025)/2);ny=1;}
      if(kind===7){nx=options.winding===0?1:Math.max(2,Math.round(2+density*.022));if(options.winding===2&&nx%3===0)nx++;ny=1;}
      gl.useProgram(program);TorusLight.bind(gl,program,options,time);gl.bindVertexArray(m.vao);gl.uniformMatrix4fv(uniforms.uViewProjection,false,matrix);
      gl.uniform2f(uniforms.uGrid,nx,ny);gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uWave,wave);gl.uniform1f(uniforms.uTurns,options.turns);
      gl.uniform1i(uniforms.uKind,kind);gl.uniform1i(uniforms.uVariant,variant);gl.uniform1i(uniforms.uWinding,options.winding);gl.uniform1f(uniforms.uInk,options.ink);gl.uniform1i(uniforms.uPalette,options.palette);
      const count=visibility.bind(m.vao,matrix,nx,ny,1,time,kind<6?1:0);
      if(kind===0&&count){
        TorusPerformance.mengerFrames(visibility.ids,count,nx,ny,time,wave,options.turns,variant,frameData);
        gl.bindBuffer(gl.ARRAY_BUFFER,frameBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,frameData,0,count*13);
        if(!configuredFrames.has(m.vao)){for(let i=0;i<4;i++){gl.enableVertexAttribArray(8+i);gl.vertexAttribPointer(8+i,i===3?4:3,gl.FLOAT,false,52,i*12);gl.vertexAttribDivisor(8+i,1);}configuredFrames.add(m.vao);}
      }
      const closed=kind<=2||kind===7;if(closed)gl.enable(gl.CULL_FACE);
      if(count)gl.drawElementsInstanced(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0,count);
      if(closed)gl.disable(gl.CULL_FACE);
    }};
  }
  return {create,meshData};
})();
