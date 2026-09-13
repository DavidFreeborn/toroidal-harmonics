"""Render time joins and vanishing time steps, not just matching loop endpoints.

Use --baseline to save measurements before a fix. Native shader rendering only;
no browser or runtime dependencies are introduced.
"""
import argparse, importlib.util, json, math, subprocess
from pathlib import Path
import numpy as np

p=argparse.ArgumentParser();p.add_argument('--baseline',action='store_true');args=p.parse_args()
s=importlib.util.spec_from_file_location('render','scripts/render-studies.py')
m=importlib.util.module_from_spec(s);s.loader.exec_module(m);r=m.Renderer(256,176)
tag='before' if args.baseline else 'after';out=Path('/tmp/torus-continuity');out.mkdir(exist_ok=True)
def frame(study,**kw):return np.asarray(r.render(study,**kw),dtype=float)[:,:,0]
def delta(a,b):return float(np.abs(a-b).mean())
catalogue=json.loads(subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),c={};vm.runInNewContext(fs.readFileSync('dist/presets.js','utf8')+fs.readFileSync('dist/collection.js','utf8')+fs.readFileSync('dist/parameters.js','utf8')+';this.x=TORUS_COLLECTION.flatMap(g=>g.studies.map(s=>[...s,TorusParameters.profile(s[0],0,{textureMode:1,textureStrength:.65,ink:.86,winding:2})]))',c);console.log(JSON.stringify(c.x))"],text=True))
joins=[]
for study,variants,family,profile in catalogue:
 kw=dict(density=88,wave=.65,layers=3,depth=3,balance=.5)
 for key,value in list(kw.items()):
  control=profile.get('recursion' if key=='depth' else key,{})
  if 'values' in control:kw[key]=min(control['values'],key=lambda x:abs(x-value))
  elif 'min' in control:kw[key]=min(control['max'],max(control['min'],value))
 for variant in range(len(variants)):
  a=frame(study,t=0,variant=variant,**kw);b=frame(study,t=2*math.pi,variant=variant,**kw)
  joins.append(dict(study=study,variant=variant,error=delta(a,b)))
print('Time-join outliers',[(x['study'],x['variant'],round(x['error'],3)) for x in joins if x['error']>.15],flush=True)
Path(out/f'{tag}-joins.json').write_text(json.dumps(joins,indent=2))

# Intermediate generation thresholds previously triggered whole-region changes.
thresholds=[]
for study in [135,136,137,138,139,140,141,142]:
 for variant in range(3):
  for layers in [1,2,3,4]:
   delay=.18+.55*.65
   for k in range(layers):
    # smoothstep(x) == 1e-5 is the old early-exit boundary, not x == 0.
    lo,hi=0.,1.
    for _ in range(40):
     mid=(lo+hi)/2
     if mid*mid*(3-2*mid)<.00001:lo=mid
     else:hi=mid
    centre=(delay*k+(lo+hi)/2)/(1+delay*(layers-1))
    errors=[]
    for h in [.001,.0001,.00001]:
     a=frame(study,t=.4,variant=variant,winding=3,balance=max(0,centre-h),layers=layers,textureMode=0)
     b=frame(study,t=.4,variant=variant,winding=3,balance=centre+h,layers=layers,textureMode=0)
     errors.append(delta(a,b))
    thresholds.append(dict(study=study,variant=variant,layers=layers,stage=centre,errors=errors))
print('Persistent threshold jumps',[(x['study'],x['variant'],x['layers'],round(x['stage'],4),[round(e,3) for e in x['errors']]) for x in thresholds if x['errors'][0]>1 and x['errors'][1]>.65*x['errors'][0]],flush=True)
Path(out/f'{tag}-thresholds.json').write_text(json.dumps(thresholds,indent=2))

if not args.baseline:
 assert max(x['error'] for x in joins)<.15,'A visible construction does not close in time'
 assert max(x['errors'][-1] for x in thresholds)<.25,'An internal generation threshold still jumps'
