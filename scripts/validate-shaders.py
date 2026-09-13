"""Compile and link the unmodified WebGL shaders in a native OpenGL ES context.
Requires Mesa EGL on Linux; uses only the Python standard library.
"""
import ctypes as C, re, subprocess
from pathlib import Path
E=C.CDLL('libEGL.so.1');I=C.c_int;U=C.c_uint;P=C.c_void_p

def egl(name,restype,args):
 f=getattr(E,name);f.restype=restype;f.argtypes=args;return f
platform=egl('eglGetPlatformDisplay',P,[U,P,C.POINTER(I)])
display=platform(0x31DD,None,None)
a,b=I(),I();assert egl('eglInitialize',U,[P,C.POINTER(I),C.POINTER(I)])(display,C.byref(a),C.byref(b))
assert egl('eglBindAPI',U,[U])(0x30A0)
attrs=(I*13)(0x3033,1,0x3040,0x40,0x3024,8,0x3023,8,0x3022,8,0x3025,24,0x3038)
config=P();count=I();assert egl('eglChooseConfig',U,[P,C.POINTER(I),C.POINTER(P),I,C.POINTER(I)])(display,attrs,C.byref(config),1,C.byref(count)) and count.value
surface=egl('eglCreatePbufferSurface',P,[P,P,C.POINTER(I)])(display,config,(I*5)(0x3057,16,0x3056,16,0x3038))
context=egl('eglCreateContext',P,[P,P,P,C.POINTER(I)])(display,config,None,(I*3)(0x3098,3,0x3038))
assert context and egl('eglMakeCurrent',U,[P,P,P,P])(display,surface,surface,context)
getproc=egl('eglGetProcAddress',P,[C.c_char_p])
def gl(name,restype,args):return C.CFUNCTYPE(restype,*args)(getproc(name.encode()))
getstring=gl('glGetString',C.c_char_p,[U]);print(getstring(0x1F02).decode(),getstring(0x8B8C).decode())
createShader=gl('glCreateShader',U,[U]);source=gl('glShaderSource',None,[U,I,C.POINTER(C.c_char_p),C.POINTER(I)]);compile=gl('glCompileShader',None,[U]);getShader=gl('glGetShaderiv',None,[U,U,C.POINTER(I)]);shaderLog=gl('glGetShaderInfoLog',None,[U,I,C.POINTER(I),C.c_char_p]);
createProgram=gl('glCreateProgram',U,[]);attach=gl('glAttachShader',None,[U,U]);link=gl('glLinkProgram',None,[U]);getProgram=gl('glGetProgramiv',None,[U,U,C.POINTER(I)]);programLog=gl('glGetProgramInfoLog',None,[U,I,C.POINTER(I),C.c_char_p]);
failed=False
for file in ['artwork.js','kinetic.js','sculptures.js','symmetry.js','cycles.js','visionary.js','topology.js','chiaroscuro.js','mechanisms.js','quasicrystal.js','metamorphosis.js','tessellations.js','transformations.js']:
 code=(Path(__file__).resolve().parents[1]/'dist'/file).read_text();p=createProgram()
 for stage,kind in [('vertex',0x8B31),('fragment',0x8B30)]:
  text=subprocess.check_output(['node',str(Path(__file__).with_name('shader-source.cjs')),file,stage]);s=createShader(kind);sp=C.c_char_p(text);source(s,1,C.byref(sp),None);compile(s)
  ok=I();getShader(s,0x8B81,C.byref(ok));buf=C.create_string_buffer(8192);shaderLog(s,8192,None,buf)
  print(file,stage,'PASS' if ok.value else 'FAIL',buf.value.decode());failed|=not ok.value;attach(p,s)
 link(p);ok=I();getProgram(p,0x8B82,C.byref(ok));buf=C.create_string_buffer(8192);programLog(p,8192,None,buf)
 print(file,'link','PASS' if ok.value else 'FAIL',buf.value.decode());failed|=not ok.value
raise SystemExit(1 if failed else 0)
