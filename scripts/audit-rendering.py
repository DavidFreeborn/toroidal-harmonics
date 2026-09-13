"""Reproducible native render audit, including submission and completed drawing.

Mesa software timings compare revisions here, not browser FPS on other devices.
Image readback, first-use compilation and the reference renderer's JSON parsing
are excluded from steady-frame timings. Use LP_NUM_THREADS consistently.
"""
import argparse,importlib.util,inspect,io,json,os,subprocess,textwrap,time
from pathlib import Path
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);p.add_argument('--output',type=Path,required=True);p.add_argument('--ids',default='');p.add_argument('--width',type=int,default=900);p.add_argument('--height',type=int,default=620);p.add_argument('--samples',type=int,default=7);args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('render',args.root/'scripts/render-studies.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
source=textwrap.dedent(inspect.getsource(m.Renderer.render)).split(' self.ctx.finish();')[0]
ns={};exec(source,m.__dict__,ns);m.Renderer.draw_only=ns['render']
js="const fs=require('fs'),vm=require('vm'),c={};for(const f of ['presets.js','collection.js'])vm.runInNewContext(fs.readFileSync('dist/'+f,'utf8'),c);vm.runInNewContext('this.rows=TORUS_COLLECTION.flatMap(g=>g.studies.map(([id,names])=>({id,names,s:TorusPresets.get(id)})))',c);console.log(JSON.stringify(c.rows))"
rows=json.loads(subprocess.check_output(['node','-e',js],cwd=args.root));r=m.Renderer(args.width,args.height,perspective=105)
quasi=r.quasimesh;quasicache={}
def quasimesh(program,level=2):
 key=(program.glo,level)
 if key not in quasicache:
  vao=quasi(program,level);quasicache[key]=(vao,r.quasi_count)
 vao,r.quasi_count=quasicache[key];return vao
r.quasimesh=quasimesh
results=[]
for row in rows:
 if args.ids and str(row['id']) not in args.ids.split(','):continue
 study=row['id'];s=row['s'];kw={dict(recursion='depth',variation='variant').get(k,k):v for k,v in s.items() if k not in ['speed','perspective']}
 start=time.perf_counter();im=r.render(study,**kw);first=(time.perf_counter()-start)*1000;image_bytes=io.BytesIO();im.save(image_bytes,format='PNG');temporary=args.output/f'{study}.png.tmp';temporary.write_bytes(image_bytes.getvalue());os.replace(temporary,args.output/f'{study}.png')
 times=[]
 for i in range(args.samples+3):
  r.ctx.finish();start=time.perf_counter();r.draw_only(study,t=.4+i*.03,**kw);r.ctx.finish()
  if i>=3:times.append((time.perf_counter()-start)*1000)
 item=dict(study=study,construction=row['names'][s['variation']],first_render_ms=round(first,2),median_ms=round(float(np.median(times)),3),p95_ms=round(float(np.percentile(times,95)),3),instanced_triangles=sum(a*b for a,b in r.draw_counts),instanced_draws=r.draw_counts)
 results.append(item);print(item,flush=True)
 temporary=args.output/'measurements.json.tmp';temporary.write_text(json.dumps(dict(renderer=r.ctx.info['GL_RENDERER'],api=r.ctx.info['GL_VERSION'],width=args.width,height=args.height,results=results),indent=2));os.replace(temporary,args.output/'measurements.json')
if r.visibility_process:r.visibility_process.terminate()
