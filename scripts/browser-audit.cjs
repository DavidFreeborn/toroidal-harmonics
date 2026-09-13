const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
async function open(root,options={}){
 const server=http.createServer((req,res)=>{const part=decodeURIComponent(req.url.split('?')[0]);if(part==='/favicon.ico'){res.writeHead(204);res.end();return;}const file=path.join(root,part==='/'?'index.html':part);if(!file.startsWith(path.resolve(root)+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':'image/webp');res.end(data);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:process.env.TORUS_BROWSER||'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:options.viewport||{width:1100,height:760},deviceScaleFactor:options.dpr||1,reducedMotion:options.animate?'no-preference':'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{
  window.__audit={links:[],draws:[],frames:[],longTasks:[],gpu:[],record:false,frameTime:null,framebuffer:null};
  const proto=WebGL2RenderingContext.prototype;
  const bind=proto.bindFramebuffer;proto.bindFramebuffer=function(target,buffer){if(target===this.FRAMEBUFFER||target===this.DRAW_FRAMEBUFFER)__audit.framebuffer=buffer;return bind.call(this,target,buffer);};
  const query=proto.getQueryParameter,beginQuery=proto.beginQuery,queryStudies=new WeakMap();
  proto.beginQuery=function(target,q){queryStudies.set(q,document.getElementById('study-title')?.textContent);return beginQuery.call(this,target,q);};
  proto.getQueryParameter=function(q,p){const value=query.call(this,q,p);if(p===this.QUERY_RESULT&&__audit.record&&queryStudies.get(q)===document.getElementById('study-title')?.textContent)__audit.gpu.push(value/1e6);return value;};
  for(const key of ['linkProgram','drawElements','drawElementsInstanced']){const original=proto[key];proto[key]=function(...args){const start=performance.now();const result=original.apply(this,args);const ms=performance.now()-start;if(key==='linkProgram')__audit.links.push({at:start,ms});else if(__audit.record&&!__audit.framebuffer)__audit.draws.push({at:start,ms,frame:__audit.frameTime,title:document.getElementById('study-title').textContent});return result;};}
  new PerformanceObserver(list=>{for(const e of list.getEntries())__audit.longTasks.push({at:e.startTime,ms:e.duration});}).observe({type:'longtask',buffered:true});
  const raf=window.requestAnimationFrame;window.requestAnimationFrame=function(callback){return raf.call(window,now=>{if(__audit.record)__audit.frames.push(now);__audit.frameTime=now;try{callback(now);}finally{__audit.frameTime=null;}});};
 });
 if(options.seed!==undefined)await page.addInitScript(seed=>{let state=seed;Math.random=()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296;};},options.seed);
 if(options.background===false)await page.route('**/programs.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nTorusPrograms.idleQueue=()=>({enqueue(){return Promise.resolve(false)},promote(){},dispose(){}});'});});
 if(options.phase!==undefined)await page.route('**/artwork.js*',async route=>{const response=await route.fetch(),source=await response.text(),clock='state.time=(state.time+(elapsed/1000)*state.speed*Math.PI/16)%(Math.PI*2);';if(!source.includes(clock))throw Error('Cannot fix the benchmark animation phase');await route.fulfill({response,body:source.replace(clock,'state.time='+Number(options.phase)+';')});});
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await page.waitForFunction(()=>document.querySelector('#artwork').getAttribute('aria-busy')==='false',null,{timeout:120000});
 const info=await page.evaluate(()=>{const c=document.querySelector('canvas'),g=c.getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return {renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),userAgent:navigator.userAgent,headless:true,dpr:devicePixelRatio,width:c.width,height:c.height,parallel:!!g.getExtension('KHR_parallel_shader_compile'),timer:!!g.getExtension('EXT_disjoint_timer_query_webgl2')};});
 async function select(id){const start=Date.now();await page.evaluate(id=>{const button=[...document.querySelectorAll('.study-choice')].find(b=>b.querySelector('img').getAttribute('src').includes('/'+id+'.webp'));if(!button)throw Error('Unknown study '+id);button.click();},id);await page.waitForFunction(()=>document.querySelector('#artwork').getAttribute('aria-busy')==='false',null,{timeout:120000});return Date.now()-start;}
 async function input(id,value){await page.evaluate(({id,value})=>{const x=document.getElementById(id);x.value=String(value);x.dispatchEvent(new Event('input',{bubbles:true}));},{id,value});}
 async function settle(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
 async function close(){await browser.close();await new Promise(resolve=>server.close(resolve));}
 return {page,browser,server,errors,info,select,input,settle,close};
}
function percentile(values,p){const a=[...values].sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.floor(a.length*p))]||0;}
async function main(){
 const root=path.resolve(process.argv[2]||path.join(__dirname,'../dist')),out=path.resolve(process.argv[3]||path.join(__dirname,'browser-audit'));fs.mkdirSync(out,{recursive:true});
 const app=await open(root,{animate:true});const report={info:app.info,cases:[],errors:app.errors};
 try{
  for(const id of [101,76,138,21,27,59,67,68,130,101,76]){
   await app.page.evaluate(()=>{__audit.record=true;__audit.frames=[];__audit.draws=[];__audit.longTasks=[];__audit.gpu=[];});
   const selectionMs=await app.select(id);await app.page.waitForTimeout(1800);
   const data=await app.page.evaluate(()=>{__audit.record=false;return {frames:__audit.frames,draws:__audit.draws,gpu:__audit.gpu,longTasks:__audit.longTasks,title:document.getElementById('study-title').textContent,width:document.querySelector('canvas').width};});
   const frames=[...new Set(data.draws.filter(d=>d.title===data.title&&d.frame!==null).map(d=>d.frame))],intervals=frames.slice(1).map((t,i)=>t-frames[i]);
   report.cases.push({id,title:data.title,selectionMs,width:data.width,medianMs:percentile(intervals,.5),p95Ms:percentile(intervals,.95),maxMs:Math.max(...intervals),slowFrames:intervals.filter(x=>x>25).length,frameCount:intervals.length,gpuMedianMs:percentile(data.gpu,.5),drawSubmitMaxMs:Math.max(...data.draws.map(d=>d.ms)),longTasks:data.longTasks});
   console.log(JSON.stringify(report.cases.at(-1)));
   fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
  }
  report.errors=app.errors;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
 }finally{await app.close();}
}
module.exports={open,percentile};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
