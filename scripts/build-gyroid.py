"""A periodic nodal gyroid mesh, generated once, then instanced on the GPU."""
from pathlib import Path
import itertools
import json
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
N = 24
PHASE = np.array([.17, .31, .13])

def field(p):
    q = 2 * np.pi * p + PHASE
    s, c = np.sin(q), np.cos(q)
    return s[0]*c[1] + s[1]*c[2] + s[2]*c[0]

corners = np.array(list(itertools.product(range(2), repeat=3)))
# A consistent body diagonal and face triangulation throughout the periodic grid.
tetrahedra = [(0, 4, 6, 7), (0, 6, 2, 7), (0, 2, 3, 7),
              (0, 3, 1, 7), (0, 1, 5, 7), (0, 5, 4, 7)]
vertices, indices, lookup, roots = [], [], {}, {}
def vertex(a, b, fa, fb):
    key = tuple(sorted((tuple(a), tuple(b))))
    if key in roots:
        return roots[key]
    lo, hi = a/N, b/N
    if fa > 0:
        lo, hi = hi, lo
    for _ in range(30):
        mid = (lo+hi)*.5
        if field(mid) < 0:
            lo = mid
        else:
            hi = mid
    point = (lo+hi)*.5
    pkey = tuple(np.round(point, 9))
    if pkey not in lookup:
        lookup[pkey] = len(vertices)
        vertices.append(point)
    roots[key] = lookup[pkey]
    return roots[key]

for cell in itertools.product(range(N), repeat=3):
    points = corners + np.array(cell)
    values = [field(p/N) for p in points]
    for tetra in tetrahedra:
        polygon = []
        for a, b in itertools.combinations(tetra, 2):
            if (values[a] < 0) != (values[b] < 0):
                polygon.append(vertex(points[a], points[b], values[a], values[b]))
        if len(polygon) < 3:
            continue
        xyz = np.array([vertices[v] for v in polygon])
        centre = xyz.mean(axis=0)
        axis = xyz[0]-centre
        normal = np.cross(xyz[1]-xyz[0], xyz[2]-xyz[0])
        side = np.cross(normal, axis)
        angles = np.arctan2((xyz-centre)@side / np.linalg.norm(side),
                            (xyz-centre)@axis / np.linalg.norm(axis))
        order = np.argsort(angles)
        polygon = [polygon[i] for i in order]
        for j in range(1, len(polygon)-1):
            indices.extend([polygon[0], polygon[j], polygon[j+1]])

vertices = np.array(vertices)
residual = max(abs(field(p)) for p in vertices)
assert residual < 1e-8
# Opposing faces must have identical transverse coordinates to meet without gaps.
for axis in range(3):
    other = [j for j in range(3) if j != axis]
    boundaries = []
    for value in [0, 1]:
        points = vertices[np.abs(vertices[:, axis]-value) < 1e-8][:, other]
        boundaries.append({tuple(np.round(p, 7)) for p in points})
    assert boundaries[0] == boundaries[1], (axis, len(boundaries[0]), len(boundaries[1]))
data = {"vertices": np.round(vertices, 8).reshape(-1).tolist(), "indices": indices}
(ROOT / 'dist/gyroid.js').write_text('const TORUS_GYROID = '+json.dumps(data, separators=(',', ':'))+';\n')
print(f'{len(vertices)} vertices; {len(indices)//3} triangles; residual {residual:.3g}; all periodic seams match')
