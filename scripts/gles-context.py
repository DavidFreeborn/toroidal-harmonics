"""Render the unchanged GLSL ES sources, not desktop-language translations.

This is native Mesa ES validation, not a browser or hardware GPU benchmark.
ModernGL supplies buffer and draw helpers over the current EGL ES context.
"""
import ctypes as C
import moderngl

def create_context():
    lib=C.CDLL('libEGL.so.1');I=C.c_int;U=C.c_uint;P=C.c_void_p
    def fn(name,result,args):
        f=getattr(lib,name);f.restype=result;f.argtypes=args;return f
    display=fn('eglGetPlatformDisplay',P,[U,P,C.POINTER(I)])(0x31DD,None,None)
    major,minor=I(),I()
    assert fn('eglInitialize',U,[P,C.POINTER(I),C.POINTER(I)])(display,C.byref(major),C.byref(minor))
    assert fn('eglBindAPI',U,[U])(0x30A0)
    config=P();count=I();attrs=(I*13)(0x3033,1,0x3040,0x40,0x3024,8,0x3023,8,0x3022,8,0x3025,24,0x3038)
    assert fn('eglChooseConfig',U,[P,C.POINTER(I),C.POINTER(P),I,C.POINTER(I)])(display,attrs,C.byref(config),1,C.byref(count)) and count.value
    surface=fn('eglCreatePbufferSurface',P,[P,P,C.POINTER(I)])(display,config,(I*5)(0x3057,16,0x3056,16,0x3038))
    context=fn('eglCreateContext',P,[P,P,P,C.POINTER(I)])(display,config,None,(I*3)(0x3098,3,0x3038))
    assert context and fn('eglMakeCurrent',U,[P,P,P,P])(display,surface,surface,context)
    getproc=fn('eglGetProcAddress',P,[C.c_char_p])
    class Loader:
        def load_opengl_function(self,name):return getproc(name.encode())
    loader=Loader();moderngl.init_context(loader);ctx=moderngl.get_context()
    # ModernGL's initial desktop capability probes query enums absent in ES.
    # Clear those setup errors once. Draw-time errors are checked normally.
    info=ctx.info
    while ctx.error!='GL_NO_ERROR':pass
    class NativeIO:
        keepalive=(lib,loader,display,surface,context)
        def __init__(self):
            def gl(name,result,args):return C.CFUNCTYPE(result,*args)(getproc(name.encode()))
            self.bind=gl('glBindFramebuffer',None,[U,U]);self.colour=gl('glClearColor',None,[C.c_float]*4)
            self.depth=gl('glClearDepthf',None,[C.c_float]);self.clear_bits=gl('glClear',None,[U])
            self.blit=gl('glBlitFramebuffer',None,[I]*8+[U,U])
            self.read_pixels=gl('glReadPixels',None,[I,I,I,I,U,U,P])
        def clear(self,framebuffer):
            self.bind(0x8D40,framebuffer.glo);self.colour(1,1,1,1);self.depth(1);self.clear_bits(0x4100)
        def resolve(self,target,source,w,h):
            self.bind(0x8CA8,source.glo);self.bind(0x8CA9,target.glo)
            self.blit(0,0,w,h,0,0,w,h,0x4000,0x2600)
        def read(self,framebuffer,w,h):
            self.bind(0x8D40,framebuffer.glo);data=(C.c_ubyte*(w*h*4))()
            self.read_pixels(0,0,w,h,0x1908,0x1401,data);return bytes(data)
    ctx.extra=NativeIO()
    assert 'OpenGL ES' in info['GL_VERSION']
    return ctx
