"""Measure visible parameter effects using the actual GLSL and mesh builders.
No browser is used. Reports inert controls and duplicate discrete geometry steps.
"""
import importlib.util,json,subprocess,numpy as np,argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=Path('/tmp/torus-parameter-audit.json'));p.add_argument('--from-id',type=int,default=0);p.add_argument('--ids',default='');p.add_argument('--parameters',default='');p.add_argument('--curated',action='store_true');p.add_argument('--width',type=int,default=320);p.add_argument('--height',type=int,default=220);args=p.parse_args()
spec=importlib.util.spec_from_file_location('render',Path(__file__).with_name('render-studies.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
js="""const fs=require('fs'),vm=require('vm'),c={};for(const f of ['presets.js','collection.js','parameters.js'])vm.runInNewContext(fs.readFileSync('dist/'+f,'utf8'),c);vm.runInNewContext('this.rows=TORUS_COLLECTION.flatMap(g=>g.studies.flatMap(([id,variants])=>variants.map((name,v)=>{const defaults=TorusParameters.normalise(id,v,TorusPresets.get(id));return {id,v,name,defaults,p:TorusParameters.profile(id,v,PROFILE_STATE)};})))',c);console.log(JSON.stringify(c.rows))"""
js=js.replace('PROFILE_STATE','defaults' if args.curated else '{textureMode:1,textureStrength:.65,ink:.86,winding:2}')
rows=json.loads(subprocess.check_output(['node','-e',js],cwd=m.ROOT));r=m.Renderer(args.width,args.height,perspective=105 if args.curated else 76);results=[];inactive=[]
base=dict(ink=.86,palette=0,depth=3,turns=1,density=88,wave=.65,winding=2,layers=3,balance=.5,spectral=1,textureMode=1,textureStrength=.65,textureScale=2)
for row in rows:
 if row['id']<args.from_id or (args.ids and str(row['id']) not in args.ids.split(',')):continue
 kw=base.copy();kw['variant']=row['v'];cache={}
 if args.curated:
  for k,v in row['defaults'].items():
   key={'recursion':'depth','variation':'variant'}.get(k,k)
   if key in kw or key=='inkCycle':kw[key]=v
  kw['variant']=row['v']
 for key,control in row['p'].items():
  k='depth' if key=='recursion' else key
  if k not in kw:continue
  if 'values' in control:kw[k]=min(control['values'],key=lambda x:abs(x-kw[k]))
  elif 'min' in control:kw[k]=min(control['max'],max(control['min'],kw[k]))
 def image(options,t=.4):
  key=(t,*sorted(options.items()))
  if key not in cache:cache[key]=np.asarray(r.render(row['id'],t=t,**options),dtype=float)
  return cache[key]
 for key,control in row['p'].items():
  if key in ['speed','perspective'] or (args.parameters and key not in args.parameters.split(',')):continue
  k='depth' if key=='recursion' else key
  values=control.get('values')
  if values is None:
   if key=='textureMode':values=[0,1,2,3,4,5,6]
   elif key=='spectral':values=[0,1,2]
   elif control['step']==1:values=list(range(control['min'],control['max']+1))
   else:values=[control['min'],control['max']]
  diffs=[]
  for a,b in zip(values,values[1:]):
   aa=dict(kw,**{k:a});bb=dict(kw,**{k:b});diff=float(np.abs(image(aa)-image(bb)).mean())
   if diff<.15:diff=max(diff,float(np.abs(image(aa,1.3)-image(bb,1.3)).mean()))
   diffs.append(round(diff,5))
  item={'id':row['id'],'v':row['v'],'parameter':key,'diffs':diffs};results.append(item)
  if min(diffs,default=0)<.15:inactive.append(item)
 print(row['id'],row['v'],'checked',len(row['p']),'controls',flush=True)
 args.output.write_text(json.dumps({'measurements':results,'weak':inactive},indent=2))
print('WEAK',json.dumps(inactive),flush=True)
if r.visibility_process:r.visibility_process.terminate()
