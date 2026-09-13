"""Exact four-chair substitution, stored as a tiny periodic cell atlas."""
from pathlib import Path
import json
R=[((1,0),(0,1)),((0,-1),(1,0)),((-1,0),(0,-1)),((0,1),(-1,0))]
def turn(p,r):return (R[r][0][0]*p[0]+R[r][0][1]*p[1],R[r][1][0]*p[0]+R[r][1][1]*p[1])
base=[(.5,.5),(1.5,.5),(.5,1.5)]
def occupied(t):
 x,y,r=t;return {(int(round(turn(p,r)[0]+x-.5)),int(round(turn(p,r)[1]+y-.5))) for p in base}
target={(x,y) for x in range(4) for y in range(4) if x<2 or y<2};candidates=[]
for r in range(4):
 for x in range(5):
  for y in range(5):
   t=(x,y,r);cells=occupied(t)
   if cells<=target:candidates.append((t,cells))
def cover(left,chosen=[]):
 if not left:return chosen
 p=min(left)
 for t,cells in candidates:
  if p in cells and cells<=left:
   result=cover(left-cells,chosen+[t])
   if result:return result
sub=cover(target);assert len(sub)==4
width,height=32,90;atlas=[0]*(width*height*4);tiles=[(0,0,0),(2,3,2)]
for depth in range(1,5):
 next_tiles=[]
 for x,y,r in tiles:
  for a,b,s in sub:
   dx,dy=turn((a,b),r);next_tiles.append((2*x+dx,2*y+dy,(r+s)%4))
 tiles=next_tiles;n=2**depth;row=3*(n-2);seen=set()
 for tag,tile in enumerate(tiles):
  for x,y in occupied(tile):
   assert 0<=x<2*n and 0<=y<3*n and (x,y) not in seen,(depth,x,y)
   seen.add((x,y));i=4*((row+y)*width+x);atlas[i:i+4]=[*tile,tag%4]
 assert len(seen)==6*n*n
 print('Depth',depth,':',len(tiles),'chairs;',len(seen),'cells covered exactly')
root=Path(__file__).resolve().parents[1]
(root/'dist/tessellation-data.js').write_text('/* Four-chair substitution; each atlas level covers a 2 × 3 period exactly. */\nconst TORUS_CHAIR='+json.dumps({'width':width,'height':height,'samples':atlas,'substitution':sub},separators=(',',':'))+';\n')
