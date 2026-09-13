# Visual quality audit, revision 21

Historical report. The [revision 22 overhaul](RENDERING-OVERHAUL.md) supersedes these findings with hardware-browser testing, additional sampling corrections and a new preparation pipeline.

The user supplied screenshots of broken contours in Nested separatrices, coarse pixels in Sierpiński counterpoint, and stray cell outlines in Rotating squares. The previous audit compared optimised output with an existing renderer that already contained defects. Passing those image comparisons did not establish visual quality. This pass uses supersampled references, explicit coverage integrals, independent numerical derivatives, geometric surface checks, and rendered animation checks.

## Findings and corrections

| Cause | Visible consequence | Correction |
| --- | --- | --- |
| Adaptive raster scale could fall to 0.5, in addition to a pixel-budget reduction | Enlarged coarse pixels and broken small details | Adaptive mode retains at least one raster pixel per CSS pixel; separate Full and Fine choices preserve an explicitly selected resolution |
| A slow study lowered the starting resolution of unrelated studies | A lighter study could remain unnecessarily coarse | Resolution history is retained per study/family, without a global inherited penalty |
| The conformal angle used a two-argument arctangent with a branch cut | A horizontal seam and a sudden loss of recursive detail | An equivalent unwrapped conformal lift preserves both its period and its smooth derivative |
| Smoothing differentiated cell identity changes and rotations across cell boundaries | Grey square outlines where the background should be empty | Rotating squares uses the analytic local box gradient and the continuous chart's derivatives; related circular and squircle cells have bounded filter widths |
| Thin strokes were smoothed as a single absolute-distance threshold | A very thin stroke could remain nearly half-opaque, producing excessive ink and speckling | Two edge coverages preserve the stroke's integrated width as it becomes subpixel |
| Repeated lines were sampled too coarsely | Moiré and unstable line contrast | The periodic pulse is integrated over the pixel footprint, with residual high-frequency aliases suppressed towards its mean pigment |
| Ternary holes used discontinuous local coordinates and discarded small generations | Broken squares, a seam, and lost fine-scale shading | Periodic interval integrals cover each square hole and its outline, while the selected recursive levels retain their area contribution |
| Finite differences of rapidly oscillating fields could cancel | Dashed or unstable contours despite apparently small derivative estimates | Nested separatrices, Hamiltonian silk, Separatrix engraving, Phase vortices, Guilloché and Meridian flow propagate analytic derivatives through their maps |
| Fine light patterns were point sampled | An additional source of shimmering | Screen-space filtering applies to the light waves; product-to-sum identities retain slowly varying interference beats |
| The twelve beams in each cubic gimbal overlapped at their corners | Coplanar faces could compete in the depth buffer | The exposed boundary of the exact beam union replaces overlapping faces; the dimensions and recursive ratios are unchanged |

The light field on a surface now uses that surface's existing angle chart directly. This avoids recovering the same angles from interpolated positions and removes two inverse trigonometric evaluations per illuminated surface fragment. Solids retain their world-space light coordinates. The small-argument sinc filter uses a sixth-order polynomial with maximum absolute error below 0.0000028 on its selected interval; larger arguments use the sine quotient.

The unwrapped meridional coordinate is

\[
y(v)=\frac{v-2\arctan(\sin v/(3+\cos v))}{2\pi},\qquad
y(v+2\pi)=y(v)+1,\qquad
y'(v)=\frac{2}{\pi(5+3\cos v)}.
\]

The shears, winding integers, recursion depths, density settings, geometric scales and animation clock are retained. Filtering changes the finite-resolution representation of those structures. It does not make a finite display capable of showing infinitely small detail. The Penrose modes remain periodic approximants, and the selected fractals retain finite recursion depths.

The sampling approach follows the distinction between point samples and pixel-area averages explained in [GPU Gems, Chapter 25](https://developer.nvidia.com/gpugems/gpugems/part-iv-image-processing/chapter-25-fast-filter-width-estimates-texture-maps). A finite pixel footprint is essential for stable procedural patterns in motion.

## Reference-image comparisons

The three reported studies were rendered at 400 × 272 pixels at phases 0.4, 2.1 and 5.2, with curated defaults and a 105° perspective. References use the previous renderer at four times the width and height, averaged back to the comparison size. Thus the reference contains sixteen samples per output pixel, in addition to the existing edge filtering. Results are grayscale RMSE on a 0–255 scale, not browser frame rates or a subjective quality score.

| Study | Previous RMSE, three phases | Corrected RMSE, three phases |
| --- | --- | --- |
| Rotating squares | 23.44, 22.96, 23.01 | 15.46, 15.22, 15.20 |
| Sierpiński counterpoint | 18.29, 16.60, 16.84 | 7.82, 7.38, 7.35 |
| Nested separatrices | 15.08, 14.75, 15.00 | 9.08, 9.12, 9.27 |

An initial separatrix correction became too soft and increased reference error. That attempt was rejected. Retaining the average contribution of subpixel chambers, rather than fading those chambers into white gaps, produced the final improvement. Both mathematical detail and its finite-resolution average matter.

[View the three default renders before and after correction](visual-quality-comparison.webp).

## Performance at equal resolution

Both revisions ran in isolation at 900 × 620 pixels on the same Mesa llvmpipe renderer with four threads. Each of the 99 defaults had three warmup frames and seven measured frames. Measurements include submission and completed drawing, excluding image readback and first-use compilation. Individual samples remain noisy; these are directional measurements, not hardware-browser predictions.

| Study | Previous median, ms | Corrected median, ms |
| --- | ---: | ---: |
| Rotating squares | 49.90 | 42.76 |
| Sierpiński counterpoint | 32.34 | 41.63 |
| Nested separatrices | 35.85 | 35.55 |
| Recursive gimbals | 50.86 | 61.58 |
| Hamiltonian silk | 42.19 | 40.92 |
| Phase vortices | 58.86 | 52.55 |

Across the collection, the median study's drawing-time ratio is 1.0648, an increase of about 6.5%; the sum of all study medians increases 6.9%. The more accurate coverage and light filtering carry a measurable cost, despite removing redundant angle reconstruction. This is a visual-correctness pass with some local speed improvements, not a universal speedup. The earlier visibility, mesh caching and scheduling optimisations remain in place. Avoiding a blurred, undersized raster can also increase actual device workload relative to the previous adaptive setting.

## Verification

- The periodic coverage integrals preserve their expected mean in 56 width/footprint combinations, with maximum mean error below 0.000018.
- Twenty finite-stroke tests preserve integrated width and leave pixels outside the stroke/filter support exactly empty.
- 3,072 GPU map/Jacobian cases agree with independent double-precision central differences. Maximum normalised derivative error is 0.000164; maximum map-position discrepancy is 0.0000016.
- The conformal lift has the correct period and derivative across multiple wrapped domains.
- Cubic frame meshes at all four depths have outward-facing, non-degenerate triangles, exactly two oppositely oriented faces at every edge, no duplicate triangles, and the exact union volume.
- Rebuilding the cubic joints reduced the three gimbal cycle-join mean discrepancies from approximately 0.25–0.29 to 0.00014–0.0028 at the test resolution.
- All 302 construction cycle joins and all 240 internal-threshold probes pass after the joint correction.
- All 54 metamorphosis constructions pass endpoint-approach checks and 96 interior intervals per construction; the existing 45 figurative winding-seam combinations and 17 contrast phases also pass.
- UI integration covers all 302 constructions, rendering-resolution choices, input coalescing, delayed selection, pause/visibility behaviour, fallback renderers and the adaptive resolution floor. All 99 presets, 25 archived studies and 1,485 random recipes remain valid.
- Native OpenGL ES renders exercise the production GLSL ES sources without translating them to desktop GLSL, in addition to the desktop reference renders. All 99 default studies render without graphics API errors. All 13 shader pairs compile and link.
- The three reported studies also have 120 native ES review frames: every construction at both density extremes and maximum permitted layers, at three phases, in landscape and portrait formats. Contact sheets and selected full images were inspected.

## Scope and reproduction

Native rendering uses Mesa llvmpipe. It does not validate the user's particular browser, GPU driver, display refresh rate or browser-selected multisampling. A matching CPU/ES render is evidence about the source and sampled output, not proof of identical behaviour on every device. A still-image reference comparison alone also cannot certify all possible temporal aliasing.

No compatible browser preview is available for this buildless static project in the current environment. The native GLES harness therefore renders the actual shader language and checks draw-time API errors. Its explicit ES clear, resolve and readback functions avoid desktop-only helper operations; setup-only capability-query errors are cleared before drawing, and draw errors are never ignored.

Keep performance runs isolated from the other rendering tests. Runtime dependencies have not changed. The native test tools require Python, NumPy, Pillow, ModernGL and Mesa EGL; UI checks use Node and linkedom.

```sh
node scripts/verify-frame-joints.cjs
python scripts/verify-sampling.py
python scripts/validate-shaders.py
node scripts/verify-presets.cjs
node scripts/verify-runtime.cjs
node scripts/verify-scheduling.cjs
python scripts/check-cycle-motion.py
python scripts/check-metamorphosis-transitions.py
python scripts/verify-winding-seams.py
python scripts/verify-contrast-cycle.py
TORUS_RENDER_API=gles python scripts/audit-rendering.py --output /tmp/torus-es --samples 1
TORUS_RENDER_API=gles python scripts/render-reported-cases.py --output /tmp/torus-cases
TORUS_RENDER_API=gles python scripts/render-reported-cases.py --portrait --output /tmp/torus-portrait
python scripts/compare-render-quality.py --baseline /path/to/revision-20 --output /tmp/torus-reference
```

Detailed numerical results and the final isolated timing comparison are recorded in `visual-quality-results.json` alongside this report.
