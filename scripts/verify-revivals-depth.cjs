/* Independent coefficient-space proofs for the expanded revival controls.
   Actual production uploads feed a separable reconstruction, then a direct
   two-dimensional spectrum supplies the independent reference. No GPU needed. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const PI=Math.PI,TAU=2*PI,add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],scale=(a,s)=>[a[0]*s,a[1]*s],mul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]],abs=a=>Math.hypot(...a),unit=t=>[Math.cos(t),Math.sin(t)];
const div=(a,b)=>scale(mul(a,[b[0],-b[1]]),1/(b[0]*b[0]+b[1]*b[1]));
function theta(z){let value=[0,0];for(let n=0;n<10;n++){const k=2*n+1,c=2*(-1)**n*Math.exp(-PI*(n+.5)**2);value=add(value,scale([Math.sin(k*PI*z[0])*Math.cosh(k*PI*z[1]),Math.cos(k*PI*z[0])*Math.sinh(k*PI*z[1])],c));}return value;}
function ratio(z,a,b){return div(mul(theta(sub(z,a)),theta(add(z,a))),mul(theta(sub(z,b)),theta(add(z,b))));}
const chartMatrices=[[[1,0],[0,1]],[[1,1],[0,1]],[[1,0],[1,1]],[[1,1],[1,2]]];
function chart(z,w){return chartMatrices[w].map(row=>row[0]*z[0]+row[1]*z[1]);}
function spectrum(z,time,order,wave,variant,balance,turns=1){
 const alpha=.07+.12*balance,r=alpha/.13;let sum=[0,0];
 for(let n=-order;n<=order;n++)for(let m=-order;m<=order;m++){
  const k=variant===2?n+m:n,l=variant===2?n-m:m;
  const petals=variant===1?.22*r*(n*n-m*m):.018*r*r*(n**4-6*n*n*m*m+m**4);
  const amplitude=r*Math.exp(-alpha*(n*n+m*m))*(.06+.12*(1-wave)+(.6+wave)*petals);
  sum=add(sum,scale(unit(TAU*(k*z[0]+l*z[1])-(k*k+l*l)*time*turns),amplitude));
 }
 return sum;
}
function uploadedField(z,variant,u){
 const values=u[variant===2?'uDiagonal[0]':'uEvolution[0]'];
 function moments(x){const result=[values.slice(0,2),[0,0],[0,0]];for(let n=1;n<=u.uLayers;n++)for(let p=0;p<3;p++)result[p]=add(result[p],scale(values.slice(2*n,2*n+2),2*Math.cos(TAU*n*x)*n**(2*p)));return result;}
 const a=moments(variant===2?z[0]+z[1]:z[0]),b=moments(variant===2?z[0]-z[1]:z[1]),r=u.uAperture;
 const core=mul(a[0],b[0]),petal=variant===1?scale(sub(mul(a[1],b[0]),mul(a[0],b[1])),.22*r):scale(add(sub(mul(a[2],b[0]),scale(mul(a[1],b[1]),6)),mul(a[0],b[2])),.018*r*r);
 return add(scale(core,.06+.12*(1-u.uWave)),scale(petal,.6+u.uWave));
}
async function main(){
 const uniforms={},gl={getUniformLocation:(_,name)=>name,useProgram(){},bindVertexArray(){},uniformMatrix4fv(){},uniform1f:(name,value)=>uniforms[name]=value,uniform1i:(name,value)=>uniforms[name]=value,uniform2fv:(name,value)=>uniforms[name]=Array.from(value),uniform4fv:(name,value)=>uniforms[name]=Array.from(value),drawElements(){}};
 const module=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/revivals.js'),'utf8')+';TorusRevivals',{TorusPrograms:{specialize:s=>s,link:async()=>({})},TorusLight:{fragment:s=>s,bind(){}}});
 const renderer=await module.create(gl,{},6);await renderer.prepare(0);await renderer.prepare(1);let checks=0,maximumNormalizedError=0;
 function close(a,b,tolerance=2e-6){const error=abs(sub(a,b))/Math.max(1,abs(b));checks++;maximumNormalizedError=Math.max(maximumNormalizedError,error);assert(error<tolerance,`Relative identity error ${error} >= ${tolerance}`);}
 for(const balance of [0,.5,1])for(const variant of [0,1,2])for(const order of [4,6,8])for(const wave of [0,.65,1])for(const turns of [1,2]){
  const options={layers:order,ink:1,turns,balance,winding:0,recursion:3,palette:0};
  for(const time of [0,.317,TAU/3]){
   renderer.draw([],time,wave,88,0,variant,options);
   for(const z of [[.137,.271],[-.413,.081]])close(uploadedField(z,variant,uniforms),spectrum(z,time,order,wave,variant,balance,turns));
   const original=uniforms['uEvolution[0]'].slice();renderer.draw([],time+TAU,wave,88,0,variant,options);for(let n=0;n<=8;n++)close(uniforms['uEvolution[0]'].slice(2*n,2*n+2),original.slice(2*n,2*n+2),1e-7);
  }
 }
 // Fractional-copy theorem is independent of the altered aperture spectrum.
 for(const balance of [0,.5,1])for(const variant of [0,1,2])for(const [p,q] of [[1,3],[1,4],[2,5]]){
  const weights=Array.from({length:q},(_,j)=>{let s=[0,0];for(let n=0;n<q;n++)s=add(s,unit(TAU*(-p*n*n+j*n)/q));return scale(s,1/q);});
  const z=[.183,-.271];let copies=[0,0];for(let j=0;j<q;j++)for(let k=0;k<q;k++)copies=add(copies,mul(mul(weights[j],weights[k]),spectrum([z[0]-j/q,z[1]-k/q],0,6,.65,variant,balance)));
  close(copies,spectrum(z,TAU*p/q,6,.65,variant,balance),1e-10);
 }
 for(const balance of [0,.2,.5,1])for(const wave of [0,.55,1])for(const spectral of [0,1,2])for(const time of [0,.371,1.27]){
  const options={layers:3,ink:1,balance,spectral,winding:0,recursion:3,palette:0};renderer.draw([],time,wave,40,1,0,options);const current=uniforms['uDivisors[0]'].slice();assert.equal(uniforms.uGenerationRatio,spectral+1);checks++;
  renderer.draw([],time+PI,wave,40,1,0,options);const half=uniforms['uDivisors[0]'].slice();
  for(let j=0;j<3;j++){
   const a=current.slice(j*4,j*4+2),b=current.slice(j*4+2,j*4+4);close(half.slice(j*4,j*4+2),b,1e-7);close(half.slice(j*4+2,j*4+4),scale(a,-1),1e-7);
   for(const z of [[.071,.083],[.313,-.277]]){const f=ratio(z,a,b);close(mul(f,ratio(z,b,scale(a,-1))),[1,0],1e-10);close(div(ratio(add(z,[1,1]),a,b),f),[1,0],1e-10);}
  }
 }
 // These display pullbacks have degree one and preserve lattice shifts. They
 // do not replace the square complex lattice used by the elliptic function.
 for(const [w,m] of chartMatrices.entries()){
  assert.equal(m[0][0]*m[1][1]-m[0][1]*m[1][0],1);checks++;
  const z=[.172,.283],a=chart(z,w);for(const shift of [[1,0],[0,1],[1,1]]){const delta=sub(chart(add(z,shift),w),a);close(delta,delta.map(Math.round),1e-10);}
 }
 console.log(JSON.stringify({suite:'expanded revival controls: coefficients, Gauss copies, reciprocal divisors and lattice pullbacks',checks,maximumNormalizedError}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
