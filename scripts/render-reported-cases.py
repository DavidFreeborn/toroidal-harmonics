"""Visual review matrix for the three reported sampling defects.

Exercises every construction, both density extremes, and three phases using
the actual parameter profiles. Inspect the generated contact sheets as well
as the full images; successful drawing alone is not a visual-quality verdict.
"""
import argparse, importlib.util, json, subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

p = argparse.ArgumentParser()
p.add_argument('--output', type=Path, required=True)
p.add_argument('--portrait', action='store_true')
args = p.parse_args()
root = Path(__file__).resolve().parents[1]
args.output.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('render', root/'scripts/render-studies.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
w, h = (420, 800) if args.portrait else (700, 480)
r = m.Renderer(w, h, perspective=105)
js = """
const fs=require('fs'),vm=require('vm'),c={};
for(const f of ['presets.js','collection.js','parameters.js'])
  vm.runInNewContext(fs.readFileSync('dist/'+f,'utf8'),c);
vm.runInNewContext('this.rows=TORUS_COLLECTION.flatMap(g=>g.studies).filter(s=>[30,76,99].includes(s[0])).map(s=>({id:s[0],names:s[1],defaults:TorusPresets.get(s[0]),profiles:s[1].map((_,i)=>TorusParameters.profile(s[0],i,TorusPresets.get(s[0])))}))',c);
console.log(JSON.stringify(c.rows));
"""
rows = json.loads(subprocess.check_output(['node', '-e', js], cwd=root))
results = []
for row in rows:
    tiles = []
    for variant, profile in enumerate(row['profiles']):
        kw = {dict(recursion='depth', variation='variant').get(k,k): v
              for k,v in row['defaults'].items() if k not in ['speed','perspective']}
        kw['variant'] = variant
        density = profile['density']
        ends = [density['values'][0], density['values'][-1]] if 'values' in density else [density['min'], density['max']]
        # Maximum permitted recursion exposes the smallest visible structures.
        kw['layers'] = profile['layers']['max']
        for d in ends:
            kw['density'] = d
            for i, t in enumerate([.4, 2.1, 5.2]):
                im = r.render(row['id'], t=t, **kw)
                name = f"{row['id']}-{variant}-{d}-{i}.png"
                im.save(args.output/name)
                tile = Image.new('RGB', (210, 180), 'white')
                thumb = ImageOps.contain(im, (210, 156), Image.Resampling.LANCZOS)
                tile.paste(thumb, ((210-thumb.width)//2, 0))
                ImageDraw.Draw(tile).text((5, 160), f"v{variant} density {d} t{t}", fill='black')
                tiles.append(tile)
                results.append(dict(study=row['id'], variant=variant, density=d,
                                    layers=kw['layers'], time=t, file=name))
    sheet = Image.new('RGB', (1260, 180*((len(tiles)+5)//6)), 'white')
    for i,tile in enumerate(tiles): sheet.paste(tile, (i%6*210, i//6*180))
    sheet.save(args.output/f"contact-{row['id']}.png")
    print('Rendered all cases for', row['id'], flush=True)
(args.output/'cases.json').write_text(json.dumps(dict(width=w, height=h,
    api=r.ctx.info['GL_VERSION'], cases=results), indent=2))
if r.visibility_process: r.visibility_process.terminate()
