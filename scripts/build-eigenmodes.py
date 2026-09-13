"""Generate a small periodic spectral table for the actual R=3, r=1.8 torus.
Conservative finite-volume discretization of the meridional eigenproblem.
This is an authoring tool; the static artwork has no Python dependency.
"""
import json
from pathlib import Path
import numpy as np
from scipy.linalg import eigh
N=512;R=3.;r=1.8;h=2*np.pi/N
v=np.arange(N)*h;A=R+r*np.cos(v);Ah=R+r*np.cos(v+h/2)
M=np.diag(A);modes=[];metadata=[]
for m,k in [(1,7),(2,8),(3,9),(4,10)]:
 K=np.diag((Ah+np.roll(Ah,1))/(r*r*h*h)+m*m/A)
 for j in range(N):
  K[j,(j+1)%N]=-Ah[j]/(r*r*h*h)
  K[(j+1)%N,j]=-Ah[j]/(r*r*h*h)
 eig,vec=eigh(K,M,subset_by_index=[0,12],driver='gvx')
 f=vec[:,k];f/=np.max(np.abs(f))
 if f[np.argmax(np.abs(f))]<0:f=-f
 residual=np.linalg.norm(K@f-eig[k]*(A*f))/np.linalg.norm(K@f)
 assert residual<1e-9
 modes.append(f);metadata.append({'m':m,'radial_index':k,'eigenvalue':float(eig[k]),'relative_residual':float(residual)})
root=Path(__file__).resolve().parents[1]
data={'size':N,'modes':metadata,'samples':np.column_stack(modes).round(7).ravel().tolist()}
(root/'dist/eigenmodes.js').write_text('const TORUS_EIGEN = '+json.dumps(data,separators=(',',':'))+';\n')
print(json.dumps(metadata,indent=2))
