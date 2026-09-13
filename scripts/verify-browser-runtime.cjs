/* Real WebGL2 validation of shader compilation, all visible constructions,
   responsive rasters and selection races. No screenshots or software-GPU FPS claims. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {open}=require('./browser-audit.cjs');
async function main(){
 const app=await open(path.resolve(__dirname,'../dist'),{viewport:{width:1000,height:700},dpr:2});
 const report={renderer:app.info,constructions:0,defaults:0,errors:[],responsive:[]};
 try{
  // Compile every actual source pair, including the archived Cycles family.
  const pairs=['artwork.js','kinetic.js','sculptures.js','symmetry.js','cycles.js','visionary.js','topology.js','chiaroscuro.js','mechanisms.js','quasicrystal.js','metamorphosis.js','tessellations.js','transformations.js','revivals.js','spinor.js','phason.js'].map(file=>({file,vertex:cp.execFileSync(process.execPath,[path.join(__dirname,'shader-source.cjs'),file,'vertex'],{encoding:'utf8'}),fragment:cp.execFileSync(process.execPath,[path.join(__dirname,'shader-source.cjs'),file,'fragment'],{encoding:'utf8'})}));
  report.shaders=await app.page.evaluate(async pairs=>{
   const g=document.createElement('canvas').getContext('webgl2'),results=[];
   for(const pair of pairs){await TorusPrograms.link(g,pair.vertex,pair.fragment);results.push(pair.file);}
   const error=g.getError();if(error)throw Error('Compilation GL error '+error);g.getExtension('WEBGL_lose_context')?.loseContext();return results;
  },pairs);
  console.log('PASS',report.shaders.length,'production WebGL2 shader pairs');
  const ids=await app.page.evaluate(()=>[...document.querySelectorAll('.study-choice img')].map(img=>Number(img.getAttribute('src').match(/\/(\d+)\.webp/)[1])));
  for(const id of ids){
   await app.select(id);const count=await app.page.locator('#variation option').count();
   for(let variant=0;variant<count;variant++){
    await app.input('variation',variant);await app.settle();
    const error=await app.page.evaluate(()=>document.querySelector('canvas').getContext('webgl2').getError());assert.equal(error,0,'study '+id+' construction '+variant);report.constructions++;
   }
   report.defaults++;
  }
  assert.equal(report.defaults,103);assert.equal(report.constructions,314);console.log('PASS 103 studies / 314 constructions');
  report.extremes=0;
  for(const id of [101,76,117,136,98,145,146,147,148]){
   await app.select(id);const variants=await app.page.locator('#variation option').count();
   for(let variant=0;variant<variants;variant++)for(const end of ['min','max']){
    await app.input('variation',variant);
    for(const key of ['density','layers','recursion']){
     const bound=await app.page.locator('#'+key).getAttribute(key==='density'?end:'max');
     if(bound!==null)await app.input(key,bound);
    }
    await app.settle();assert.equal(await app.page.evaluate(()=>document.querySelector('canvas').getContext('webgl2').getError()),0,'extreme study '+id+' variant '+variant+' '+end);report.extremes++;
   }
  }
  console.log('PASS',report.extremes,'reported/recursive construction extremes');
  for(const viewport of [{width:1000,height:700},{width:390,height:844},{width:1600,height:900}]){
   await app.page.setViewportSize(viewport);await app.select(101);
   for(const quality of ['native','fine','adaptive']){
    await app.input('renderQuality',quality);await app.settle();
    const raster=await app.page.evaluate(()=>{const c=document.querySelector('canvas');return {width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight,dpr:devicePixelRatio,error:c.getContext('webgl2').getError()};});
    assert.equal(raster.error,0);assert(raster.width>=raster.cssWidth);if(quality!=='adaptive')assert.equal(raster.width,raster.cssWidth*raster.dpr*(quality==='fine'?2:1));report.responsive.push({quality,viewport,...raster});
   }
  }
  await app.page.setViewportSize({width:1000,height:700});await app.input('renderQuality','adaptive');
  await app.page.evaluate(()=>{for(let i=0;i<16;i++)document.getElementById(i%2?'extra-random':'random').click();const b=[...document.querySelectorAll('.study-choice')].find(x=>x.querySelector('img').src.includes('/76.webp'));b.click();});
  await app.page.waitForFunction(()=>document.querySelector('#artwork').getAttribute('aria-busy')==='false',null,{timeout:120000});await app.settle();
  assert.equal(await app.page.locator('#study-title').textContent(),'Sierpiński counterpoint');
  await app.page.waitForTimeout(1000);assert.equal(await app.page.locator('#study-title').textContent(),'Sierpiński counterpoint');
  assert.equal(await app.page.locator('#pause').getAttribute('aria-label'),'Play animation');
  console.log('PASS responsive DPR2 raster modes, rapid Random / Extra random / final selection, paused state');
  report.errors=app.errors;assert.equal(app.errors.length,0,app.errors.join('\n'));
  fs.writeFileSync(path.join(__dirname,'browser-validation.json'),JSON.stringify(report,null,2));
 }finally{await app.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
