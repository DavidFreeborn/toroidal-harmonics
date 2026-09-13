"""Independent mathematical identities, not snapshots of shader spelling."""
import importlib.util,json
from pathlib import Path
import numpy as np

HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('revivals',HERE/'revivals-math.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
rng=np.random.default_rng(672431)
report={}
def check(name,error,tolerance,count):
    error=float(error);assert error<tolerance,(name,error,tolerance)
    report[name]={'maximum_error':error,'tolerance':tolerance,'cases':count}

def modes(order,wave,variant):
    n,m=np.meshgrid(np.arange(-order,order+1),np.arange(-order,order+1))
    c=np.exp(-.13*(n*n+m*m))
    petal=.22*(n*n-m*m) if variant==1 else .018*(n**4-6*n*n*m*m+m**4)
    c*=.06+.12*(1-wave)+(.6+wave)*petal
    k,l=(n+m,n-m) if variant==2 else (n,m)
    return k.ravel(),l.ravel(),c.ravel()

z=rng.uniform(-2,2,(27,2));direct_errors=[];period_errors=[];fraction_errors=[]
for order in [4,6,8]:
 for variant in [0,1,2]:
  for wave in [0,.65,1]:
   k,l,c=modes(order,wave,variant)
   t=.731
   direct=np.sum(c*np.exp(1j*(2*np.pi*(z[:,0,None]*k+z[:,1,None]*l)-t*(k*k+l*l))),axis=-1)
   actual=r.talbot(z,t,order,wave,variant)
   direct_errors.extend(np.abs(direct-actual))
   period_errors.extend(np.abs(r.talbot(z,t+2*np.pi,order,wave,variant)-actual))
   for p,q in [(1,2),(1,3),(1,4),(2,5),(3,7)]:
    n=np.arange(q);j=n[:,None]
    g=np.sum(np.exp(2j*np.pi*(-p*n*n+j*n)/q),axis=1)/q
    reconstructed=np.zeros(len(z),complex)
    for x in range(q):
     for y in range(q):
      reconstructed+=g[x]*g[y]*r.talbot(z-np.array([x,y])/q,0,order,wave,variant)
    fraction_errors.extend(np.abs(reconstructed-r.talbot(z,2*np.pi*p/q,order,wave,variant)))
check('Talbot_separable_field_vs_independent_2D_spectrum',max(direct_errors),2e-10,len(direct_errors))
check('Talbot_exact_full_period',max(period_errors),2e-10,len(period_errors))
check('Talbot_fractional_Gauss_sum_translated_copies',max(fraction_errors),2e-10,len(fraction_errors))

w=rng.uniform(-.5,.5,10000)+1j*rng.uniform(-.5,.5,10000)
theta_error=np.max(np.abs(r.theta1(np.pi*w,3)-r.theta1(np.pi*w,12)))
check('Theta_three_term_absolute_truncation',theta_error,3e-12,len(w))
def direct_ratio(z,t,wave):
 a,b=r.divisor(t,wave)
 return r.theta1(np.pi*(z-a),12)*r.theta1(np.pi*(z+a),12)/(r.theta1(np.pi*(z-b),12)*r.theta1(np.pi*(z+b),12))
ratio_errors=[];green_errors=[];reciprocal_errors=[];full_errors=[];lattice_errors=[];hierarchy_errors=[]
for wave in [0,.55,1]:
 for t in np.linspace(0,2*np.pi,17):
  z=w[:43]
  f=direct_ratio(z,t,wave)
  scale=np.maximum(1,np.abs(f))
  for shift in [1,1j,1+1j]:lattice_errors.extend(np.abs(direct_ratio(z+shift,t,wave)-f)/scale)
  green_errors.extend(np.abs(np.log(np.abs(f))-r.elliptic_log(z,t,wave)))
  reciprocal_errors.extend(np.abs(f*direct_ratio(z,t+np.pi,wave)-1))
  full_errors.extend(np.abs(direct_ratio(z,t+2*np.pi,wave)-f)/scale)
  for cover in [2,1+1j,2+1j]:
   for levels in [1,2,3]:
    h=np.zeros(len(z));half=np.zeros(len(z));product=np.ones(len(z),complex)
    for depth in range(levels):
     point=z*cover**depth;phase=t+.25*depth;power=2**(levels-depth-1)
     h+=power*r.elliptic_log(point,phase,wave)
     half+=power*r.elliptic_log(point,t+np.pi+.25*depth,wave)
     # Reduce before direct theta product to avoid unnecessary exponential
     # range loss on the high-degree cover; the balanced ratio is periodic.
     reduced=(point.real+.5)%1-.5+1j*((point.imag+.5)%1-.5)
     product*=direct_ratio(reduced,phase,wave)**power
    hierarchy_errors.extend(np.abs(h+half))
    ratio_errors.extend(np.abs(h-np.log(np.abs(product))))
check('Balanced_theta_ratio_lattice_periodicity',max(lattice_errors),2e-11,len(lattice_errors))
check('Green_potential_matches_balanced_ratio',max(green_errors),2e-11,len(green_errors))
check('Elliptic_half_period_reciprocity',max(reciprocal_errors),2e-11,len(reciprocal_errors))
check('Elliptic_exact_full_period',max(full_errors),2e-11,len(full_errors))
check('Covering_hierarchy_log_of_meromorphic_product',max(ratio_errors),2e-10,len(ratio_errors))
check('Covering_hierarchy_half_period_sign_exchange',max(hierarchy_errors),2e-10,len(hierarchy_errors))
report['covering_degrees']=[4,2,5]
(HERE/'revivals-math-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))

# Independent direct-spectrum derivatives and numerical elliptic derivatives
# are sent to a separate WebGL test; they do not reuse the shader recurrences.
fixture=[]
points=rng.uniform(-.48,.48,(48,2))
for variant in [0,1,2]:
 for order in [4,6,8]:
  for t in [0,.371,1.923]:
   k,l,c=modes(order,.65,variant)
   phase=c*np.exp(1j*(2*np.pi*(points[:,0,None]*k+points[:,1,None]*l)-t*(k*k+l*l)))
   f=np.sum(phase,axis=-1);fx=np.sum(phase*(2j*np.pi*k),axis=-1);fy=np.sum(phase*(2j*np.pi*l),axis=-1)
   fixture.append({'kind':0,'variant':variant,'order':order,'time':t,'wave':.65,'points':points.tolist(),'expected':np.stack([f.real,f.imag,fx.real,fx.imag,fy.real,fy.imag],axis=-1).tolist()})
for t in [0,.371,1.923,3.512]:
 for wave in [0,.55,1]:
  z=points[:,0]+1j*points[:,1];h=1e-6
  value=r.elliptic_log(z,t,wave)
  x=(r.elliptic_log(z+h,t,wave)-r.elliptic_log(z-h,t,wave))/(2*h)
  y=(r.elliptic_log(z+1j*h,t,wave)-r.elliptic_log(z-1j*h,t,wave))/(2*h)
  fixture.append({'kind':1,'time':t,'wave':wave,'points':points.tolist(),'expected':np.stack([value,x,y],axis=-1).tolist()})
(HERE/'revivals-gpu-fixture.json').write_text(json.dumps(fixture,separators=(',',':'))+'\n')
