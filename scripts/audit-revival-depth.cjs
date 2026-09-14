/* Production-renderer composition and identity captures for the new controls.
   Coordinate the hardware GPU window before running this script. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {open}=require('./browser-audit.cjs');
async function main(){
 const out=path.resolve(process.env.REVIVAL_DEPTH_OUT||path.join(__dirname,'revival-depth-audit'));fs.mkdirSync(out,{recursive:true});
 const app=await open(path.resolve(__dirname,'../dist'),{background:false,viewport:{width:825,height:570},dpr:Number(process.env.REVIVAL_DEPTH_DPR||1)});
 try{
  await app.page.route('**/revivals.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('return {create};','return {create,fragmentSource,vertexSource};')+`\n{const create=TorusRevivals.create;TorusRevivals.create=async(...a)=>{const renderer=await create(...a),draw=renderer.draw;window.__depth={renderer,gl:a[0]};renderer.draw=(...args)=>{window.__depth.args=args;return draw(...args);};return renderer;};}`});});
  await app.page.reload();await app.page.waitForFunction(()=>document.querySelector('#artwork').getAttribute('aria-busy')==='false',null,{timeout:120000});
  const cases=[],report={info:app.info,cases,errors:app.errors};
  async function capture(name,kind,variant,time,overrides={}){
   const result=await app.page.evaluate(({kind,variant,time,overrides})=>{
    const {renderer,gl,args}=window.__depth,a=args.slice();a[1]=time;a[4]=kind;a[5]=variant;a[6]={...a[6],...overrides};if(overrides.wave!==undefined)a[2]=overrides.wave;if(overrides.density!==undefined)a[3]=overrides.density;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,gl.canvas.width,gl.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);renderer.draw(...a);
    const buffer=new Uint8Array(gl.canvas.width*gl.canvas.height*4);gl.readPixels(0,0,gl.canvas.width,gl.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,buffer);
    let sum=0,black=0,white=0;for(let i=0;i<buffer.length;i+=4){sum+=buffer[i];black+=buffer[i]<30;white+=buffer[i]>225;}
    return {data:gl.canvas.toDataURL(),pixels:Array.from(buffer.filter((_,i)=>i%4===0)),mean:sum/(buffer.length/4),black:black/(buffer.length/4),white:white/(buffer.length/4),error:gl.getError(),args:{time,wave:a[2],density:a[3],kind,variant,options:a[6]}};
   },{kind,variant,time,overrides});
   fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(result.data.split(',')[1],'base64'));delete result.data;const pixels=result.pixels;delete result.pixels;assert.equal(result.error,0);cases.push({name,...result});return pixels;
  }
  const differences=(a,b,complement=false)=>{let total=0,maximum=0;for(let i=0;i<a.length;i++){const error=Math.abs(a[i]+(complement?b[i]-255:-b[i]));maximum=Math.max(maximum,error);total+=error;}return {mean:total/a.length,maximum};};
  async function floatingIdentity(kind,palette){return app.page.evaluate(({kind,palette})=>{
   const {renderer,gl,args}=window.__depth;if(!gl.getExtension('EXT_color_buffer_float'))throw Error('Floating framebuffer unavailable');
   const width=gl.canvas.width,height=gl.canvas.height,texture=gl.createTexture(),depth=gl.createRenderbuffer(),fb=gl.createFramebuffer();
   gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,width,height,0,gl.RGBA,gl.FLOAT,null);
   gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,width,height);
   gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
   if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete floating framebuffer');
   function draw(time){const a=args.slice();a[1]=time;a[4]=kind;a[5]=0;a[6]={...args[6],palette,textureMode:0};gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);renderer.draw(...a);const pixels=new Float32Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.FLOAT,pixels);return pixels;}
   function error(a,b,complement){let total=0,maximum=0;for(let i=0;i<a.length;i+=4){if(!Number.isFinite(a[i])||!Number.isFinite(b[i]))throw Error('Nonfinite float target');const d=Math.abs(a[i]+(complement?b[i]-1:-b[i]));total+=d;maximum=Math.max(maximum,d);}return {mean:total/(a.length/4),maximum};}
   try{const initial=draw(0),full=error(initial,draw(2*Math.PI),false),half=kind===1?error(initial,draw(Math.PI),true):null;return {kind,palette,full,half,error:gl.getError()};}
   finally{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteFramebuffer(fb);gl.deleteTexture(texture);gl.deleteRenderbuffer(depth);}
  },{kind,palette});}
  const identities=[],floatingIdentities=[],sensitivity=[];
  for(const kind of [0,1]){
   const selection=await app.select(145+kind);await app.settle();console.log(JSON.stringify({kind,selection}));
   for(const variant of [0,1,2])for(const time of [0,Math.PI/4,Math.PI/2])await capture(`${kind}-v${variant}-phase${time.toFixed(3)}`,kind,variant,time);
   for(const palette of [0,1,2]){
    const zero=await capture(`${kind}-treatment${palette}-0`,kind,0,0,{palette,textureMode:0});
    const full=await capture(`${kind}-treatment${palette}-full`,kind,0,2*Math.PI,{palette,textureMode:0});
    const error=differences(zero,full);assert(error.mean<.015&&error.maximum<=4,JSON.stringify({kind,palette,error}));identities.push({kind,palette,identity:'full-period',...error});
    // RGB8 conversion may truncate both complementary values, giving a one-
    // step bias. Keep a two-step bound and check the unquantized target below.
    if(kind===1){const half=await capture(`${kind}-treatment${palette}-half`,kind,0,Math.PI,{palette,textureMode:0});const error=differences(zero,half,true);assert(error.mean<1.01&&error.maximum<=2,JSON.stringify({kind,palette,error}));identities.push({kind,palette,identity:'half-complement',...error});}
    const floating=await floatingIdentity(kind,palette);console.log(JSON.stringify({floating}));assert.equal(floating.error,0);for(const error of [floating.full,floating.half].filter(Boolean))assert(error.mean<.00002&&error.maximum<.005,JSON.stringify(floating));floatingIdentities.push(floating);
   }
   const options={winding:0,palette:1,recursion:3,balance:kind===0?.35:.2,spectral:1,textureMode:0};
   const base=await capture(`${kind}-controls-base`,kind,0,.41,options);
   for(const [key,values] of Object.entries({winding:[1,2,3],palette:[0,2],recursion:[1,5],balance:[0,1],...(kind===1?{spectral:[0,2],wave:[0,1]}:{})}))for(const value of values){const pixels=await capture(`${kind}-${key}-${value}`,kind,0,.41,{...options,[key]:value});const difference=differences(base,pixels);assert(difference.mean>.05,`${kind} ${key} ${value} has no effect`);sensitivity.push({kind,key,value,...difference});}
  }
  report.identities=identities;report.floatingIdentities=floatingIdentities;report.sensitivity=sensitivity;report.errors=app.errors;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));assert.equal(app.errors.length,0);console.log(JSON.stringify({pass:true,captures:cases.length,identities,floatingIdentities,sensitivityCases:sensitivity.length}));
 }finally{await app.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
