/* Run GPU-isolated. Fresh browsers and disabled shader disk caching make each
   selected homepage study a cold start. Stress profiles are emulations, not
   measurements of a phone GPU or Safari. Serve the exact built website. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),zlib=require('node:zlib');
const {chromium}=require('playwright');
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(2,i),a.slice(i+1)]}));
const site=path.resolve(args.site||'../website/dist'),output=path.resolve(args.out||'preview-worst-case.json');
const profile=args.profile||'desktop',rounds=Number(args.rounds||1),sampleMs=Number(args.sample||2500),compression=args.compression||'none';
const catalogue={};for(const name of ['presets','collection'])vm.runInNewContext(fs.readFileSync(path.join(site,'fun/toroidal-harmonics',name+'.js'),'utf8'),catalogue);
const ids=Array.from(vm.runInNewContext('TORUS_COLLECTION.flatMap(g=>g.studies.map(s=>s[0]))',catalogue));
const selected=args.ids?args.ids.split(',').map(Number):ids;
const percentile=(xs,p)=>{const a=[...xs].sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.floor(a.length*p))]??null};
const report={date:new Date().toISOString(),profile,rounds,sampleMs,conditions:{frameMethod:'unique animation timestamps with onscreen draws',compression,coldBrowser:true,shaderDiskCache:false,network:profile==='mobile-stress'?'150 ms latency, 1.6 Mbit/s down, 750 kbit/s up':'local HTTP, unthrottled',cpuRate:profile==='mobile-stress'?4:1,viewport:profile==='mobile-stress'?[390,844]:[1440,1000],dpr:profile==='mobile-stress'?3:2,mobileHardware:false},cases:[]};
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.avif':'image/avif','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
(async()=>{
 fs.mkdirSync(path.dirname(output),{recursive:true});
 const compressed=new Map();
 if(compression==='br'){
  // Compression is prepared before timing, matching the production CDN's
  // compressed transfers without charging the first visitor for compression.
  function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.(html|js|css|svg)$/.test(f))compressed.set(f,zlib.brotliCompressSync(fs.readFileSync(f),{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:5}}))}}
  walk(site);
 }
 const server=http.createServer((req,res)=>{let f=path.resolve(site,'.'+decodeURIComponent(req.url.split('?')[0]));if(f!==site&&!f.startsWith(site+path.sep))return res.writeHead(403).end();if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');fs.readFile(f,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');if(compressed.has(f)&&/\bbr\b/.test(req.headers['accept-encoding']||'')){res.setHeader('Content-Encoding','br');data=compressed.get(f)}res.end(data)});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  for(let round=0;round<rounds;round++)for(const id of (round%2?[...selected].reverse():selected)){
   const index=ids.indexOf(id);if(index<0)throw Error('Unknown study '+id);
   const browser=await chromium.launch({channel:process.env.TORUS_BROWSER||'msedge',headless:true,args:['--disable-gpu-shader-disk-cache']});
   const context=await browser.newContext({viewport:{width:report.conditions.viewport[0],height:report.conditions.viewport[1]},deviceScaleFactor:report.conditions.dpr,isMobile:profile==='mobile-stress',hasTouch:profile==='mobile-stress'});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.addInitScript(({index,count})=>{
     Math.random=()=> (index+.25)/count;
     window.__audit={record:false,draws:[],gpu:[],tasks:[],ready:null,links:[],scrollAt:0,frameTime:null};
     const raf=window.requestAnimationFrame;window.requestAnimationFrame=function(callback){return raf.call(window,now=>{__audit.frameTime=now;try{callback(now)}finally{__audit.frameTime=null}})};
     const proto=WebGL2RenderingContext.prototype;let framebuffer=null;
     const bind=proto.bindFramebuffer;proto.bindFramebuffer=function(target,buffer){if(target===this.FRAMEBUFFER||target===this.DRAW_FRAMEBUFFER)framebuffer=buffer;return bind.call(this,target,buffer)};
     for(const name of ['drawElements','drawElementsInstanced','drawArrays','drawArraysInstanced']){const original=proto[name];proto[name]=function(...a){if(__audit.record&&!framebuffer&&__audit.frameTime!==null)__audit.draws.push(__audit.frameTime);return original.apply(this,a)}}
     const query=proto.getQueryParameter;proto.getQueryParameter=function(q,p){const result=query.call(this,q,p);if(__audit.record&&p===this.QUERY_RESULT)__audit.gpu.push(result/1e6);return result};
     const link=proto.linkProgram;proto.linkProgram=function(...a){__audit.links.push(performance.now());return link.apply(this,a)};
     new PerformanceObserver(l=>{for(const e of l.getEntries())__audit.tasks.push({at:e.startTime,ms:e.duration})}).observe({type:'longtask',buffered:true});
     addEventListener('message',e=>{if(e.data?.type==='torus-preview-ready')__audit.ready=performance.now()});
    },{index,count:ids.length});
    if(profile==='mobile-stress'){
     const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1600000/8,uploadThroughput:750000/8,connectionType:'cellular4g'});
    }
    await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
    if(profile==='mobile-stress'){await page.evaluate(()=>{__audit.scrollAt=performance.now();document.querySelector('.preview-frame').scrollIntoView({behavior:'instant'})});}
    await page.waitForSelector('[data-ready=true]',{timeout:60000});
    const startup=await page.evaluate(()=>{const f=document.querySelector('.preview-frame iframe'),w=f.contentWindow,c=w.document.querySelector('canvas'),g=c.getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return {id:Number(document.querySelector('[data-study]').dataset.study),title:f.title,readyMs:__audit.ready,afterScrollMs:__audit.scrollAt?__audit.ready-__audit.scrollAt:null,raster:[c.width,c.height],css:[c.getBoundingClientRect().width,c.getBoundingClientRect().height],renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),browser:navigator.userAgent,quality:w.document.querySelector('#renderQuality').value,startupLongTasks:w.__audit.tasks,resources:w.performance.getEntriesByType('resource').map(r=>({name:r.name.split('/').pop(),start:r.startTime,end:r.responseEnd,bytes:r.encodedBodySize}))}});
    if(startup.id!==id)throw Error(`Study ${id} fell back to ${startup.id}`);
    await page.waitForTimeout(500);
    await page.locator('.preview-frame iframe').evaluate(f=>{const a=f.contentWindow.__audit;a.record=true;a.draws=[];a.gpu=[];a.tasks=[];a.begin=f.contentWindow.performance.now()});
    await page.waitForTimeout(sampleMs);
    const data=await page.locator('.preview-frame iframe').evaluate(f=>{const w=f.contentWindow,a=w.__audit;a.record=false;const c=w.document.querySelector('canvas');return {draws:a.draws,gpu:a.gpu,tasks:a.tasks,duration:w.performance.now()-a.begin,raster:[c.width,c.height],glError:c.getContext('webgl2').getError()}});
    if(data.glError||errors.length)throw Error(`Rendering errors: ${data.glError}; ${errors.join('; ')}`);
    if(startup.quality!=='native'||String(startup.raster)!==String(data.raster))throw Error('Rendering resolution changed');
    if(!data.draws.length)throw Error('No animation frames rendered');
    // Count only animation callbacks which actually submitted an onscreen draw,
    // deduplicating multiple draw calls with the browser's frame timestamp.
    const frames=[...new Set(data.draws)],intervals=frames.slice(1).map((v,i)=>v-frames[i]);
    const row={round,...startup,frameCount:frames.length,observedFPS:frames.length/(data.duration/1000),frameMedianMs:percentile(intervals,.5),frameP95Ms:percentile(intervals,.95),frameMaxMs:intervals.length?Math.max(...intervals):null,gpuMedianMs:percentile(data.gpu,.5),gpuP95Ms:percentile(data.gpu,.95),gpuSamples:data.gpu.length,steadyLongTasks:data.tasks,rasterAfter:data.raster,glError:data.glError,errors};
    report.cases.push(row);console.log(JSON.stringify({round,id,title:row.title,readyMs:Math.round(row.readyMs),fps:Math.round(row.observedFPS),p95:row.frameP95Ms,gpu:row.gpuMedianMs}));
   }catch(e){report.cases.push({round,id,failure:e.message,errors});console.log('FAILED',id,e.message)}
   finally{await browser.close();fs.writeFileSync(output,JSON.stringify(report,null,2));}
  }
  const good=report.cases.filter(r=>!r.failure);report.summary={passed:good.length,failures:report.cases.filter(r=>r.failure),startupMedian:percentile(good.map(r=>r.readyMs),.5),startupP95:percentile(good.map(r=>r.readyMs),.95),slowestStarts:[...good].sort((a,b)=>b.readyMs-a.readyMs).slice(0,10).map(({id,title,readyMs})=>({id,title,readyMs})),slowestRendering:[...good].sort((a,b)=>(b.gpuMedianMs||0)-(a.gpuMedianMs||0)).slice(0,10).map(({id,title,gpuMedianMs,observedFPS,frameP95Ms})=>({id,title,gpuMedianMs,observedFPS,frameP95Ms}))};fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));
  if(report.summary.failures.length)process.exitCode=1;
 }finally{await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
