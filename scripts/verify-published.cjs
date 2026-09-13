/* Small remote-deployment smoke test. No local server, source substitution,
   screenshots, or generated files. Usage: node scripts/verify-published.cjs URL [URL ...]
   Set NODE_PATH to the bundled Playwright node_modules, as for browser-audit.cjs. */
const assert=require('node:assert/strict');
const expectedStudies=103,newStudies=[145,146,147,148];
// Static hosts may serve the same guide through their extensionless alias.
const guidePath=value=>value.replace(/\/$/,'').replace(/\.html$/,'');
function baseURL(value){
 const url=new URL(value);assert(['http:','https:'].includes(url.protocol),'Expected an HTTP(S) deployment URL');
 url.search='';url.hash='';if(!url.pathname.endsWith('/')&&!url.pathname.endsWith('/index.html'))url.pathname+='/';
 return url.href;
}
async function verify(browser,url){
 const context=await browser.newContext({viewport:{width:1100,height:760},deviceScaleFactor:1,reducedMotion:'reduce'});
 const report={url,pass:false,choices:0,studies:[],guide:null,errors:[]};let active=true;
 const problem=(kind,message)=>{if(active)report.errors.push({kind,message});};
 context.on('page',page=>{
  page.on('pageerror',error=>problem('page',error.message));
  page.on('console',message=>{if(message.type()==='error')problem('console',message.text()+' '+(message.location().url||''));});
  page.on('requestfailed',request=>problem('request',request.url()+' '+request.failure()?.errorText));
  page.on('response',response=>{if(response.status()>=400)problem('http',response.status()+' '+response.url());});
 });
 await context.addInitScript(()=>{
  const audit=window.__publishedAudit={draws:0,contexts:[],lost:0},bound=new WeakMap();
  const getContext=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){const gl=getContext.call(this,type,...args);if(type==='webgl2'&&gl&&!audit.contexts.includes(gl)){audit.contexts.push(gl);this.addEventListener('webglcontextlost',()=>audit.lost++);}return gl;};
  const proto=WebGL2RenderingContext.prototype,bind=proto.bindFramebuffer;
  proto.bindFramebuffer=function(target,buffer){if(target===this.FRAMEBUFFER||target===this.DRAW_FRAMEBUFFER)bound.set(this,buffer);return bind.call(this,target,buffer);};
  for(const key of ['drawElements','drawElementsInstanced','drawArrays','drawArraysInstanced']){const original=proto[key];proto[key]=function(...args){const result=original.apply(this,args);if(!bound.get(this))audit.draws++;return result;};}
 });
 const page=await context.newPage();page.setDefaultTimeout(30000);
 const ready=async id=>{
  await page.waitForFunction(id=>{
   const root=document.getElementById('artwork'),link=document.getElementById('readme-link');
   return root?.getAttribute('aria-busy')==='false'&&(id===null||link?.hash==='#study-'+id);
  },id??null,{timeout:120000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 };
 const checkpoint=async()=>{
  const state=await page.evaluate(()=>{
   const audit=window.__publishedAudit,canvas=document.querySelector('#field'),gl=audit.contexts[0],errors=[];
   if(gl)for(let i=0;i<8;i++){const error=gl.getError();if(error===gl.NO_ERROR)break;errors.push(error);}
   return {draws:audit.draws,contexts:audit.contexts.length,lost:audit.lost,errors,width:canvas?.width||0,height:canvas?.height||0,alert:document.getElementById('error')?.hidden===false};
  });
  assert(state.contexts>0&&state.width>0&&state.height>0,'WebGL canvas was not initialized');assert(!state.alert,'Application reports a rendering error');assert.equal(state.lost,0,'WebGL context was lost');assert.deepEqual(state.errors,[],'WebGL error');return state;
 };
 try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});assert(response?.ok(),'Application document failed to load');await ready();await checkpoint();
  const actualBase=new URL('./',page.url()),ids=await page.locator('.study-choice img').evaluateAll(images=>images.map(image=>Number(new URL(image.src).pathname.match(/\/(\d+)\.webp$/)?.[1])));
  assert.equal(ids.length,expectedStudies,'Wrong published study count');assert.equal(new Set(ids).size,expectedStudies,'Duplicate or invalid study identifiers');assert(ids.every(Number.isInteger),'Invalid study identifier');report.choices=ids.length;
  for(const id of newStudies){
   const before=(await checkpoint()).draws;await page.locator('#collection-toggle').click();
   const choice=page.locator('.study-choice').filter({has:page.locator('img[src*="/'+id+'.webp"]')});assert.equal(await choice.count(),1,'Missing study '+id);await choice.click();await ready(id);
   const state=await checkpoint();assert(state.draws>before,'Study '+id+' submitted no visible draw');assert.equal(await choice.getAttribute('aria-pressed'),'true');
   const guideHref=await page.locator('#readme-link').getAttribute('href'),guideURL=new URL(guideHref,page.url());
   assert.equal(guideURL.origin,actualBase.origin,'Readme left the deployment origin');assert.equal(guidePath(guideURL.pathname),new URL('readme',actualBase).pathname,'Readme left the deployment directory');assert.equal(guideURL.hash,'#study-'+id,'Readme selected the wrong explainer');
   await page.locator('#settings').click();
   const controls=await page.locator('#controls').evaluate(element=>[...element.querySelectorAll('input,select')].filter(input=>input.getClientRects().length&&!input.closest('[hidden]')).map(input=>({id:input.id,value:input.value,disabled:input.disabled,options:input.tagName==='SELECT'?input.options.length:undefined})));
   const names=controls.map(control=>control.id);for(const key of ['variation','speed','perspective','ink','wave','renderQuality'])assert(names.includes(key),'Missing control '+key+' in study '+id);
   for(const key of id===145?['density','layers','turns']:id===146?['density','layers']:id===147?['density','winding','turns']:[])assert(names.includes(key),'Missing control '+key+' in study '+id);
   assert(!names.includes('textureMode'),'Unrelated texture modulation exposed in new study');assert(controls.every(control=>!control.disabled&&control.value!==''),'Empty or disabled study controls');assert.equal(controls.find(control=>control.id==='variation').options,3,'Expected three constructions');
   await page.locator('#parameters-close').click();report.studies.push({id,title:await page.locator('#study-title').textContent(),constructions:3,controls:names,readme:guideURL.href});
  }
  // Follow the actual target=_blank link, checking both path and hash routing.
  const popupPromise=page.waitForEvent('popup');await page.locator('#readme-link').click();const guide=await popupPromise;
  // A popup can be delivered while its initial blank document is current.
  await guide.waitForURL(value=>value.pathname.endsWith('/readme.html')||value.pathname.endsWith('/readme'),{waitUntil:'domcontentloaded'});
  const guideURL=new URL(guide.url());assert.equal(guideURL.origin,actualBase.origin);assert.equal(guidePath(guideURL.pathname),new URL('readme',actualBase).pathname);assert.equal(guideURL.hash,'#study-148');
  await guide.waitForFunction(()=>document.activeElement?.id==='study-148');
  const data=await guide.evaluate(()=>({
   articles:[...document.querySelectorAll('article[id^="study-"]')].map(article=>({id:Number(article.id.slice(6)),text:article.querySelector('p')?.textContent?.trim(),title:article.querySelector('h3 a')?.textContent?.trim(),href:article.querySelector('h3 a')?.href,references:article.querySelectorAll('.references a').length})),
   concepts:document.querySelectorAll('#concepts dt').length,influences:document.querySelectorAll('#influences dt').length,
   badLinks:[...document.querySelectorAll('a[href]')].filter(a=>!['http:','https:'].includes(new URL(a.href).protocol)).map(a=>a.href),selectedVisible:document.getElementById('study-148')?.closest('details')?.open
  }));
  assert.equal(data.articles.length,expectedStudies,'Wrong published guide count');assert.deepEqual(data.articles.map(a=>a.id).sort((a,b)=>a-b),ids.slice().sort((a,b)=>a-b),'Guide and artwork contain different studies');
  for(const article of data.articles){assert(article.text&&article.title&&article.references>0,'Incomplete guide entry '+article.id);const target=new URL(article.href);assert.equal(target.origin,actualBase.origin);assert.equal(target.pathname,actualBase.pathname);assert.equal(target.search,'?study='+article.id);}
  assert(data.concepts>=39&&data.influences===5,'Missing mathematical concepts or artistic influences');assert.deepEqual(data.badLinks,[]);assert(data.selectedVisible,'Selected explainer was not revealed');
  report.guide={url:guide.url(),explainers:data.articles.length,concepts:data.concepts,influences:data.influences,selected:148};
  await checkpoint();assert.equal(report.errors.length,0,'Browser or network errors occurred');report.pass=true;
 }catch(error){problem('assertion',error.message+' '+(error.stack?.split('\n')[1]?.trim()||''));}finally{active=false;await context.close();}
 return report;
}
async function main(args=process.argv.slice(2)){
 if(!args.length||args.includes('--help')){console.log('Usage: node scripts/verify-published.cjs URL [URL ...]');if(!args.length)process.exitCode=1;return;}
 const urls=args.map(baseURL),{chromium}=require('playwright'),browser=await chromium.launch({channel:process.env.TORUS_BROWSER||'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']}),results=[];
 try{for(const url of urls)results.push(await verify(browser,url));}finally{await browser.close();}
 console.log(JSON.stringify({pass:results.every(result=>result.pass),deployments:results},null,2));if(results.some(result=>!result.pass))process.exitCode=1;
}
module.exports={baseURL,verify};if(require.main===module)main().catch(error=>{console.log(JSON.stringify({pass:false,error:error.message}));process.exitCode=1;});
