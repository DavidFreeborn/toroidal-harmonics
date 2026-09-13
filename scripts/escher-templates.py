"""Paired vector contours for the Escher transformations.

Coordinates use a square chart, with its vertical coordinate increasing downwards. Opposite edges are generated
by translation, never separately drawn. The swan construction is informed by
Escher's study 128; the winged construction by his study 38. These are newly
drawn cubic contours and engravings, not raster copies of the notebook pages.
"""
import numpy as np

def curve(start, *segments, samples=8):
    out=[np.array(start,dtype=float)]
    for c1,c2,end in segments:
        a=out[-1].copy();b,c,d=map(lambda x:np.array(x,dtype=float),(c1,c2,end))
        for t in np.linspace(0,1,samples+1)[1:]:
            out.append((1-t)**3*a+3*t*(1-t)**2*b+3*t*t*(1-t)*c+t**3*d)
    return np.array(out)

def outline(top,right):
    # Screen coordinates are convenient for drawing; convert only on export.
    return np.concatenate([top[:-1],right[:-1],(top+ [0,1])[::-1][:-1],(right- [1,0])[::-1][:-1]])

def bird():
    top=curve((0,0),
      ((.15,.19),(.24,.48),(.24,.72)),
      ((.37,.65),(.48,.67),(.60,.78)),
      ((.61,.65),(.37,.61),(.37,.45)),
      ((.32,.25),(.39,.20),(.52,.20)),
      ((.75,.18),(.90,.12),(1,0)))
    right=curve((1,0),
      ((.99,.16),(.85,.30),(.64,.43)),
      ((.87,.48),(1.02,.64),(1.02,.81)),
      ((1.03,.89),(1.02,.95),(1,1)))
    paths=[curve((.08,.99),((.33,.98),(.68,.93),(.74,.78)),((.80,.61),(.94,.84),(.77,.96))),
      curve((.45,.24),((.52,.22),(.63,.23),(.59,.29)),((.55,.34),(.47,.33),(.45,.24))),
      curve((.63,.25),((.65,.29),(.67,.30),(.68,.33))),
      curve((.27,1.14),((.35,1.32),(.36,1.50),(.37,1.66))),
      curve((.43,1.70),((.48,1.72),(.53,1.76),(.58,1.77)))]
    fine=[]
    for k in range(5):
      fine.append(curve((.12+.105*k,1.015-.020*k),((.31+.08*k,1.02-.02*k),(.52+.055*k,.96-.02*k),(.61+.04*k,.87-.018*k))))
      fine.append(curve((-.048*k,.09+.072*k),((.13-.025*k,.29+.04*k),(.21-.022*k,.47+.035*k),(.21-.018*k,.70+.025*k))))
    paths.append(curve((.68,.32),((.74,.28),(.83,.20),(.88,.15))))
    return outline(top,right), paths, fine, [('eye',(.526,.274),.020)]

def fish():
    upper=curve((0,-1),((.16,-.80),(.16,-.56),(-.15,-.43)),
      ((.15,-.62),(.51,-.47),(.80,-.21)),((.91,-.11),(.97,-.065),(1,0)))
    lower=upper[::-1]*[1,-1]
    poly=np.concatenate([upper[:-1],lower[:-1],(upper+[-1,1])[::-1][:-1],(lower+[-1,-1])[::-1][:-1]])
    paths=[curve((.44,-.30),((.18,-.17),(.18,.16),(.44,.30))),
      curve((.63,-.14),((.76,-.24),(.84,-.10),(.72,-.04)),((.65,-.015),(.60,-.07),(.63,-.14))),
      curve((.83,.04),((.90,.04),(.95,.025),(1,0))),
      curve((-.35,-.12),((-.13,-.37),(.0,-.22),(.05,-.02)),((-.1,.025),(-.26,.02),(-.35,-.12))),
      curve((-.8,0),((-.68,-.04),(-.60,-.075),(-.50,-.1)))]
    fine=[]
    for k in range(6):
      y=-.35+k*.14
      # Scales follow the flank; short marks preserve the silhouette hierarchy.
      fine.append(curve((-.15,y*.62),((-.06,y*.62-.05),(.025,y*.62-.05),(.07,y*.62))))
      fine.append(curve((-.7,y),((-.60,y*.72),(-.49,y*.5),(-.39,y*.33))))
    def chart(p):
      p=np.asarray(p);return np.stack([(p[...,0]+p[...,1]+1)/2,(-p[...,0]+p[...,1]+1)/2],axis=-1)
    return chart(poly),[chart(p) for p in paths],[chart(p) for p in fine],[('eye',chart((.71,-.12)),.013)]

def moth_swept():
    top=curve((0,0),
      ((.13,.20),(.29,.31),(.40,.35)),
      ((.43,.29),(.48,.19),(.46,.13)),
      ((.45,.09),(.41,.03),(.40,0)),
      ((.46,.03),(.50,.08),(.53,.10)),
      ((.55,.10),(.57,.10),(.59,.10)),
      ((.65,.07),(.70,.02),(.75,0)),
      ((.72,.07),(.66,.13),(.63,.16)),
      ((.61,.23),(.57,.29),(.54,.35)),
      ((.68,.29),(.88,.10),(1,0)))
    right=curve((1,0),
      ((.95,.27),(.85,.53),(.77,.63)),
      ((.67,.79),(.55,.69),(.42,.54)),
      ((.31,.63),(.15,.86),(1,1)))
    paths=[curve((.42,.37),((.38,.54),(.29,.75),(.25,.89))),
      curve((.54,.36),((.49,.53),(.34,.79),(.25,.89))),
      curve((.08,.16),((.21,.36),(.31,.37),(.41,.39))),
      curve((.55,.39),((.71,.36),(.86,.23),(.95,.11))),
      curve((.41,.45),((.24,.53),(.09,.66),(.09,.78))),
      curve((.52,.45),((.60,.54),(.69,.64),(.73,.64)))]
    fine=[]
    for k in range(5):
      t=k/5
      fine.append(curve((.42,.40),((.20,.42),(.12+.03*k,.25+.04*k),(.04+.07*k,.12+.05*k))))
      fine.append(curve((.53,.40),((.67,.40),(.81,.30),(.88-.03*k,.23+.07*k))))
    return outline(top,right),paths,fine,[('eye',(.515,.168),.018),('eye',(.576,.167),.018)]

def moth():
    upper=curve((0,-1),((.04,-1.02),(.09,-1.10),(.12,-1.13)),
      ((.12,-1.0),(.16,-.91),(.12,-.83)),
      ((.08,-.71),(.10,-.67),(.16,-.57)),
      ((.47,-.74),(.84,-.94),(1,0)))
    left=upper[::-1]*[-1,1];right=(left+[1,1])[::-1]
    poly=np.concatenate([upper[:-1],right[:-1],(upper+[-1,1])[::-1][:-1],left[:-1]])
    paths=[curve((-.07,-.64),((-.09,-.25),(-.05,.5),(0,.85))),
      curve((.07,-.64),((.09,-.25),(.05,.5),(0,.85)))]
    fine=[]
    for hand in [-1,1]:
      paths.append(curve((.1*hand,-.44),((.35*hand,-.56),(.73*hand,-.57),(.85*hand,-.14))))
      paths.append(curve((.08*hand,.04),((.32*hand,.05),(.60*hand,.26),(.72*hand,.46))))
      for k in range(5):
        fine.append(curve((.1*hand,-.30+k*.06),((.30*hand,-.22+k*.07),((.45+.05*k)*hand,-.4+k*.19),((.70+.055*k)*hand,-.28+k*.17))))
    def chart(p):
      p=np.asarray(p);return np.stack([(p[...,0]+p[...,1]+1)/2,(-p[...,0]+p[...,1]+1)/2],axis=-1)
    return chart(poly),[chart(p) for p in paths],[chart(p) for p in fine],[('eye',chart((-.055,-.87)),.012),('eye',chart((.055,-.87)),.012)]

TEMPLATES={'bird':bird,'fish':fish,'moth':moth}

if __name__=='__main__':
    from PIL import Image,ImageDraw
    from pathlib import Path
    out=Path('/tmp/torus-escher-proofs');out.mkdir(exist_ok=True)
    for name,fn in TEMPLATES.items():
      poly,paths,fine,dots=fn();im=Image.new('RGB',(1100,900),'white');d=ImageDraw.Draw(im);s=210
      for j in range(-2,5):
        for i in range(-2,6):
          o=np.array([i,j])*s+np.array([90,-70]);col=25 if (i+j)%2 else 245;inv=255-col
          d.polygon([tuple(v) for v in poly*s+o],fill=(col,)*3)
          for p in paths+fine:d.line([tuple(v) for v in p*s+o],fill=(inv,)*3,width=2)
          for _,p,r in dots:
            x,y=np.array(p)*s+o;d.ellipse((x-r*s,y-r*s,x+r*s,y+r*s),fill=(inv,)*3)
          d.line([tuple(v) for v in np.concatenate([poly,poly[:1]])*s+o],fill=(10,)*3,width=2)
      im.save(out/(name+'-flat.png'))
