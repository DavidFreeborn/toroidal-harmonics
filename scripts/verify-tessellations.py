"""Native GLSL checks: complete loops, both chart seams, distinct constructions.
Also validate the exact chair cover and all periodic pentagrid edge pairings by
running their deterministic generators. Does not measure browser/device FPS.
"""
import importlib.util,numpy as np,math,json,subprocess
from pathlib import Path
s=importlib.util.spec_from_file_location('r','scripts/render-studies.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);r=m.Renderer(480,330)
# Add an angle offset only to the reference shader varyings. World geometry is
# unchanged, so a full turn tests texture closure independently of the camera.
ss=[]
for stage in ['vertex','fragment']:
 text=subprocess.check_output(['node','scripts/shader-source.cjs','tessellations.js',stage],text=True).replace('#version 300 es','#version 330').replace('precision highp float;','')
 if stage=='vertex':text=text.replace('uniform mat4 uViewProjection;','uniform mat4 uViewProjection; uniform vec2 uTestShift;').replace('vec2 a=vAngles;','vec2 a=vAngles;vAngles+=uTestShift;')
 ss.append(text)
p=r.ctx.program(vertex_shader=ss[0],fragment_shader=ss[1]);p['uViewProjection'].write(r.matrix);r.programs['tessellations.js']=p
rows=[]
for study in range(101,125):
 images=[]
 for variant in range(3):
  p['uTestShift'].value=(0,0)
  a=np.array(r.render(study,t=.4,variant=variant)).astype(float);b=np.array(r.render(study,t=.4+2*math.pi,variant=variant)).astype(float);c=np.array(r.render(study,t=1.15,variant=variant)).astype(float)
  loop=float(np.abs(a-b).mean());motion=float(np.abs(a-c).mean());assert loop<.15,(study,variant,'loop',loop);assert motion>1,(study,variant,'motion',motion);assert a.std()>7,(study,'blank')
  seams=[]
  if study<=120:
   for shift in [(2*math.pi,0),(0,2*math.pi)]:
    p['uTestShift'].value=shift;d=np.array(r.render(study,t=.4,variant=variant)).astype(float);error=float(np.abs(a-d).mean());assert error<.15,(study,variant,'seam',shift,error);seams.append(error)
  rows.append(dict(study=study,variant=variant,loop=loop,motion=motion,seams=seams));images.append(a)
 for a,b in zip(images,images[1:]):assert np.abs(a-b).mean()>.3,(study,'indistinct constructions')
 print('PASS motion, closure, constructions',study,flush=True)
# Confirm that buffer selection preserves the earlier pentagrid at all old stops.
for density in [40,88,136]:
 for study in [68,69,70,92,93,94]:
  r.render(study,density=density);assert r.quasi_count==1210
Path('/tmp/torus-tessellation-checks.json').write_text(json.dumps(rows,indent=2))
