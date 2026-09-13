"""Time isolated geometry draws in Mesa EGL. Pass a checkout path as the first argument.
These measurements compare rendering work here, not browser FPS on another device.
"""
import importlib.util,sys,time,numpy as np
from pathlib import Path
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1];spec=importlib.util.spec_from_file_location('r',root/'scripts/render-studies.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);r=m.Renderer(900,620)
for study in [54,22,27,28,57,61]:
 r.render(study)
 if study>=54:v=r.meshes[('new',study-54,1 if study>=60 else 3,0)];instances=r.draw_counts[0][1] if hasattr(r,'draw_counts') else (4 if study==61 else 196)
 else:
  p=r.program('kinetic.js' if study==22 else 'sculptures.js');v=[value for key,value in r.meshes.items() if key[0]==p.glo][-1];instances=r.draw_counts[0][1] if hasattr(r,'draw_counts') else (2880 if study==22 else 1440 if study==27 else 144)
 times=[]
 for i in range(8):
  r.ms.use();r.ms.clear(1,1,1);r.torus.render();r.ctx.finish()
  start=time.perf_counter();v.render(instances=instances);r.ctx.finish()
  if i>2:times.append((time.perf_counter()-start)*1000)
 print(study,'mesh triangles',v.vertices//3,'instances',instances,'completed draw ms',round(float(np.median(times)),2),flush=True)
if hasattr(r,'visibility_process') and r.visibility_process:r.visibility_process.terminate()
