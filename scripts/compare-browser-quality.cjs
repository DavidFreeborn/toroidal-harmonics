/* Deterministic real-browser references. DPR 4 retains 16 raster samples per
   output pixel; analysis must area-average these references, not nearest resize. */
const fs=require('node:fs'),path=require('node:path');
const {open}=require('./browser-audit.cjs');
async function main(){
 const baseline=path.resolve(process.argv[2]),output=path.resolve(process.argv[3]);
 fs.mkdirSync(output,{recursive:true});
 const cases=(process.env.TORUS_CASES||'101,76').split(',').map(Number),phases=[.4,2.1,5.2],report=[];
 for(const [role,root,dpr] of [['before',baseline,1],['reference',baseline,4],['after',path.join(__dirname,'../dist'),1],['after-reference',path.join(__dirname,'../dist'),4]]){
  const app=await open(root,{viewport:{width:500,height:340},dpr});
  try{
   await app.page.route('**/presets.js*',async route=>{const response=await route.fetch(),body=(await response.text()).replace(/const hidden=new Set\(\[[^\]]*\]\)/,'const hidden=new Set([])');await route.fulfill({response,body});});
   await app.page.addInitScript(()=>{
    window.__qualityPhase=.4;
    const times=new WeakSet(),proto=WebGL2RenderingContext.prototype,get=proto.getUniformLocation,set=proto.uniform1f;
    proto.getUniformLocation=function(program,name){const location=get.call(this,program,name);if(name==='uTime'&&location)times.add(location);return location;};
    proto.uniform1f=function(location,value){return set.call(this,location,times.has(location)?window.__qualityPhase:value);};
   });
   await app.page.reload();
   await app.page.waitForFunction(()=>document.querySelector('#artwork').getAttribute('aria-busy')==='false');
   await app.page.addStyleTag({content:'#artwork > :not(canvas){visibility:hidden!important}'});
   await app.page.selectOption('#renderQuality','native',{force:true});
   for(const id of cases){
    await app.select(id);
    for(const [i,phase] of phases.entries()){
     await app.page.evaluate(phase=>window.__qualityPhase=phase,phase);
     await app.input('speed',2);await app.settle();
     await app.page.locator('canvas').screenshot({path:path.join(output,`${role}-${id}-${i}.png`)});
    }
   }
   const raster=await app.page.evaluate(()=>{const c=document.querySelector('canvas');return {width:c.width,height:c.height,rendering:document.getElementById('renderQuality').value};});
   report.push({role,info:{...app.info,...raster},errors:app.errors});console.log(role,app.errors);
  }finally{await app.close();}
 }
 fs.writeFileSync(path.join(output,'browser.json'),JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
