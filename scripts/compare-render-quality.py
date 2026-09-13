"""Compare the reported studies against supersampled reference images.

Reports finite-resolution error, not subjective quality or browser FPS.
Run with --baseline /path/to/previous/source --output /path/to/results.
Each revision runs in its own process and graphics context.
"""
from pathlib import Path
import argparse,importlib.util,io,json,os,subprocess,sys
import numpy as np
from PIL import Image

p=argparse.ArgumentParser();p.add_argument('--baseline',type=Path);p.add_argument('--output',type=Path,required=True)
p.add_argument('--root',type=Path);p.add_argument('--role');p.add_argument('--scale',type=int,default=1)
p.add_argument('--reuse-baseline',action='store_true');args=p.parse_args()
ids=[30,76,99];times=[.4,2.1,5.2];width,height=400,272
if args.root:
    spec=importlib.util.spec_from_file_location('render',args.root/'scripts/render-studies.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    r=m.Renderer(width*args.scale,height*args.scale,perspective=105)
    js="const fs=require('fs'),vm=require('vm'),c={};vm.runInNewContext(fs.readFileSync('dist/presets.js','utf8')+';this.p=TorusPresets',c);console.log(JSON.stringify([30,76,99].map(id=>[id,c.p.get(id)])))"
    settings=dict(json.loads(subprocess.check_output(['node','-e',js],cwd=args.root)))
    folder=args.output/args.role;folder.mkdir(parents=True,exist_ok=True)
    for study in ids:
        kw={dict(recursion='depth',variation='variant').get(k,k):v for k,v in settings[study].items() if k not in ['speed','perspective']}
        for i,t in enumerate(times):
            im=r.render(study,t=t,**kw)
            if args.scale>1:im=im.resize((width,height),Image.Resampling.BOX)
            data=io.BytesIO();im.save(data,format='PNG');(folder/f'{study}-{i}.png').write_bytes(data.getvalue())
    if r.visibility_process:r.visibility_process.terminate()
    sys.exit(0)

assert args.baseline
root=Path(__file__).resolve().parents[1];args.output.mkdir(parents=True,exist_ok=True)
for role,source,scale in [('before',args.baseline,1),('before-reference',args.baseline,4),('after',root,1),('after-reference',root,4)]:
    if args.reuse_baseline and role.startswith('before') and all((args.output/role/f'{study}-{i}.png').exists() for study in ids for i in range(len(times))):continue
    subprocess.run([sys.executable,__file__,'--root',str(source),'--role',role,'--scale',str(scale),'--output',str(args.output)],check=True)
    print('Rendered',role,flush=True)
def read(role,study,i):return np.array(Image.open(args.output/role/f'{study}-{i}.png'),dtype=float)[:,:,0]
rows=[]
for study in ids:
    for i,t in enumerate(times):
        a=read('before',study,i);b=read('after',study,i);reference=read('before-reference',study,i);newref=read('after-reference',study,i)
        row=dict(study=study,time=t,before_rmse=float(np.sqrt(np.mean((a-reference)**2))),after_rmse=float(np.sqrt(np.mean((b-reference)**2))),after_self_rmse=float(np.sqrt(np.mean((b-newref)**2))))
        rows.append(row);print(row,flush=True)
temporary=args.output/'results.tmp';temporary.write_text(json.dumps(rows,indent=2));os.replace(temporary,args.output/'results.json')
