/* Evaluate the actual scalar edge-pigment expressions around their former
   thresholds. A hard colour inversion persists under shrinking time steps. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const mix=(a,b,t)=>a+(b-a)*t,smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
const cases=[
 ['kinetic.js',/float edge=(.+);/,['pigment','uInk'],[.48,1],0,.035,.80],
 ['chiaroscuro.js',/float edgeTone=(.+);/,['pigment','uInk'],[.48,1],0,.025,.78],
 ['sculptures.js',/float tone=mix\(paper,(.+),clamp\(ink,0.0,1.0\)\);/,['pigment','uInk'],[.48,1],0,.028,.76],
 ['mechanisms.js',/tone=mix\(tone,(.+),rim\*\.85\);/,['pigment'],[.5],0,.025,.87],
 ['transformations.js',/tone=mix\(tone,(.+),marks\*\.95\);/,['tone'],[.4],0,.97,.025]
];
for(const [file,pattern,args,point,index,black,white] of cases){
 const source=fs.readFileSync(path.join(__dirname,'../dist',file),'utf8'),match=source.match(pattern);assert(match,file+' edge expression');
 const evaluate=new Function('mix','smoothstep',...args,'return '+match[1]);
 const at=x=>{const values=point.slice();values[index]=x;return evaluate(mix,smoothstep,...values)};
 assert(Math.abs(at(0)-black)<1e-12&&Math.abs(at(1)-white)<1e-12,file+' preserves endpoint pigment');
 let previous=Infinity;
 for(const epsilon of [1e-2,1e-3,1e-4,1e-5,1e-6]){
  const difference=Math.abs(at(point[index]+epsilon)-at(point[index]-epsilon));
  assert(difference<previous*.2,file+' must converge without a persistent flash');previous=difference;
 }
 assert(previous<2e-5,file+' jump at middle grey');
 console.log('PASS',file,'continuous edge contrast; last shrinking-step difference',previous.toExponential(3));
}
