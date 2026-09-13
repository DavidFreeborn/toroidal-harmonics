"""Area-average browser references and report grayscale raster error.

The reference retains the previous shader at four times each raster dimension.
This measures sampling accuracy, not perceived quality or animation performance.
"""
import argparse,json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw

parser=argparse.ArgumentParser();parser.add_argument('folder',type=Path);args=parser.parse_args()
rows=[];studies=set()
for path in sorted(args.folder.glob('before-*.png')):
    _,study,frame=path.stem.split('-');study,frame=int(study),int(frame);studies.add(study)
    before=Image.open(path).convert('L');size=before.size
    def read(role):
        image=Image.open(args.folder/f'{role}-{study}-{frame}.png').convert('L')
        return np.asarray(image.resize(size,Image.Resampling.BOX),dtype=float)
    a=np.asarray(before,dtype=float);b=read('after');reference=read('reference');new_reference=read('after-reference')
    rows.append(dict(study=study,phase=[.4,2.1,5.2][frame],before_rmse=float(np.mean((a-reference)**2)**.5),after_rmse=float(np.mean((b-reference)**2)**.5),after_self_rmse=float(np.mean((b-new_reference)**2)**.5)))
args.folder.joinpath('results.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows,indent=2))
if studies:
    width,height=size;sheet=Image.new('RGB',(width*3,(height+24)*len(studies)),color='white');draw=ImageDraw.Draw(sheet)
    for row,study in enumerate(sorted(studies)):
        for column,role in enumerate(['before','after','reference']):
            x,y=column*width,row*(height+24)
            draw.text((x+6,y+5),f'{study}: {role}',fill='black')
            image=Image.open(args.folder/f'{role}-{study}-0.png').convert('RGB').resize(size,Image.Resampling.BOX)
            sheet.paste(image,(x,y+24))
    sheet.save(args.folder/'comparison.png')
