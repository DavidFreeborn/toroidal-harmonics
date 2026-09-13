/* Real GLSL subdivision Jacobians versus independent central differences.
   Tests the exact production loop, including quarter-turn ancestry and early leaves. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'../dist/transformations.js'),'utf8');
function functionSource(name){
 const re=new RegExp('(?:float|vec2) '+name+'\\('),start=source.search(re);assert(start>=0);
 let index=source.indexOf('{',start),depth=1;for(index++;depth;index++){if(source[index]==='{')depth++;if(source[index]==='}')depth--;}
 return source.slice(start,index);
}
const production=functionSource('recursiveSample'),body=production.slice(production.indexOf('{')+1,production.indexOf('  edgePixel=pixelGradient'))
 .replace('stage=phaseAt((id+.5)/roots)','stage=uStage');
const fragment=`#version 300 es
precision highp float;
uniform highp int uKind,uVariant,uDebugMode;
uniform float uLayers,uWave,uStage;
uniform vec2 uPoint;
out vec4 fragColor;
${['boxEdge','generation','quarter','quarterDirection','ink'].map(functionSource).join('\n')}
void main(){vec2 q=uPoint,dx=vec2(1,0),dy=vec2(0,1);float roots=2.0;
${body}
fragColor=uDebugMode==0?vec4(dx,dy):vec4(f,0,1);
}`;
function leaf(point,kind,variant,layers,wave,stage){
 let f=point.map(x=>x-Math.floor(x)),ancestry=((Math.floor(point[0])+Math.floor(point[1]))%2+2)%2;
 for(let level=0;level<layers;level++){
  const lag=(.30+1.10*wave)*(2*level-(layers-1))/Math.max(1,layers-1),g=stage/(stage+(1-stage)*2**lag);
  if(g<=0)break;
  if(kind===10||kind===15){
   const turn=variant===0?0:variant===1?level%4:(ancestry+level)%4;
   if(turn===1)f=[1-f[1],f[0]];if(turn===2)f=f.map(x=>1-x);if(turn===3)f=[f[1],1-f[0]];
   const split=kind===15?[1-.61803398875*g,1-.38196601125*g]:[1-.5*g,1-.5*g],digit=f.map((x,i)=>x>=split[i]?1:0);
   f=f.map((x,i)=>(x-digit[i]*split[i])/Math.max(1e-6,digit[i]?1-split[i]:split[i]));ancestry+=digit[0]+2*digit[1];if(digit[0]&&digit[1])break;
  }else if(kind===11||kind===14){
   const a=g/3,digit=f.map(x=>Number(x>=a)+Number(x>=1-a));
   f=f.map((x,i)=>(x-(digit[i]===0?0:digit[i]===1?a:1-a))/Math.max(1e-6,digit[i]===1?1-2*a:a));
   if(digit[0]===1&&digit[1]===1)break;ancestry+=1+(digit[0]+digit[1])%2;
  }else{
   const axis=(level+variant)%2,a=g/3,x=f[axis],digit=Number(x>=a)+Number(x>=1-a);
   f[axis]=(x-(digit===0?0:digit===1?a:1-a))/Math.max(1e-6,digit===1?1-2*a:a);
   if(digit===1)break;ancestry+=digit===0?1:2;
  }
 }
 return f;
}
async function main(){
 const browser=await chromium.launch({channel:process.env.TORUS_BROWSER||'chrome',headless:true});
 try{
  const page=await browser.newPage();const cases=[];let seed=92371;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let kind=10;kind<=15;kind++)for(let variant=0;variant<3;variant++)for(let layers=1;layers<=4;layers++)for(const stage of [.1,.63,1])for(let i=0;i<4;i++)cases.push({kind,variant,layers,stage,wave:.73,point:[random()*3-.5,random()*3-.5]});
  const output=await page.evaluate(({fragment,cases})=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=4;const gl=canvas.getContext('webgl2');if(!gl.getExtension('EXT_color_buffer_float'))throw Error('Float target required');
   function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
   const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}'));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.useProgram(p);
   const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32F,4,4);const framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Float target incomplete');gl.viewport(0,0,4,4);
   const uniforms={};for(const name of ['uKind','uVariant','uLayers','uWave','uStage','uPoint','uDebugMode'])uniforms[name]=gl.getUniformLocation(p,name);
   const pixel=new Float32Array(4),rows=[];
   for(const item of cases){
    gl.uniform1i(uniforms.uKind,item.kind);gl.uniform1i(uniforms.uVariant,item.variant);gl.uniform1f(uniforms.uLayers,item.layers);gl.uniform1f(uniforms.uWave,item.wave);gl.uniform1f(uniforms.uStage,item.stage);gl.uniform2fv(uniforms.uPoint,item.point);
    const row=[];for(const mode of [0,1]){gl.uniform1i(uniforms.uDebugMode,mode);gl.drawArrays(gl.TRIANGLES,0,3);gl.readPixels(1,1,1,1,gl.RGBA,gl.FLOAT,pixel);row.push(Array.from(pixel));}rows.push(row);
   }
   if(gl.getError())throw Error('WebGL error');return rows;
  },{fragment,cases});
  let worst=0,positionWorst=0;
  for(let i=0;i<cases.length;i++){
   const c=cases[i],value=p=>leaf(p,c.kind,c.variant,c.layers,c.wave,c.stage),expected=[],epsilon=1e-6;
   for(let axis=0;axis<2;axis++){const a=c.point.slice(),b=c.point.slice();a[axis]+=epsilon;b[axis]-=epsilon;const x=value(a),y=value(b);expected.push(...x.map((v,j)=>(v-y[j])/(2*epsilon)));}
   const actual=output[i][0],position=value(c.point);
   for(let j=0;j<4;j++){const error=Math.abs(actual[j]-expected[j])/(1+Math.abs(expected[j]));worst=Math.max(worst,error);assert(error<3e-4,JSON.stringify({case:c,expected,actual,error}));}
   for(let j=0;j<2;j++){const error=Math.abs(output[i][1][j]-position[j]);positionWorst=Math.max(positionWorst,error);assert(error<3e-4,JSON.stringify({case:c,position,actual:output[i][1],error}));}
  }
  console.log('PASS',cases.length,'production GPU recursive Jacobians; max normalized derivative error',worst,'max position error',positionWorst);
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
