/* Random choices use the same valid, dependent controls as the Parameters panel. */
const TorusSelection=(()=>{
 function index(current,length,available,rng=Math.random){
  const candidates=[];for(let i=0;i<length;i++)if(available(i))candidates.push(i);
  const pool=candidates.length>1?candidates.filter(i=>i!==current):candidates;
  return pool.length?pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))]:current;
 }
 function parameters(id,constructions,rng=Math.random){
  const s=TorusPresets.get(id),pick=values=>values[Math.min(values.length-1,Math.floor(rng()*values.length))];
  s.variation=pick(Array.from({length:constructions},(_,i)=>i));
  // Select controlling choices before their dependent ranges. A held form,
  // for example, must be chosen before its subdivision controls are sampled.
  const order=['textureMode','inkCycle','ink','palette','winding','balance','layers','recursion','spectral','turns','wave','density','textureStrength','textureScale','speed','perspective'];
  // These two studies reveal inheritance/contour breadth after choosing depth.
  // Older held-form studies instead require balance before their layer count.
  if(id===146||id===148){order.splice(order.indexOf('layers'),1);order.splice(order.indexOf('balance'),0,'layers');}
  for(const key of order){
   const spec=TorusParameters.profile(id,s.variation,s)[key];if(!spec)continue;
   const values=spec.values||(key==='textureMode'?[0,1,2,3,4,5,6]:key==='spectral'?[0,1,2]:null);
   if(values)s[key]=pick(values);
   else{const steps=Math.round((spec.max-spec.min)/spec.step);s[key]=Number((spec.min+Math.floor(rng()*(steps+1))*spec.step).toFixed(6));}
  }
  return TorusParameters.normalise(id,s.variation,s);
 }
 return {index,parameters};
})();
