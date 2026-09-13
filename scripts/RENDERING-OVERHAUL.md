# Rendering and responsiveness overhaul — revision 22

## Scope and acceptance criteria

This pass reviews the shipped buildless WebGL2 application, rather than treating agreement with an older render as evidence of good image quality. The 99 visible studies, 302 named constructions, archived studies, presets, controls, winding numbers, recursion choices and mathematical geometry are retained.

1. Thin square boundaries must remain continuous as they cross pixels, move into the distance and pass through recursive levels.
2. Pigment coverage must agree with independent pixel-area integration and supersampled browser references; blur is not a substitute for correct coverage.
3. Shader linking, geometry allocation, texture upload and first GPU use must complete before an incoming study is presented. Cached studies must avoid repeating that preparation.
4. Late selections must not overwrite newer requests. Random and Extra random must prepare the actual recipe, retain pause, and begin without consuming preparation delay as animation time.
5. Idle preparation must require visible artwork, no active selection and measured spare GPU capacity (or pause), with one bounded job at a time.
6. Adaptive rendering must use available display detail, retain the CSS-pixel floor, and respond to sustained overload without sacrificing mathematical detail.
7. Verification must exercise actual Chrome/ANGLE/WebGL2 output and interactions, alongside deterministic numerical and resource-lifetime tests.

## Audit findings and implementation plan

| Finding | Consequence | Implemented action |
| --- | --- | --- |
| Readiness stopped at shader linking | First-draw compilation, geometry allocation and texture work reached the visible frame | Prepare geometry, draw into a small offscreen framebuffer matching default MSAA/depth, then await a GPU fence without blocking finish/readback |
| Renderer families were discovered on demand | First Random could wait seconds for an unfamiliar family | Deduplicate compilation; prepare the next random choice, neighbours, pointer/focus targets and representative families in a prioritized idle queue |
| General procedural shaders compiled unrelated studies together | Long compilation and high GPU register pressure | Compile Metamorphosis, Tessellations and Topology with only study identity constant. All scientific parameters and construction variants remain dynamic; cache the resulting small programs per study |
| Extra random applied parameters after selection | The prepared default did not match incoming geometry | Construct and prepare the randomized recipe before committing |
| Preparation delay entered the new animation's first elapsed-time step | Uneven starts despite asynchronous linking | Keep the previous state active; restart the presentation timestamp at commit, retaining phase and pause |
| Background work and stale timers looked like rendering cost | Inappropriate resolution changes and GPU competition | Suspend measurements across preparation/resizes, reject stale/disjoint results, sample once per eight frames and reacquire headroom between compilation and warming |
| A fixed 1.15/1.8-megapixel budget capped Adaptive | Coarse high-DPI rendering even with GPU headroom | Start at display density up to 2×, retain the CSS-pixel floor, and scale only in response to measured load. Native and Fine stay fixed |
| Square counterweave differentiated folded distances | Shared borders and nested frames became dashed | Use continuous chart Jacobians, analytic box gradients, periodic shared-edge coverage and filtered checkerboard tones |
| Recursive functions differentiated coordinates mutated inside loops | ANGLE/NVIDIA rendered broken Sierpiński squares despite previous native Mesa tests | Calculate Jacobians before recursion and explicitly propagate scale/rotation |
| Scalar edge footprints discarded pixel orientation | Incorrect oblique and subpixel coverage | Integrate a linear edge over the screen pixel using both derivative components, with independently checked limiting cases |
| Hard grey thresholds flipped edge colours | Groups of engraved edges flashed simultaneously | Continuous contrast transitions with the same endpoints in five renderer families |
| Curved Chiaroscuro surfaces used triangle normals | Faceted highlights | Reuse existing analytic normals for ribbons and cables |
| Six families built geometry during first drawing | Allocation/upload work delayed presentation | Expose and reuse prepare() in Kinetic, Sculptures, Chiaroscuro, Mechanisms, Quasicrystal and archived Cycles |
| Transformations allocated uniform tuple arrays every frame | Recurring garbage | Bind uniforms directly |
| Existing verification relied on Linux/Mesa and mocked DOM | Browser-specific defects remained undetected | Add reproducible Playwright compilation, references, pixel-coverage tests, collection review and timing captures |

## Browser evidence

Hardware validation uses Chrome, ANGLE Direct3D11 and an NVIDIA GeForce RTX 4070 Laptop GPU. Browser timing and resolution are recorded with captures. These results apply to this environment, not every browser, display or GPU.

### Image quality

At 500 × 340 CSS pixels, full rendering resolution and three phases (0.4, 2.1, 5.2), frames are compared with area-averaged 2000 × 1360 browser references. References contain sixteen raster samples per output pixel, in addition to shader coverage filtering. UI overlays are hidden. Grayscale RMSE uses a 0–255 scale; it is not a subjective quality score.

| Study | Previous RMSE | Corrected RMSE | Reference-error reduction |
| --- | --- | --- | --- |
| Square counterweave | 27.45 / 26.79 / 26.67 | 4.11 / 4.09 / 4.06 | approximately 85% |
| Sierpiński counterpoint | 24.84 / 24.81 / 24.70 | 4.54 / 4.39 / 4.41 | approximately 82% |

The comparison also saves supersampled references of the corrected renderer, allowing self-convergence to be inspected separately from the previous implementation.

[Visual comparison](browser-quality/comparison.png) · [Raw image metrics](browser-quality/results.json)

The expanded pass covers 18 procedural studies at 54 fixed phase cases; every case improves against its supersampled reference. Sierpiński inlay's error decreases by about 77%, recursive eyes by about 67%, and Paperfolding damask by about 52%. Four subpixel ancestry samples fix fine leaf-pigment aliasing where edge filtering alone is insufficient. [Consolidated metrics](browser-quality-summary.json) and [additional comparisons](browser-quality-final/comparison.png) retain the results.

Further Transformations checks improve Sierpiński bloom from RMSE 22.03–22.71 to 8.92–9.18, while also improving Quadtree genesis, Eyes of emergence and Golden mitosis. Pearl waves loses its unintended square-boundary marks. [Extended metrics](browser-extended/results.json) record all measured phases.

### Compilation architecture

The expanded accurate shaders initially exposed a regression: the two general programs needed about 8–9 seconds to compile on ANGLE. That intermediate implementation was rejected. Selected-study compilation reduces measured Metamorphosis cases to 0.31–0.62 seconds and Square counterweave/Interlocking waves to 0.72/0.31 seconds. Sierpiński inlay's more expensive four-region program remains approximately 2.62 seconds cold; other studies no longer wait for it. These are link-readiness measurements, not visible transition times. [Compilation measurements](browser-specialization.json)

All 41 Metamorphosis/Tessellations identities were compared with their general programs across three variants and two phases: 246 image pairs. The largest mean difference was below 0.0004 intensity levels on a 0–255 scale, consistent with rounding. [Equivalence results](browser-specialization-equivalence.json)

The same approach substantially reduces Topology's per-frame cost. An isolated direct-query comparison at 2200 × 1520, phase 0.4 and curated parameters alternates general and specialized draws, consuming each query before the next study. Across the 22 actual identities, median GPU time is 16.65 → 0.66 ms; per-study reductions range from 74% to 98%. This shader fixture uses a 64 × 32 torus mesh for both programs; production retains its original 192 × 96 mesh. It isolates specialization with identical current shader mathematics, not application-wide speedup. [Raw paired GPU samples](browser-specialization-gpu.json)

Topology also passes 176 image pairs (four variants, two phases). Its maximum mean difference is 0.03294 intensity levels out of 255, with rare isolated pixels differing by up to 38. These are near-equivalent images, not pixel-identical results. All dynamic controls remain uniforms. [Per-kind comparison data](browser-specialization-equivalence.json)

### Validation

- Independent GPU edge coverage: 1,008 cases against clipped pixel polygon areas; maximum absolute error approximately 1.8 × 10⁻⁷. Periodic coverage: 105 checks; maximum error approximately 4.8 × 10⁻⁸.
- DOM integration: 302 constructions, delayed/out-of-order selection, Random/Extra random, pause, hidden/offscreen scheduling, coalesced inputs, renderer failure and rendering choices.
- Geometry preparation: 1,188 recipes and 2,376 subsequent draws without geometry allocation after preparation.
- Scheduling: 60/90/120/144 Hz, isolated/sustained overload, recovery, stale/disjoint timers, invalid samples, headroom gating and query cleanup.
- Preparation: compile deduplication/retry, bounded framebuffer/MSAA/depth matching, fences, state restoration, priority/cancellation and context loss.
- Contrast: shrinking-step probes in five corrected families converge, retaining their endpoint colours.
- Existing closed-frame union geometry, presets and 100-switch bounded atlas-lifetime tests pass.
- Actual WebGL2: all 13 shader source pairs compile, all 99 visible studies and 302 constructions draw without browser/GL errors, and 30 reported/recursive construction extremes pass. Portrait/landscape DPR2 Native/Fine/Adaptive rasters, rapid Random/Extra random/final-selection races, and retained pause state pass. Fine includes a 6400 × 3600 raster. [Browser validation](browser-validation.json)
- 864 production-GLSL recursive Jacobians agree with independent calculations: maximum normalized derivative error 5.12 × 10⁻⁷; maximum position error 2.52 × 10⁻⁵.

### Application performance and Random readiness

The final comparison runs the original snapshot and completed application separately in hardware-accelerated headless Chrome 152 on the same RTX 4070 Laptop GPU. No competing capture or GPU jobs run during measurement. The collection sweep uses the real application, a 1100 × 760 CSS viewport, DPR 2 and fixed Full display resolution: **2200 × 1520 raster pixels for both versions**. Phase is fixed at 0.4, with curated parameters, a 180 ms settling period and approximately one second of samples per study. Background preparation is disabled only for this steady-rendering comparison. GPU queries are tagged with the study that issued them; late results from a previous study are discarded. At least four valid samples contribute to each study median.

| Measurement | Original | Completed overhaul |
| --- | --- | --- |
| Median of the 99 study GPU medians | 4.12 ms | 2.49 ms |
| Square counterweave GPU median | 5.07 ms | 1.84 ms |
| Sierpiński counterpoint GPU median | 5.34 ms | 3.06 ms |
| Sierpiński inlay GPU median | 4.29 ms | 2.91 ms |
| Random selection readiness, median of 12 switches | 201.2 ms | 19.3 ms |
| Slowest Random readiness in that sequence | 2429.2 ms | 201.2 ms |

The collection median decreases by approximately 40%; the median of individual paired percentage reductions is 35.4%. These are different aggregates. 69 of 99 studies measure faster. More accurate filters sometimes cost extra: Sierpiński bloom increases from 4.06 to 5.28 ms while its reference error falls by about 60%. Small differences in otherwise unchanged studies include normal GPU clock, power and sampling variation. This is one matched browser/device run, not a universal speedup or a statistical confidence interval. [Consolidated timings and all per-study results](browser-performance-summary.json) · [Original steady samples](browser-steady-before.json) · [Final steady samples](browser-steady-after.json)

The separate Random benchmark leaves the real preparation queue enabled, uses DPR 1, waits three seconds after startup and 2.4 seconds between clicks, and repeats the same seeded sequence of 12 studies. Median readiness improves by approximately 90%. Readiness means the requested selection has committed and its preparation indicator has cleared; it does not measure the display's exact presentation time. The sequence exercises useful idle preparation and is complemented by the rapid-click correctness tests above. Cold, unprepared selections can still take longer, as the compilation measurements show. [Original Random sequence](browser-random-before.json) · [Final Random sequence](browser-random-after.json)

## Design limits

Sampling filters represent subpixel detail by its area contribution. A finite display cannot resolve arbitrarily fine fractals. The collection review still found near-Nyquist dashes in some extremely fine Hamiltonian silk/Guilloché bands; the work does not certify every parameter combination as alias-free. Automatic rendering settings do not change recursion, density, topology or winding. Fine mode renders twice Native's density in each direction, costing four times as many raster pixels. A first visit can still wait for an unprepared shader or asset; the interface indicates preparation while retaining the previous artwork. Optional GPU extensions have fallbacks.

At the start of this revision-22 audit, the supplied directory was not a Git checkout. Original dist and scripts were saved separately before editing for reference comparisons and preserved in a local backup archive. Revision 22 itself was not deployed; the subsequent revision 23 adds four studies and independent public editions.

## Reproduction

Runtime remains static: serve dist with any HTTP server. There is no new runtime library or build step.

```sh
npm ci
npm test
npm run test:browser
node scripts/browser-audit.cjs /path/to/dist /path/to/results
node scripts/compare-browser-quality.cjs /path/to/baseline/dist /path/to/images
node scripts/capture-browser-overview.cjs /path/to/overview
node scripts/verify-specialization.cjs topology.js --benchmark
node scripts/benchmark-browser.cjs /path/to/dist /path/to/steady.json steady
node scripts/benchmark-browser.cjs /path/to/dist /path/to/random.json random
```

Browser tools default to installed Chrome. Set TORUS_BROWSER=msedge for Edge, or run `npx playwright install chromium` and set TORUS_BROWSER=chromium. Measure performance alone, at matched viewport/DPR/rendering settings; screenshots and concurrent GPU jobs invalidate fine timing comparisons. Python/Pillow/NumPy analyse and assemble image references only.

Filtering follows pixel-footprint integration as described in [Physically Based Rendering](https://www.pbr-book.org/4ed/Textures_and_Materials/Texture_Sampling_and_Antialiasing). Shader readiness uses [KHR_parallel_shader_compile](https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/) and WebGL2 fences; linking is deliberately distinguished from completed first rendering.
