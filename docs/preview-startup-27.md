# Homepage preview startup — release 27

The embedded preview previously compiled the full base shader before choosing a random study, then fetched the selected renderer and its data in successive request waves. The homepage also downloaded a hidden 42 KB poster and delayed the reveal after the first live draw.

The preview now chooses once using the existing visible catalogue and Random function. It starts the selected renderer/data requests before base compilation, preserving dependency execution order. Only the embedded base shader's fixed study identity becomes a constant; the standalone shader, mathematical parameters, mesh, pixel filters and selected renderer remain unchanged. Study failover prepares the appropriate base program again. Background study preparation stays disabled for embeds.

Embedded rendering uses native display density with a minimum of two raster pixels per CSS pixel, bounded by GPU dimensions. It does not reduce resolution during playback. The standalone Adaptive, Native and Fine choices retain their existing behaviour.

Verification on Windows, Edge 154, NVIDIA RTX 4070 Laptop GPU:

- `npm test` passes, including all 311 constructions and the scientific, scheduling, preparation, geometry and asset-cache suites.
- `npm run test:preview` compares every one of the 102 visible default studies to a dynamic-base-shader reference at 220 CSS pixels, DPR 2. All red-channel pixel comparisons are exact (maximum and mean error zero). The artwork is monochrome; the test also checks nonblank output, WebGL errors, study labels and raster sizes.
- DPR 1 and DPR 3 checks confirm the 2x floor and uncapped native density above it. An aborted Phason renderer verifies failover.
- The website's 10 fixture and 11 actual-renderer lifecycle cases pass, including random-refresh exclusion, reduced motion, offscreen/hidden pause, Save-Data and WebGL failure. No JavaScript errors. No placeholder is fetched or shown, including failure states.

The website retains the full release through its SHA-256 importer. This report is controlled local evidence; it does not establish mobile-device performance or field Core Web Vitals.

Cold-start measurement: three fresh Edge processes per study and version, GPU shader disk cache disabled, local HTTP server, no network/CPU throttling, 1440 × 1000 viewport and DPR 2. Before and after both use a 466 × 466 artwork raster. The order alternates between rounds. Timings run from homepage navigation to the first real-frame ready message; they exclude the old extra reveal delay.

| Study ID | Previous median | Release 27 median | Reduction |
| --- | ---: | ---: | ---: |
| 148 — Phason Tide | 2.315 s | 1.203 s | 48% |
| 93 | 1.991 s | 0.867 s | 56% |
| 79 | 1.650 s | 0.509 s | 69% |
| 19 — Toroidal eigenmodes | 1.722 s | 0.521 s | 70% |

These four studies exercise four different renderer families. Results do not establish a speedup for every study, browser, network or device. The website also removes a scheduled start frame, two reveal frames and a 160 ms fade; those are separate from this readiness comparison.
