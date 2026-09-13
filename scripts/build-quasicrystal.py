"""Periodic rational pentagrid approximants, constructed by de Bruijn duality."""
from pathlib import Path
from collections import Counter
import numpy as np,math,json

def build(vectors):
 N=np.array(vectors,float)
 E=np.array([[math.cos(2*math.pi*j/5),math.sin(2*math.pi*j/5)] for j in range(5)])
 gamma=np.array([math.sqrt(p)*.13 for p in [2,3,5,7,11]])
 period=E.T@N;inverse=np.linalg.inv(period);tiles=[];area=0
 for i in range(5):
  for j in range(i+1,5):
   pair=np.array([N[i],N[j]]);inv=np.linalg.inv(pair)
   ranges=[]
   for k in [i,j]:
    vals=[np.dot(N[k],corner)-gamma[k] for corner in [[0,0],[0,1],[1,0],[1,1]]]
    ranges.append(range(math.floor(min(vals))-1,math.ceil(max(vals))+2))
   for a in ranges[0]:
    for b in ranges[1]:
     x=inv@np.array([a+gamma[i],b+gamma[j]])
     if np.any(x<0) or np.any(x>=1):continue
     index=np.ceil(N@x-gamma-1e-8);index[i]=a;index[j]=b
     origin=inverse@(index@E);A=inverse@E[i];B=inverse@E[j];centre=origin+(A+B)/2
     origin-=np.floor(centre);centre-=np.floor(centre)
     family=i*5+j;tiles.extend([*origin,*A,*B,*centre,family])
     area+=abs(np.linalg.det(np.array([A,B])))
 assert abs(area-1)<1e-9,area
 # Every edge is shared twice and Euler characteristic is zero on the torus.
 edges=Counter();vertices=set()
 def key(p):return tuple(int(round(float(x%1)*1e7))%10000000 for x in p)
 for tile in np.array(tiles).reshape(-1,9):
  o,A,B=tile[:2],tile[2:4],tile[4:6];corners=[key(x) for x in [o,o+A,o+A+B,o+B]]
  vertices.update(corners)
  for a,b in zip(corners,corners[1:]+corners[:1]):edges[tuple(sorted([a,b]))]+=1
 assert set(edges.values())=={2}
 assert len(vertices)-len(edges)+len(tiles)//9==0
 result={'tiles':[round(float(x),8) for x in tiles],'count':len(tiles)//9,'area':round(area,12)}
 print('Built',result['count'],'rhombi; closed edges',len(edges),'area',area)
 return result

levels=[build(n) for n in [
 [[5,0],[2,5],[-4,3],[-4,-3],[2,-5]],
 [[8,0],[2,8],[-6,5],[-6,-5],[2,-8]],
 [[13,0],[4,12],[-10,7],[-10,-7],[4,-12]]]]
# Root fields remain identical for all pre-existing studies. The finest level
# reuses those fields rather than duplicating its payload.
result={**levels[2],'levels':levels[:2]}
out=Path(__file__).resolve().parents[1]/'dist/quasicrystal-data.js'
out.write_text('/* Rational pentagrid duals; each fundamental area = 1. */\nconst TORUS_QUASI='+json.dumps(result,separators=(',',':'))+';\n')
