// Feed the production visibility and orientation code to native reference renders.
const fs=require('node:fs'),vm=require('node:vm'),readline=require('node:readline'),path=require('node:path');
const c={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/performance.js'),'utf8')+';this.P=TorusPerformance',c);
let ids=[];const gl=new Proxy({}, {get(_,key){return key==='bufferSubData'?(_,offset,data,start,count)=>{ids=Array.from(data.subarray(start,start+count))}:()=>{};}});
const visibility=c.P.instances(gl),frames=new Float32Array(8192*31),vao={},chunks=c.P.jacquardChunks(),chunkIds=new Float32Array(16384);
readline.createInterface({input:process.stdin}).on('line',line=>{
 const [matrix,nx,ny,parts,t,pad,options]=JSON.parse(line);ids=[];
 if(options?.jacquard){const n=chunks.fill(matrix,nx,t,chunkIds);process.stdout.write(JSON.stringify({ids:Array.from(chunkIds.subarray(0,n))})+'\n');return;}
 const count=visibility.bind(vao,matrix,nx,ny,parts,t,pad);
 const result={ids};if(options){
  if(options.corner)c.P.cornerFrames(visibility.ids,count,nx,ny,t,options.wave,options.turns,options.variant,frames);
  else c.P.mengerFrames(visibility.ids,count,nx,ny,t,options.wave,options.turns,options.variant,frames);
  result.frames=Array.from(frames.subarray(0,count*(options.corner?31:13)));
 }
 process.stdout.write(JSON.stringify(result)+'\n');
});
