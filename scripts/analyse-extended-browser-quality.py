"""Compare native images with a sixteen-raster-sample area-averaged reference."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import argparse, json
import numpy as np

parser=argparse.ArgumentParser()
parser.add_argument('directory',nargs='?',type=Path,default=Path(__file__).with_name('browser-extended'))
out=parser.parse_args().directory
try:
    font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',14)
except OSError:
    font=ImageFont.load_default()
rows=[]
for study in [7,136,135,139,140]:
    for index,phase in enumerate([.4,2.1,5.2] if study in [7,136] else [.4]):
        def read(role):
            image=Image.open(out/f'{role}-{study}-{index}.png').convert('RGB')
            if image.width>500:
                image=image.resize((500,340),Image.Resampling.BOX)
            return np.asarray(image,dtype=float)
        before,after,reference,new_reference=map(read,['before','after','before-reference','after-reference'])
        def rmse(a,b):
            return round(float(np.sqrt(np.mean((a-b)**2))),3)
        row=dict(id=study,phase=phase,before_rmse=rmse(before,reference),after_rmse=rmse(after,reference),after_self_rmse=rmse(after,new_reference))
        rows.append(row)
        sheet=Image.new('RGB',(1500,364),'#ddd')
        draw=ImageDraw.Draw(sheet)
        for column,(label,pixels) in enumerate([('Before',before),('After',after),('16-sample reference',reference)]):
            sheet.paste(Image.fromarray(pixels.astype('uint8')),(column*500,24))
            draw.text((column*500+5,3),f'{study} {label}',font=font,fill='black')
        sheet.save(out/f'compare-{study}-{index}.jpg',quality=95)
        print(row)
(out/'results.json').write_text(json.dumps(rows,indent=2),encoding='utf8')
