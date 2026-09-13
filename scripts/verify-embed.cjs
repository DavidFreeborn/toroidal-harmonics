/* Real embedded-preview integration checks. No production-source rewriting.
   Usage: node scripts/verify-embed.cjs [dist-directory] [study-id ...]
   NODE_PATH must include the bundled Playwright installation. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),assert=require('node:assert/strict');
const core=['programs','lightfield','performance','eigenmodes','presets','collection','parameters','selection','artwork'];
const cases=new Map([[145,['revivals']],[146,['revivals']],[148,['phason','quasicrystal-data']],[101,['tessellations','tessellation-data']],[114,['tessellations','tessellation-data']],[138,['transformations']],[130,['transformations']],[19,['topology','spectrum']],[20,[]],[68,['quasicrystal','quasicrystal-data']],[67,['mechanisms']],[21,['kinetic']],[81,['metamorphosis','spectrum']],[32,['symmetry']],[56,['chiaroscuro']],[27,['sculptures']],[28,['sculptures']],[0,['topology','spectrum']]]);
function catalogue(root){
 const context={};vm.runInNewContext(fs.readFileSync(path.join(root,'presets.js'),'utf8')+fs.readFileSync(path.join(root,'collection.js'),'utf8')+';this.ids=TORUS_COLLECTION.flatMap(g=>g.studies.map(s=>s[0]));this.hidden=[...TorusPresets.hidden];',context);
 return {ids:Array.from(context.ids),hidden:Array.from(context.hidden)};
}
function harness(){return `<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><style>html,body{margin:0}iframe{display:block;border:0;width:660px;height:440px}</style><script>
window.messages=[];window.fixtureOrigin=new URL(location.href).searchParams.get('frameOrigin')||location.origin;
addEventListener('message',event=>{if(event.source!==document.querySelector('iframe')?.contentWindow)return;let ready=null;try{const w=event.source;ready={draws:w.__embedAudit.draws,busy:w.document.querySelector('#artwork')?.getAttribute('aria-busy'),width:w.document.querySelector('canvas')?.width};}catch{}messages.push({origin:event.origin,data:event.data,ready});});
sessionStorage.removeItem('torus-preview-study');
window.send=payload=>document.querySelector('iframe').contentWindow.postMessage(payload,fixtureOrigin);
addEventListener('DOMContentLoaded',()=>{const frame=document.createElement('iframe');frame.id='preview';frame.src=fixtureOrigin+'/embed.html';document.body.appendChild(frame);});
</script>`;}
async function serve(root){
 const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname==='/harness'){response.setHeader('Content-Type','text/html');response.end(harness());return;}
  if(url.pathname==='/favicon.ico'){response.writeHead(204);response.end();return;}
  let file;try{file=path.resolve(root,'.'+decodeURIComponent(url.pathname));}catch{response.writeHead(400);response.end();return;}
  if(!file.startsWith(root+path.sep)){response.writeHead(403);response.end();return;}
  fs.readFile(file,(error,data)=>{if(error){response.writeHead(404);response.end();return;}response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':'image/webp');response.end(data);});
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return {server,origin:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>server.close(resolve))};
}
async function fixture(browser,origin,seed,foreignOrigin){
 const context=await browser.newContext({viewport:{width:700,height:480},deviceScaleFactor:1,reducedMotion:'no-preference'}),page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text()+' '+message.location().url);});
 page.on('request',request=>requests.push(new URL(request.url()).pathname));page.on('requestfailed',request=>errors.push(request.url()+' '+request.failure()?.errorText));page.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+response.url());});
 await context.addInitScript(seed=>{
  if(!location.pathname.endsWith('/embed.html'))return;Math.random=()=>seed;
  const audit=window.__embedAudit={draws:0,lost:0,contexts:[]},get=HTMLCanvasElement.prototype.getContext,bindings=new WeakMap();
  HTMLCanvasElement.prototype.getContext=function(type,...args){const gl=get.call(this,type,...args);if(type==='webgl2'&&gl&&!audit.contexts.includes(gl)){audit.contexts.push(gl);this.addEventListener('webglcontextlost',()=>audit.lost++);}return gl;};
  const proto=WebGL2RenderingContext.prototype,bind=proto.bindFramebuffer;
  proto.bindFramebuffer=function(target,buffer){if(target===this.FRAMEBUFFER||target===this.DRAW_FRAMEBUFFER)bindings.set(this,buffer);return bind.call(this,target,buffer);};
  for(const key of ['drawElements','drawElementsInstanced','drawArrays','drawArraysInstanced']){const original=proto[key];proto[key]=function(...args){const result=original.apply(this,args);if(!bindings.get(this))audit.draws++;return result;};}
 },seed);
 await page.goto(origin+'/harness'+(foreignOrigin?'?frameOrigin='+encodeURIComponent(foreignOrigin):''),{waitUntil:'domcontentloaded'});
 const element=await page.locator('#preview').elementHandle(),frame=await element.contentFrame();
 await frame.waitForFunction(()=>document.getElementById('artwork')?.getAttribute('aria-busy')==='false',{},{timeout:120000});
 if(!foreignOrigin)await page.waitForFunction(()=>messages.some(message=>message.data?.type==='torus-preview-ready'),{},{timeout:120000});
 return {page,frame,context,errors,requests};
}
const snapshot=frame=>frame.evaluate(()=>{
 const audit=__embedAudit,gl=audit.contexts[0],errors=[];
 if(gl)for(let i=0;i<8;i++){const error=gl.getError();if(!error)break;errors.push(error);}
 return {draws:audit.draws,lost:audit.lost,errors,paused:document.querySelector('#pause')?.getAttribute('aria-label')==='Play animation',id:Number(sessionStorage.getItem('torus-preview-study')),robots:document.querySelector('meta[name="robots"]')?.content,chrome:[...document.querySelectorAll('#artwork > :not(#field)')].filter(element=>element.getClientRects().length>0).map(element=>element.id||element.tagName),text:document.body.innerText.trim()};
});
async function stable(frame){await frame.page().waitForTimeout(180);const first=await snapshot(frame);await frame.page().waitForTimeout(180);const second=await snapshot(frame);assert.equal(second.draws,first.draws,'Paused preview continued drawing after pending work drained');for(const state of [first,second]){assert(state.paused);assert.equal(state.lost,0);assert.deepEqual(state.errors,[]);}return second;}
async function main(){
 const root=path.resolve(process.argv[2]||path.join(__dirname,'../dist')),selected=process.argv.slice(3).map(Number),wanted=selected.length?selected:[...cases.keys()],{ids,hidden}=catalogue(root);
 assert(!ids.includes(147)&&ids.every(id=>!hidden.includes(id)),'Preview catalogue includes hidden studies');assert.equal(ids.length,102);
 const {chromium}=require('playwright'),host=await serve(root),other=await serve(root),browser=await chromium.launch({channel:process.env.TORUS_BROWSER||'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']}),report={pass:false,visibleStudies:ids.length,cases:[],refreshes:[],security:null,errors:[]};
 try{
  for(const id of wanted){
   assert(cases.has(id)&&ids.includes(id),'Test study is not visible: '+id);
   const seed=(ids.indexOf(id)+.5)/ids.length;let app;
   try{
    app=await fixture(browser,host.origin,seed);const {page,frame,requests,errors}=app;
    const ready=await page.evaluate(()=>messages.filter(message=>message.data?.type==='torus-preview-ready'));
    assert.equal(ready.length,1,'Preview should emit one ready event');assert.equal(ready[0].data.id,id,'Seeded random selection chose the wrong study');assert(ready[0].ready.draws>0&&ready[0].ready.width>0&&ready[0].ready.busy==='false','Ready was sent before a valid visible draw');
    const initial=await stable(frame);assert.equal(initial.id,id);assert.equal(initial.lost,0);assert.deepEqual(initial.errors,[]);assert.deepEqual(initial.chrome,[]);assert.equal(initial.text,'');assert(/\bnoindex\b/.test(initial.robots),'Preview must not be indexed');
    const scripts=[...new Set(requests.filter(request=>request.endsWith('.js')).map(request=>path.basename(request,'.js')))].sort();assert.deepEqual(scripts,[...core,...cases.get(id)].sort(),'Unrelated or missing family dependencies for '+id);
    assert.equal(requests.filter(request=>request==='/moore-field.png').length,id===20?1:0,'Moore atlas should only load for its selected study');assert(!requests.some(request=>request.startsWith('/studies/')),'Preview fetched catalogue thumbnails');
    assert.deepEqual(requests.filter(request=>request.startsWith('/escher/')),id===130?['/escher/130.png']:[],'Preview fetched an unrelated animal atlas');
    // A same-origin message from the child itself is not trusted as its parent.
    await frame.evaluate(()=>postMessage({type:'torus-preview-state',paused:false},location.origin));
    await page.evaluate(()=>{send({type:'torus-preview-state',paused:'false'});send({type:'other',paused:false});});
    await stable(frame);
    const before=(await snapshot(frame)).draws;await page.evaluate(()=>send({type:'torus-preview-state',paused:false}));
    await frame.waitForFunction(before=>__embedAudit.draws>before+1,before,{timeout:8000});const running=await snapshot(frame);assert.equal(running.paused,false,'Trusted resume was ignored');assert.equal(running.lost,0);assert.deepEqual(running.errors,[]);
    await page.evaluate(()=>send({type:'torus-preview-state',paused:true}));await stable(frame);assert.deepEqual(errors,[]);
    report.cases.push({id,readyAfterDraw:true,pausedAndResumed:true,scripts:cases.get(id),moore:id===20});
   }catch(error){report.errors.push({id,message:error.message,details:app?.errors||[]});}finally{if(app)await app.context.close();}
  }
  // Refresh keeps sessionStorage and must choose another visible study each time.
  let app=await fixture(browser,host.origin,(ids.indexOf(145)+.5)/ids.length);
  try{
   let previous=(await snapshot(app.frame)).id;report.refreshes.push(previous);
   for(let turn=0;turn<3;turn++){
    await app.page.evaluate(()=>{messages=[];document.querySelector('iframe').contentWindow.location.reload();});
    await app.page.waitForFunction(()=>messages.some(message=>message.data?.type==='torus-preview-ready'),{},{timeout:120000});
    const current=await app.page.evaluate(()=>messages.find(message=>message.data?.type==='torus-preview-ready').data.id);assert(ids.includes(current)&&!hidden.includes(current));assert.notEqual(current,previous,'Refresh repeated the previous study');report.refreshes.push(current);previous=current;
   }
   assert.deepEqual(app.errors,[]);
  }finally{await app.context.close();}
  // A genuine different-origin parent has the correct Window source but must
  // neither receive a targeted ready event nor control the child animation.
  app=await fixture(browser,other.origin,(ids.indexOf(19)+.5)/ids.length,host.origin);
  try{const before=await stable(app.frame);await app.page.evaluate(()=>send({type:'torus-preview-state',paused:false}));const after=await stable(app.frame);assert.equal(after.draws,before.draws);assert.equal((await app.page.evaluate(()=>messages)).length,0);assert.deepEqual(app.errors,[]);report.security={sameOriginWrongSourceIgnored:true,malformedMessagesIgnored:true,differentOriginParentIgnored:true};}finally{await app.context.close();}
  report.pass=report.errors.length===0;
 }catch(error){report.errors.push({message:error.message});}finally{await browser.close();await host.close();await other.close();}
 console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
}
main().catch(error=>{console.log(JSON.stringify({pass:false,error:error.message}));process.exitCode=1;});
