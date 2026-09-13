"""Compare layered contour sampling with the previous full-resolution atlas.
The reference sampler is reconstructed by reversing only the storage mapping.
"""
import importlib.util,subprocess,numpy as np,json
from pathlib import Path
from PIL import Image
s=importlib.util.spec_from_file_location('r',Path(__file__).with_name('render-studies.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m);r=m.Renderer(560,380,perspective=105)
new=r.program('transformations.js');src=[]
for stage in ['vertex','fragment']:
 code=subprocess.check_output(['node','scripts/shader-source.cjs','transformations.js',stage],text=True).replace('#version 300 es','#version 330').replace('precision highp float;','')
 if stage=='fragment':code=code.replace('uniform highp sampler2DArray uCreature;','uniform sampler2D uCreature;').replace('/vec2(1820.0);','/vec2(3640.0,1820.0);').replace('texture(uCreature,vec3(at,0)).rgb,texture(uCreature,vec3(at,1)).r','texture(uCreature,at).rgb,texture(uCreature,at+vec2(.5,0)).r')
 src.append(code)
old=r.ctx.program(vertex_shader=src[0],fragment_shader=src[1]);old['uViewProjection'].write(r.matrix);rows=[]
for study in range(130,135):
 r.programs['transformations.js']=new;r.render(study);array=r.meshes[('creature',study)]
 im=Image.open(m.ROOT/'dist/escher'/f'{study}.png').convert('RGB');atlas=r.ctx.texture(im.size,3,im.tobytes());atlas.filter=(m.moderngl.LINEAR,m.moderngl.LINEAR);atlas.repeat_x=atlas.repeat_y=False
 # Prove the packing itself retains every texel, not just rendered examples.
 pixels=np.array(im);half=pixels.shape[1]//2;packed=np.frombuffer(array.read(),dtype='u1').reshape(2,pixels.shape[0],half,3);assert np.array_equal(np.concatenate([packed[0],packed[1]],axis=1),pixels)
 for variant in range(3):
  for phase in [0,1/48,.12,.5,.79,47/48,1]:
   kwargs=dict(variant=variant,winding=3,balance=phase,textureMode=0)
   r.programs['transformations.js']=old;r.meshes[('creature',study)]=atlas;a=np.asarray(r.render(study,**kwargs),dtype=float)
   r.programs['transformations.js']=new;r.meshes[('creature',study)]=array;b=np.asarray(r.render(study,**kwargs),dtype=float)
   d=abs(a-b);item=dict(study=study,variant=variant,stage=phase,mae=float(d.mean()),maximum=float(d.max()),pixels_gt4=float((d>4).mean()));rows.append(item);assert item['mae']<.005 and item['pixels_gt4']<.0001,item
 print('PASS full texel retention and 21 rendered comparisons',study,flush=True)
Path('/tmp/torus-atlas-layout-v20.json').write_text(json.dumps(rows,indent=2));print('Maximum mean difference',max(x['mae'] for x in rows))
