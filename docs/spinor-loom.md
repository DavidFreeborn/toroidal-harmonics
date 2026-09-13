# Spinor Loom: geometry and verification

Spinor Loom implements an explicit Dirac belt-trick homotopy. A cube turns
continuously in one direction while its attached ribbons form arches and return
to their original state after **720 degrees**. The outer ribbon attachments are
fixed relative to each mechanism. A single 360-degree turn returns the cube's
orientation but leaves the surrounding ribbons in a different configuration.

The mathematical inspiration is Alexander E. Holroyd's
[The spinor linkage—a mechanical implementation of the plate trick](https://arxiv.org/abs/2107.01681).
That paper gives a physical linkage with thirteen bodies and twelve hinges.
This visualization uses a smooth geometric homotopy with the same double-cover
principle, rather than simulating that particular linkage. It is an elastic
geometric deformation; ribbon arclength is not constrained and no material
stress or mechanical dynamics are claimed.

## Explicit construction

Write a quaternion as its scalar component followed by its three imaginary
components. At radial coordinate `r`, define

```
s = clamp((r - 0.38) / 0.77, 0, 1)
a = (pi/2) s^3 (10 - 15s + 6s^2)
c = cos(a), h = sin(a)
F(a,t) = c cos(t) + c sin(t) i + h j
Q(a,t) = F(a,t) conjugate(F(a,0))
```

Both factors have unit norm. Multiplication gives

```
Q = h^2 + c^2 cos(t)
    + c^2 sin(t) i
    + hc (1 - cos(t)) j
    - hc sin(t) k.
```

This is a based contraction of a great circle in the unit-quaternion sphere
`S^3`. On the inner region `r <= 0.38`, it equals `cos(t) + sin(t)i`, which
rotates the cube through angle `2t` about its x axis. For `r >= 1.15`, it equals
the identity. At `t = 0` and `t = 2pi`, every radius has the identity quaternion.
The quintic interpolation joins the rigid regions with continuous first and
second derivatives.

The actual material deformation is

```
Phi_t(p) = Q(|p|,t) p conjugate(Q(|p|,t)).
```

Here `p` is interpreted as a purely imaginary quaternion. This changes the
whole ribbon's spatial shape, including its centreline, rather than applying
an accumulated scalar twist to a fixed centreline. Conjugating `Q` by a constant
x-axis rotation changes the plane of the intermediate arches without changing
the cube's spin, attachment constraints, or period; the third variant alternates
that plane between neighbors.

## Attachments, crossings, normals

The undeformed ribbons are broad strips extending radially from the cube's
faces to small fixed anchor bars. Cube half-width is `0.21`; even its corners
lie inside radius `0.38`, so the entire cube and the beginning of each ribbon
undergo exactly the same rigid rotation. Every anchor point lies outside radius
`1.15` and remains fixed. Ribbon breadth stays within the face width.

The ambient map preserves radius. Its explicit inverse is

```
Phi_t^-1(y) = conjugate(Q(|y|,t)) y Q(|y|,t).
```

It is therefore a smooth embedding: originally disjoint ribbons cannot cross
one another or pass through the cube. The differential is nonsingular and
orientation preserving (its determinant is one). The finite mesh approximates
these analytic surfaces with 160 length segments and eight width segments per
ribbon. Surface normals come from the exact differential applied to the two
material tangent directions, followed by their cross product. They do not use
triangle-facet derivatives or differenced animation frames.

Each complete mechanism is enclosed in a conservative sphere. Its centre runs
on a helical procession inside the torus. The placement code minimizes the exact
torus chord distance over every possible mean minor angle, then bounds each
mechanism to less than half the smallest separation. Spheres remain disjoint
through the complete animation, including the torus's inner wall. Their depth
also leaves every point in front of the white torus surface. These bounds cover
all variants and ribbon-breadth settings.

## Material and rendering behavior

Cube face pigments, the dark and pale sides of every ribbon, and the anchor
pigments are fixed in material coordinates. The base material's light source
is fixed; its dark–light motion comes from turning the surfaces, revealing
opposite sides, and geometric occlusion. The shared light choreography can
optionally modulate that shading and defaults to off; it does not change the
quaternion deformation or the geometry.
The optional palette control exchanges the two pigments explicitly.

The two required meshes are cached (two ribbons and four ribbons). `prepare`
allocates the selected mesh and placement recipe before presentation. Steady
rendering updates a small reusable instance buffer, with no mesh allocation or
re-tessellation. Each mechanism is instanced in one draw call. The module also
provides `dispose` to release its buffers, vertex arrays, and program.

## Variants and controls

| Setting | Meaning |
| --- | --- |
| Twin belts | Two opposing broad ribbons, making the double-turn cycle easiest to follow |
| Crossed loom | Four ribbons attached to four cube faces |
| Counterposed arches | Two ribbons with alternating arch planes between neighbors |
| Ribbon breadth | Changes the material width while keeping the attachment inside each cube face |
| Density | Changes the mechanism count and recomputes safe spacing; values 40 / 88 / 136 give 17 / 23 / 29 mechanisms |
| Helical pitch | One, two, three, or five minor turns per major circuit |
| Cycle count | One, two, or three complete 720-degree cycles per global animation period |

Recommended defaults are Twin belts, density `88`, breadth `0.65`, helical pitch
two (`winding: 1`), one cycle, contrast `0.95`, and palette `0`.

## Reproducible checks

Run `node scripts/verify-spinor.cjs` for independent quaternion-product and
finite-difference checks. Run `node scripts/capture-spinor.cjs` with the bundled
Playwright module on `NODE_PATH` for production-shader transform feedback and
phase captures. GPU jobs should run sequentially with other performance tests.

Verified on Chrome / ANGLE / NVIDIA RTX 4070 Laptop GPU:

- **864 CPU cases:** the expanded quaternion formula agrees with independent
  quaternion multiplication; its analytic differential agrees with central
  differences (maximum error `6.05e-9`).
- Radius preservation, explicit inverse, constant-speed cube orientation,
  fixed anchors, nonidentity after 360 degrees, and exact 720-degree periodicity
  all pass. Maximum determinant error is `4.44e-15`.
- **72 placement recipes / 504 draws:** no geometry allocation after preparation;
  enclosing spheres stay disjoint and inside the torus wall. Minimum sampled
  world-space gap between mechanism bounds is `0.0401`.
- **648 production GLSL vertices:** transform-feedback positions agree with
  the independent double-precision construction within `9.94e-7`; analytic
  normals agree within `3.24e-6`.
- All three variants were inspected in the actual application with the white
  torus background, and 27 isolated phase captures were checked. No WebGL or
  page errors occurred. Artifacts and numerical results are under
  `scripts/spinor-audit/`.
