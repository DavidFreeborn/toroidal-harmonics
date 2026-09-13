/* Dependency-free CI proofs. Actual production draw uniforms are checked,
   then independent finite spectra and theta ratios establish their identities.
   verify-revivals-gpu.cjs additionally checks the GLSL and its derivatives. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const TAU=2*Math.PI,add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],scale=(a,s)=>[a[0]*s,a[1]*s],mul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]],abs=a=>Math.hypot(...a),unit=t=>[Math.cos(t),Math.sin(t)];
const div=(a,b)=>scale(mul(a,[b[0],-b[1]]),1/(b[0]*b[0]+b[1]*b[1]));
function theta(z,terms=12){let value=[0,0];for(let n=0;n<terms;n++){const k=2*n+1,c=2*(-1)**n*Math.exp(-Math.PI*(n+.5)**2);value=add(value,scale([Math.sin(k*z[0])*Math.cosh(k*z[1]),Math.cos(k*z[0])*Math.sinh(k*z[1])],c));}return value;}
function ratio(z,a,b){return div(mul(theta(scale(sub(z,a),Math.PI)),theta(scale(add(z,a),Math.PI))),mul(theta(scale(sub(z,b),Math.PI)),theta(scale(add(z,b),Math.PI))));}
function spectral(x,y,time,order,wave,variant){let total=[0,0];for(let n=-order;n<=order;n++)for(let m=-order;m<=order;m++){
 const k=variant===2?n+m:n,l=variant===2?n-m:m,petal=variant===1?.22*(n*n-m*m):.018*(n**4-6*n*n*m*m+m**4);
 const coefficient=Math.exp(-.13*(n*n+m*m))*(.06+.12*(1-wave)+(.6+wave)*petal);
 total=add(total,scale(unit(TAU*(k*x+l*y)-(k*k+l*l)*time),coefficient));
}return total;}
async function main(){
 let checks=0,maximumError=0;function close(actual,expected,tolerance=1e-9){const error=abs(sub(actual,expected));maximumError=Math.max(maximumError,error);checks++;assert(error<tolerance,`Identity error ${error} >= ${tolerance}`);}
 const uniforms={};const gl={getUniformLocation:(_,name)=>name,useProgram(){},bindVertexArray(){},uniformMatrix4fv(){},uniform1f(){},uniform1i(){},uniform2fv:(name,v)=>uniforms[name]=Array.from(v),uniform4fv:(name,v)=>uniforms[name]=Array.from(v),drawElements(){}};
 const module=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/revivals.js'),'utf8')+';TorusRevivals',{TorusPrograms:{specialize:s=>s,link:async()=>({})},TorusLight:{fragment:s=>s,bind(){}}});
 const renderer=await module.create(gl,{},6);await renderer.prepare(0);await renderer.prepare(1);
 for(const time of [0,.123,.713,1.72,4.31])for(const turns of [1,2]){
  renderer.draw([],time,.65,88,0,0,{layers:6,ink:1,turns});
  for(let n=0;n<=8;n++)for(const [name,multiplier] of [['uEvolution[0]',1],['uDiagonal[0]',2]])close(uniforms[name].slice(2*n,2*n+2),scale(unit(-n*n*time*turns*multiplier),Math.exp(-.13*n*n)),8e-8);
  const before=uniforms['uEvolution[0]'].slice();renderer.draw([],time+TAU,.65,88,0,0,{layers:6,ink:1,turns});
  for(let n=0;n<=8;n++)close(uniforms['uEvolution[0]'].slice(2*n,2*n+2),before.slice(2*n,2*n+2),8e-8);
 }
 for(const variant of [0,1,2])for(const order of [4,6,8])for(const [x,y] of [[.137,.271],[-.413,.081],[.023,-.471]]){
  const initial=spectral(x,y,.713,order,.65,variant);close(spectral(x,y,.713+TAU,order,.65,variant),initial);
  for(const [p,q] of [[1,2],[1,3],[1,4],[2,5],[3,7]]){
   const weights=Array.from({length:q},(_,j)=>{let value=[0,0];for(let n=0;n<q;n++)value=add(value,unit(TAU*(-p*n*n+j*n)/q));return scale(value,1/q);});
   let copied=[0,0];for(let j=0;j<q;j++)for(let k=0;k<q;k++)copied=add(copied,mul(mul(weights[j],weights[k]),spectral(x-j/q,y-k/q,0,order,.65,variant)));
   close(copied,spectral(x,y,TAU*p/q,order,.65,variant));
  }
 }
 for(const time of [0,.171,.891,1.71,2.991])for(const wave of [0,.55,1]){
  renderer.draw([],time,wave,40,1,0,{layers:3,ink:1});const current=uniforms['uDivisors[0]'].slice();
  renderer.draw([],time+Math.PI,wave,40,1,0,{layers:3,ink:1});const half=uniforms['uDivisors[0]'].slice();
  renderer.draw([],time+TAU,wave,40,1,0,{layers:3,ink:1});const full=uniforms['uDivisors[0]'].slice();
  for(let j=0;j<3;j++){
   const a=current.slice(j*4,j*4+2),b=current.slice(j*4+2,j*4+4);
   close(half.slice(j*4,j*4+2),b,8e-8);close(half.slice(j*4+2,j*4+4),scale(a,-1),8e-8);
   close(full.slice(j*4,j*4+2),scale(a,-1),8e-8);close(full.slice(j*4+2,j*4+4),scale(b,-1),8e-8);
   for(const z of [[.017,.063],[.311,-.417],[-.217,.173]]){
    const f=ratio(z,a,b);close(mul(f,ratio(z,b,scale(a,-1))),[1,0]);
    for(const shift of [[1,0],[0,1],[1,1]])close(div(ratio(add(z,shift),a,b),f),[1,0]);
    close(theta(scale(z,Math.PI),3),theta(scale(z,Math.PI),12),3e-12);
   }
  }
 }
 // Gaussian-integer multiplication maps the square period lattice into itself;
 // determinants count the exact sheets in each inherited eye generation.
 for(const [a,b,degree] of [[2,0,4],[1,1,2],[2,1,5]]){assert.equal(a*a+b*b,degree);checks++;}
 console.log(JSON.stringify({suite:'revival identities and production uniforms',checks,maximumAbsoluteError:maximumError}));
}
main().catch(error=>{console.error(error);process.exitCode=1});
