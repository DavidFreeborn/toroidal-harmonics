/* Full visible-collection visual smoke test in a real browser, plus fixed-phase
   curved-lighting and moving-pigment cases. This records no timing claims. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {open}=require('./browser-audit.cjs');
async function main(){
 const output=path.resolve(process.argv[2]||path.join(__dirname,'browser-overview'));fs.mkdirSync(output,{recursive:true});
 const app=await open(path.join(__dirname,'../dist'),{viewport:{width:825,height:570},dpr:1});
 const report={info:app.info,defaults:[],details:[],errors:app.errors};
 try{
  await app.page.addInitScript(()=>{
   window.__reviewPhase=.4;
   const times=new WeakSet(),proto=WebGL2RenderingContext.prototype,get=proto.getUniformLocation,set=proto.uniform1f;
   proto.getUniformLocation=function(program,name){const location=get.call(this,program,name);if(name==='uTime'&&location)times.add(location);return location;};
   proto.uniform1f=function(location,value){return set.call(this,location,times.has(location)?window.__reviewPhase:value);};
  });
  await app.page.reload();
  await app.page.waitForFunction(()=>document.querySelector('#artwork').getAttribute('aria-busy')==='false');
  await app.page.addStyleTag({content:'#artwork > :not(canvas){visibility:hidden!important}'});
  await app.page.selectOption('#renderQuality','native',{force:true});
  const ids=await app.page.evaluate(()=>[...document.querySelectorAll('.study-choice')].map(b=>Number(b.querySelector('img').getAttribute('src').match(/\/(\d+)\.webp/)[1])));
  assert.equal(ids.length,99);
  async function capture(file){
   await app.settle();
   const record=await app.page.evaluate(()=>{const g=document.querySelector('canvas').getContext('webgl2');return {title:document.querySelector('#study-title').textContent,construction:document.querySelector('#variation').selectedOptions[0]?.textContent,error:g.getError(),width:g.drawingBufferWidth,height:g.drawingBufferHeight};});
   assert.equal(record.error,0,'WebGL error before '+file);
   await app.page.locator('canvas').screenshot({path:path.join(output,file)});
   return {...record,file};
  }
  for(const id of ids){
   await app.select(id);report.defaults.push({id,...await capture(id+'.png')});
   console.log('DEFAULT',id,report.defaults.at(-1).title);
  }
  report.hiddenRequestedCases=[57,62,86].filter(id=>!ids.includes(id));
  fs.writeFileSync(path.join(output,'overview.json'),JSON.stringify(report,null,2));
  // Cable geometry is completely shader-driven. The recursive cube uses CPU
  // frame transforms, so retain its actual .4 phase while reviewing variant 2.
  for(const [id,phases] of [[61,[.4,1.3,2.1,3.7,5.2]],[67,[.4]]]){
   await app.select(id);await app.input('variation',2);
   for(const [i,phase] of phases.entries()){
    await app.page.evaluate(phase=>window.__reviewPhase=phase,phase);await app.input('speed',2);
    report.details.push({id,phase,variation:2,...await capture(id+'-v2-'+i+'.png')});
   }
   console.log('DETAIL',id);
  }
  report.errors=app.errors;assert.equal(app.errors.length,0,'browser errors');
  fs.writeFileSync(path.join(output,'overview.json'),JSON.stringify(report,null,2));
  console.log('PASS',report.defaults.length,'defaults and',report.details.length,'phase probes; no WebGL or browser errors');
 }finally{await app.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
