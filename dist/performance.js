/* Frame pacing and conservative visibility, independent of the artwork's mathematics. */
const TorusPerformance = (() => {
  // Learn a sustainable ceiling instead of repeatedly probing a failed size.
  // Missing GPU timers are supported; RAF intervals still detect missed frames.
  function governor(){
    const scales=[.5,.6,.72,.85,1],history=new Map(),families=new Map(),samples=new Float32Array(24);
    let key='',family='',level=4,ceiling=4,n=0,warm=3,fast=0,changedAt=-10000,period=1000/60,gpu=0,gpuAt=-Infinity,stable=0,severe=0;
    function remember(){if(!key)return;history.set(key,{level,ceiling});families.set(family,level);if(history.size>256)history.delete(history.keys().next().value);}
    function reduce(cost,now){
      ceiling=Math.min(ceiling,level-1);
      const desired=scales[level]*Math.sqrt(period/Math.max(period,cost))*.96;
      let next=level-1;while(next>0&&scales[next]>desired)next--;
      level=next;n=0;fast=0;gpu=0;stable=0;severe=0;changedAt=now;remember();return true;
    }
    return {
      get scale(){return scales[level];},get tag(){return key+':'+level;},get period(){return period;},
      // Background GPU preparation needs measured spare capacity, not simply
      // an idle JavaScript callback. No timer means no assumed GPU headroom.
      get headroom(){return warm===0&&stable>=2&&gpu>0&&gpu<period*.55;},
      suspend(){n=0;warm=3;fast=0;gpu=0;gpuAt=-Infinity;stable=0;severe=0;},
      reset(next,nextFamily=next){
        if(next===key)return;remember();key=next;family=nextFamily;
        const saved=history.get(key);level=saved?.level??families.get(family)??4;ceiling=saved?.ceiling??4;
        this.suspend();changedAt=-10000;
      },
      observe(ms,now,timing=null){
        if(timing&&timing.tag===this.tag&&Number.isFinite(timing.ms)&&timing.ms>0){gpu=gpu?.75*gpu+.25*timing.ms:timing.ms;gpuAt=now;}
        if(now-gpuAt>1000)gpu=0;
        if(warm>0){warm--;return false;}
        if(!Number.isFinite(ms)||ms<=0)return false;
        // Native retina rendering is the starting point. A clearly overloaded
        // new study should not spend a full 24-frame window struggling there.
        // Six consecutive severe misses exclude isolated compilation/UI stalls.
        severe=ms>period*2.4?severe+1:0;
        if(severe>=6&&level>0&&now-changedAt>350){warm=3;return reduce(ms,now);}
        samples[n++]=Math.min(ms,1000);if(n<samples.length)return false;n=0;
        const sorted=Array.from(samples).sort((a,b)=>a-b),median=sorted[12],slow=sorted[19],lower=sorted[4];
        if(lower>=4&&lower<period*.92)period=lower;
        if((median>period*1.18||slow>period*1.40)&&level>0&&now-changedAt>350){
          return reduce(median,now);
        }
        if(median<period*1.06&&slow<period*1.12){fast++;stable++;}else{fast=0;stable=0;}
        const headroom=level<4&&gpu>0&&gpu*(scales[level+1]/scales[level])**2<period*.72;
        if(fast>=6&&level<4&&(level<ceiling||headroom)&&now-changedAt>(headroom?6000:10000)){
          level++;fast=0;gpu=0;stable=0;changedAt=now;remember();return true;
        }
        return false;
      }
    };
  }
  function gpuTimer(gl){
    const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if(!ext||typeof ext.TIME_ELAPSED_EXT!=='number')return {begin(){},end(){},poll(){return null;},reset(){},dispose(){}};
    const pending=[],pool=[];let active=null,frame=0,disposed=false;
    const clock=()=>typeof performance==='undefined'?Date.now():performance.now();
    function clear(){for(const item of pending)gl.deleteQuery(item.query);pending.length=0;for(const query of pool)gl.deleteQuery(query);pool.length=0;}
    return {
      // One asynchronous sample per eight frames is enough for the governor.
      // Measuring every frame needlessly synchronises driver bookkeeping.
      begin(tag,now=clock()){frame++;if(disposed||active||(frame-1)%8||pending.length>=4)return;const query=pool.pop()||gl.createQuery();if(!query)return;gl.beginQuery(ext.TIME_ELAPSED_EXT,query);active={query,tag,frame,now};},
      end(){if(!active)return;gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(active);active=null;},
      poll(now=clock()){
        if(disposed||frame%8||!pending.length)return null;
        if(gl.getParameter(ext.GPU_DISJOINT_EXT)){clear();return null;}
        while(pending.length&&now-pending[0].now>1000)gl.deleteQuery(pending.shift().query);
        if(!pending.length)return null;const first=pending[0];
        if(frame-first.frame<4||!gl.getQueryParameter(first.query,gl.QUERY_RESULT_AVAILABLE))return null;
        pending.shift();const ms=gl.getQueryParameter(first.query,gl.QUERY_RESULT)/1e6;pool.push(first.query);return Number.isFinite(ms)&&ms>0?{ms,tag:first.tag}:null;
      },
      reset(){if(active){gl.endQuery(ext.TIME_ELAPSED_EXT);gl.deleteQuery(active.query);active=null;}clear();frame=0;},
      dispose(){this.reset();disposed=true;}
    };
  }
  function trigRange(angle,radius,out,offset){
    const lo=angle-radius,hi=angle+radius,a=Math.cos(lo),b=Math.cos(hi),tau=Math.PI*2;
    out[offset]=Math.ceil((lo-Math.PI)/tau)<=Math.floor((hi-Math.PI)/tau)?-1:Math.min(a,b);
    out[offset+1]=Math.ceil(lo/tau)<=Math.floor(hi/tau)?1:Math.max(a,b);
  }
  function product(a,b,c,d,out,offset){out[offset]=Math.min(a*c,a*d,b*c,b*d);out[offset+1]=Math.max(a*c,a*d,b*c,b*d);}
  function clipPlanes(matrix,out){
    for(let axis=0;axis<3;axis++)for(let side=0;side<2;side++)for(let k=0;k<4;k++)out[(2*axis+side)*4+k]=matrix[k*4+3]+(side?1:-1)*matrix[k*4+axis];
  }
  function visibleBox(planes,box){
    for(let p=0;p<24;p+=4)if(planes[p]*box[planes[p]>=0?1:0]+planes[p+1]*box[planes[p+1]>=0?3:2]+planes[p+2]*box[planes[p+2]>=0?5:4]+planes[p+3]<-.0001)return false;
    if(box[1]<0){
      const distance=3.65-box[1],z=Math.max(Math.abs(box[4]),Math.abs(box[5])),y=Math.max(Math.abs(box[2]),Math.abs(box[3]));
      if(z<distance*.3416&&y*3.65<1.78*distance)return false;
    }
    return true;
  }
  // The chamber is static. Cull its existing triangles only when the view
  // changes, instead of transforming and clipping the entire torus every frame.
  // Every retained vertex stays at the original resolution and position.
  function surfaceMesh(U,V){
    const positions=new Float64Array((U+1)*(V+1)*3),out=new Uint32Array(U*V*6),planes=new Float64Array(24),tau=2*Math.PI;
    for(let i=0;i<=U;i++)for(let j=0;j<=V;j++){
      const u=tau*i/U,v=tau*j/V,r=3+1.8*Math.cos(v),o=(i*(V+1)+j)*3;
      positions[o]=r*Math.cos(u);positions[o+1]=1.8*Math.sin(v);positions[o+2]=r*Math.sin(u);
    }
    return {indices(matrix){
      clipPlanes(matrix,planes);let count=0;
      function keep(a,b,c){
        const x=a*3,y=b*3,z=c*3,ax=positions[x],ay=positions[x+1],az=positions[x+2];
        const bx=positions[y]-ax,by=positions[y+1]-ay,bz=positions[y+2]-az,cx=positions[z]-ax,cy=positions[z+1]-ay,cz=positions[z+2]-az;
        const facing=(by*cz-bz*cy)*(3.65-ax)-(bz*cx-bx*cz)*ay-(bx*cy-by*cx)*az;
        if(facing>1e-7)return;
        for(let p=0;p<24;p+=4){const X=planes[p],Y=planes[p+1],Z=planes[p+2],D=planes[p+3];if(X*ax+Y*ay+Z*az+D<-.0001&&X*positions[y]+Y*positions[y+1]+Z*positions[y+2]+D<-.0001&&X*positions[z]+Y*positions[z+1]+Z*positions[z+2]+D<-.0001)return;}
        out[count++]=a;out[count++]=b;out[count++]=c;
      }
      for(let i=0;i<U;i++)for(let j=0;j<V;j++){const n=i*(V+1)+j;keep(n,n+1,n+V+1);keep(n+1,n+V+2,n+V+1);}
      return out.subarray(0,count);
    }};
  }
  // Split the existing Jacquard curves at existing vertices. The bounds include
  // all nine strands, both transverse edges, lift and both periodic shears.
  // No curve sample, crossing or strand is simplified.
  function jacquardChunks(){
    const chunks=64,tau=2*Math.PI,planes=new Float32Array(24),ur=new Float64Array(2*12*chunks*4),vr=new Float64Array(chunks*4),box=new Float64Array(6),radial=new Float64Array(2),mask=new Uint8Array(chunks);
    let previous=0;
    return {chunks,fill(matrix,nx,time,out){
      if(nx!==previous){
        for(let family=0;family<2;family++)for(let k=0;k<nx;k++)for(let j=0;j<chunks;j++){
          const u=(family?3:2)*tau*(j+.5)/chunks+tau*k/nx/(family?2:3),o=((family*nx+k)*chunks+j)*4;
          trigRange(u,(family?3:2)*Math.PI/chunks+.14,ur,o);trigRange(u-Math.PI/2,(family?3:2)*Math.PI/chunks+.14,ur,o+2);
        }
        previous=nx;
      }
      clipPlanes(matrix,planes);let count=0;
      for(let family=0;family<2;family++){
        for(let j=0;j<chunks;j++){
          const v=(family?2:-3)*tau*(j+.5)/chunks-time,radius=(family?2:3)*Math.PI/chunks+.13;
          trigRange(v,radius,vr,j*4);trigRange(v-Math.PI/2,radius,vr,j*4+2);
        }
        for(let k=0;k<nx;k++){
          for(let j=0;j<chunks;j++){
            const o=((family*nx+k)*chunks+j)*4;
            product(1.48,1.74,vr[j*4],vr[j*4+1],radial,0);radial[0]+=3;radial[1]+=3;
            product(radial[0],radial[1],ur[o],ur[o+1],box,0);
            product(1.48,1.74,vr[j*4+2],vr[j*4+3],box,2);
            product(radial[0],radial[1],ur[o+2],ur[o+3],box,4);
            mask[j]=visibleBox(planes,box)?1:0;
          }
          for(let strand=0;strand<9;strand++)for(let j=0;j<chunks;j++)if(mask[j])out[count++]=((family*nx+k)*9+strand)*chunks+j;
        }
      }
      return count;
    }};
  }
  function jacquard(gl){
    const chunks=jacquardChunks(),ids=new Float32Array(16384),configured=new WeakSet(),buffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,ids,gl.DYNAMIC_DRAW);
    return {bind(vao,matrix,nx,time){
      const count=chunks.fill(matrix,nx,time,ids);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      if(count)gl.bufferSubData(gl.ARRAY_BUFFER,0,ids,0,count);
      if(!configured.has(vao)){gl.enableVertexAttribArray(7);gl.vertexAttribPointer(7,1,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(7,1);configured.add(vao);}
      return count;
    }};
  }
  // Affine transforms shared by every vertex of a solid. Row-major scratch
  // matrices are packed as GLSL columns only when written to the GPU buffer.
  const ma=new Float64Array(9),mb=new Float64Array(9),mc=new Float64Array(9),basis=new Float64Array(9),world=new Float64Array(9);
  function rotation(out,axis,a){
    out.fill(0);out[0]=out[4]=out[8]=1;const c=Math.cos(a),s=Math.sin(a);
    if(axis===0){out[4]=out[8]=c;out[5]=-s;out[7]=s;}
    if(axis===1){out[0]=out[8]=c;out[2]=s;out[6]=-s;}
    if(axis===2){out[0]=out[4]=c;out[1]=-s;out[3]=s;}
  }
  function multiply(a,b,out){for(let i=0;i<3;i++)for(let j=0;j<3;j++)out[i*3+j]=a[i*3]*b[j]+a[i*3+1]*b[3+j]+a[i*3+2]*b[6+j];}
  function torusBasis(u,v){const cu=Math.cos(u),su=Math.sin(u),cv=Math.cos(v),sv=Math.sin(v);basis[0]=-su;basis[1]=-sv*cu;basis[2]=-cv*cu;basis[3]=0;basis[4]=cv;basis[5]=-sv;basis[6]=cu;basis[7]=-sv*su;basis[8]=-cv*su;}
  function pack(matrix,scale,out,o){for(let j=0;j<3;j++)for(let i=0;i<3;i++)out[o+j*3+i]=matrix[i*3+j]*scale;}
  function cornerFrames(ids,count,nx,ny,time,wave,turns,variant,out){
    const tau=2*Math.PI;
    for(let k=0;k<count;k++){
      const id=ids[k],u=tau*((id%nx)+.5)/nx,v0=tau*(Math.floor(id/nx)+.5)/ny,v=v0-time;
      const cell=Math.min((3+1.8*Math.cos(v))*tau/nx,1.8*tau/ny),size=.88*cell,ph=2*u+3*v0-2*turns*time+.28*wave*Math.sin(3*u-2*v0+time),o=k*31;
      torusBasis(u,v);rotation(ma,1,ph);multiply(basis,ma,world);pack(world,size,out,o);
      for(let l=0;l<2;l++){
        if(variant===1){rotation(ma,2,ph+l*.6);rotation(mb,1,.25*Math.sin(ph));}
        else if(variant===2){rotation(ma,0,ph);rotation(mb,2,-ph+l*.45);}
        else{rotation(ma,1,(l%2*2-1)*ph);rotation(mb,0,.4*Math.sin(ph-l));}
        multiply(ma,mb,mc);multiply(basis,mc,world);pack(world,size/3**(l+1),out,o+9*(l+1));
      }
      out[o+27]=(3+1.8*Math.cos(v))*Math.cos(u)+basis[2]*.88*size;
      out[o+28]=1.8*Math.sin(v)+basis[5]*.88*size;
      out[o+29]=(3+1.8*Math.cos(v))*Math.sin(u)+basis[8]*.88*size;out[o+30]=ph;
    }
    return out;
  }
  function instances(gl){
    const ids=new Float32Array(8192),planes=new Float32Array(24),columns=new Float32Array(256),vRange=new Float64Array(4),box=new Float64Array(6),radial=new Float64Array(2);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,ids,gl.DYNAMIC_DRAW);
    let previousNX=0,previousPad=0;const configured=new WeakSet();
    return {get ids(){return ids;},bind(vao,matrix,nx,ny,parts,time,pad=0){
      let count=0;
      if(!pad){for(let i=0;i<nx*ny*parts;i++)ids[count++]=i;}
      else {
        // Clip an enclosing world-space box, including every fold and inward lift.
        // The ranges enclose the whole torus patch, so no centre-only popping.
        if(nx!==previousNX||pad!==previousPad){for(let i=0;i<nx;i++){const u=2*Math.PI*(i+.5)/nx;trigRange(u,pad*2*Math.PI/nx,columns,4*i);trigRange(u-Math.PI/2,pad*2*Math.PI/nx,columns,4*i+2);}previousNX=nx;previousPad=pad;}
        clipPlanes(matrix,planes);
        for(let j=0;j<ny;j++){
          const v=2*Math.PI*(j+.5)/ny-time,cell=Math.min((3+1.8*Math.cos(v))*2*Math.PI/nx,1.8*2*Math.PI/ny);
          trigRange(v,pad*2*Math.PI/ny,vRange,0);trigRange(v-Math.PI/2,pad*2*Math.PI/ny,vRange,2);
          product(1.8-2*cell,1.8+.2*cell,vRange[0],vRange[1],radial,0);radial[0]+=3;radial[1]+=3;
          product(1.8-2*cell,1.8+.2*cell,vRange[2],vRange[3],box,2);
          for(let i=0;i<nx;i++){
            product(radial[0],radial[1],columns[4*i],columns[4*i+1],box,0);
            product(radial[0],radial[1],columns[4*i+2],columns[4*i+3],box,4);
            let visible=true;
            for(let p=0;p<24;p+=4)if(planes[p]*box[planes[p]>=0?1:0]+planes[p+1]*box[planes[p+1]>=0?3:2]+planes[p+2]*box[planes[p+2]>=0?5:4]+planes[p+3]<-.0001){visible=false;break;}
            // The central excluded volume contains this cylinder. Its shadow
            // is an exact conservative occluder for the fixed interior camera.
            // The whole box must be behind its tangent cone and within its caps.
            if(visible&&box[1]<0){
              const distance=3.65-box[1],z=Math.max(Math.abs(box[4]),Math.abs(box[5])),y=Math.max(Math.abs(box[2]),Math.abs(box[3]));
              if(z<distance*.3416&&y*3.65<1.78*distance)visible=false;
            }
            if(visible)for(let part=0;part<parts;part++)ids[count++]=(j*nx+i)*parts+part;
          }
        }
      }
      gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);if(count)gl.bufferSubData(gl.ARRAY_BUFFER,0,ids,0,count);
      if(!configured.has(vao)){gl.enableVertexAttribArray(7);gl.vertexAttribPointer(7,1,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(7,1);configured.add(vao);}
      return count;
    }};
  }
  // One orientation per visible sponge, shared by every recursive face.
  function mengerFrames(ids,count,nx,ny,time,wave,turns,variant,out){
    const tau=2*Math.PI;
    for(let k=0;k<count;k++){
      const id=ids[k],u=tau*((id%nx)+.5)/nx,v0=tau*(Math.floor(id/nx)+.5)/ny,v=v0-time;
      const ph=2*u+2*v0-turns*time+.24*wave*Math.sin(3*u-2*v0+time),beat=Math.sin(ph);
      const x=variant===2?.35*Math.sin(2*ph):ph-.72*wave*beat,y=variant===2?ph-.6*beat:.22+.34*wave*beat,z=variant===2?ph:.22*wave*beat;
      const cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z),o=k*13;
      out[o]=cz*cy;out[o+1]=sz*cy;out[o+2]=-sy;
      out[o+3]=cz*sy*sx-sz*cx;out[o+4]=sz*sy*sx+cz*cx;out[o+5]=cy*sx;
      out[o+6]=cz*sy*cx+sz*sx;out[o+7]=sz*sy*cx-cz*sx;out[o+8]=cy*cx;
      out[o+9]=u;out[o+10]=v;out[o+11]=Math.min((3+1.8*Math.cos(v))*tau/nx,1.8*tau/ny);out[o+12]=variant===1?.32*wave*(.5+.5*beat):0;
    }
    return out;
  }
  return {governor,gpuTimer,instances,mengerFrames,jacquard,jacquardChunks,cornerFrames,surfaceMesh};
})();
