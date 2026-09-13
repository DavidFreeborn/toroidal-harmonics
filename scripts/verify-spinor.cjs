/* CPU proof checks are independent of the shader's expanded quaternion formula.
   Browser transform feedback in capture-spinor.cjs also checks production GLSL. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../dist/spinor.js'),'utf8'),TAU=Math.PI*2;
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),scale=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a),unit=a=>scale(a,1/norm(a));
function mul(a,b){return [...add(add(scale(b.slice(0,3),a[3]),scale(a.slice(0,3),b[3])),cross(a.slice(0,3),b.slice(0,3))),a[3]*b[3]-dot(a.slice(0,3),b.slice(0,3))];}
function conjugate(q){return [-q[0],-q[1],-q[2],q[3]];}
function rotate(q,p){return mul(mul(q,[...p,0]),conjugate(q)).slice(0,3);}
function smooth(s){return s*s*s*(10+s*(-15+6*s));}
function quaternion(radius,t,arch=0){
 const s=Math.max(0,Math.min(1,(radius-.38)/.77)),a=Math.PI/2*smooth(s),c=Math.cos(a),h=Math.sin(a);
 const F=[c*Math.sin(t),h,0,c*Math.cos(t)],base=[0,h,0,c],q=mul(F,conjugate(base)),A=[Math.sin(arch/2),0,0,Math.cos(arch/2)];
 return mul(mul(A,q),conjugate(A));
}
function deform(p,t,arch=0){return rotate(quaternion(norm(p),t,arch),p);}
function analytic(p,t,arch=0){
 const radius=norm(p),s=Math.max(0,Math.min(1,(radius-.38)/.77)),a=Math.PI/2*smooth(s),da=Math.PI/2*30*s*s*(1-s)*(1-s)/.77,c=Math.cos(a),h=Math.sin(a),C=Math.cos(t),S=Math.sin(t);
 let q=[c*c*S,h*c*(1-C),-h*c*S,h*h+c*c*C],qa=[-2*h*c*S,(c*c-h*h)*(1-C),-(c*c-h*h)*S,2*h*c*(1-C)];
 const A=[Math.sin(arch/2),0,0,Math.cos(arch/2)];q=mul(mul(A,q),conjugate(A));qa=mul(mul(A,qa),conjugate(A));
 const v=q.slice(0,3),dv=qa.slice(0,3),radial=scale(add(cross(dv,add(cross(v,p),scale(p,q[3]))),cross(v,add(cross(dv,p),scale(p,qa[3])))),2*da);
 return {position:rotate(q,p),columns:[[1,0,0],[0,1,0],[0,0,1]].map(e=>add(rotate(q,e),scale(radial,dot(p,e)/radius)))};
}
let maxGradient=0,maxDet=0,maxInverse=0,maxPeriod=0,cases=0;
for(const t of [0,.0001,.31,1.1,Math.PI,4.21,TAU-.0001,TAU])for(const arch of [0,Math.PI/3,-Math.PI/3])for(const r of [.21,.38,.3801,.45,.63,.85,1.1499,1.15,1.28])for(const d of [[1,2,3],[-1,.2,1],[0,0,1],[0,1,0]]){
 const p=scale(unit(d),r),value=deform(p,t,arch),a=analytic(p,t,arch),inverse=rotate(conjugate(quaternion(norm(value),t,arch)),value);
 assert(norm(sub(value,a.position))<2e-14,'expanded shader formula agrees with independent quaternion product');
 assert(Math.abs(norm(value)-r)<2e-14,'ambient map preserves radius');
 maxInverse=Math.max(maxInverse,norm(sub(inverse,p)));maxPeriod=Math.max(maxPeriod,norm(sub(value,deform(p,t+TAU,arch))));
 for(let k=0;k<3;k++){const plus=p.slice(),minus=p.slice(),eps=1e-6;plus[k]+=eps;minus[k]-=eps;const finite=scale(sub(deform(plus,t,arch),deform(minus,t,arch)),1/(2*eps));maxGradient=Math.max(maxGradient,norm(sub(finite,a.columns[k])));}
 const determinant=dot(a.columns[0],cross(a.columns[1],a.columns[2]));maxDet=Math.max(maxDet,Math.abs(determinant-1));cases++;
}
assert(maxGradient<2e-7);assert(maxDet<1e-12);assert(maxInverse<2e-14);assert(maxPeriod<2e-14);
for(const t of [.1,1,Math.PI,4,TAU]){
 for(const p of [[.21,.18,0],[.21,-.21,.21],[0,0,.21]])assert(norm(sub(deform(p,t),rotate([Math.sin(t),0,0,Math.cos(t)],p)))<1e-13,'cube and attachment share an exact constant-speed rotation');
 for(const p of [[0,0,1.2],[.18,0,1.2],[0,1.2,0]])assert(norm(sub(deform(p,t),p))<1e-13,'outer anchors remain fixed');
}
assert(norm(sub(deform([0,0,.7],Math.PI),[0,0,.7]))>.5,'one360-degree turn has not reset the ribbon');
assert(norm(sub(deform([0,0,.7],TAU),[0,0,.7]))<1e-13,'two360-degree turns reset the ribbon');
let allocations=0,uploads=0,draws=0,captured=null,vertexSource;
const gl=new Proxy({}, {get(_,key){
 if(key==='createBuffer'||key==='createVertexArray')return ()=>{allocations++;return {}};
 if(key==='bufferData')return ()=>{uploads++};
 if(key==='bufferSubData')return (target,offset,data,start,count)=>{captured=Array.from(data.subarray(start,start+count))};
 if(key==='drawElementsInstanced')return (mode,count,type,offset,n)=>{assert(count>0&&n>=12&&n<=40);draws++};
 if(key==='getUniformLocation')return (_,name)=>name;
 if(/^[A-Z_0-9]+$/.test(key))return key;
 return ()=>{};
}});
const context=vm.createContext({Float32Array,Uint16Array,Math,Map,TorusPrograms:{link:async(g,v)=>{vertexSource=v;return {}}}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/lightfield.js'),'utf8'),context);
vm.runInContext(source,context);const moduleValue=vm.runInContext('TorusSpinor',context);
async function main(){
 const render=await moduleValue.create(gl);let minGap=Infinity,recipes=0;
 for(const density of [0,40,88,136,160,224])for(let winding=0;winding<4;winding++)for(let variant=0;variant<3;variant++){
  const options={winding,turns:1,ink:.95,palette:0},r=moduleValue.recipe(density,winding),m=render.prepare(0,variant,options,density),mark=[allocations,uploads];
  assert.equal(render.prepare(0,variant,options,density),m);
  for(const phase of [0,.31,Math.PI,4.2,TAU]){
   render.draw(new Float32Array(16),phase,.65,density,0,variant,options);
   assert.deepEqual([allocations,uploads],mark,'draw must allocate no mesh or GL storage');
   for(let i=0;i<r.count;i++)for(let j=i+1;j<r.count;j++){
    const a=captured.slice(i*17,i*17+3),b=captured.slice(j*17,j*17+3),gap=norm(sub(a,b))-2*r.radius;minGap=Math.min(minGap,gap);assert(gap>.02,'whole mechanism bounds must be separated');
   }
   for(let i=0;i<r.count;i++){
    const p=captured.slice(i*17,i*17+3),tubeDistance=Math.hypot(Math.hypot(p[0],p[2])-3,p[1]);assert(tubeDistance+r.radius<1.8-.03,'entire geometry remains in front of torus wall');
   }
  }
  render.draw(new Float32Array(16),0,.65,density,0,variant,options);const initial=captured.slice();
  render.draw(new Float32Array(16),TAU,.65,density,0,variant,options);assert(Math.max(...captured.map((x,i)=>Math.abs(x-initial[i])))<1e-6,'full instance state wraps seamlessly');recipes++;
 }
 for(const variant of [0,1]){
  const m=moduleValue.meshData(variant);assert(m.vertices.length/9<65536);assert(Math.max(...m.indices)<m.vertices.length/9);
  for(let k=0;k<m.vertices.length;k+=9){const p=Array.from(m.vertices.subarray(k,k+3));if(m.vertices[k+8]<0)p[0]*=.18;assert(norm(p)<1.31,'mesh lies in conservative bounding sphere');}
 }
 assert(vertexSource.includes('normal=normalize(cross(along,across))'),'production uses analytic ribbon normals');
 render.dispose();
 console.log(JSON.stringify({pass:true,quaternionCases:cases,maxGradient,maxDet,maxInverse,maxPeriod,recipes,draws,minWorldGap:minGap},null,2));
}
module.exports={quaternion,deform,analytic,rotate,sub,norm,cross,unit};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
