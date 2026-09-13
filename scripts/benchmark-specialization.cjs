/* Run without other GPU jobs: isolated ANGLE compilation/link readiness. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../dist'),c={};
for(const file of ['programs.js','lightfield.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8')+';this.P=typeof TorusPrograms!=="undefined"?TorusPrograms:this.P;this.L=typeof TorusLight!=="undefined"?TorusLight:this.L;',c);
async function main(){
 const browser=await chromium.launch({channel:process.env.TORUS_BROWSER||'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 const report=[];
 try{
  for(const file of ['metamorphosis.js','tessellations.js']){
   const code=fs.readFileSync(path.join(root,file),'utf8'),vertex=code.match(/const vertexSource = `([\s\S]*?)`;/)[1],raw=code.match(/const fragmentSource = `([\s\S]*?)`;/)[1];
   for(const kind of [null,...(file==='metamorphosis.js'?[5,14,17]:[0,8,16])]){
    const fragment=c.L.fragment(kind===null?raw:c.P.specialize(raw,{uKind:kind}),false),page=await browser.newPage();
    const result=await page.evaluate(async({vertex,fragment,kind})=>{
     const gl=document.createElement('canvas').getContext('webgl2',{antialias:true}),ext=gl.getExtension('KHR_parallel_shader_compile'),start=performance.now();
     const p=gl.createProgram();for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);gl.attachShader(p,shader);gl.deleteShader(shader);}gl.linkProgram(p);
     if(ext)while(!gl.getProgramParameter(p,ext.COMPLETION_STATUS_KHR))await new Promise(resolve=>requestAnimationFrame(resolve));
     if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
     const ms=performance.now()-start,e=gl.getExtension('WEBGL_debug_renderer_info');return {ms,parallel:!!ext,renderer:gl.getParameter(e.UNMASKED_RENDERER_WEBGL)};
    },{vertex,fragment,kind});
    report.push({file,kind,...result});console.log(JSON.stringify(report.at(-1)));await page.close();
   }
  }
  fs.writeFileSync(path.join(__dirname,'browser-specialization.json'),JSON.stringify(report,null,2));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
