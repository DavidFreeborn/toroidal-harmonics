const fs=require('node:fs'),path=require('node:path');
const {open}=require('./browser-audit.cjs');
async function main(){
 const out=path.join(__dirname,'revival-depth-audit');fs.mkdirSync(out,{recursive:true});
 const app=await open(path.resolve(__dirname,'../dist'),{background:false,viewport:{width:825,height:570},dpr:1});
 try{
  await app.page.route('**/revivals.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`\n{const create=TorusRevivals.create;TorusRevivals.create=async(...a)=>{const renderer=await create(...a),draw=renderer.draw;window.__candidate={renderer,gl:a[0]};renderer.draw=(...args)=>{window.__candidate.args=args;return draw(...args);};return renderer;};}`});});
  await app.page.reload();await app.page.waitForFunction(()=>document.querySelector('#artwork').getAttribute('aria-busy')==='false',null,{timeout:120000});await app.select(146);await app.settle();
  const cases=[];for(const variant of [0,2])for(const time of [0,.8]){
   const result=await app.page.evaluate(({variant,time})=>{const {renderer,gl,args}=window.__candidate,a=args.slice();a[1]=time;a[3]=88;a[5]=variant;a[6]={...a[6],layers:3,spectral:0,textureMode:6,textureStrength:.27};gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,gl.canvas.width,gl.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);renderer.draw(...a);return {image:gl.canvas.toDataURL(),error:gl.getError(),options:a[6]};},{variant,time});
   const name=`1-density88-equal-v${variant}-phase${time}.png`;fs.writeFileSync(path.join(out,name),Buffer.from(result.image.split(',')[1],'base64'));delete result.image;cases.push({variant,time,name,...result});if(result.error)throw Error('WebGL error '+result.error);
  }
  fs.writeFileSync(path.join(out,'candidates.json'),JSON.stringify(cases,null,2));console.log(JSON.stringify({captured:cases.length,errors:app.errors}));
 }finally{await app.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
