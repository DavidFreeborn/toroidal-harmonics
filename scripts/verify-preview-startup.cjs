/* Actual browser regression for the canvas-only preview. A dynamic base shader
   is the pixel reference; the specialised program must render the same frame. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),catalogue={};
for(const file of ['presets.js','collection.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),catalogue);
const ids=vm.runInNewContext('TORUS_COLLECTION.flatMap(g=>g.studies.map(s=>s[0]))',catalogue);
const source=fs.readFileSync(path.join(root,'artwork.js'),'utf8');
const reference=source.replace("const source=embedded?fragmentSource.replace('uniform float uPattern;',`const float uPattern=${pattern}.0;`):fragmentSource;",'const source=fragmentSource;');
assert.notEqual(source,reference,'reference must disable specialization');
(async()=>{
 const server=http.createServer((q,r)=>{const url=new URL(q.url,'http://local'),ref=url.pathname.startsWith('/reference/'),name=url.pathname.replace(/^\/(reference\/)?/,'');let data;
 try{data=name==='artwork.js'&&ref?reference:fs.readFileSync(path.join(root,name));}catch{return r.writeHead(404).end();}
 r.setHeader('Content-Type',name.endsWith('.html')?'text/html':name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'application/octet-stream');r.end(data);
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:process.env.TORUS_BROWSER||'msedge',headless:true});
 const results=[],errors=[];
 try{
  async function frame(index,reference,dpr=2,fail=''){
   const context=await browser.newContext({viewport:{width:220,height:220},deviceScaleFactor:dpr,reducedMotion:'reduce'}),page=await context.newPage();
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(({index,count})=>{Math.random=()=> (index+.25)/count;const orig=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(name,opts){return orig.call(this,name,name==='webgl2'?{...opts,preserveDrawingBuffer:true}:opts)};},{index,count:ids.length});
   if(fail)await page.route('**/'+fail+'.js?*',r=>r.abort());
   await page.goto(`http://127.0.0.1:${server.address().port}/${reference?'reference/':''}embed.html`);
   await page.waitForFunction(()=>document.querySelector('#artwork').getAttribute('aria-busy')==='false',{},{timeout:60000});
   const result=await page.evaluate(()=>{const c=document.querySelector('canvas'),g=c.getContext('webgl2'),p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);return {pixels:Array.from(p),width:c.width,height:c.height,error:g.getError(),label:c.getAttribute('aria-label'),quality:document.querySelector('#renderQuality').value};});
   await context.close();assert.equal(result.error,0);return result;
  }
  for(let i=0;i<ids.length;i++){
   const before=await frame(i,true),after=await frame(i,false);assert.equal(after.width,440);assert.equal(after.height,440);assert.equal(after.quality,'native');assert.equal(after.label,before.label);
   let sum=0,max=0,ink=0;for(let k=0;k<after.pixels.length;k+=4){const error=Math.abs(before.pixels[k]-after.pixels[k]);sum+=error;max=Math.max(max,error);if(after.pixels[k]<245)ink++;}
   const mean=sum/(after.width*after.height);assert(mean<.05,`Study ${ids[i]} changed: ${mean}`);assert(ink>20,`Study ${ids[i]} must draw actual artwork`);results.push({id:ids[i],mean,max});
   if(i%10===0)console.log('Compared',i+1,'/',ids.length);
  }
  for(const dpr of [1,3]){const frameResult=await frame(0,false,dpr);assert.equal(frameResult.width,220*Math.max(2,dpr));}
  // Fallback changes the selected study, so its base shader must follow too.
  const fallback=await frame(ids.indexOf(148),false,2,'phason');assert(!fallback.label.startsWith('Phason Tide'));assert.equal(fallback.error,0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:results.length,maximumMeanError:Math.max(...results.map(r=>r.mean)),maximumChannelError:Math.max(...results.map(r=>r.max)),resolution:'2x minimum, native above 2x',fallback:true}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
