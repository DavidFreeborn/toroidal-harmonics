/* Actual renderer draws on RGBA32F: default shading equals the unwrapped base
   shader, all six effects respond to strength/frequency, including archived147. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
async function main(){
 const root=path.join(__dirname,'../dist'),files=['programs','lightfield','quasicrystal-data','revivals','spinor','phason','presets'];
 const source=files.map(name=>fs.readFileSync(path.join(root,name+'.js'),'utf8')).join('\n');
 const sampling=fs.readFileSync(path.join(root,'lightfield.js'),'utf8').match(/const sampling=`([\s\S]*?)`;/)[1];
 const browser=await chromium.launch({channel:process.env.TORUS_BROWSER||'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage();await page.addScriptTag({content:source});
  const report=await page.evaluate(async sampling=>{
   const canvas=document.createElement('canvas');canvas.width=256;canvas.height=176;const gl=canvas.getContext('webgl2',{antialias:false});
   if(!gl.getExtension('EXT_color_buffer_float'))throw Error('Floating WebGL target required');
   const extension=gl.getExtension('WEBGL_debug_renderer_info'),renderer=extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
   const colour=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,colour);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,256,176,0,gl.RGBA,gl.FLOAT,null);
   const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,colour,0);
   const depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,256,176);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete target');
   gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.disable(gl.DITHER);gl.viewport(0,0,256,176);gl.clearColor(1,1,1,1);
   const vertices=[],indices=[],nu=256,nv=128;for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++)vertices.push(i/nu,j/nv);
   for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const k=i*(nv+1)+j;indices.push(k,k+nv+1,k+1,k+1,k+nv+1,k+nv+2);}
   const vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);
   const f=1/Math.tan(105*Math.PI/360),A=-(20+.05)/(20-.05),B=-2*20*.05/(20-.05),matrix=new Float32Array([0,0,A,-1,0,f,0,0,-f*176/256,0,0,0,0,0,-3.65*A+B,3.65]);
   const original=TorusLight.fragment,pairs=[];
   for(const [name,module,kind,id] of [['Talbot',TorusRevivals,0,145],['Elliptic',TorusRevivals,1,146],['Spinor',TorusSpinor,0,147],['Phason',TorusPhason,0,148]]){
    TorusLight.fragment=text=>text.replace('precision highp float;','precision highp float;\n'+sampling);
    const base=await module.create(gl,vao,indices.length);await base.prepare(kind);
    TorusLight.fragment=original;const lit=await module.create(gl,vao,indices.length);await lit.prepare(kind);
    pairs.push({name,base,lit,kind,id});
   }
   const results=[];let frames=0,finiteValues=0;
   function draw(r,p,variant,time,options){gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.viewport(0,0,256,176);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);r.draw(matrix,time,options.wave,p.id===148?0:options.density,p.kind,variant,options);const pixels=new Float32Array(256*176*4);gl.readPixels(0,0,256,176,gl.RGBA,gl.FLOAT,pixels);const error=gl.getError();if(error)throw Error(`${p.name}: GL ${error}`);for(let i=0;i<pixels.length;i++){if(!Number.isFinite(pixels[i])||pixels[i]<-1e-6||pixels[i]>1.000001)throw Error(`${p.name}: invalid pixel ${pixels[i]}`);}finiteValues+=pixels.length;frames++;return pixels;}
   function difference(a,b){let sum=0,max=0;for(let i=0;i<a.length;i+=4){const d=Math.abs(a[i]-b[i]);sum+=d;max=Math.max(max,d);}return {mean:sum/(a.length/4),max};}
   for(const p of pairs)for(const variant of [0,1,2])for(const time of [0,.731,2.19]){
    const options={...TorusPresets.get(p.id),textureMode:0},base=draw(p.base,p,variant,time,options),off=draw(p.lit,p,variant,time,options);
    const originalDifference=difference(base,off);if(originalDifference.max>2e-6)throw Error(`${p.name}: default regression ${JSON.stringify(originalDifference)}`);
    for(const mode of [1,2,3,4,5,6]){
     const zero=draw(p.lit,p,variant,time,{...options,textureMode:mode,textureStrength:0});const zeroDifference=difference(zero,base);if(zeroDifference.max>2e-6)throw Error(`${p.name}: zero strength regression`);
     const low=draw(p.lit,p,variant,time,{...options,textureMode:mode,textureStrength:.35,textureScale:2});
     const high=draw(p.lit,p,variant,time,{...options,textureMode:mode,textureStrength:.85,textureScale:2});
     const fine=draw(p.lit,p,variant,time,{...options,textureMode:mode,textureStrength:.85,textureScale:5});
     const effect=difference(base,high),strength=difference(low,high),frequency=difference(high,fine);
     if(effect.mean<1e-5||strength.mean<1e-5||frequency.mean<1e-5)throw Error(`${p.name} v${variant} t${time} m${mode}: ineffective control ${JSON.stringify({effect,strength,frequency})}`);
     results.push({study:p.id,variant,time,mode,baseMaximumError:originalDifference.max,zeroMaximumError:zeroDifference.max,effectMean:effect.mean,strengthMean:strength.mean,frequencyMean:frequency.mean});
    }
   }
   return {renderer,frames,finiteValues,cases:results};
  },sampling);
  assert.equal(report.cases.length,216);assert.equal(report.frames,936);fs.writeFileSync(path.join(__dirname,'new-study-lighting-results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({pass:true,renderer:report.renderer,cases:report.cases.length,frames:report.frames,finiteValues:report.finiteValues,maximumDefaultError:Math.max(...report.cases.map(c=>c.baseMaximumError)),minimumEffectMean:Math.min(...report.cases.map(c=>c.effectMean)),minimumStrengthMean:Math.min(...report.cases.map(c=>c.strengthMean)),minimumFrequencyMean:Math.min(...report.cases.map(c=>c.frequencyMean))}));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
