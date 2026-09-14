/* Exact preset captures and browser checks for the concise guide and new controls. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {open}=require('./browser-audit.cjs');
async function main(){
 const root=path.resolve(process.argv[2]||'dist'),out=path.resolve('scripts/publication-qa');fs.mkdirSync(out,{recursive:true});
 const app=await open(root,{background:false,viewport:{width:1100,height:760},dpr:2}),report={info:app.info,studies:[],layouts:[],guide:{}};
 try{
  const hidden=await app.page.addStyleTag({content:'.masthead,.actions,.study-bar,#controls,#collection,#preparing-status{visibility:hidden!important}'});
  for(const id of [145,146,148]){
   await app.select(id);await app.settle();
   assert.equal(await app.page.locator('#pause').getAttribute('aria-label'),'Play animation');
   assert.equal(await app.page.locator('#textureMode-label').getAttribute('hidden'),null);
   for(const key of ['textureStrength','textureScale'])assert.equal(await app.page.locator('#'+key+'-label').getAttribute('hidden'),null);
   await app.page.screenshot({path:path.join(out,'study-'+id+'.png')});
   const href=await app.page.locator('#readme-link').getAttribute('href');assert(href.endsWith('#study-'+id));
   report.studies.push({id,title:await app.page.locator('#study-title').textContent(),readme:href});
  }
  await hidden.evaluate(element=>element.remove());
  await app.page.locator('#collection-toggle').click();
  assert.equal(await app.page.locator('.study-choice img[src*="/147.webp"]').count(),0);
  for(const id of [145,146,148]){const selector='.study-choice img[src*="/'+id+'.webp"]';await app.page.locator(selector).scrollIntoViewIfNeeded();await app.page.waitForFunction(selector=>{const image=document.querySelector(selector);return image.complete&&image.naturalWidth>0;},selector);}
  await app.page.locator('#collection-close').click();
  for(const viewport of [{width:1100,height:760},{width:768,height:1024},{width:390,height:844},{width:550,height:380}]){
   await app.page.setViewportSize(viewport);await app.select(146);await app.settle();
   await app.page.locator('#readme-link').focus();await app.page.evaluate(()=>document.getElementById('artwork').classList.add('quiet'));
   const focus=await app.page.locator('.masthead').evaluate(element=>getComputedStyle(element).opacity);assert.equal(Number(focus),1,'readme stays visible while keyboard-focused');
   await app.page.locator('#settings').click();
   const layout=await app.page.evaluate(()=>{const box=id=>{const r=document.getElementById(id).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};return {width:innerWidth,height:innerHeight,bodyWidth:document.documentElement.scrollWidth,bar:box('collection-toggle'),controls:box('controls'),readme:box('readme-link')};});
   assert(layout.bodyWidth<=layout.width+1);for(const key of ['bar','controls','readme']){assert(layout[key].left>=0&&layout[key].right<=layout.width+1,key+' horizontal bounds');assert(layout[key].top>=0&&layout[key].bottom<=layout.height+1,key+' vertical bounds');}
   if(layout.controls.left<layout.bar.right&&layout.controls.right>layout.bar.left)assert(layout.controls.bottom+8<=layout.bar.top,'parameters must leave the study navigation usable: '+JSON.stringify(layout));
   await app.page.screenshot({path:path.join(out,'layout-'+viewport.width+'.png')});report.layouts.push(layout);await app.page.locator('#parameters-close').click();
  }
  // Following the actual small link opens the current brief with its group expanded.
  const popupPromise=app.page.waitForEvent('popup');await app.page.locator('#readme-link').click();const guide=await popupPromise;await guide.waitForLoadState();
  assert(guide.url().endsWith('readme.html#study-146'));assert(await guide.locator('#study-146').isVisible());assert(await guide.locator('#study-146').evaluate(element=>element.closest('details').open));
  assert.equal(await guide.locator('article').count(),102);
  await guide.locator('#study-search').fill('Villarceau');assert.equal(await guide.locator('article:visible').count(),2);
  await guide.locator('#study-search').fill('no matching torus');assert.equal(await guide.locator('article:visible').count(),0);assert.equal(await guide.locator('#search-result').textContent(),'0 matching studies');
  await guide.locator('#study-search').fill('');await guide.setViewportSize({width:390,height:844});await guide.locator('#concepts > summary').click();
  assert(await guide.locator('#concepts').evaluate(element=>element.scrollWidth<=innerWidth));
  await guide.screenshot({path:path.join(out,'readme-mobile.png')});
  report.guide={studyCount:102,selectedBrief:true,search:true,mobile:true};
  // The readme's title link actually starts the linked study, with no WebGL errors.
  await guide.goto(new URL('./?study=145',app.page.url()).href);await guide.waitForFunction(()=>document.querySelector('#artwork')?.getAttribute('aria-busy')==='false',null,{timeout:120000});
  assert.equal(await guide.locator('#study-title').textContent(),'Talbot Cathedral');await guide.close();
  report.errors=app.errors;assert.equal(app.errors.length,0,app.errors.join('\n'));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log('PASS new preset captures and Spinor suppression, desktop/tablet/mobile/200%-equivalent layout, keyboard focus, short-guide search and study links');
 }finally{await app.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
