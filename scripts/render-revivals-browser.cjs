/* Production-renderer captures at exact phases: CPU Fourier coefficients and
   divisor uniforms are updated by the actual draw entry point on every frame. */
const fs=require('node:fs'),path=require('node:path');
const {open}=require('./browser-audit.cjs');
async function main(){
 const out=path.join(__dirname,process.env.REVIVAL_OUT||'revivals-browser');fs.mkdirSync(out,{recursive:true});
 const app=await open(path.resolve(__dirname,'../dist'),{background:false,viewport:{width:1100,height:760},dpr:Number(process.env.REVIVAL_DPR||1)});
 try{
  await app.page.route('**/revivals.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('return {create};','return {create,fragmentSource,vertexSource};')+`\n{
   const original=TorusRevivals.create;TorusRevivals.create=async(...args)=>{const renderer=await original(...args),draw=renderer.draw;window.__revival={renderer,gl:args[0]};renderer.draw=(...values)=>{window.__revival.args=values;return draw(...values)};return renderer;};
  }`});});
  await app.page.reload();await app.page.waitForFunction(()=>document.querySelector('#artwork').getAttribute('aria-busy')==='false',null,{timeout:120000});
  const report={info:app.info,cases:[],errors:app.errors};
  for(const kind of [0,1]){
   const selectionMs=await app.select(145+kind);await app.settle();
   await app.page.screenshot({path:path.join(out,`default-${kind}.png`)});
   for(const variant of [0,1,2])for(const [phaseIndex,time] of [0,Math.PI/4,Math.PI/2,Math.PI,2*Math.PI].entries()){
    const value=await app.page.evaluate(({kind,variant,time,density})=>{
     const {renderer,gl,args}=window.__revival,a=args.slice();a[1]=time;a[4]=kind;a[5]=variant;if(density!==null)a[3]=density;
     gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,gl.canvas.width,gl.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);renderer.draw(...a);
     const pixels=new Uint8Array(gl.canvas.width*gl.canvas.height*4);gl.readPixels(0,0,gl.canvas.width,gl.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
     let sum=0,black=0,white=0;for(let i=0;i<pixels.length;i+=4){sum+=pixels[i];black+=pixels[i]<30;white+=pixels[i]>225;}
     return {data:gl.canvas.toDataURL(),width:gl.canvas.width,height:gl.canvas.height,mean:sum/(pixels.length/4),black:black/(pixels.length/4),white:white/(pixels.length/4),error:gl.getError(),args:{time:a[1],wave:a[2],density:a[3],kind:a[4],variant:a[5],options:a[6]}};
    },{kind,variant,time,density:process.env.REVIVAL_DENSITY?Number(process.env.REVIVAL_DENSITY):null});
    fs.writeFileSync(path.join(out,`${kind}-${variant}-${phaseIndex}.png`),Buffer.from(value.data.split(',')[1],'base64'));delete value.data;
    report.cases.push(value);console.log(JSON.stringify({kind,variant,phaseIndex,mean:value.mean,error:value.error}));
   }
   console.log(JSON.stringify({kind,selectionMs}));
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));if(app.errors.length)throw Error(app.errors.join('\n'));
 }finally{await app.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
