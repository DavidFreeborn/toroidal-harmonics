/* Native-browser finite-pixel checks for isolated circles and recursive leaves. */
const fs=require('node:fs'),path=require('node:path');
const {open}=require('./browser-audit.cjs');
async function main(){
 const baseline=path.resolve(process.argv[2]),output=path.resolve(process.argv[3]||path.join(__dirname,'browser-extended'));fs.mkdirSync(output,{recursive:true});
 const records=[];
 for(const [role,root,dpr] of [['before',baseline,1],['before-reference',baseline,4],['after',path.join(__dirname,'../dist'),1],['after-reference',path.join(__dirname,'../dist'),4]]){
  if(role.startsWith('before')&&[7,136,135,139,140].every(id=>Array.from({length:id===7||id===136?3:1},(_,i)=>fs.existsSync(path.join(output,`${role}-${id}-${i}.png`))).every(Boolean))){console.log('REUSE',role);continue;}
  const app=await open(root,{viewport:{width:500,height:340},dpr});
  try{
   await app.page.addInitScript(()=>{
    window.__phase=.4;
    const times=new WeakSet(),p=WebGL2RenderingContext.prototype,get=p.getUniformLocation,set=p.uniform1f;
    p.getUniformLocation=function(program,name){const loc=get.call(this,program,name);if(name==='uTime'&&loc)times.add(loc);return loc;};
    p.uniform1f=function(loc,value){return set.call(this,loc,times.has(loc)?window.__phase:value);};
   });
   await app.page.reload();await app.page.waitForFunction(()=>document.querySelector('#artwork').getAttribute('aria-busy')==='false');
   await app.page.addStyleTag({content:'#artwork > :not(canvas){visibility:hidden!important}'});await app.page.selectOption('#renderQuality','native',{force:true});
   for(const id of [7,136,135,139,140]){
    await app.select(id);
    for(const [index,phase] of (id===7||id===136?[.4,2.1,5.2]:[.4]).entries()){
     await app.page.evaluate(phase=>window.__phase=phase,phase);await app.input('speed',2);await app.settle();
     const error=await app.page.evaluate(()=>document.querySelector('canvas').getContext('webgl2').getError());if(error)throw Error('WebGL '+error);
     await app.page.locator('canvas').screenshot({path:path.join(output,`${role}-${id}-${index}.png`)});
    }
   }
   records.push({role,info:app.info,errors:app.errors});console.log('PASS',role,'9 cases');
  }finally{await app.close();}
 }
 fs.writeFileSync(path.join(output,'browser.json'),JSON.stringify(records,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
