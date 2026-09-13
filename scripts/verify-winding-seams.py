"""Check animal tile closure at every density, including odd repeat counts."""
import importlib.util,subprocess,math,numpy as np,json
from pathlib import Path
s=importlib.util.spec_from_file_location('r','scripts/render-studies.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);r=m.Renderer(420,280,perspective=105)
ss=[]
for stage in ['vertex','fragment']:
 text=subprocess.check_output(['node','scripts/shader-source.cjs','transformations.js',stage],text=True).replace('#version 300 es','#version 330').replace('precision highp float;','')
 if stage=='vertex':text=text.replace('uniform mat4 uViewProjection;','uniform mat4 uViewProjection;uniform vec2 uTestShift;').replace('vec2 a=vAngles;','vec2 a=vAngles;vAngles+=uTestShift;')
 ss.append(text)
p=r.ctx.program(vertex_shader=ss[0],fragment_shader=ss[1]);p['uViewProjection'].write(r.matrix);r.programs['transformations.js']=p
rows=[]
for study in range(130,135):
 for density in [40,88,136]:
  for variant in range(3):
   p['uTestShift'].value=(0,0)
   base=np.asarray(r.render(study,density=density,variant=variant,ink=1,wave=1,textureMode=3,textureStrength=.27),dtype=float)
   errors=[]
   for shift in [(2*math.pi,0),(0,2*math.pi)]:
    p['uTestShift'].value=shift
    im=np.asarray(r.render(study,density=density,variant=variant,ink=1,wave=1,textureMode=3,textureStrength=.27),dtype=float)
    errors.append(float(abs(im-base).mean()))
   assert max(errors)<.15,(study,density,variant,errors)
   rows.append(dict(study=study,density=density,variant=variant,errors=errors))
 print('PASS all densities and constructions:',study,flush=True)
Path('/tmp/torus-winding-seams.json').write_text(json.dumps(rows,indent=2))
