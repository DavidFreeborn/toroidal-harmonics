# Phason Tide: construction and verification

Phason Tide changes the adjacency of a periodic rhomb mosaic. Its three rational pentagrid duals contain 204, 492 or 1,210 rhombi on a unit torus chart. These are finite periodic approximants, not infinite Penrose tilings. Pulling their charts back to the curved chamber further changes their apparent metric.

The primary reference is Szallas, Jagannathan and Wessel, [*A phason disordered two dimensional quantum antiferromagnet*](https://arxiv.org/abs/0901.4441), especially Figure 2 and the construction on page 2. Their local operation replaces a threefold vertex and its three incident bonds. If its old position is `c` and its three neighbours are `n0, n1, n2`, the new position is `n0 + n1 + n2 − 2c`. The paper studies quantum antiferromagnetism; this artwork illustrates the geometric rearrangement and does not simulate that physical model.

The implementation identifies actual degree-three vertices in the periodic pentagrid graph and selects disjoint three-rhomb patches, favouring those bordering fivefold stars. Each patch is a convex hexagon. The three new rhombi occupy the same hexagon and retain the same three edge-family pairs. Old incident bonds disappear and three different bonds appear. Their changed connections reorganize neighbouring stars.

The continuous interpolation is an explicit presentation choice. A discrete phason flip does not prescribe a rigid-tile animation. Here the interior vertex moves between its two permitted positions while its three boundary junctions traverse alternate hexagon edges. Three temporary convex pentagons fill the patch throughout this movement. Their endpoint shapes are the two genuine rhomb tilings. Thus the mosaic stays filled, but its tiles are not asserted to remain rigid rhombi during a flip.

The interpolation uses a quintic easing with zero first and second derivatives at both ends. A sinusoidal front flips and unflips the sites during one closed `2π` cycle. Its integer chart winding can be meridional, diagonal, counter-diagonal or helical; one, two or three repeated wavefront pairs can circulate simultaneously. Every active patch still reaches both genuine rhomb configurations during the cycle, for every allowed front breadth. Time is reduced into `[0, 2π)` before uploading it to the GPU, so equivalent completed cycles use the same floating-point shader input.

The three variants are **Travelling front**, **Countertides**, and **Star relay**. The first follows the selected winding uniformly. Countertides sends fronts in opposite directions in the two longitudinal sectors. Star relay offsets each patch by its angle about the nearest bordering degree-five vertex, so connected star neighbourhoods respond in sequence. Their disjoint patch selections also differ. The 492-rhomb middle model has 106 independent flipping patches, compared with 43 in the open 204-rhomb model and 265–266 in the finest model.

Tile contours are inward parallel offsets of the actual deforming polygons. Their scale is `2 × area / perimeter`, which changes continuously through a flip. They are engraving within a tile, not extra claims of Penrose subdivision or additional topological flips. Pigment can distinguish the two rhomb shape families, the five unoriented bisector classes of the edge-family pairs, or the reversed shape-family assignment. At intermediate states the family pigment follows the same continuous morph as the geometry. The optional shared light choreography acts on these material tones.

| Public key | Construction | Stops or range |
| --- | --- | --- |
| `density` | Pentagrid approximant | 40 / 88 / 136 → 204 / 492 / 1,210 rhombi |
| `layers` | Tile contours | 1 = plain; 2 = one inset contour; 3 = two |
| `balance` | Contour breadth | 0–1, when contours are enabled |
| `winding` | Front route | 0 = meridional; 1 = diagonal; 2 = counter-diagonal; 3 = helical |
| `turns` | Simultaneous wavefront pairs | 1–3; the complete temporal period remains `2π` |
| `palette` | Material assignment | shape families / five directions / reversed families |
| `wave` | Front breadth | 0–1 |

The module defaults to the middle approximant, one inset contour, diagonal winding and one wavefront pair. The application owns the curated speed, perspective, contrast and shared light settings. The renderer retains internal density values `0`, `1`, `2` for existing scientific fixtures.

Rendering uses the common continuous torus surface, rather than separately tessellating moving tile edges. A static periodic spatial index identifies at most 6, 8 or 10 candidates for the three densities. Each tile's normalized edge planes and conservative pixel bounds are computed once and reused for every inset. Interior and exterior pixels return immediately; a pixel crossing only one edge uses its exact analytic half-plane area. Only pixels meeting a polygon corner need full convex clipping. Adjacent pigment contributions are accumulated and normalized. Endpoint states explicitly use four-vertex rhombi, avoiding spurious tiny fifth edges from floating-point interpolation. There is no mesh, texture or program allocation during prepared playback. The fixed nine-entry model/variant cache has at most 18 data textures and does not allocate string keys on each draw.

`node scripts/verify-phason.cjs` checks all three approximant sizes and variants: 80,860 local interpolation states, 576 complete torus phases, nonnegative convex tile areas, true rhomb endpoints, preserved edge-family pairs, replacement of incident bonds, periodic spatial lookup, edge incidence/orientation, and torus Euler characteristic. Moving junctions split their neighbouring edges before manifold incidence is counted. The maximum observed local area error is `2.23 × 10⁻¹⁶` in the unit chart.

`node scripts/verify-phason-coverage.cjs` compares the production GLSL pixel clipping against an independent double-precision reference that clips polygons against pixel boundaries. All 648 cases pass, including rhomb endpoints, near-degenerate moving junctions, and anisotropic pixel footprints. The largest fractional pixel-area error is `0.000021843`; the mean is `0.000001065`.

`node scripts/verify-phason-detail.cjs` checks 241,920 phase states across every allowed front route, count and breadth. It verifies both chart seams, exact endpoint reachability and temporal periodicity. Its mocked GPU also verifies all nine cached models, uniform-only control changes, and 216 prepared draws with zero resource creation or upload.

`node scripts/verify-phason-insets.cjs` compares 2,160 production GLSL inset coverages against a separate double-precision polygon offset and pixel clipping implementation. All cases pass, with maximum error `0.000021980` and mean error `0.000000385`.

`node scripts/audit-phason-detail.cjs <artifact-directory>` captures the actual production renderer, checks visible control responses and periodic frames, measures isolated completed GPU work, and instruments total polygon coverage to detect missing screen tiles. All 21 option captures repeat pixel-exactly after `2π`. All 18 tested partition frames have positive coverage everywhere and complete polygon area for footprints within the static spatial lookup's padding. At near-tangent torus silhouettes, a few pixel footprints exceed that finite bound: 4–25 of 3,344,000 pixels in the single-sample diagnostic have partial summed area. Their final pigment is normalized, and no empty tile remains. This is a local projection/filtering limitation, distinct from the corrected endpoint rhomb defect. GPU scripts must be run without competing rendering benchmarks.

The isolated warmed detail audit at 2,200 × 1,520 on the same RTX 4070 Laptop measured 7.64–8.32 ms median GPU work for 492 rhombi with one inset contour, across all three variants and two phases. The plain 204-rhomb case took 3.72 ms. The most demanding 1,210-rhomb/two-contour case took 26.63 ms in that run; it benefits from the application's adaptive rendering budget. These are local observations rather than guaranteed frame rates; the whole-application audit owns final comparative performance claims.

The original release's `scripts/audit-phason.cjs` measured the plain 204-rhomb version at 2,200 × 1,520 pixels on an RTX 4070 Laptop / ANGLE D3D11 renderer: 5.23, 5.43 and 5.09 ms median GPU time for its three variants. Those are historical measurements of the original sparse construction. The new detail audit reports current settings and timing per case; device-specific observations are not universal frame-rate claims.
