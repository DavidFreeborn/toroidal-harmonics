/* Exercise production GLSL in WebGL 2. The independent reference clips the
   screen pixel polygon against a strip and computes its area geometrically. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
function clip(polygon,a,b,c){
 const out=[];
 for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=a*p[0]+b*p[1]+c,dq=a*q[0]+b*q[1]+c;
  if(dp>=0)out.push(p);
  if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
 }
 return out;
}
function area([d,width,x,y]){
 let p=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
 p=clip(p,x,y,width+d);p=clip(p,-x,-y,width-d);
 return Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-a[1]*b[0];},0))*.5;
}
async function main(){
 const sampling=fs.readFileSync(path.join(__dirname,'../dist/lightfield.js'),'utf8').match(/const sampling=`([\s\S]*?)`;/)[1];
 const cases=[];
 for(const scale of [.0001,.003,.03,.3,1,4])for(const angle of [0,.00001,.13,.42,Math.PI/4,1.13,Math.PI/2])for(const ratio of [.003,.03,.3,1])for(const position of [-.7,-.2,0,.13,.47,.7]){
  cases.push([position*scale,ratio*scale,Math.cos(angle)*scale,Math.sin(angle)*scale]);
 }
 const browser=await chromium.launch({channel:process.env.TORUS_BROWSER||'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage();
  const result=await page.evaluate(({sampling,cases})=>{
   const canvas=document.createElement('canvas');canvas.width=8192;canvas.height=1;const gl=canvas.getContext('webgl2');
   if(!gl||!gl.getExtension('EXT_color_buffer_float'))throw Error('Float WebGL 2 target required');
   function shader(kind,source){const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
   const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}'));
   gl.attachShader(p,shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;uniform highp sampler2D cases;uniform int mode;uniform vec3 parameters;out vec4 result;\n'+sampling+'\nvoid main(){vec4 s=texelFetch(cases,ivec2(gl_FragCoord.xy),0);float value=mode==0?torusCoverage(s.x,s.y,s.zw):torusPeriodic(gl_FragCoord.x/8192.0+.137,parameters.x,parameters.yz);result=vec4(value);}'));
   gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.useProgram(p);
   const input=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,input);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,cases.length,1,0,gl.RGBA,gl.FLOAT,new Float32Array(cases.flat()));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
   const output=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,output);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,8192,1,0,gl.RGBA,gl.FLOAT,null);
   const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,output,0);gl.bindTexture(gl.TEXTURE_2D,input);
   gl.viewport(0,0,8192,1);gl.drawArrays(gl.TRIANGLES,0,3);
   const actual=new Float32Array(8192*4);gl.readPixels(0,0,8192,1,gl.RGBA,gl.FLOAT,actual);
   const values=cases.map((_,i)=>actual[i*4]),means=[];
   gl.uniform1i(gl.getUniformLocation(p,'mode'),1);
   for(const width of [.002,.01,.04,.14,.30,.49,.5])for(const footprint of [.01,.1,.7,1,3])for(const angle of [0,.31,Math.PI/4]){
    gl.uniform3f(gl.getUniformLocation(p,'parameters'),width,Math.cos(angle)*footprint,Math.sin(angle)*footprint);gl.drawArrays(gl.TRIANGLES,0,3);gl.readPixels(0,0,8192,1,gl.RGBA,gl.FLOAT,actual);
    let sum=0;for(let i=0;i<8192;i++)sum+=actual[i*4];means.push(Math.abs(sum/8192-2*width));
   }
   return {values,means,error:gl.getError()};
  },{sampling,cases});
  const errors=cases.map((c,i)=>Math.abs(result.values[i]-area(c))),maxAreaError=Math.max(...errors),maxPeriodicMeanError=Math.max(...result.means);
  assert.equal(result.error,0);assert(maxAreaError<.00002,`Polygon coverage error ${maxAreaError}`);assert(maxPeriodicMeanError<.00003,`Mean pigment error ${maxPeriodicMeanError}`);
  console.log(JSON.stringify({cases:cases.length,periodicMeans:result.means.length,maxAreaError,maxPeriodicMeanError}));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
