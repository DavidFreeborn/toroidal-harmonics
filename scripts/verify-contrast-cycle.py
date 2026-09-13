"""Compare the automatic eigenmode contrast with its manual equivalent."""
import importlib.util,json,math,subprocess,numpy as np
from pathlib import Path
spec=importlib.util.spec_from_file_location('render',Path(__file__).with_name('render-studies.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
r=m.Renderer(640,440,perspective=105)
js="const fs=require('fs'),vm=require('vm'),c={};vm.runInNewContext(fs.readFileSync('dist/presets.js','utf8')+';this.s=TorusPresets.get(19)',c);console.log(JSON.stringify(c.s))"
s=json.loads(subprocess.check_output(['node','-e',js],cwd=m.ROOT))
kw={dict(recursion='depth',variation='variant').get(k,k):v for k,v in s.items() if k not in ['speed','perspective']}
def render(t,cycle,contrast):
 return np.asarray(r.render(19,t=t,**dict(kw,inkCycle=cycle,ink=contrast)),dtype=float)
for t in np.linspace(0,2*math.pi,17):
 error=float(abs(render(t,1,1)-render(t,0,.5-.5*math.cos(t))).mean())
 assert error<.02,(t,error)
epsilon=1e-4
cross=float(abs(render(2*math.pi-epsilon,1,1)-render(epsilon,1,1)).mean())
near=float(abs(render(.8-epsilon,1,1)-render(.8+epsilon,1,1)).mean())
assert cross<max(.15,near*5),(cross,near)
assert float(abs(render(0,1,1)-render(math.pi,1,1)).mean())>1
print('PASS 17 contrast phases match manual settings; continuous cycle seam; full light/dark range')
