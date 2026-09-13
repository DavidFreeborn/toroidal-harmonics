"""Build finite, periodic signed-distance volumes from paired vector contours.

The runtime interpolates distances and follows their zero contours, rather than
crossfading pictures. Geometry, coarse engraving and fine engraving are separate.
Only 49 sampled forms are needed; a single shared torus mesh renders all detail.
"""
from pathlib import Path
import importlib.util,json,math
import numpy as np
from PIL import Image,ImageDraw
from scipy.ndimage import distance_transform_edt
from scipy.interpolate import RBFInterpolator

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('templates',ROOT/'scripts/escher-templates.py')
T=importlib.util.module_from_spec(spec);spec.loader.exec_module(T)
SIZE=256;FRAMES=49;COLS=7;ROWS=7;BORDER=2;CELL=SIZE+2*BORDER
SUPER=4;PAD=24;DRAW=(SIZE+2*PAD)*SUPER
OUT=ROOT/'dist/escher';OUT.mkdir(exist_ok=True)
PROOF=Path('/tmp/torus-escher-proofs');PROOF.mkdir(exist_ok=True)

def resample(p,n=49):
    d=np.r_[0,np.cumsum(np.linalg.norm(np.diff(p,axis=0),axis=1))]
    t=np.linspace(0,d[-1],n)
    return np.stack([np.interp(t,d,p[:,i]) for i in range(2)],axis=1)

def square_template(name):
    poly,coarse,fine,dots=T.TEMPLATES[name]()
    corners=[np.argmin(np.linalg.norm(poly-c,axis=1)) for c in [[0,0],[1,0],[1,1],[0,1]]]
    poly=np.r_[poly,poly[:1]];corners.append(len(poly)-1)
    edges=[resample(poly[corners[k]:corners[k+1]+1]) for k in range(4)]
    # Enforce paired vertices after resampling. The opposite curves share data.
    edges[2]=(edges[0]+[0,1])[::-1];edges[3]=(edges[1]-[1,0])[::-1]
    poly=np.concatenate([e[:-1] for e in edges])
    base=np.concatenate([np.linspace(a,b,49)[:-1] for a,b in zip([[0,0],[1,0],[1,1],[0,1]],[[1,0],[1,1],[0,1],[0,0]])])
    return dict(poly=poly,base=base,coarse=coarse,fine=fine,dots=dots)

def reptile():
    data=json.loads((ROOT/'scripts/escher-lizard-source.json').read_text());lines=np.array(data['lines'])
    def chain(edges,start):
        p=[np.array(start)];edges=list(edges)
        while edges:
            candidates=[(np.linalg.norm(e[j]-p[-1]),i,j) for i,e in enumerate(edges) for j in [0,1]]
            d,i,j=min(candidates);e=edges.pop(i);p.append(e[1-j])
        return np.array(p)
    def rotate(a):return np.array([[math.cos(a),-math.sin(a)],[math.sin(a),math.cos(a)]])
    r=rotate(2*math.pi/3);a0=np.array([119.141,354.128]);a1=np.array([291.292,459.128]);a3=np.array([444.327,162.162]);a5=a1+rotate(-math.pi/3)@(a3-a1)
    a2=a1+r@(a0-a1);a4=a3+r@(a2-a3)
    verts=[a0,a1,a2,a3,a4,a5]
    masters=[chain(lines[:8],a0),chain(lines[16:28],a2),chain(lines[40:52],a4)]
    edges=[]
    for k,p in enumerate(masters):
        i=2*k;u=np.linspace(0,1,len(p))[:,None]
        p=p+(1-u)*(verts[i]-p[0])+u*(verts[i+1]-p[-1])
        # Rounded corners commute with rotations. Both sides use the same curve.
        for _ in range(2):
            p=np.vstack([p[:1],np.stack([.8*p[:-1]+.2*p[1:],.2*p[:-1]+.8*p[1:]],axis=1).reshape(-1,2),p[-1:]])
        p=resample(p,65);edges.extend([p,(p[::-1]-verts[i+1])@r.T+verts[i+1]])
    poly=np.concatenate([e[:-1] for e in edges]);base=np.concatenate([np.linspace(verts[k],verts[(k+1)%6],65)[:-1] for k in range(6)])
    lattice=np.stack([(np.eye(2)-r)@(a3-a1),(np.eye(2)-r)@(a5-a1)],axis=1)
    inv=np.linalg.inv(lattice)
    def chart(p):return (np.asarray(p)-a1)@inv.T
    coarse=[np.array(e) for e in lines[64:]]
    coarse+= [T.curve((172,320),((209,303),(248,265),(303,237))),T.curve((235,290),((286,263),(320,256),(367,260)))]
    fine=[]
    for j in range(4):
        for i in range(4):
            x=224+i*27+j*4;y=235+j*23-i*6
            fine.append(T.curve((x-8,y),((x-5,y-8),(x+5,y-8),(x+8,y))))
    return dict(poly=chart(poly),base=chart(base),coarse=[chart(p) for p in coarse],fine=[chart(p) for p in fine],dots=[('eye',chart([432,196]),.016)],rot=r,origin=a1,lattice=lattice,inv=inv)

def mapped_details(a,b):
    # A smooth displacement fitted to the exact paired contours keeps engraving
    # attached to the changing body. Clipping below enforces tile ownership.
    fit=RBFInterpolator(a['poly'],b['poly']-a['poly'],smoothing=1e-6,kernel='thin_plate_spline')
    def map_points(p):return p+fit(np.asarray(p))
    return dict(coarse=[map_points(p) for p in a['coarse']],fine=[map_points(p) for p in a['fine']],dots=[(k,map_points(np.asarray([p]))[0],r) for k,p,r in a['dots']])

def sdf(mask):
    if not mask.any():return np.full(mask.shape,-32.)
    if mask.all():return np.full(mask.shape,32.)
    return distance_transform_edt(mask)-distance_transform_edt(~mask)

def encode(distance):return np.uint8(np.clip(np.round(128+distance*7),0,255))

def build(study,A,B,lizard=False):
    period=1 if lizard else 2
    scale=SIZE*SUPER/period; offset=PAD*SUPER; lo=PAD*SUPER; hi=(PAD+SIZE)*SUPER
    source_map=mapped_details(A,B);target_map=mapped_details(B,A)
    atlas=Image.new('RGB',(2*COLS*CELL,ROWS*CELL));samples=[];coverage=[]
    for frame in range(FRAMES):
        g=frame/(FRAMES-1);poly=A['poly']*(1-g)+B['poly']*g
        if A['coarse']:
            # Morph corresponding anatomical strokes directly. An eye travels
            # into its new position; it is never a crossfade of two eyes.
            anatomy={};correspondence=([0,1,2,3,4,2] if study==131 else [0,1,2,3,4,4])
            for key in ['coarse','fine']:
                paths=[];amount=max(len(A[key]),len(B[key]))
                for k in range(amount):
                    ia=correspondence[k%len(correspondence)] if key=='coarse' else min(k,len(A[key])-1)
                    ib=min(k,len(B[key])-1)
                    pa=resample(A[key][ia],33);pb=resample(B[key][ib],33)
                    paths.append(pa*(1-g)+pb*g)
                anatomy[key]=paths
            anatomy['dots']=[]
            for k in range(max(len(A['dots']),len(B['dots']))):
                _,pa,ra=A['dots'][min(k,len(A['dots'])-1)];_,pb,rb=B['dots'][min(k,len(B['dots'])-1)]
                anatomy['dots'].append(('eye',np.asarray(pa)*(1-g)+np.asarray(pb)*g,ra*(1-g)+rb*g))
            if g==0:anatomy=A
            if g==1:anatomy=B
            drawings=[(anatomy,anatomy,1.,0.)]
        else:
            drawings=[(B,target_map,g,1-g)]
        labels=Image.new('L',(DRAW,DRAW),2 if lizard else 0)
        masks=[Image.new('L',labels.size,0) for _ in range(2)]
        engr=[Image.new('L',labels.size,0),Image.new('L',labels.size,0)]
        # Work over a 3x3 periodic cover; crop the centre only after measuring.
        for j in range(-5,6):
          for i in range(-5,6):
            for orient in range(3 if lizard else 1):
              r=np.eye(2) if not lizard else B['inv']@np.linalg.matrix_power(B['rot'],orient)@B['lattice']
              o=np.array([i,j]);p=poly@r.T+o
              if np.any(p.max(axis=0)<-PAD*period/SIZE) or np.any(p.min(axis=0)>period+PAD*period/SIZE):continue
              colour=orient if lizard else (i+j)%2
              pts=p*scale+offset
              tile=Image.new('L',labels.size,0);td=ImageDraw.Draw(tile);td.polygon([tuple(x) for x in pts],fill=255)
              labels.paste(colour,mask=tile)
              for k in range(2):masks[k].paste(255 if colour==k else 0,mask=tile)
              for endpoint,other,weight,travel in drawings:
                if weight<.001:continue
                # For a geometric starting cell, only the target has anatomy.
                for level,key in enumerate(['coarse','fine']):
                  strokes=Image.new('L',labels.size,0);d=ImageDraw.Draw(strokes)
                  for pa,pb in zip(endpoint[key],other[key]):
                    path=(pa*(1-travel)+pb*travel)@r.T+o
                    # Width grows from zero, so intermediate strokes are born
                    # geometrically rather than as ghosted outlines.
                    width=max(1,round(scale*(.010 if level==0 else .006)*weight))
                    d.line([tuple(x) for x in path*scale+offset],fill=255,width=width,joint='curve')
                  if level==0:
                    for (kind,pa,rad),(_,pb,_) in zip(endpoint['dots'],other['dots']):
                      x,y=((np.asarray(pa)*(1-travel)+np.asarray(pb)*travel)@r.T+o)*scale+offset;rr=rad*scale*weight
                      d.ellipse((x-rr,y-rr,x+rr,y+rr),fill=255)
                  a=np.array(strokes);a[np.array(tile)==0]=0
                  engr[level]=Image.fromarray(np.maximum(np.array(engr[level]),a))
        lab=np.array(labels);fields=[]
        def down(field):
            field=field[lo:hi,lo:hi]/SUPER
            return field.reshape(SIZE,SUPER,SIZE,SUPER).mean(axis=(1,3))
        for k in range(2):fields.append(encode(down(sdf(lab==k))))
        for e in engr:fields.append(encode(down(sdf(np.array(e)>0))))
        field=np.stack(fields,axis=-1);padded=np.pad(field,((BORDER,BORDER),(BORDER,BORDER),(0,0)),mode='wrap')
        atlas.paste(Image.fromarray(padded[:,:,:3]),((frame%COLS)*CELL,(frame//COLS)*CELL))
        fine=np.repeat(padded[:,:,3:4],3,axis=2);atlas.paste(Image.fromarray(fine),(COLS*CELL+(frame%COLS)*CELL,(frame//COLS)*CELL))
        if frame in [0,12,24,36,48]:
          pal=np.array([25,246,130] if lizard else [25,246]);image=pal[lab[lo:hi:SUPER,lo:hi:SUPER]]
          mask=(fields[2]>128)|(fields[3]>128);image=np.where(mask,255-image,image)
          samples.append(Image.fromarray(np.uint8(image)).convert('RGB'))
        if frame%12==0:print(study,frame,flush=True)
    atlas.save(OUT/f'{study}.png',optimize=True)
    sheet=Image.new('RGB',(SIZE*len(samples),SIZE),'white')
    for i,im in enumerate(samples):sheet.paste(im,(i*SIZE,0))
    sheet.save(PROOF/f'{study}-stages.png')

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--ids',default='130,131,132,133,134');args=parser.parse_args()
    templates={k:square_template(k) for k in ['bird','fish','moth']}
    for study in map(int,args.ids.split(',')):
      if study==132:
        b=reptile();a=dict(b,poly=b['base'],coarse=[],fine=[],dots=[])
      else:
        b=templates['bird' if study in [130,131] else 'moth']
        a=templates['fish'] if study in [131,134] else dict(b,poly=b['base'],coarse=[],fine=[],dots=[])
      build(study,a,b,study==132)
