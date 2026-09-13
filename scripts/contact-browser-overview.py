"""Contact sheets for the 99-study native-browser audit; full images remain intact."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageStat
import argparse, json, math

parser = argparse.ArgumentParser()
parser.add_argument('directory', nargs='?', type=Path, default=Path(__file__).with_name('browser-overview'))
args = parser.parse_args()
out = args.directory
data = json.loads((out / 'overview.json').read_text(encoding='utf8'))
try:
    font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 14)
except OSError:
    font = ImageFont.load_default()
checks = []
for group in range(math.ceil(len(data['defaults']) / 25)):
    sheet = Image.new('RGB', (1650, 1270), '#ddd')
    draw = ImageDraw.Draw(sheet)
    for index, row in enumerate(data['defaults'][group * 25:(group + 1) * 25]):
        image = Image.open(out / row['file']).convert('RGB')
        gray = image.convert('L')
        checks.append(dict(id=row['id'],std=round(ImageStat.Stat(gray).stddev[0],2),range=gray.getextrema()))
        x, y = index % 5 * 330, index // 5 * 254
        sheet.paste(image.resize((330,228),Image.Resampling.LANCZOS),(x,y))
        draw.text((x+5,y+230),f"{row['id']} {row['title']}",font=font,fill='black')
    sheet.save(out / f'contact-{group+1}.jpg',quality=95)
sheet = Image.new('RGB',(1239,622),'#ddd')
draw = ImageDraw.Draw(sheet)
for index,row in enumerate(data['details']):
    image=Image.open(out / row['file']).convert('RGB')
    x,y=index%3*413,index//3*311
    sheet.paste(image.resize((413,285),Image.Resampling.LANCZOS),(x,y))
    draw.text((x+4,y+287),f"{row['id']} v2 phase {row['phase']}",font=font,fill='black')
sheet.save(out / 'details.jpg',quality=95)
(out / 'image-checks.json').write_text(json.dumps(checks,indent=2),encoding='utf8')
print(len(checks),'images; minimum tonal standard deviation',min(row['std'] for row in checks))
