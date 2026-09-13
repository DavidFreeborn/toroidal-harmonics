"""Bake distance and arclength coordinates of a rounded, closed Moore curve."""
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
from PIL import Image
root=Path(__file__).resolve().parents[1]
s='LFL+F+LFL';rules={'L':'-RF+LFL+FR-','R':'+LF-RFR-FL+'}
for _ in range(5):s=''.join(rules.get(c,c) for c in s)
p=[];x=y=0;direction=0
for c in s:
 if c=='F':
  p.append((x,y));dx,dy=[(1,0),(0,1),(-1,0),(0,-1)][direction];x+=dx;y+=dy
 elif c=='+':direction=(direction+1)%4
 elif c=='-':direction=(direction-1)%4
p.append((x,y));p=np.array(p,dtype=float)
assert len(p)==4096 and len(set(map(tuple,p)))==4096
assert np.linalg.norm(p[-1]-p[0])==1
p=(p-p.min(axis=0)+0.5)/64
# Chaikin subdivision gives a C1 limit; three refinements smooth the corners.
for _ in range(3):
 q=np.roll(p,-1,axis=0);p=np.stack((.75*p+.25*q,.25*p+.75*q),axis=1).reshape(-1,2)
q=np.roll(p,-1,axis=0);length=np.linalg.norm(q-p,axis=1);total=length.sum();arc=np.r_[0,np.cumsum(length)[:-1]]
base_p=p;base_q=q
p=np.concatenate([base_p+np.array([i,j]) for i in [-1,0,1] for j in [-1,0,1]])
q=np.concatenate([base_q+np.array([i,j]) for i in [-1,0,1] for j in [-1,0,1]])
arc=np.tile(arc,9);length=np.tile(length,9)
tree=cKDTree((p+q)*.5)
N=1536;out=np.empty((N,N,4),dtype=np.uint8)
for row in range(0,N,32):
 yy,xx=np.meshgrid((np.arange(row,min(row+32,N))+.5)/N,(np.arange(N)+.5)/N,indexing='ij')
 points=np.column_stack((xx.ravel(),yy.ravel()))
 _,ids=tree.query(points,k=4,workers=2)
 a=p[ids];d=q[ids]-a
 t=np.clip(np.sum((points[:,None,:]-a)*d,axis=2)/np.sum(d*d,axis=2),0,1)
 distance=np.linalg.norm(points[:,None,:]-a-t[:,:,None]*d,axis=2)
 k=np.argmin(distance,axis=1);ii=np.arange(len(points));ix=ids[ii,k]
 phase=(arc[ix]+t[ii,k]*length[ix])/total*2*np.pi
 colors=np.column_stack((np.minimum(distance[ii,k]/.025,1),.5+.5*np.cos(phase),.5+.5*np.sin(phase),np.ones(len(points))))
 out[row:row+len(yy)]=np.round(colors.reshape(len(yy),N,4)*255).astype('u1')
Image.fromarray(out).save(root/'dist/moore-field.png',optimize=True)
print('Moore curve:',len(base_p),'rounded segments; closed; periodic distance texture generated.')
