"""Deterministic reference renders of the site shaders, separate from browser UI tests."""
from pathlib import Path
import re,math,json,subprocess,sys,os,importlib.util
import moderngl,numpy as np
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=Path('/tmp/toroidal-renders')
def jsround(value):return math.floor(value+.5)
class Renderer:
 def __init__(self,w=1100,h=760,cull=True,perspective=76):
  self.w,self.h=w,h;self.cull=cull;self.visibility_process=None;self.draw_counts=[];self.face_culling=True;self.gles=os.environ.get('TORUS_RENDER_API')=='gles'
  if self.gles:
   spec=importlib.util.spec_from_file_location('torus_gles',Path(__file__).with_name('gles-context.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);self.ctx=module.create_context()
  else:self.ctx=moderngl.create_standalone_context(backend='egl')
  self.ctx.enable(moderngl.DEPTH_TEST)
  self.fb=self.ctx.simple_framebuffer((w,h),components=3);self.ms=self.ctx.simple_framebuffer((w,h),components=3,samples=4)
  f=min(1,w/h)/math.tan(math.radians(perspective)/2);near=.04;far=20
  view=np.array([[0,0,-1,0],[0,1,0,0],[1,0,0,-3.65],[0,0,0,1]],dtype='f4');proj=np.array([[f/(w/h),0,0,0],[0,f,0,0],[0,0,(far+near)/(near-far),2*far*near/(near-far)],[0,0,-1,0]],dtype='f4')
  self.matrix=(proj@view).T.copy().tobytes();self.programs={};self.meshes={}
  self.instance_buffer=self.ctx.buffer(np.arange(16384,dtype='f4').tobytes());self.frame_buffer=self.ctx.buffer(reserve=8192*31*4)
  source=(ROOT/'dist/artwork.js').read_text();self.U,self.V=map(int,re.search(r'const U=(\d+),V=(\d+)',source).groups())
  js="const fs=require('fs'),vm=require('vm'),c={};vm.runInNewContext(fs.readFileSync('dist/performance.js','utf8')+';this.P=TorusPerformance',c);console.log(JSON.stringify(Array.from(c.P.surfaceMesh("+str(self.U)+","+str(self.V)+").indices("+json.dumps(list(np.frombuffer(self.matrix,dtype='f4').astype(float)))+"))))"
  self.visible_surface=json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT))
  self.base=self.program('artwork.js');self.torus=self.grid(self.base,self.U,self.V,2)
  for fn,n in [('eigenmodes.js',1),('spectrum.js',3)]:
   data=json.loads((ROOT/'dist'/fn).read_text().split('=',1)[1].strip().rstrip(';'));tex=self.ctx.texture((512,n),4,data=np.array(data['samples'],dtype='f4').tobytes(),dtype='f4');tex.filter=(moderngl.NEAREST,moderngl.NEAREST);tex.use(0 if n==1 else 2)
   if n==1:self.eigen=tex
   else:self.spectrum=tex
  im=Image.open(ROOT/'dist/moore-field.png').convert('RGBA');tex=self.ctx.texture(im.size,4,im.tobytes());tex.filter=(moderngl.LINEAR,moderngl.LINEAR);tex.use(1);self.moore=tex
  data=json.loads((ROOT/'dist/tessellation-data.js').read_text().split('const TORUS_CHAIR=',1)[1].rstrip(';\n'));self.chair=self.ctx.texture((data['width'],data['height']),4,data=np.array(data['samples'],dtype='f4').tobytes(),dtype='f4');self.chair.filter=(moderngl.NEAREST,moderngl.NEAREST);self.chair.use(3)
 def program(self,file):
  if file in self.programs:return self.programs[file]
  src=(ROOT/'dist'/file).read_text();ss=[]
  for stage in ['vertex','fragment']:
   s=subprocess.check_output(['node',str(ROOT/'scripts/shader-source.cjs'),file,stage],text=True)
   if not self.gles:s=s.replace('#version 300 es','#version 330').replace('precision highp float;','')
   ss.append(s)
  p=self.ctx.program(vertex_shader=ss[0],fragment_shader=ss[1]);p['uViewProjection'].write(self.matrix);self.programs[file]=p;return p
 def uniforms(self,p,values):
  for key,val in values.items():
   if key in p:p[key].value=val
 def grid(self,p,nx,ny,d=3,faces=1,xscale=1):
  surface=d==2 and nx==self.U and ny==self.V
  key=(p.glo,nx,ny,d,faces,xscale,self.cull if surface else False)
  if key in self.meshes:return self.meshes[key]
  verts=[];inds=[]
  for face in range(faces):
   o=len(verts);verts.extend([[i/nx*xscale,j/ny]+([face] if d==3 else []) for i in range(nx+1) for j in range(ny+1)])
   for i in range(nx):
    for j in range(ny):
     k=o+i*(ny+1)+j;inds.extend([k,k+ny+1,k+1,k+1,k+ny+1,k+ny+2] if faces==6 and face in [0,3,4] else [k,k+1,k+ny+1,k+1,k+ny+2,k+ny+1])
  if surface and self.cull:inds=self.visible_surface
  content=[(self.ctx.buffer(np.array(verts,dtype='f4').tobytes()),f'{d}f','aUV' if d==2 else 'aParam')]
  if 'aInstance' in p:content.append((self.instance_buffer,'1f /i','aInstance'))
  v=self.ctx.vertex_array(p,content,self.ctx.buffer(np.array(inds,dtype='u4').tobytes()));self.meshes[key]=v;return v
 def newmesh(self,p,kind,depth,variant=0):
  key=('new',kind,depth,variant if kind in [0,5] else 0)
  if key in self.meshes:return self.meshes[key]
  script="const fs=require('fs'),vm=require('vm'),c={};vm.runInNewContext(fs.readFileSync('dist/chiaroscuro.js','utf8')+';this.M=TorusChiaroscuro',c);process.stdout.write(JSON.stringify(c.M.meshData("+str(kind)+","+str(depth)+","+str(variant)+")))"
  data=json.loads(subprocess.check_output(['node','-e',script],cwd=ROOT))
  buf=self.ctx.buffer(np.array(data['vertices'],dtype='f4').tobytes());idx=self.ctx.buffer(np.array(data['indices'],dtype='u4').tobytes())
  v=self.ctx.vertex_array(p,[(buf,'3f 3f 2f 3f 3f','aPosition','aNormal','aUV','aAnchor','aMeta'),(self.instance_buffer,'1f /i','aInstance'),(self.frame_buffer,'3f 3f 3f 4f /i','aTurn0','aTurn1','aTurn2','aCell')],idx);self.meshes[key]=v;return v
 def mechanism_mesh(self,p,kind,depth):
  key=('mechanisms',kind,depth)
  if key in self.meshes:return self.meshes[key]
  script="const fs=require('fs'),vm=require('vm'),c={};vm.runInNewContext(fs.readFileSync('dist/mechanisms.js','utf8')+';this.M=TorusMechanisms',c);console.log(JSON.stringify(c.M.meshData("+str(kind)+","+str(depth)+")))"
  data=json.loads(subprocess.check_output(['node','-e',script],cwd=ROOT))
  v=self.ctx.vertex_array(p,[(self.ctx.buffer(np.array(data['vertices'],dtype='f4').tobytes()),'3f 3f 2f 3f','aPosition','aAnchor','aUV','aMeta'),(self.instance_buffer,'1f /i','aInstance'),(self.frame_buffer,'3f 3f 3f 3f 3f 3f 3f 3f 3f 4f /i','aOuter0','aOuter1','aOuter2','aFirst0','aFirst1','aFirst2','aSecond0','aSecond1','aSecond2','aCentre')],self.ctx.buffer(np.array(data['indices'],dtype='u4').tobytes()));self.meshes[key]=v;return v
 def quasimesh(self,p,level=2):
  key=('quasi',p.glo,level)
  if key in self.meshes:self.quasi_count=self.quasi_counts[level];return self.meshes[key]
  data=json.loads((ROOT/'dist/quasicrystal-data.js').read_text().split('const TORUS_QUASI=',1)[1].rstrip(';\n'))
  if level<2:data=data['levels'][level]
  self.quasi_count=data['count']
  if not hasattr(self,'quasi_counts'):self.quasi_counts={}
  self.quasi_counts[level]=self.quasi_count
  vertices=[[i/4,j/4] for i in range(5) for j in range(5)];indices=[]
  for i in range(4):
   for j in range(4):
    n=i*5+j;indices.extend([n,n+1,n+5,n+1,n+6,n+5])
  v=self.ctx.vertex_array(p,[(self.ctx.buffer(np.array(vertices,dtype='f4').tobytes()),'2f','aUV'),(self.ctx.buffer(np.array(data['tiles'],dtype='f4').tobytes()),'2f 2f 2f 3f /i','aOrigin','aEdgeA','aEdgeB','aTile')],self.ctx.buffer(np.array(indices,dtype='u4').tobytes()));self.meshes[key]=v;return v
 def instance_count(self,nx,ny,parts,t,pad,options=None):
  if (not self.cull or not pad) and options is None:
   self.instance_buffer.write(np.arange(nx*ny*parts,dtype='f4').tobytes());return nx*ny*parts
  if self.visibility_process is None:
   self.visibility_process=subprocess.Popen(['node',str(ROOT/'scripts/visibility-service.cjs')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True)
  result=self.service([list(np.frombuffer(self.matrix,dtype='f4').astype(float)),nx,ny,parts,t,pad if self.cull else 0,options]);ids=result['ids']
  if ids:self.instance_buffer.write(np.array(ids,dtype='f4').tobytes())
  if 'frames' in result and result['frames']:self.frame_buffer.write(np.array(result['frames'],dtype='f4').tobytes())
  return len(ids)
 def service(self,args):
  if self.visibility_process is None:self.visibility_process=subprocess.Popen(['node',str(ROOT/'scripts/visibility-service.cjs')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True)
  proc=self.visibility_process;proc.stdin.write(json.dumps(args)+'\n');proc.stdin.flush();return json.loads(proc.stdout.readline())
 def draw_solid(self,vao,count,closed):
  if closed and self.face_culling:self.ctx.enable(moderngl.CULL_FACE)
  vao.render(instances=count)
  self.ctx.disable(moderngl.CULL_FACE)
 def render(self,study,t=.4,variant=0,ink=.86,palette=0,depth=3,turns=1,density=88,wave=.65,winding=2,layers=3,balance=.5,spectral=1,textureMode=1,textureStrength=.65,textureScale=2,inkCycle=0):
  self.draw_counts=[];self.ms.use()
  if self.gles:self.ctx.extra.clear(self.ms)
  else:self.ms.clear(1,1,1)
  self.eigen.use(0);self.moore.use(1);self.spectrum.use(2);self.chair.use(3)
  common=dict(uTextureMode=textureMode,uTextureStrength=textureStrength,uTextureScale=textureScale,uTime=t,uWave=wave,uDensity=density,uInk=ink,uContrastCycle=inkCycle,uPalette=palette,uVariant=variant,uTurns=turns,uWinding=winding,uLayers=layers,uBalance=balance,uSpectral=spectral,uChair=3,uSpectrum=2,uEigen=0,uMoore=1,uCamera=(3.65,0,0))
  self.uniforms(self.base,dict(common,uPattern=21))
  if 21<=study<=25 or study in [27,28] or 54<=study<=67 or study==70 or 86<=study<=94:self.torus.render()
  if 125<=study<=140:
   p=self.program('transformations.js');v=self.grid(p,self.U,self.V,2)
   ready=130<=study<=134 and (ROOT/'dist/escher'/f'{study}.png').exists()
   if ready:
    key=('creature',study)
    if key not in self.meshes:
     im=np.array(Image.open(ROOT/'dist/escher'/f'{study}.png').convert('RGB'));half=im.shape[1]//2;tex=self.ctx.texture_array((half,im.shape[0],2),3,np.concatenate([im[:,:half],im[:,half:]],axis=0).tobytes());tex.filter=(moderngl.LINEAR,moderngl.LINEAR);tex.repeat_x=tex.repeat_y=False;self.meshes[key]=tex
    self.meshes[key].use(4)
   self.uniforms(p,dict(common,uKind=study-125,uCreature=4,uCreatureReady=int(ready)));v.render()
  elif study>=141:
   p=self.program('quasicrystal.js');v=self.quasimesh(p,min(2,max(0,math.floor(density/48)-1)));self.uniforms(p,dict(common,uKind=study-131));v.render(instances=self.quasi_count)
  elif 101<=study<=120:
   p=self.program('tessellations.js');v=self.grid(p,self.U,self.V,2);self.uniforms(p,dict(common,uKind=study-101));v.render()
  elif study>=121:
   p=self.program('quasicrystal.js');v=self.quasimesh(p,min(2,max(0,math.floor(density/48)-(1 if study>=123 else 0))));self.uniforms(p,dict(common,uKind=study-115));v.render(instances=self.quasi_count)
  elif study>=95 or 71<=study<=85:
   p=self.program('metamorphosis.js');v=self.grid(p,self.U,self.V,2);self.uniforms(p,dict(common,uKind=study-80 if study>=95 else study-71));v.render()
  elif study>=92 or 68<=study<=70:
   p=self.program('quasicrystal.js');v=self.quasimesh(p);self.uniforms(p,dict(common,uKind=study-89 if study>=92 else study-68));v.render(instances=self.quasi_count)
  elif study>=86 or 62<=study<=67:
   p=self.program('mechanisms.js');kind=study-80 if study>=86 else study-62;v=self.mechanism_mesh(p,kind,depth);nx=ny=2*jsround((10+density*.045)/2);self.uniforms(p,dict(common,uKind=kind,uGrid=(nx,ny),uFrames=int(kind==5)));count=self.instance_count(nx,ny,1,t,1.5,dict(corner=True,wave=wave,turns=turns,variant=variant) if kind==5 else None);self.draw_counts.append((v.vertices//3,count));self.draw_solid(v,count,kind==5)
  elif study>=54:
   p=self.program('chiaroscuro.js');kind=study-54;n=2*math.floor((10+density*.045)/2+.5);nx=ny=n
   if kind==6:nx=2*math.floor((3+density*.025)/2+.5);ny=1
   if kind==7:
    nx=1 if winding==0 else max(2,jsround(2+density*.022));ny=1
    if winding==2 and nx%3==0:nx+=1
   v=self.newmesh(p,kind,1 if kind>=6 else depth,variant);self.uniforms(p,dict(common,uGrid=(nx,ny),uKind=kind));count=self.instance_count(nx,ny,1,t,1 if kind<6 else 0,dict(wave=wave,turns=turns,variant=variant) if kind==0 else None);self.draw_counts.append((v.vertices//3,count));self.draw_solid(v,count,kind<=2 or kind==7)
  elif 21<=study<=25:
   p=self.program('kinetic.js');kind=study-21
   specs=json.loads(re.search(r'const specs=(\[.*?\]);',(ROOT/'dist/kinetic.js').read_text()).group(1));spec=specs[kind];gx,gy=spec[:2];faces=spec[2] if len(spec)>2 else 1;v=self.grid(p,gx,gy,3,faces)
   even=lambda x:math.floor(x/2+.5)*2
   nx,ny,parts=even(18+density*.12),24,1
   if kind==1:nx,ny,parts=even(16+density*.09),20,6
   if kind==2:nx,ny,parts=jsround(3+density*.04),1,3;nx+=int(nx%3==0)
   if kind==3:nx,ny,parts=even(16+density*.07),18,3
   if kind==4:nx,ny,parts=even(18+density*.1),22,1
   self.uniforms(p,dict(common,uGrid=(nx,ny),uKind=kind));count=self.instance_count(nx,ny,parts,t,0 if (study==23 or study==28) else .8);self.draw_counts.append((v.vertices//3,count));self.draw_solid(v,count,kind in [0,2])
  elif study in [27,28]:
   p=self.program('sculptures.js');kind=study-27;segments=3*(2*jsround((6+density*.025)/2));v=self.grid(p,2*(16+4*variant) if kind==0 else segments,2 if kind==0 else 1,xscale=1 if kind==0 else segments)
   nx=2*jsround((14+density*.045)/2) if kind==0 else 2*jsround((6+density*.025)/2);ny=16 if kind==0 else 1;parts=5 if kind==0 else 18
   self.uniforms(p,dict(common,uGrid=(nx,ny),uKind=kind,uChunked=int(kind==1)))
   if kind==1 and not self.cull:count=self.instance_count(nx,1,18*64,t,0)
   else:count=self.instance_count(nx,ny,parts,t,.8 if kind==0 else 0,dict(jacquard=True) if kind==1 else None)
   self.draw_counts.append((v.vertices//3,count));v.render(instances=count)
  elif study in [8,11,12,20,26]:self.uniforms(self.base,dict(common,uPattern=study));self.torus.render()
  elif study in [32,33]:
   p=self.program('symmetry.js');v=self.grid(p,self.U,self.V,2);self.uniforms(p,dict(common,uKind=study-30));v.render()
  else:
   p=self.program('topology.js');v=self.grid(p,self.U,self.V,2);self.uniforms(p,dict(common,uKind=study));v.render()
  self.ctx.finish();
  if self.gles:
   self.ctx.extra.resolve(self.fb,self.ms,self.w,self.h);data=self.ctx.extra.read(self.fb,self.w,self.h)
   assert self.ctx.error=='GL_NO_ERROR'
   return Image.frombytes('RGBA',(self.w,self.h),data).convert('RGB').transpose(Image.Transpose.FLIP_TOP_BOTTOM)
  self.ctx.copy_framebuffer(self.fb,self.ms)
  assert self.ctx.error=='GL_NO_ERROR'
  return Image.frombytes('RGB',(self.w,self.h),self.fb.read(components=3)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
if __name__=='__main__':
 import argparse
 from PIL import ImageOps
 parser=argparse.ArgumentParser(description='Render the actual shaders and meshes with Mesa EGL. Requires moderngl, NumPy, Pillow and Node.')
 parser.add_argument('--output',type=Path,default=OUT)
 parser.add_argument('--thumbnails',action='store_true',help='Regenerate visible study WebP assets in dist/studies')
 parser.add_argument('--portrait',action='store_true')
 args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
 r=Renderer(420,800,perspective=105) if args.portrait else Renderer(perspective=105)
 catalogue=json.loads(subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),c={};for(const f of ['presets.js','collection.js'])vm.runInNewContext(fs.readFileSync('dist/'+f,'utf8'),c);vm.runInNewContext('this.x=TORUS_COLLECTION.flatMap(g=>g.studies.map(s=>[s[0],TorusPresets.get(s[0])]))',c);console.log(JSON.stringify(c.x))"],cwd=ROOT))
 for study,defaults in catalogue:
  kwargs={dict(recursion='depth',variation='variant').get(k,k):v for k,v in defaults.items() if k not in ['speed','perspective']}
  im=r.render(study,**kwargs);im.save(args.output/f'{study}.png')
  if args.thumbnails:ImageOps.fit(im,(400,280),method=Image.Resampling.LANCZOS).save(ROOT/'dist/studies'/f'{study}.webp',quality=92,method=6)
  print('Rendered',study,flush=True)
 if r.visibility_process:r.visibility_process.terminate()
