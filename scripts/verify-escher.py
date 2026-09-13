"""Check geometric coverage independently of the renderer's colour partition."""
from pathlib import Path
import importlib.util,json
import numpy as np
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('fields',ROOT/'scripts/build-escher-fields.py');F=importlib.util.module_from_spec(s);s.loader.exec_module(F)
templates={k:F.square_template(k) for k in ['bird','fish','moth']}
report=[]
for study in range(130,135):
    liz=study==132
    b=F.reptile() if liz else templates['bird' if study in [130,131] else 'moth']
    a=templates['fish'] if study in [131,134] else dict(b,poly=b['base'])
    period=1 if liz else 2;size=640;scale=size/period
    for g in np.linspace(0,1,9):
        poly=(1-g)*a['poly']+g*b['poly'];counts=np.zeros((size,size),dtype='u2');edges=Image.new('L',(size,size),0);ed=ImageDraw.Draw(edges)
        for j in range(-4,5):
          for i in range(-4,5):
            for o in range(3 if liz else 1):
              r=b['inv']@np.linalg.matrix_power(b['rot'],o)@b['lattice'] if liz else np.eye(2)
              p=(poly@r.T+[i,j])*scale
              if np.any(p.max(axis=0)<0) or np.any(p.min(axis=0)>size):continue
              im=Image.new('L',(size,size),0);d=ImageDraw.Draw(im);points=[tuple(v) for v in p];d.polygon(points,fill=1);counts+=np.array(im)
              ed.line(points+points[:1],fill=255,width=4,joint='curve')
        interior=np.array(edges)==0;bad=int(np.count_nonzero((counts!=1)&interior));ratio=bad/max(1,np.count_nonzero(interior))
        report.append(dict(study=study,form=float(g),uncovered_or_overlapping_interior_pixels=bad,fraction=ratio))
        assert ratio<.0001,(study,g,ratio)
print('PASS 45 geometric coverage checks; no uncovered or overlapping interior pixels')
Path('/tmp/escher-coverage.json').write_text(json.dumps(report,indent=2))
