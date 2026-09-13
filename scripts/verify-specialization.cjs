/* The real driver must preserve every study and its dynamic variants when
   unrelated study branches are removed at compile time. Run GPU-isolated. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),c={};
const benchmark=process.argv.includes('--benchmark'),args=process.argv.slice(2).filter(value=>value!=='--benchmark');
const supported=['metamorphosis.js','tessellations.js','topology.js'],files=args.length?args:supported;
if(files.some(file=>!supported.includes(file)))throw Error('Choose a supported shader file: '+supported.join(', '));
const topologyKinds=Object.values(vm.runInNewContext('('+fs.readFileSync(path.join(root,'artwork.js'),'utf8').match(/const topologyKinds=(\{[^;]+\});/)[1]+')'));
for(const [file,name] of [['programs.js','TorusPrograms'],['lightfield.js','TorusLight'],['spectrum.js','TORUS_SPECTRUM'],['tessellation-data.js','TORUS_CHAIR'],['presets.js','TorusPresets']])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8')+';this.'+name+'='+name,c);
async function main(){
 const browser=await chromium.launch({channel:process.env.TORUS_BROWSER||'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']}),report=[];
 try{
  for(const file of files){
   const code=fs.readFileSync(path.join(root,file),'utf8'),vertex=code.match(/const vertexSource = `([\s\S]*?)`;/)[1],raw=code.match(/const fragmentSource = `([\s\S]*?)`;/)[1],kinds=file==='topology.js'?topologyKinds:Array.from({length:file==='metamorphosis.js'?21:20},(_,kind)=>kind),variants=file==='topology.js'?[0,1,2,3]:[0,1,2];
   const page=await browser.newPage(),result=await page.evaluate(async({vertex,fragments,spectrum,chair,kinds,variants,benchmark,presets})=>{
    const canvas=document.createElement('canvas');canvas.width=benchmark?2200:192;canvas.height=benchmark?1520:128;
    const gl=canvas.getContext('webgl2',{antialias:benchmark,alpha:false,powerPreference:'high-performance'}),ext=gl.getExtension('KHR_parallel_shader_compile'),timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if(benchmark&&!timer)throw Error('Hardware GPU timers are required for the specialization benchmark');
    const compile=async fragment=>{const p=gl.createProgram();for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);gl.attachShader(p,s);gl.deleteShader(s);}gl.linkProgram(p);if(ext)while(!gl.getProgramParameter(p,ext.COMPLETION_STATUS_KHR))await new Promise(resolve=>requestAnimationFrame(resolve));if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;};
    const generic=await compile(fragments[0]);
    const uv=[],indices=[],U=64,V=32;for(let i=0;i<=U;i++)for(let j=0;j<=V;j++)uv.push(i/U,j/V);for(let i=0;i<U;i++)for(let j=0;j<V;j++){const n=i*(V+1)+j;indices.push(n,n+1,n+V+1,n+1,n+V+2,n+V+1);}
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(uv),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);
    const texture=(unit,width,height,data)=>{gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,width,height,0,gl.RGBA,gl.FLOAT,new Float32Array(data));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);};texture(2,512,3,spectrum.samples);texture(3,chair.width,chair.height,chair.samples);
    const aspect=canvas.width/canvas.height,f=1/Math.tan(105*Math.PI/360),near=.04,far=20,view=[0,0,1,0,0,1,0,0,-1,0,0,0,0,0,-3.65,1],projection=[f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0],matrix=new Float32Array(16);for(let column=0;column<4;column++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)matrix[column*4+row]+=projection[k*4+row]*view[column*4+k];
    gl.enable(gl.DEPTH_TEST);gl.clearColor(1,1,1,1);gl.viewport(0,0,canvas.width,canvas.height);
    function draw(program,kind,variant,time,preset=null){gl.useProgram(program);const location=name=>gl.getUniformLocation(program,name);gl.uniformMatrix4fv(location('uViewProjection'),false,matrix);for(const [name,value] of Object.entries({uTime:time,uWave:preset?.wave??.78,uDensity:preset?.density??48,uLayers:preset?.layers??4,uBalance:preset?.balance??.6,uInk:preset?.ink??.85,uTextureStrength:preset?.textureStrength??.65,uTextureScale:preset?.textureScale??2}))gl.uniform1f(location(name),value);for(const [name,value] of Object.entries({uKind:kind,uVariant:variant,uWinding:preset?.winding??variant,uSpectral:preset?.spectral??variant,uSpectrum:2,uChair:3,uTextureMode:preset?.textureMode??(variant?3:0),uPalette:preset?.palette??variant,uContrastCycle:preset?.inkCycle??variant%2}))gl.uniform1i(location(name),value);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_INT,0);if(benchmark)return;const pixels=new Uint8Array(192*128*4);gl.readPixels(0,0,192,128,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;}
    async function measure(program,kind,preset){
     const query=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,query);draw(program,kind,preset.variation,.4,preset);gl.endQuery(timer.TIME_ELAPSED_EXT);gl.flush();
     while(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE))await new Promise(resolve=>requestAnimationFrame(resolve));
     if(gl.getParameter(timer.GPU_DISJOINT_EXT))throw Error('GPU timing was disjoint');const ms=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(query);return ms;
    }
    const result=[];
    for(let index=0;index<kinds.length;index++){
     const kind=kinds[index],program=await compile(fragments[index+1]);let sum=0,max=0,over2=0,samples=0;
     if(benchmark){
      const before=[],after=[],preset=presets[index];
      // Warm both programs, then alternate measurements so GPU clock changes
      // affect the pair equally. Every query is consumed before another study.
      for(let warm=0;warm<3;warm++){await measure(generic,kind,preset);await measure(program,kind,preset);}
      for(let sample=0;sample<9;sample++){if(sample%2){after.push(await measure(program,kind,preset));before.push(await measure(generic,kind,preset));}else{before.push(await measure(generic,kind,preset));after.push(await measure(program,kind,preset));}}
      const median=values=>[...values].sort((a,b)=>a-b)[4],genericMs=median(before),specializedMs=median(after);result.push({kind,genericMs,specializedMs,reduction:1-specializedMs/genericMs,before,after});gl.deleteProgram(program);continue;
     }
     for(const variant of variants)for(const time of [.4,2.3]){const expected=draw(generic,kind,variant,time),actual=draw(program,kind,variant,time);for(let i=0;i<actual.length;i+=4){const error=Math.abs(actual[i]-expected[i]);sum+=error;max=Math.max(max,error);if(error>2)over2++;samples++;}}
     result.push({kind,mean:sum/samples,max,over2,samples});gl.deleteProgram(program);
    }
    if(gl.getError()!==gl.NO_ERROR)throw Error('WebGL error in specialization comparison');return result;
   },{vertex,fragments:[c.TorusLight.fragment(raw,false),...kinds.map(uKind=>c.TorusLight.fragment(c.TorusPrograms.specialize(raw,{uKind}),false))],spectrum:c.TORUS_SPECTRUM,chair:c.TORUS_CHAIR,kinds,variants,benchmark,presets:kinds.map(kind=>c.TorusPresets.get(file==='topology.js'?kind:file==='tessellations.js'?kind+101:kind>=15?kind+80:kind+71))});
   for(const row of result){report.push({file,...row});if(benchmark)console.log(file,row.kind,row.genericMs.toFixed(3)+' ms -> '+row.specializedMs.toFixed(3)+' ms',Math.round(100*row.reduction)+'%');else assert(row.mean<.05,'specialization image changed: '+file+' kind '+row.kind+' mean '+row.mean);}
   if(!benchmark)console.log('PASS',file,result.length*variants.length*2,'render pairs; worst mean intensity error',Math.max(...result.map(row=>row.mean)));await page.close();
  }
  const output=path.join(__dirname,benchmark?'browser-specialization-gpu.json':'browser-specialization-equivalence.json'),previous=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')).filter(row=>!files.includes(row.file)):[];
  fs.writeFileSync(output,JSON.stringify([...previous,...report],null,2));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
