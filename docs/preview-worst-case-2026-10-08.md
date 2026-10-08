# Homepage preview: worst-case audit, 8 October 2026

All 102 visible studies loaded at their original resolution without JavaScript or WebGL errors. The cold desktop sweep had a 0.53 s median, a 2.55 s 95th percentile and a 2.89 s maximum. Repeated tests of seven selected outliers reached 3.09 s. These are measured results under the conditions below, not a bound on all visitors' load times.

The constrained-connection test exposed an important remaining problem: Reptile interlock took 20.17 s from navigation, or 19.73 s after scrolling its preview into view. Its 3,001,285-byte mathematical texture took 15.24 s to transfer. The other transformation textures are also large (2.09–2.28 MB). They must not be replaced with lower-resolution fields or lossy images to improve this result.

## Selected outliers

Desktop values are medians of three fresh-browser runs. Stress values are one cold run per study, followed by 35 seconds of animation. The preview is below the initial mobile fold; the test scrolls it into view immediately after DOMContentLoaded. Both navigation-to-ready and scroll-to-ready are recorded. Readiness follows the real first draw.

| Study | Desktop median | Stress: navigation to ready | Stress: scroll to ready | Stress frames/s |
| --- | ---: | ---: | ---: | ---: |
| 132 — Reptile interlock | 2.66 s | 20.17 s | 19.73 s | 60.0 |
| 128 — Pythagorean turn | 2.72 s | 4.32 s | 3.88 s | 60.0 |
| 127 — Octagon bloom | 2.45 s | 4.35 s | 3.91 s | 60.0 |
| 117 — Sierpiński inlay | 2.39 s | 3.92 s | 3.48 s | 59.9 |
| 148 — Phason Tide | 1.14 s | 3.07 s | 2.63 s | 59.9 |
| 139 — Eyes of emergence | 2.34 s | 4.38 s | 3.94 s | 60.0 |
| 28 — Jacquard manifold | 0.46 s | 2.25 s | 1.83 s | 60.0 |

Across all seven 35-second stress samples, rendering stayed at native 660 × 660 pixels for a 220 × 220 CSS-pixel preview. No downscaling, placeholder or scientific parameter changes were made. Consult the raw frame interval, long-task and GPU samples for variability; an average near 60 frames/s does not imply every frame meets its deadline. Desktop repeats included an approximately 100 ms frame gap and a 109 ms long task in one Sierpiński inlay run.

## Conditions and limits

- Runtime: release 27, source commit 0721a12d444284693193f6ad755108d3641d7105, imported into the built Astro homepage with its actual visibility/playback controller. Consent/CV changes correspond to website commit c6e143d1d260a19041efb01fae5c31894d49e032 (published by PR 60).
- Windows, Edge 154, NVIDIA RTX 4070 Laptop GPU via ANGLE/D3D11. Each case starts a fresh browser process with the browser GPU shader disk cache disabled. Tests run serially on the GPU; these are laboratory measurements, not field Core Web Vitals.
- Desktop: 1440 × 1000, DPR 2, 466 × 466 raster, local HTTP, no CPU/network throttling, uncompressed resources. Screen every study for 2.5 seconds after a 0.5-second warm-up, then repeat the selected seven three times in alternating order.
- Stress: 390 × 844, DPR 3, 4× browser CPU slowdown, 150 ms network latency, 1.6 Mbit/s download and 750 kbit/s upload, empty browser caches. Text assets are Brotli-compressed at quality 5 before timing, corresponding to the production CDN's use of Brotli (not a byte-identical CDN implementation). PNG data textures remain unchanged.
- Selection combines the three slowest starters, the three highest sampled GPU costs, and the separate Sierpiński inlay renderer. Reptile interlock also has the largest downloaded resource in the full sweep.
- The first screening harness approximated rendered frames from draw-submission gaps over 2 ms. Repeats and stress runs use unique animation timestamps that actually submitted onscreen draws. Use the latter for frame-rate conclusions. GPU queries are sampled by the existing renderer, not every frame.
- No actual phone GPU, Safari/iOS, battery use, thermal throttling, background workload matrix or exhaustive parameter/animation-phase sweep was tested. Slower connections or weaker devices can be considerably worse. The homepage's existing 30-second startup timeout is unchanged.

## Next optimization targets

1. The five creature-field textures dominate constrained-network startup. Investigate lossless encoding, exact-channel packing and earlier fetch scheduling, proving decoded data and rendered pixel equivalence before release. No compression saving has yet been demonstrated by this audit.
2. Many slow desktop studies share the transformation renderer, which still compiles a dynamic multi-study graphics program. Per-study preparation is a candidate; measure it separately and preserve all mathematical controls and output.

The audit changes no runtime rendering code, assets, quality settings or study eligibility. It records remaining problems rather than hiding expensive studies from random selection.

## Reproduce

Build the website separately and pass its output directory. Run these serially, with no competing GPU benchmarks:

```sh
node scripts/audit-preview-worst-case.cjs --site=../website/dist --out=desktop-scan.json
node scripts/audit-preview-worst-case.cjs --site=../website/dist --out=desktop-repeats.json --ids=132,128,127,117,148,139,28 --rounds=3 --sample=2500
node scripts/audit-preview-worst-case.cjs --site=../website/dist --out=mobile-stress.json --profile=mobile-stress --compression=br --ids=132,128,127,117,148,139,28 --sample=35000
```

Full per-case results, resource sizes/timings, browser/GPU identity, raster dimensions and frame metrics are in [the JSON record](preview-worst-case-2026-10-08.json).
