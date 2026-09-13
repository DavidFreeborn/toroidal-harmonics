"""Twelve verified Laplace-Beltrami eigenfunctions, in three scale families."""
import json
from pathlib import Path
import numpy as np
from scipy.linalg import eigh
N=512;R=3.;r=1.8;h=2*np.pi/N
v=np.arange(N)*h;A=R+r*np.cos(v);Ah=R+r*np.cos(v+h/2);M=np.diag(A)
banks=[[(1,2),(2,3),(3,2),(4,3)],[(1,6),(2,7),(3,6),(4,7)],[(2,10),(3,11),(4,10),(5,11)]]
cache={};metadata=[];samples=[]
for m in range(1,6):
 K=np.diag((Ah+np.roll(Ah,1))/(r*r*h*h)+m*m/A)
 for j in range(N):K[j,(j+1)%N]=K[(j+1)%N,j]=-Ah[j]/(r*r*h*h)
 values,vectors=eigh(K,M,subset_by_index=[0,11],driver='gvx');cache[m]=(K,values,vectors)
for bank in banks:
 fs=[];meta=[]
 for m,k in bank:
  K,values,vectors=cache[m];f=vectors[:,k].copy();f/=np.max(abs(f))
  if f[np.argmax(abs(f))]<0:f=-f
  residual=np.linalg.norm(K@f-values[k]*A*f)/np.linalg.norm(K@f);assert residual<1e-9
  fs.append(f);meta.append({'m':m,'k':k,'lambda':float(values[k]),'residual':float(residual)})
 samples.extend(np.column_stack(fs).round(8).ravel().tolist());metadata.append(meta)
data={'size':512,'banks':metadata,'samples':samples}
(Path(__file__).resolve().parents[1]/'dist/spectrum.js').write_text('const TORUS_SPECTRUM = '+json.dumps(data,separators=(',',':'))+';\n')
print('Generated 12 eigenfunctions; maximum discrete relative residual:',max(x['residual'] for bank in metadata for x in bank))
