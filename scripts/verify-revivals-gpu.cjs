/* Production GLSL recurrence and analytic gradients vs independent Python
   direct Fourier modes / high-order theta ratios and finite differences. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
async function main(){
 const text=fs.readFileSync(path.join(__dirname,'../dist/revivals.js'),'utf8');
 const prefix=text.match(/const fragmentSource = `([\s\S]*?)void main\(\)\{/)[1];
 const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'revivals-gpu-fixture.json'),'utf8'));
 const browser=await chromium.launch({channel:process.env.TORUS_BROWSER||'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage();const actual=await page.evaluate(({prefix,fixture})=>{
   const c=document.createElement('canvas');c.width=64;c.height=1;const gl=c.getContext('webgl2');if(!gl.getExtension('EXT_color_buffer_float'))throw Error('Floating target unavailable');
   const diagnostic=`uniform highp sampler2D points;uniform int mode;void main(){vec2 z=texelFetch(points,ivec2(gl_FragCoord.xy),0).xy;if(uKind==0){Field f;if(uVariant==2){f=rosette(kernel(z.x+z.y,true),kernel(z.x-z.y,true),false);vec2 x=f.x,y=f.y;f.x=x+y;f.y=x-y;}else f=rosette(kernel(z.x,false),kernel(z.y,false),uVariant==1);fragColor=mode==0?vec4(f.value,f.x):vec4(f.y,0,0);}else fragColor=vec4(ellipticField(z,vec2(0),vec2(0),uDivisors[0]),0);}`;
   function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
   const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}'));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,prefix+diagnostic));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.useProgram(p);
   const output=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,output);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,64,1,0,gl.RGBA,gl.FLOAT,null);const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,output,0);
   const input=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,input);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.viewport(0,0,64,1);
   const u={};for(const name of ['uKind','uVariant','uLayers','uEvolution[0]','uDiagonal[0]','uDivisors[0]','uWave','mode'])u[name]=gl.getUniformLocation(p,name);
   const results=[];
   for(const f of fixture){
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RG32F,f.points.length,1,0,gl.RG,gl.FLOAT,new Float32Array(f.points.flat()));gl.uniform1i(u.uKind,f.kind);gl.uniform1i(u.uVariant,f.variant||0);gl.uniform1f(u.uLayers,f.order||1);gl.uniform1f(u.uWave,f.wave);
    const evolution=[],diagonal=[];for(let n=0;n<=8;n++){const w=Math.exp(-.13*n*n),p=-n*n*f.time;evolution.push(w*Math.cos(p),w*Math.sin(p));diagonal.push(w*Math.cos(2*p),w*Math.sin(2*p));}
    gl.uniform2fv(u['uEvolution[0]'],evolution);gl.uniform2fv(u['uDiagonal[0]'],diagonal);
    const rx=.23+.065*f.wave,ry=.12+.025*f.wave,c=Math.cos(f.time/2),s=Math.sin(f.time/2);gl.uniform4fv(u['uDivisors[0]'],[rx*c,ry*s,-rx*s,ry*c]);
    const values=[];for(let mode=0;mode<(f.kind===0?2:1);mode++){gl.uniform1i(u.mode,mode);gl.drawArrays(gl.TRIANGLES,0,3);const buffer=new Float32Array(64*4);gl.readPixels(0,0,64,1,gl.RGBA,gl.FLOAT,buffer);for(let i=0;i<f.points.length;i++){if(!values[i])values[i]=[];values[i].push(...buffer.slice(4*i,4*i+(f.kind===0?(mode===0?4:2):3)));}}
    results.push(values);
   }
   return {results,error:gl.getError()};
  },{prefix,fixture});
  assert.equal(actual.error,0);const maxima=[0,0],counts=[0,0];
  fixture.forEach((f,j)=>f.expected.forEach((row,i)=>row.forEach((expected,k)=>{const error=Math.abs(actual.results[j][i][k]-expected)/Math.max(1,Math.abs(expected));maxima[f.kind]=Math.max(maxima[f.kind],error);counts[f.kind]++;})));
  assert(maxima[0]<.0005,`Talbot numerical error ${maxima[0]}`);assert(maxima[1]<.0005,`Elliptic numerical error ${maxima[1]}`);
  const report={talbot:{values:counts[0],maximumNormalizedError:maxima[0]},elliptic:{values:counts[1],maximumNormalizedError:maxima[1]},webglError:actual.error};fs.writeFileSync(path.join(__dirname,'revivals-gpu-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
