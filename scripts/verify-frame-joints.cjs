/* Exposed beam union: closed oriented surfaces, no duplicate faces, exact volume. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const c={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/chiaroscuro.js'),'utf8')+';this.M=TorusChiaroscuro',c);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
for(let depth=1;depth<=4;depth++){
 const {vertices:v,indices}=c.M.meshData(2,depth),edges=new Map(),faces=new Set();let volume=0;
 const position=i=>v.slice(i*14,i*14+3),key=p=>p.map(x=>x.toFixed(10)).join(',');
 for(let i=0;i<indices.length;i+=3){
  const ids=indices.slice(i,i+3),p=ids.map(position),keys=p.map(key),normal=v.slice(ids[0]*14+3,ids[0]*14+6);
  assert(dot(cross(sub(p[1],p[0]),sub(p[2],p[0])),normal)>1e-12,'zero-area or reversed face');
  const face=keys.slice().sort().join('/');assert(!faces.has(face),'duplicate coplanar triangle');faces.add(face);
  for(let j=0;j<3;j++){const a=keys[j],b=keys[(j+1)%3],edge=[a,b].sort().join('/'),entry=edges.get(edge)||[0,0];entry[0]++;entry[1]+=a<b?1:-1;edges.set(edge,entry);}
  volume+=dot(p[0],cross(p[1],p[2]))/6;
 }
 for(const [edge,[count,orientation]] of edges){assert.equal(count,2,'open or non-manifold edge: '+edge);assert.equal(orientation,0,'inconsistent winding');}
 let expected=0;for(let l=0;l<depth;l++){const s=.83*.66**l,w=.051*.66**l;expected+=12*(s+w)*w*w-16*w*w*w;}
 assert(Math.abs(volume-expected)<1e-12,'volume must equal the union, not the sum of overlapping bars');
 console.log('PASS',depth,'levels:',indices.length/3,'triangles, closed joints, exact union volume');
}
