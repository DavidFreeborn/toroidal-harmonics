"""Independent double-precision models for the revival studies."""
import numpy as np

TAU=2*np.pi

def kernel(x,t,order=6,diffusion=1):
    terms=np.arange(-order,order+1)
    weights=np.exp(-.13*terms*terms)
    phase=np.exp(1j*(TAU*x[...,None]*terms-t*diffusion*terms*terms))*weights
    return [np.sum(phase*terms**power,axis=-1) for power in [0,2,4]]

def talbot(z,t,order=6,lobes=.65,variant=0):
    x,y=z[...,0],z[...,1]
    a,b=kernel(x,t,order),kernel(y,t,order)
    core=a[0]*b[0]
    petal=.018*(a[2]*b[0]-6*a[1]*b[1]+a[0]*b[2])
    if variant==1:
        petal=.22*(a[1]*b[0]-a[0]*b[1])
    if variant==2:
        c,d=kernel(x+y,t,order,2),kernel(x-y,t,order,2)
        core=c[0]*d[0]
        petal=.018*(c[2]*d[0]-6*c[1]*d[1]+c[0]*d[2])
    return (.06+.12*(1-lobes))*core+(.6+1.0*lobes)*petal

def theta1(z,terms=6):
    n=np.arange(terms)
    return np.sum(2*(-1.)**n*np.exp(-np.pi*(n+.5)**2)*np.sin((2*n+1)*z[...,None]),axis=-1)

def green(z):
    x=(np.real(z)+.5)%1-.5;y=(np.imag(z)+.5)%1-.5
    theta=theta1(np.pi*(x+1j*y))
    return np.log(np.maximum(np.abs(theta),1e-14))-np.pi*y*y

def divisor(t,excursion=.55):
    rx=.23+.065*excursion;ry=.12+.025*excursion
    return rx*np.cos(t/2)+1j*ry*np.sin(t/2),-rx*np.sin(t/2)+1j*ry*np.cos(t/2)

def elliptic_log(z,t,excursion=.55):
    a,b=divisor(t,excursion)
    return green(z-a)+green(z+a)-green(z-b)-green(z+b)+2*np.pi*(a.imag*a.imag-b.imag*b.imag)

if __name__=='__main__':
    from PIL import Image,ImageDraw
    from pathlib import Path
    path=Path(__file__).with_name('revivals-design');path.mkdir(exist_ok=True)
    grid=(np.arange(300)+.5)/300-.5;x,y=np.meshgrid(grid,grid);z=np.stack([x,y],axis=-1)
    im=Image.new('RGB',(1200,900),'white');d=ImageDraw.Draw(im)
    for row,variant in enumerate([0,1,2]):
        for col,t in enumerate([0,np.pi/4,np.pi/2,2.1]):
            value=talbot(z,t,variant=variant);level=np.log1p(np.abs(value)**2*.3)
            ink=np.clip((level-.3)/.25,0,1)
            gray=(255*(1-ink)).astype('uint8');tile=Image.fromarray(gray).convert('RGB')
            im.paste(tile,(col*300,row*300));d.text((col*300+5,row*300+5),f'{variant} t={t:.2f}',fill='red')
    im.save(path/'talbot-seeds.png')
