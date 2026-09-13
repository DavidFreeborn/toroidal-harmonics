"""Capture actual GPU vertex outputs: rigid cube metrics and fast-path equivalence.
No image-space perspective assumptions; compares both shader implementations.
"""
import subprocess,json,re,math
from pathlib import Path
import moderngl,numpy as np
ROOT=Path(__file__).resolve().parents[1]
c=moderngl.create_standalone_context(backend='egl');c.simple_framebuffer((16,16)).use()
def source(file):return subprocess.check_output(['node',str(ROOT/'scripts/shader-source.cjs'),file,'vertex'],text=True).replace('#version 300 es','#version 330').replace('precision highp float;','')
def values(p,**kw):
 for k,v in kw.items():
  if k in p:p[k].value=v

def capture(p,content,count,instances=1,columns=3):
 vao=c.vertex_array(p,content,skip_errors=True);out=c.buffer(reserve=count*instances*columns*4);vao.transform(out,mode=moderngl.POINTS,vertices=count,instances=instances);c.finish();result=np.frombuffer(out.read(),dtype='f4').reshape(instances,count,columns).copy();vao.release();out.release();assert c.error=='GL_NO_ERROR';return result
p=c.program(vertex_shader=source('kinetic.js'),varyings=['vPosition'])
params=np.array([[x,y,f] for f in range(6) for x,y in [(0,0),(1,0),(1,1),(0,1)]],dtype='f4');vb=c.buffer(params.tobytes());ib=c.buffer(reserve=16)
checks=0;worst=0
for variant in range(5):
 for nx in [22,32,42]:
  ids=np.array([0,nx*5+2,nx*12+nx//2,nx*23-1],dtype='f4');ib.write(ids.tobytes())
  for t in [0,.4,1.57,3.13,2*math.pi]:
   values(p,uKind=0,uVariant=variant,uGrid=(nx,24),uTime=t,uWave=1,uTurns=3)
   pts=capture(p,[(vb,'3f','aParam'),(ib,'1f /i','aInstance')],24,4).reshape(4,6,4,3)
   edges=np.roll(pts,-1,axis=2)-pts;lengths=np.linalg.norm(edges,axis=3);unit=edges/lengths[:,:,:,None]
   relative=(lengths.max(axis=(1,2))-lengths.min(axis=(1,2)))/lengths.mean(axis=(1,2));orth=np.abs(np.sum(unit*np.roll(unit,1,axis=2),axis=3));planar=np.abs(np.sum((pts[:,:,3]-pts[:,:,0])*np.cross(unit[:,:,0],unit[:,:,1]),axis=2))/lengths.mean()
   err=max(relative.max(),orth.max(),planar.max());worst=max(worst,err);assert err<3e-5,(variant,nx,t,err);checks+=4
print('PASS',checks,'rolling cubes: equal edges, right angles and planar faces; maximum relative error',worst,flush=True)
# Compare original GLSL transforms with the CPU-instanced paths in the same
# production shader. Mesh ordering is cell, then generation, then face vertex.
def mesh(file,name,kind,depth):
 js="const fs=require('fs'),vm=require('vm'),c={};vm.runInNewContext(fs.readFileSync('dist/"+file+"','utf8')+';this.M="+name+"',c);console.log(JSON.stringify(c.M.meshData("+str(kind)+","+str(depth)+")))"
 return np.array(json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT))['vertices'],dtype='f4')
for file,name,kind,frames,stride,layout,attrs in [('mechanisms.js','TorusMechanisms',5,'cornerFrames',31,'3f 3f 2f 3f',['aPosition','aAnchor','aUV','aMeta'])]:
 p=c.program(vertex_shader=source(file),varyings=['vPosition','vMeta']);worst=0;countChecks=0
 for depth in [1,2,3]:
  data=mesh(file,name,kind,depth);small=data
  ncols=11;vb=c.buffer(data.tobytes());smallvb=c.buffer(small.tobytes());n=len(data)//ncols;ns=len(small)//ncols
  ids=[0,57,137];ib=c.buffer(np.array(ids,dtype='f4').tobytes())
  for variant in range(3):
   for t in [.4,3.13,6.1]:
    values(p,uFrames=0,uKind=kind,uVariant=variant,uGrid=(12,12),uTime=t,uWave=.93,uTurns=3)
    old=capture(p,[(vb,layout,*attrs),(ib,'1f /i','aInstance')],n,3,6)
    encoded=ids
    args=[encoded,len(encoded),12,12,t,.93,3,variant]
    js="const fs=require('fs'),vm=require('vm'),c={};vm.runInNewContext(fs.readFileSync('dist/performance.js','utf8')+';this.P=TorusPerformance',c);const a=new Float32Array("+str(len(encoded)*stride)+");c.P."+frames+"(..."+json.dumps(args)+",a);console.log(JSON.stringify(Array.from(a)))"
    frame=c.buffer(np.array(json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT)),dtype='f4').tobytes())
    content=(frame,'3f 3f 3f 3f 3f 3f 3f 3f 3f 4f /i','aOuter0','aOuter1','aOuter2','aFirst0','aFirst1','aFirst2','aSecond0','aSecond1','aSecond2','aCentre')
    values(p,uFrames=1);new=capture(p,[(smallvb,layout,*attrs),content],ns,len(encoded),6).reshape(old.shape)
    err=np.abs(new-old).max();worst=max(worst,err);assert err<3e-5,(file,depth,variant,t,err);countChecks+=new.shape[0]*new.shape[1];frame.release()
  vb.release();smallvb.release();ib.release()
 print('PASS',file,countChecks,'vertex/metadata comparisons; maximum absolute error',worst,flush=True)
