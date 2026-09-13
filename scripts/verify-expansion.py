"""Render all additional constructions and verify periodic motion and light modes."""
import importlib.util,numpy as np,math,json,subprocess
from pathlib import Path
s=importlib.util.spec_from_file_location('r','scripts/render-studies.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);r=m.Renderer(480,330)
rows=[]
for study in range(86,101):
 for variant in range(3):
  a=np.array(r.render(study,t=.4,variant=variant,layers=18 if study==95 else 3)).astype(float);b=np.array(r.render(study,t=.4+2*math.pi,variant=variant,layers=18 if study==95 else 3)).astype(float);c=np.array(r.render(study,t=1.15,variant=variant,layers=18 if study==95 else 3)).astype(float)
  loop=float(np.abs(a-b).mean());motion=float(np.abs(a-c).mean());assert loop<.15,(study,variant,'loop',loop);assert motion>1,(study,variant,'motion',motion);assert a.std()>7,(study,'blank');rows.append([study,variant,loop,motion])
 print('PASS motion and loop',study,flush=True)
# Existing studies with every new light mode.
for study in [21,53,47,49,51,13]:
 for light in range(1,7):
  a=np.array(r.render(study,t=.4,textureMode=light)).astype(float);b=np.array(r.render(study,t=.4+2*math.pi,textureMode=light)).astype(float)
  error=float(np.abs(a-b).mean());assert error<.15,(study,light,error)
 print('PASS light modes',study,flush=True)
Path('/tmp/torus-expansion14-checks.json').write_text(json.dumps(rows,indent=2))
if r.visibility_process:r.visibility_process.terminate()
