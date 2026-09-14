/* Exact production contour AA versus independent double-precision clipping.
   GPU test: coordinate an exclusive slot when running alongside performance work. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.join(__dirname,'../dist'),context={};
for(const [file,name] of [['quasicrystal-data.js','TORUS_QUASI'],['phason.js','TorusPhason']])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8')+';this.'+name+'='+name,context);
const P=context.TorusPhason,cases=[],f=Math.fround,levels=[...context.TORUS_QUASI.levels,context.TORUS_QUASI];
for(const level of levels){
 const model=P.buildModel(level);
 for(const patch of model.patches.slice(0,6))for(const t of [0,.000001,.37,.7,1])for(const polygon of P.polygons({...patch,flip:true},t))for(const scale of [.0005,.006])for(const insetScale of [0,.08,.24,.55]){
  const angle=.13+cases.length*.41,dx=[scale*Math.cos(angle),scale*Math.sin(angle)],dy=[-.17*scale*Math.sin(angle),.17*scale*Math.cos(angle)];
  const perimeter=polygon.reduce((sum,p,i)=>sum+Math.hypot(p[0]-polygon[(i+1)%polygon.length][0],p[1]-polygon[(i+1)%polygon.length][1]),0),extent=2*P.area(polygon)/perimeter,inset=insetScale*extent;
  // Samples on actual inset edges exercise the fast marginal and corner path.
  const edge=cases.length%polygon.length,a=polygon[edge],b=polygon[(edge+1)%polygon.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]),along=cases.length%3===0?.01:.5;
  const point=[a[0]+along*(b[0]-a[0])-(b[1]-a[1])*inset/Math.max(length,1e-15)+.17*dx[0]-.13*dy[0],a[1]+along*(b[1]-a[1])+(b[0]-a[0])*inset/Math.max(length,1e-15)+.17*dx[1]-.13*dy[1]];
  cases.push({polygon:polygon.map(p=>p.map(f)),point:point.map(f),dx:dx.map(f),dy:dy.map(f),inset:f(inset)});
 }
}
function clip(poly,distance){const output=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b);if(da>=0)output.push(a);if(da*db<0){const t=da/(da-db);output.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return output;}
function expected({polygon,point,dx,dy,inset}){
 let insetPolygon=polygon;
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],x=b[0]-a[0],y=b[1]-a[1],length=Math.hypot(x,y);if(length<1e-10)continue;
  insetPolygon=clip(insetPolygon,p=>(x*(p[1]-a[1])-y*(p[0]-a[0]))/length-inset);
 }
 const determinant=dx[0]*dy[1]-dx[1]*dy[0];let poly=insetPolygon.map(p=>{const x=p[0]-point[0],y=p[1]-point[1];return [(x*dy[1]-y*dy[0])/determinant,(dx[0]*y-dx[1]*x)/determinant];});
 for(const [axis,boundary,sign] of [[0,-.5,1],[0,.5,-1],[1,-.5,1],[1,.5,-1]])poly=clip(poly,p=>(p[axis]-boundary)*sign);
 return Math.abs(poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p[0]*q[1]-p[1]*q[0];},0))/2;
}
(async()=>{
 const raw=fs.readFileSync(path.join(root,'phason.js'),'utf8').match(/const fragmentSource = `([\s\S]*?)`;/)[1],coverage=raw.slice(raw.indexOf('float cross2('),raw.indexOf('float progress('));
 const browser=await chromium.launch({channel:process.env.TORUS_BROWSER||'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage(),values=await page.evaluate(({cases,coverage})=>{
   const canvas=document.createElement('canvas');canvas.width=cases.length;canvas.height=1;const gl=canvas.getContext('webgl2');if(!gl.getExtension('EXT_color_buffer_float'))throw Error('Floating-point framebuffer required');
   const program=gl.createProgram();for(const [type,source] of [[gl.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}'],[gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;uniform highp sampler2D inputData;out vec4 result;\n'+coverage+'\nvoid main(){int id=int(gl_FragCoord.x);vec4 a=texelFetch(inputData,ivec2(0,id),0),b=texelFetch(inputData,ivec2(1,id),0);vec2 poly[5];for(int i=0;i<5;i++)poly[i]=texelFetch(inputData,ivec2(2+i,id),0).xy;result=vec4(coverage(a.xy,a.zw,b.xy,poly,5,b.z));}']]){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);}
   gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
   const data=new Float32Array(cases.length*7*4);cases.forEach((c,i)=>{const offset=i*28;data.set([...c.point,...c.dx,...c.dy,c.inset,0],offset);c.polygon.forEach((p,j)=>data.set(p,offset+8+j*4));});
   const input=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,input);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,7,cases.length,0,gl.RGBA,gl.FLOAT,data);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
   const output=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,output);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,cases.length,1,0,gl.RGBA,gl.FLOAT,null);const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,output,0);gl.bindTexture(gl.TEXTURE_2D,input);gl.viewport(0,0,cases.length,1);gl.drawArrays(gl.TRIANGLES,0,3);
   const pixels=new Float32Array(cases.length*4);gl.readPixels(0,0,cases.length,1,gl.RGBA,gl.FLOAT,pixels);if(gl.getError()!==gl.NO_ERROR)throw Error('WebGL error during inset audit');return cases.map((_,i)=>pixels[i*4]);
  },{cases,coverage});
  let maximum=0,sum=0;values.forEach((value,i)=>{const error=Math.abs(value-expected(cases[i]));maximum=Math.max(maximum,error);sum+=error;assert(Number.isFinite(value)&&error<.0001,'Contour coverage differs from independent reference, case '+i+': '+error);});
  console.log('PASS',cases.length,'inset GPU areas across all3 approximants, thin and wide rhombi, moving pentagons, corner pixels and anisotropic footprints; maximum error',maximum,'mean',sum/cases.length);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
