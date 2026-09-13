const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),math=require('./verify-spinor.cjs');
const root=path.join(__dirname,'../dist'),out=path.join(__dirname,'spinor-audit');fs.mkdirSync(out,{recursive:true});
const fixture=`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff}canvas{display:block;width:600px;height:600px}</style><canvas width="1200" height="1200"></canvas><script src="/programs.js"></script><script src="/spinor.js"></script><script>
const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2',{antialias:true,preserveDrawingBuffer:true});
const originalLink=TorusPrograms.link;TorusPrograms.link=async(g,v,f)=>{window.vertexSource=v;return originalLink(g,v,f)};
let render,matrix;window.ready=(async()=>{render=await TorusSpinor.create(gl);const f=1/Math.tan(Math.PI/8),A=-(20+.05)/(20-.05),B=-2*20*.05/(20-.05);matrix=new Float32Array([0,0,A,-1,0,f,0,0,-f,0,0,0,0,0,-3.65*A+B,3.65]);})();
window.capture=(time,variant)=>{
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
 const buffer=gl.bufferSubData.bind(gl),draw=gl.drawElementsInstanced.bind(gl);
 gl.bufferSubData=(target,offset,data,start,count)=>{const one=new Float32Array(data);one.set([0,0,0,.98,0,1,0,1,0,0,0,0,-1,Math.cos(time),Math.sin(time),Math.cos(variant===2?Math.PI/3:0),Math.sin(variant===2?Math.PI/3:0)]);return buffer(target,offset,one,start,count)};
 gl.drawElementsInstanced=(mode,count,type,offset,n)=>draw(mode,count,type,offset,1);
 // Change the recipe too, so revisiting a phase always uploads the fixture pose.
 render.draw(matrix,time,.65,88+(variant%2),0,variant,{winding:1,turns:1,ink:.95,palette:0});gl.finish();
 gl.bufferSubData=buffer;gl.drawElementsInstanced=draw;return gl.getError();
};
window.feedback=(rows)=>{
 const p=gl.createProgram(),v=gl.createShader(gl.VERTEX_SHADER),f=gl.createShader(gl.FRAGMENT_SHADER);gl.shaderSource(v,vertexSource);gl.compileShader(v);gl.shaderSource(f,'#version 300 es\\nprecision highp float;out vec4 fragColor;void main(){fragColor=vec4(1);}');gl.compileShader(f);gl.attachShader(p,v);gl.attachShader(p,f);gl.transformFeedbackVaryings(p,['vPosition','vNormal'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
 const vao=gl.createVertexArray(),input=gl.createBuffer(),output=gl.createBuffer(),tf=gl.createTransformFeedback();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,input);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(rows.flat()),gl.STATIC_DRAW);
 for(const [location,size,offset] of [[0,3,0],[1,3,3],[2,2,6],[3,1,8],[8,4,9]]){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,52,offset*4);}
 gl.vertexAttrib4f(4,0,0,0,1);gl.vertexAttrib3f(5,1,0,0);gl.vertexAttrib3f(6,0,1,0);gl.vertexAttrib3f(7,0,0,1);
 gl.useProgram(p);gl.uniformMatrix4fv(gl.getUniformLocation(p,'uViewProjection'),false,new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));gl.uniform1f(gl.getUniformLocation(p,'uWave'),.65);
 gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,tf);gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,rows.length*24,gl.STREAM_READ);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,rows.length);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);const result=new Float32Array(rows.length*6);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,result);const error=gl.getError();gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);gl.deleteTransformFeedback(tf);gl.deleteVertexArray(vao);gl.deleteBuffer(input);gl.deleteBuffer(output);gl.deleteProgram(p);gl.deleteShader(v);gl.deleteShader(f);return {values:Array.from(result),error};
};</script>`;
async function main(){
 const server=http.createServer((req,res)=>{if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}const file=path.join(root,req.url.split('?')[0]);fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(data);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']}),page=await browser.newPage({viewport:{width:600,height:600},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');await page.evaluate(()=>ready);
  const rows=[],expected=[];
  for(const time of [0,.37,1.57,Math.PI,4.31,6.28])for(const arch of [0,Math.PI/3,-Math.PI/3])for(const r of [.21,.38,.53,.72,.95,1.2])for(const side of [1,-1])for(const w of [-.92,0,.92]){
   const normal=[0,0,side],p=[w*(.095+.085*.65),0,side*r],a=math.analytic(p,time,arch),along=a.columns[2].map(x=>x*side),across=a.columns[0],n=math.unit(math.cross(along,across));
   rows.push([w,0,side*r,...normal,0,0,-1,Math.cos(time),Math.sin(time),Math.cos(arch),Math.sin(arch)]);expected.push([...a.position,...n]);
  }
  const feedback=await page.evaluate(rows=>window.feedback(rows),rows);assert.equal(feedback.error,0);let maxPosition=0,maxNormal=0;
  for(let i=0;i<rows.length;i++){maxPosition=Math.max(maxPosition,math.norm(math.sub(feedback.values.slice(i*6,i*6+3),expected[i].slice(0,3))));maxNormal=Math.max(maxNormal,math.norm(math.sub(feedback.values.slice(i*6+3,i*6+6),expected[i].slice(3))));}
  assert(maxPosition<8e-6);assert(maxNormal<3e-5);
  for(let variant=0;variant<3;variant++)for(let k=0;k<=8;k++){const error=await page.evaluate(({time,variant})=>capture(time,variant),{time:k*Math.PI/4,variant});assert.equal(error,0);await page.screenshot({path:path.join(out,'variant'+variant+'-phase'+k+'.png')});}
  const report={pass:true,feedbackVertices:rows.length,maxPosition,maxNormal,errors};assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1});
