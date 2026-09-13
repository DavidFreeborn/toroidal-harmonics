"""Compare production culling against drawing every triangle, at extreme views.
Minor silhouette sample differences are bounded separately from broad changes.
"""
import importlib.util,json,math,argparse
from pathlib import Path
import numpy as np
s=importlib.util.spec_from_file_location('r',Path(__file__).with_name('render-studies.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
parser=argparse.ArgumentParser();parser.add_argument("--ids",default="");args=parser.parse_args();studies=list(map(int,args.ids.split(","))) if args.ids else [21,56,67,59,25,27,22,23,61,28,138,130,49,19]
rows=[]
for width,height,perspective in [(660,440,105),(360,700,105),(660,440,50),(660,440,115)]:
 r=m.Renderer(width,height,perspective=perspective)
 for study in studies:
  for density,t in [(32,.4),(144,1.57),(200,3.13)]:
   # Study controls set their own legal limits; these deliberately include a
   # wider density stress range without changing its discrete geometry rules.
   kw=dict(density=density,t=t,wave=1,depth=3,layers=4,variant=2,turns=3)
   r.cull=True;r.face_culling=True;r.torus=r.grid(r.base,r.U,r.V,2)
   a=np.asarray(r.render(study,**kw),dtype=float)
   r.cull=False;r.face_culling=False;r.torus=r.grid(r.base,r.U,r.V,2)
   b=np.asarray(r.render(study,**kw),dtype=float)
   diff=np.abs(a-b);mae=float(diff.mean());fraction=float((diff>4).mean());maximum=float(diff.max())
   item=dict(study=study,size=[width,height],perspective=perspective,density=density,t=t,mae=mae,pixels_gt4=fraction,maximum=maximum);rows.append(item)
   assert mae<.06 and fraction<.001,item
  print('PASS visibility',study,width,height,perspective,flush=True)
 if r.visibility_process:r.visibility_process.terminate()
 r.ctx.release()
Path('/tmp/torus-visibility-v20'+('-subset' if args.ids else '')+'.json').write_text(json.dumps(rows,indent=2));print('PASS',len(rows),'comparisons; maximum mean error',max(x['mae'] for x in rows),flush=True)
