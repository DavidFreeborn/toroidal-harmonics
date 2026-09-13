"""Check exact-cycle render output independently of shader numeric helpers."""
import json
from pathlib import Path
import numpy as np
from PIL import Image

root=Path(__file__).parent
report=[]
for folder in ['revivals-browser','revivals-browser-density6']:
    base=root/folder
    for kind in [0,1]:
        for variant in range(3):
            first=np.array(Image.open(base/f'{kind}-{variant}-0.png')).astype(float)[:,:,:3]
            final=np.array(Image.open(base/f'{kind}-{variant}-4.png')).astype(float)[:,:,:3]
            error=np.abs(first-final)
            assert error.max()<=2,(folder,kind,variant,error.max())
            case={'folder':folder,'kind':kind,'variant':variant,'period_max_8bit_error':float(error.max()),'period_mean_8bit_error':float(error.mean())}
            if kind:
                half=np.array(Image.open(base/f'{kind}-{variant}-3.png')).astype(float)[:,:,:3]
                error=np.abs(first+half-255)
                assert error.max()<=2,(folder,variant,error.max())
                case.update(half_complement_max_8bit_error=float(error.max()),half_complement_mean_8bit_error=float(error.mean()))
            report.append(case)
(root/'revivals-image-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(f'{len(report)} full-cycle images and {sum(c["kind"] for c in report)} half-cycle complements passed.')
