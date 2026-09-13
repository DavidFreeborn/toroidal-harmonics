# Performance audit, revision 20

This is the historical performance pass. It established regression equivalence and several mathematical invariants, but did not establish sufficient visual quality. User screenshots subsequently exposed existing sampling defects and overly aggressive adaptive resolution. See [the revision 21 visual audit](VISUAL-QUALITY.md) for the corrections and current measurements.

This revision retains 99 visible studies, 302 named constructions and the archived studies. It fixes rigid-solid distortion and reduces rendering work without reducing the chamber mesh, strand samples, recursion depth, density or animation stages.

## Measured results

Native Mesa llvmpipe, LLVM 20.1.2, four rendering threads, 900 × 620 pixels, 105° perspective and each study's curated defaults. Frame times include CPU submission and completed drawing; they exclude first-use compilation, warm-up and image readback. Resolution adaptation is disabled in these comparisons. The baseline is `da93d68d31df23bdb9d8d71db47282dedad3d8b0`.

| Study | Baseline median | Final median | Less frame time | Repeated comparison |
| --- | ---: | ---: | ---: | ---: |
| Farey eyes | 167.7 ms | 93.7 ms | 44% | 36% |
| Braided trefoils | 95.9 ms | 58.2 ms | 39% | 30% |
| Cable of cables | 122.4 ms | 79.3 ms | 35% | 30% |
| Recursive gimbals | 87.7 ms | 59.5 ms | 32% | 26% |
| Rolling reconstruction | 30.1 ms | 23.6 ms | 22% | 23% |
| Recursive cube eclipse | 76.9 ms | 60.3 ms | 22% | 12% |
| Jacquard manifold | 175.3 ms | 150.0 ms | 14% | 7% |

The median reduction across the 99-study sweep was 15.46%. Benefits vary substantially. For example, Cellular exchange improved only 5.5% in the final sweep and 9.5% in the repeated comparison. Two unchanged pentagrid render paths measured slightly slower in the full sweep; repeat measurements did not reproduce those regressions. All measurements, including the outliers, are retained in [audit-results.json](audit-results.json).

These are software-renderer comparisons, not browser GPU frame rates. No hardware browser profile was available in this execution environment. They establish measurable reductions here, not universal stutter-free playback or a globally optimal renderer. Dense woven geometry remains expensive when all its mathematical detail is retained. The native harness's matrix-transfer overhead also differs from the browser's direct JavaScript-to-WebGL buffers.

## Changes and invariants

- **Rigid solids.** Rolling cubes and local sculptural solids use a torus-centred orthonormal frame, followed by their existing rotations and uniform scale. Mapping every solid vertex independently back onto the curved torus had bent the solids. Surface tessellations, paper and flowing ribbons still follow their intended curved geometry.
- **Static chamber visibility.** The original 192 × 96 mesh is retained. View changes produce a conservative subset of its original triangle indices. At the audit view, 21,890 of 36,864 triangles are submitted, about 41% fewer. Adaptive raster changes do not rebuild this index set.
- **Closed surfaces.** Correctly oriented cube faces, closed frames and cables omit their back faces. Open paper and ribbon surfaces remain two-sided. The depth buffer and all original visible curve samples remain in use.
- **Jacquard visibility.** Each curve is split at existing vertices into 64 chunks. Bounds include both periodic shears, all nine strands, crossing lift and transverse width. Hidden chunks can be omitted while retaining every visible sample and the original draw order. The default reference image is pixel-identical.
- **Recursive cube transforms.** A solid shares its world frame and ancestry transforms across its vertices. The recursive maps and their phases are unchanged. Menger frames retain their existing shared transforms.
- **Exact Farey arithmetic.** A bitmask implements coprimality for the sixteen supported denominators. It replaces repeated per-pixel Euclidean algorithms without approximating rational positions or removing eyes.
- **Compilation and selection.** Shader stages compile together. The optional parallel-compile extension is polled without asking for an unfinished link result. The previous study keeps running while the next renderer or detailed field loads; a late result cannot overwrite a newer selection. Without the extension, a synchronous link-status fallback remains necessary. See [parallel shader compilation](https://developer.mozilla.org/en-US/docs/Web/API/KHR_parallel_shader_compile).
- **Frame pacing.** The governor remembers sustainable raster sizes across constructions and related settings. It avoids repeatedly probing a known failed size. Optional, bounded GPU timer queries can establish headroom for recovery; disjoint and stale results are rejected. Density, recursion and topology never change automatically. The clock uses full elapsed time instead of clipping long frames to 100 ms.
- **Contour assets.** The five Escher atlases use two 1820 × 1820 texture-array layers. Every texel and all 49 geometric stages are retained on a device with a 2048-pixel texture limit; the old half-resolution fallback is removed. Two fields remain resident. Evicted pending loads settle safely, and failures retain a working geometric fallback. The upload follows the documented [texture-array layer API](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/texSubImage3D).

The fixed camera is `[3.65, 0, 0]`, with major radius 3 and minor radius 1.8. Visibility bounds and the central occluder depend on those facts. Revisit them if the camera or torus dimensions become adjustable. Rasterisation and finite tessellation remain numerical approximations. The Penrose studies remain periodic approximants, and fractal constructions retain their selected finite depths.

## Verification

| Check | Coverage and result |
| --- | --- |
| Native GLES compilation | All 13 complete shader pairs compile and link |
| UI integration | All 302 constructions; conditional controls, random recipes, pause, visibility, input coalescing and renderer failure |
| Presets | 99 defaults, 25 hidden studies and 1,485 valid random recipes |
| Rigid geometry | 300 GPU-captured cubes: equal edges, planar faces and right angles; maximum relative error below 0.000004 |
| Transform equivalence | 47,304 recursive-cube vertex and metadata comparisons; maximum absolute error below 0.000004 |
| Image comparison | All 99 defaults compared against the original or the intentionally corrected rigid reference; maximum mean intensity difference 0.006432 on a 0–255 scale |
| Visibility | 168 paired full/cropped renders across portrait, landscape, narrow/wide perspectives and density/phase extremes; maximum mean difference 0.008; final gimbal path rechecked separately |
| Cycle closure | All 302 constructions close after 2π; no mean error above 0.15 |
| Internal generations | 240 shrinking-step probes found no persistent threshold jumps |
| Gradual metamorphoses | All 54 constructions scanned through 96 interior intervals, then refined at their largest changes; endpoint approaches and playback joins passed |
| Torus seams | All 45 animal/density/construction combinations close around both torus directions |
| Contrast cycle | 17 phases match the corresponding manual contrast settings |
| Atlas layout | Every source texel retained; 105 rendered old/new sampling comparisons, maximum mean error below 0.001 |
| Scheduling | Simulated 60/90/120/144 Hz, sustained overload, isolated stalls, recovery, stale/disjoint timers, shader failure and context loss |
| Asset lifetime | 100 switches, a 2048 texture limit, failed loads and out-of-order completion; residency remains bounded |

Small image differences at antialiased silhouettes and floating-point-sensitive edges are reported rather than described as pixel-exact. No broad structural differences were accepted as performance improvements.

Rejected experiments included shader specialisation, a depth prepass, front-to-back chamber sorting, a Cellular seed texture cache and an extra cable transform-feedback pass. They were slower, inconsistent or offered too little benefit for their complexity here. A gimbal transform cache was also removed after it changed a small number of coplanar face-edge shading decisions. The hidden-face optimisation supplies the retained gimbal improvement.

## Reproduction

Runtime code has no new dependencies. Native checks require Node, Python, NumPy, Pillow, moderngl and Mesa EGL. UI checks require `linkedom` on `NODE_PATH`. Keep `LP_NUM_THREADS=4` constant for performance comparisons, avoid concurrent CPU-heavy jobs, and compare the same raster dimensions and parameters.

```sh
node scripts/verify-presets.cjs
node scripts/verify-scheduling.cjs
node scripts/verify-asset-cache.cjs
node scripts/verify-runtime.cjs
python scripts/validate-shaders.py
python scripts/verify-rigid-geometry.py
python scripts/verify-visibility.py
python scripts/verify-atlas-layout.py
python scripts/check-cycle-motion.py
python scripts/check-metamorphosis-transitions.py
python scripts/verify-winding-seams.py
python scripts/verify-contrast-cycle.py
LP_NUM_THREADS=4 python scripts/audit-rendering.py --output /tmp/torus-audit --samples 11
```

`audit-rendering.py --root /path/to/checkout` measures another revision using its own shaders and renderer. Its `instanced_triangles` field counts only instanced model submissions; zero does not mean the surface study draws no triangles. `benchmark-draws.py` reports completed isolated geometry drawing time and is separate from full-frame measurements. Software GPU timer queries were found to under-report completed drawing costs here, so the benchmark uses wall time through `finish()`; the live app does not call `finish()`.

The state caching, asynchronous status checks and bounded resource approach follow [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices). Optional GPU features have explicit fallbacks.
