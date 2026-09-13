"""Numerical checks of raster coverage and the unchanged torus maps.

Coverage is checked by integrating the GPU output over complete periods.
Analytic map derivatives are checked against independent central differences
of the double-precision map, not a copy of the derivative implementation.
"""
from pathlib import Path
import json,math,re
import moderngl,numpy as np

root=Path(__file__).resolve().parents[1]
ctx=moderngl.create_standalone_context(backend='egl')
sampling=re.search(r'const sampling=`([\s\S]*?)`;', (root/'dist/lightfield.js').read_text())[1]
vertex='''#version 330
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}
'''
n=8192
target=ctx.texture((n,1),4,dtype='f4');fb=ctx.framebuffer([target]);fb.use()
fragment='''#version 330
uniform float width,footprint,offset;uniform int mode;out vec4 result;
'''+sampling+'''
void main(){float x=gl_FragCoord.x/8192.0;
float a=mode==0?torusPeriodic(2.0*x+offset,width,footprint):torusStroke(2.0*x-1.0,width,footprint);
result=vec4(a);}
'''
p=ctx.program(vertex_shader=vertex,fragment_shader=fragment);vao=ctx.vertex_array(p,[])
def draw(values):
    for k,v in values.items():p[k].value=v
    vao.render(vertices=3)
    return np.frombuffer(fb.read(components=4,dtype='f4'),dtype='f4').reshape(-1,4)[:,0]
checks=[]
for width in [.002,.01,.04,.14,.30,.49,.5]:
    for footprint in [.0003,.01,.1,.7,1.,1.8,3.,12.]:
        a=draw(dict(width=width,footprint=footprint,offset=.173,mode=0))
        assert np.isfinite(a).all() and a.min()>=-1e-6 and a.max()<=1.000001
        error=abs(float(a.mean())-2*width)
        assert error<.0003,(width,footprint,error)
        checks.append(error)
for width in [.0001,.001,.01,.1,.3]:
    for footprint in [.001,.01,.1,.3]:
        a=draw(dict(width=width,footprint=footprint,offset=0.,mode=1))
        energy=float(a.mean())*2
        assert abs(energy-2*width)<max(.00001,2*width*.003),(width,footprint,energy)
        x=(np.arange(n)+.5)/n*2-1
        assert np.max(a[np.abs(x)>width+footprint+.0001],initial=0)==0
print('PASS: 56 periodic coverage integrals, 20 finite-stroke integrals and empty-background checks')

topology=(root/'dist/topology.js').read_text()
shear=topology.split('void shearFrame(',1)[1].split('float filteredLine',1)[0]
source='void shearFrame('+shear
rng=np.random.default_rng(2761);samples=np.column_stack([rng.uniform(-1,2,(512,2)),rng.uniform(0,2*math.pi,512),rng.uniform(0,1,512)]).astype('f4')
tex=ctx.texture((512,1),4,samples.tobytes(),dtype='f4');tex.filter=(moderngl.NEAREST,moderngl.NEAREST);tex.use(0)
target=ctx.texture((512,1),4,dtype='f4');fb=ctx.framebuffer([target]);fb.use()
p=ctx.program(vertex_shader=vertex,fragment_shader='''#version 330
uniform sampler2D cases;uniform int count,mode;out vec4 result;const float TAU=6.28318530718;
'''+source+'''
void main(){vec4 s=texelFetch(cases,ivec2(gl_FragCoord.xy),0);vec2 z=s.xy,dx=vec2(1,0),dy=vec2(0,1);shearFrame(z,dx,dy,s.z,s.w,count);result=mode==0?vec4(dx,dy):vec4(z,0,0);}
''');p['cases'].value=0;vao=ctx.vertex_array(p,[])
def mapped(z,t,a,count):
    z=z.copy()
    for j in range(count):
        f=2+j
        z[:,0]+=(.045+.035*a)*.78**j*np.sin(2*math.pi*f*z[:,1]+np.sin(t+j))
        z[:,1]+=(.037+.025*a)*.78**j*np.sin(2*math.pi*(f+1)*z[:,0]-np.cos(t-j))
    return z
z=samples[:,:2].astype(float);t=samples[:,2].astype(float);a=samples[:,3].astype(float);max_jacobian=0.;max_position=0.
for count in range(1,7):
    p['count'].value=count;p['mode'].value=0;vao.render(vertices=3)
    actual=np.frombuffer(fb.read(components=4,dtype='f4'),dtype='f4').reshape(-1,4)
    h=1e-6;dx=(mapped(z+[h,0],t,a,count)-mapped(z-[h,0],t,a,count))/(2*h)
    dy=(mapped(z+[0,h],t,a,count)-mapped(z-[0,h],t,a,count))/(2*h)
    reference=np.column_stack([dx,dy]);error=float(np.max(np.abs(actual-reference)/(1+np.abs(reference))))
    assert error<.003,(count,error);max_jacobian=max(max_jacobian,error)
    p['mode'].value=1;vao.render(vertices=3)
    actual=np.frombuffer(fb.read(components=4,dtype='f4'),dtype='f4').reshape(-1,4)[:,:2]
    error=float(np.max(np.abs(actual-mapped(z,t,a,count))));assert error<.0001,(count,error);max_position=max(max_position,error)
print('PASS: 3,072 map/Jacobian cases; max normalised derivative error',max_jacobian,'max position error',max_position)

v=np.linspace(-8*math.pi,8*math.pi,10001)
lift=lambda v:(v-2*np.arctan(np.sin(v)/(3+np.cos(v))))/(2*math.pi)
assert np.max(abs(lift(v+2*math.pi)-lift(v)-1))<1e-12
derivative=(lift(v+1e-5)-lift(v-1e-5))/2e-5
assert np.max(abs(derivative-2/(math.pi*(5+3*np.cos(v)))))<1e-9
print('PASS: conformal lift has the exact period and smooth analytic derivative across every meridian seam')
assert ctx.error=='GL_NO_ERROR'
print(json.dumps(dict(periodic_mean_error=max(checks),map_position_error=max_position,jacobian_relative_error=max_jacobian)))
