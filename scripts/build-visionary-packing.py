"""Generate a finite Apollonian packing by the complex Descartes reflection.
The shader uses its 64 largest positive circles. No sampled textures are needed.
"""
from pathlib import Path
from math import sqrt,pi,cos,sin
r=sqrt(3)/(2+sqrt(3));b=1/r
initial=((-1.,0j),)+tuple((b,(1-r)*complex(cos(k*2*pi/3),sin(k*2*pi/3))) for k in range(3))
circles={}
def key(b,z):return (round(b,7),round(z.real,7),round(z.imag,7))
for b,z in initial:
 if b>0:circles[key(b,z)]=(b,z)
queue=[(initial,0)]
seen=set()
while queue:
 quad,depth=queue.pop()
 if depth>=6:continue
 for k in range(4):
  oldb,oldz=quad[k];others=[c for j,c in enumerate(quad) if j!=k]
  newb=2*sum(c[0] for c in others)-oldb
  if newb<=oldb+1e-7 or newb>160:continue
  newz=(2*sum(cb*cz for cb,cz in others)-oldb*oldz)/newb
  assert abs(newz)+1/newb<1+1e-7
  for cb,cz in others:
   expected=abs(1/newb+1/cb)
   assert abs(abs(newz-cz)-expected)<1e-7
  ck=key(newb,newz)
  if ck not in circles:circles[ck]=(newb,newz)
  qq=list(quad);qq[k]=(newb,newz)
  sig=tuple(sorted(key(cb,cz) for cb,cz in qq))
  if sig not in seen:seen.add(sig);queue.append((tuple(qq),depth+1))
chosen=sorted(circles.values(),key=lambda c:c[0])[:64]
for i,(cb,cz) in enumerate(chosen):
 for db,dz in chosen[i+1:]:assert abs(cz-dz)>=1/cb+1/db-1e-7
literal='const vec3 packing[64]=vec3[64](\n'+',\n'.join(f' vec3({z.real:.10f},{z.imag:.10f},{1/b:.10f})' for b,z in chosen)+'\n);'
path=Path(__file__).resolve().parents[1]/'dist/visionary.js'
s=path.read_text();start=s.index('// PACKING_START');end=s.index('// PACKING_END',start)
s=s[:start]+'// PACKING_START\n'+literal+'\n'+s[end:];path.write_text(s)
print(f'Generated {len(circles)} tangent circles, retained {len(chosen)}; all boundaries and pairwise disjoint interiors verified.')
