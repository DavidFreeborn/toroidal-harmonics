/* Isolated actual-renderer inspection. Run only during an exclusive GPU slot. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.join(__dirname,'../dist'),out=path.resolve(process.argv[2]||path.join(os.tmpdir(),'phason-detail-audit'));
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:process.env.TORUS_BROWSER||'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:760},deviceScaleFactor:2}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>html,body{margin:0;background:white}canvas{display:block;width:1100px;height:760px}</style><canvas width="2200" height="1520"></canvas>');
  await page.evaluate(value=>window.auditMSAA=value,!process.argv.includes('--no-msaa'));
  for(const name of ['programs','lightfield','quasicrystal-data','phason'])await page.addScriptTag({content:fs.readFileSync(path.join(root,name+'.js'),'utf8')});
  const setup=await page.evaluate(async()=>{
   const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2',{antialias:window.auditMSAA,preserveDrawingBuffer:true});gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.clearColor(1,1,1,1);gl.viewport(0,0,canvas.width,canvas.height);
   const nu=256,nv=128,vertices=new Float32Array((nu+1)*(nv+1)*2),indices=new Uint32Array(nu*nv*6);let p=0,k=0;
   for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){vertices[p++]=i/nu;vertices[p++]=j/nv;}
   for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const n=i*(nv+1)+j;indices.set([n,n+nv+1,n+1,n+1,n+nv+1,n+nv+2],k);k+=6;}
   const vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
   const f=1/Math.tan(105*Math.PI/360),A=-(20+.05)/(20-.05),B=-2*20*.05/(20-.05),matrix=new Float32Array([0,0,A,-1,0,f,0,0,-f*760/1100,0,0,0,0,0,-3.65*A+B,3.65]);
   const start=performance.now(),renderer=await TorusPhason.create(gl,vao,indices.length),extension=gl.getExtension('WEBGL_debug_renderer_info'),timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
   window.fixture={gl,renderer,matrix,timer,vao,count:indices.length,pixels:new Uint8Array(canvas.width*canvas.height*4)};
   window.renderPhason=(options,time)=>{renderer.prepare(0,options.variant,options,options.density);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);renderer.draw(matrix,time,options.wave,options.density,0,options.variant,options);};
   return {renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),compileMs:performance.now()-start,width:canvas.width,height:canvas.height};
  });
  const base={density:88,layers:2,balance:.35,winding:1,turns:1,palette:0,wave:.35,ink:1,textureMode:0,variant:0},cases=[];
  if(!process.argv.includes('--partition'))await page.evaluate(base=>{const start=performance.now();do{renderPhason(base,.4);fixture.gl.finish();}while(performance.now()-start<1500);},base);
  for(const variant of [0,1,2])for(const time of [.4,2.3])cases.push({name:'default-v'+variant+'-t'+time,time,options:{...base,variant}});
  for(const density of [40,136])for(const layers of [1,3])cases.push({name:'density'+density+'-layers'+layers,time:.4,options:{...base,density,layers}});
  for(const palette of [1,2])cases.push({name:'palette'+palette,time:.4,options:{...base,palette}});
  cases.push({name:'helical-three-fronts',time:.4,options:{...base,winding:3,turns:3,layers:3,balance:1}});
  for(const [key,value] of [['balance',0],['balance',1],['winding',0],['winding',2],['turns',2],['wave',0],['wave',1]])cases.push({name:key+value,time:.4,options:{...base,[key]:value}});
  cases.push({name:'curated-lighting',time:.4,options:{...base,textureMode:4,textureStrength:.27,textureScale:2}});
  const results=[];
  for(const item of process.argv.includes('--partition')?[]:cases){
   const result=await page.evaluate(async({options,time})=>{
    const {gl,timer,pixels}=fixture;renderPhason(options,time);gl.finish();const times=[];
    for(let frame=0;frame<8;frame++){
     if(!timer)break;const q=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,q);renderPhason(options,time);gl.endQuery(timer.TIME_ELAPSED_EXT);
     while(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))await new Promise(resolve=>setTimeout(resolve,4));
     if(gl.getParameter(timer.GPU_DISJOINT_EXT))throw Error('Disjoint GPU timing sample');times.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);
    }
    gl.readPixels(0,0,2200,1520,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let dark=0,mid=0,white=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]<80)dark++;else if(pixels[i]>235)white++;else mid++;}
    const previous=pixels.slice();if(!fixture.firstFrame)fixture.firstFrame=previous;
    let difference=0;for(let i=0;i<pixels.length;i+=4)difference+=Math.abs(pixels[i]-fixture.firstFrame[i]);
    renderPhason(options,time+Math.PI*2);gl.readPixels(0,0,2200,1520,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let loopMaximum=0,loopSum=0;for(let i=0;i<pixels.length;i+=4){const delta=Math.abs(pixels[i]-previous[i]);loopMaximum=Math.max(loopMaximum,delta);loopSum+=delta;}
    renderPhason(options,time);gl.finish();const error=gl.getError();if(error)throw Error('WebGL error '+error);times.sort((a,b)=>a-b);
    return {gpuMedianMs:times[Math.floor(times.length/2)],loopMaximum,loopMean:loopSum/(pixels.length/4),differenceFromDefault:difference/(pixels.length/4),dark,mid,white};
   },item);
   assert(result.loopMaximum<=1&&result.loopMean<.0001,'Loop image mismatch '+item.name+': '+JSON.stringify(result));
   await page.screenshot({path:path.join(out,item.name+'.png')});results.push({...item,...result});console.log(JSON.stringify({name:item.name,...result}));
  }
  const partition=await page.evaluate(async base=>{
   const {gl,vao,count,matrix,pixels}=fixture,original=TorusLight.fragment;
   TorusLight.fragment=source=>source.replace('fragColor=vec4(vec3(mix(1.0,tone,uInk)),1);','fragColor=vec4(clamp(weight,0.0,1.0),max(abs(dx.x)+abs(dy.x),abs(dx.y)+abs(dy.y))*64.0,0,1);');
   const debug=await TorusPhason.create(gl,vao,count);TorusLight.fragment=original;const checks=[];
   // Resolve each local chart footprint independently. Multisample resolve can
   // mix near and far torus sheets and cannot preserve a footprint diagnostic.
   const framebuffer=gl.createFramebuffer(),colour=gl.createTexture(),depth=gl.createRenderbuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,colour);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,2200,1520,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,colour,0);gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,2200,1520);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Partition target incomplete');
   for(const density of [40,88,136])for(const variant of [0,1,2])for(const time of [.4,2.3]){
    const options={...base,density,variant,layers:1,textureMode:0};await debug.prepare(0,variant,options,density);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);debug.draw(matrix,time,options.wave,density,0,variant,options);gl.readPixels(0,0,2200,1520,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let minimum=255,deficient=0,grazingPartial=0,worstPixel=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]<minimum){minimum=pixels[i];worstPixel=i/4;}if(pixels[i]<253){if(pixels[i+1]===255)grazingPartial++;else deficient++;}}
    const examples=[];for(let i=0;i<pixels.length&&examples.length<12;i+=4)if(pixels[i]<253)examples.push([i/4%2200,1519-Math.floor(i/4/2200),pixels[i],pixels[i+1]]);
    checks.push({density,variant,time,minimum,deficient,grazingPartial,worstPixel:[worstPixel%2200,1519-Math.floor(worstPixel/2200)],examples});
   }
   if(gl.getError())throw Error('Partition audit WebGL error');gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteFramebuffer(framebuffer);gl.deleteTexture(colour);gl.deleteRenderbuffer(depth);return checks;
  },base);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({setup,results,partition,errors},null,2));
  // A nearly tangent projection can span beyond the static lookup's padding.
  // Those isolated pixels retain normalized pigment; require positive coverage
  // everywhere, and unit area within the lookup's documented footprint bound.
  for(const item of partition){assert(item.minimum>0,'Uncovered screen tile: '+JSON.stringify(item));assert.equal(item.deficient,0,'Bounded screen pixel missing tile coverage: '+JSON.stringify(item));}
  for(const item of results.slice(1))assert(item.differenceFromDefault>.01,'Ineffective construction control: '+item.name);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({setup,results,partition,errors},null,2));console.log(JSON.stringify({pass:true,setup,cases:results.length,partitionFrames:partition.length,missingBoundedPixels:partition.reduce((sum,item)=>sum+item.deficient,0),minimumCoverage8bit:Math.min(...partition.map(item=>item.minimum)),maximumGrazingPartialPixels:Math.max(...partition.map(item=>item.grazingPartial)),out}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
