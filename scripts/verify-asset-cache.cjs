/* Exercise real atlas loading code with a 2048-pixel device limit. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const images=[],live=new Set(),uploads=[];let next=0,ready=0;
const gl=new Proxy({}, {get(_,key){
 if(key==='createTexture')return ()=>{const t={id:++next};live.add(t);assert(live.size<=3,'two fields plus one placeholder');return t};
 if(key==='deleteTexture')return t=>assert(live.delete(t));
 if(key==='texStorage3D')return (target,levels,format,w,h,depth)=>{assert(w<=2048&&h<=2048);assert.equal(depth,2);assert.equal(levels,1)};
 if(key==='texSubImage3D')return (target,level,x,y,z,w,h,depth,format,type,source)=>{assert.equal(w,1820);assert.equal(h,1820);assert.equal(depth,1);assert.equal(source.width,w);uploads.push(z)};
 if(key==='getParameter')return ()=>2048;
 return ()=>{};
}});
const c={console:{warn(){}},TorusPrograms:{link:async()=>({})},TorusLight:{fragment:s=>s,bind(){}},Image:class{constructor(){this.width=3640;this.height=1820;images.push(this)}},document:{createElement(){return {getContext(){return {drawImage(image,x,y,w,h,dx,dy,dw,dh){assert.equal(w,dw);assert.equal(h,dh);assert.equal(w,1820);assert([0,1820].includes(x));assert.equal(y,0)}}}}}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/transformations.js'),'utf8')+';this.T=TorusTransformations',c);
(async()=>{
 const renderer=await c.T.create(gl,{},1,()=>ready++);
 const first=renderer.prepare(5),second=renderer.prepare(6),third=renderer.prepare(7);
 assert.equal(await first,false,'evicted pending selection must settle');const before=live.size;images[0].onload();images[0].done=true;assert.equal(live.size,before,'late evicted load must not upload');
 images[1].onload();images[1].done=true;assert.equal(await second,true);images[2].onerror();images[2].done=true;assert.equal(await third,false);
 for(let i=0;i<100;i++){
  const job=renderer.prepare(5+i%5);
  for(const im of images)if(!im.done){im.done=true;im.onload();}
  await job;assert(live.size<=3);
 }
 assert(ready>90);assert.equal(uploads.length,ready*2);assert(uploads.every((layer,i)=>layer===i%2));
 console.log('PASS full-resolution 2048-limit uploads, stale-load rejection, failed-load settlement and bounded residency over 100 switches');
})().catch(e=>{console.error(e);process.exitCode=1});
