"""Downsample verified native browser captures for collection previews."""
from pathlib import Path
from PIL import Image, ImageDraw

folder=Path(__file__).parent/'publication-qa'
output=Path(__file__).parent.parent/'dist'
names={145:'Talbot Cathedral',146:'Elliptic Eyes',147:'Spinor Loom',148:'Phason Tide'}
sheet=Image.new('RGB',(1100,808),'white')
draw=ImageDraw.Draw(sheet)
for index,(study,name) in enumerate(names.items()):
    native=Image.open(folder/f'study-{study}.png').convert('RGB')
    native.resize((220,152),Image.Resampling.LANCZOS).save(output/'studies'/f'{study}.webp',quality=94,method=6)
    if study==145:
        native.resize((1100,760),Image.Resampling.LANCZOS).save(output/'preview.webp',quality=96,method=6)
    x,y=(index%2)*550,(index//2)*404
    draw.text((x+10,y+5),name,fill='#222222')
    sheet.paste(native.resize((550,380),Image.Resampling.LANCZOS),(x,y+24))
sheet.save(Path(__file__).parent/'new-studies-preview.jpg',quality=95)
print('Built four exact-preset thumbnails, sharing preview and comparison sheet.')
