"""Inspect both reversals and the intermediate stages of all 54 metamorphoses.

Convergence under a shrinking time step distinguishes a fast motion from a
finite jump. Outputs are scratch diagnostics, not performance claims.
"""
import importlib.util,math,json,argparse
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
s=importlib.util.spec_from_file_location('r','scripts/render-studies.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
p=argparse.ArgumentParser();p.add_argument('--ids',default='');args=p.parse_args()
studies=[int(x) for x in args.ids.split(',')] if args.ids else list(range(125,143))
r=m.Renderer(320,220);out=Path('/tmp/torus-continuity');out.mkdir(exist_ok=True)
def frame(study,g,variant=0,**kwargs):return np.asarray(r.render(study,t=.4,winding=3,balance=g,variant=variant,textureMode=0,**kwargs),dtype=float)[:,:,0]
def difference(a,b):return float(np.abs(a-b).mean())
joins=[];scans=[]
for study in studies:
 for variant in range(3):
  for endpoint in [0.,1.]:
   a=frame(study,endpoint,variant)
   errors=[difference(a,frame(study,endpoint+(1 if endpoint==0 else -1)*h,variant)) for h in [.001,.0001,.00001]]
   joins.append(dict(study=study,variant=variant,endpoint=endpoint,errors=errors))
  gs=np.linspace(0,1,97);prev=frame(study,0,variant);changes=[]
  for g in gs[1:]:
   im=frame(study,float(g),variant);changes.append(difference(prev,im));prev=im
  # Probe the three largest intervals at much finer resolution. Keep the
  # coarse trace so that the test also reveals unexpectedly compressed motion.
  candidates=np.argsort(changes)[-3:];peaks=[]
  for index in candidates:
   fine=np.linspace(gs[index],gs[index+1],17);images=[frame(study,float(g),variant) for g in fine]
   ds=[difference(a,b) for a,b in zip(images,images[1:])];peaks.append(max(ds))
  scans.append(dict(study=study,variant=variant,coarse=changes,fine_peaks=peaks))
  assert max(peaks)<.4*max(changes)+.05,(study,variant,'interior change fails to shrink with time step')
  # Approach the wrapped playback join with light and circulation enabled.
  # Endpoint equality alone did not catch the original internal switches.
  motion=[]
  for h in [.001,.0001,.00001]:
   a=np.asarray(r.render(study,t=2*math.pi-h,variant=variant),dtype=float)
   b=np.asarray(r.render(study,t=h,variant=variant),dtype=float)
   motion.append(difference(a,b))
  assert motion[-1]<.25,(study,variant,'playback join',motion)
  if study==141:
   for layers in range(1,5):
    a=frame(study,0,variant,layers=layers);b=frame(study,.0000001,variant,layers=layers)
    assert difference(a,b)<.1,(study,variant,layers,'subpixel child boundary')
 print('Checked endpoint approaches and 96 interior intervals:',study,flush=True)
for name,rows in [('endpoint-approaches',joins),('intermediate-motion',scans)]:
 target=out/f'{name}.json'
 if args.ids and target.exists():rows=[x for x in json.loads(target.read_text()) if x['study'] not in studies]+rows
 target.write_text(json.dumps(rows,indent=2))
jumps=[x for x in joins if x['errors'][-1]>.25]
print('Unresolved endpoint approaches:',jumps,flush=True)
assert not jumps,'A metamorphosis has a finite endpoint jump'

# Storyboards use the real torus shader with movement and light active.
for study in [130,131,132,133,134,135,138,141,142]:
 sheet=Image.new('RGB',(320*4,244*3),'white');d=ImageDraw.Draw(sheet)
 for i in range(12):
  t=.4+2*math.pi*i/12;im=r.render(study,t=t)
  rgb=np.array(im);assert np.array_equal(rgb[:,:,0],rgb[:,:,1]) and np.array_equal(rgb[:,:,0],rgb[:,:,2])
  x=(i%4)*320;y=(i//4)*244;sheet.paste(im,(x,y));d.text((x+8,y+223),f'{32*i/12:.1f} s',fill='black')
 sheet.save(out/f'{study}-cycle.png')
