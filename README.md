# Toroidal harmonics

Mathematical artistry on a torus: 102 kinetic studies, with 311 named constructions.

[Open the artwork](https://davidfreeborn.github.io/toroidal-harmonics/) · [Short study readme](https://davidfreeborn.github.io/toroidal-harmonics/readme.html) · [Independent website edition](https://www.davidpeterwallisfreeborn.com/fun/toroidal-harmonics/)

Serve `dist` with a static web server. Requires WebGL 2. All runtime assets are included.

Choose a study below the artwork. Open Parameters for its constructions and controls. Random loads another study with its defaults; Extra random also varies the parameters. Restore defaults resets the current study.

The Rendering control offers Adaptive, Full display resolution, and Fine (twice the display resolution in each direction). Adaptive starts at display density up to 2× and responds to measured performance, retaining at least one raster pixel per CSS pixel. Full and Fine keep their selected resolution during playback; Fine costs more rendering time. The browser's renderbuffer dimensions remain the upper limit. Rendering quality is independent of a study's mathematical parameters.

Incoming studies prepare their shaders, geometry and first GPU draw before appearing. The next random choice and nearby studies prepare in the background when capacity is available. Unprepared studies show a small preparation indicator while the current artwork continues. Random and Extra random retain the pause state.

**Talbot Cathedral** uses finite Fourier wave revivals; **Elliptic Eyes** exchanges theta-function zeros and poles; **Phason Tide** changes tile adjacency in a periodic pentagrid. Each has three constructions, begins at its cycle origin and supports the shared light effects. **Spinor Loom** is retained in the source and suppressed from the visible collection. The small **Readme** link opens the selected study’s one-line explanation and linked concepts; artistic influences appear once in a separate section.

Keys: ← / → select, R random, Shift+R extra random, Space pause, F fullscreen, H hide controls, Escape close panel.

For GitHub Pages, select **Settings → Pages → Source → GitHub Actions**, then push to `main` or run **Publish artwork**.

Presets are defined in `scripts/curation.json`; regenerate with `node scripts/build-presets.cjs`. Hidden studies remain in the source.

The figurative tessellations draw on Escher’s constructions. Reptile outline adapted from [Sean Michael Ragan’s lizard tile](https://www.seanmichaelragan.com/files/MC_Escher_single_lizard_tile.svg); source data and attribution are in `scripts/escher-lizard-source.json`. Quasicrystal studies use periodic approximants and golden subdivisions.

The [current rendering audit and overhaul](scripts/RENDERING-OVERHAUL.md) records the findings, implementation plan, browser reference images, performance measurements and remaining limits. Earlier reports are retained in [the revision 21 visual audit](scripts/VISUAL-QUALITY.md) and [the revision 20 performance audit](scripts/PERFORMANCE.md).

Development verification: `npm ci`, then `npm test`. With Chrome installed, `npm run test:browser` checks production WebGL2 shaders, every construction, responsive rendering and pixel coverage. These dependencies are development tools; serving `dist` requires no installation or build.

Run `npm run build:release` after editing the collection or runtime. It regenerates the short guide, canvas-only preview and SHA-256 asset manifest. The website’s `scripts/sync-toroidal-harmonics.js` imports the complete release, verifies every file, and adapts only main-page/guide HTML metadata and navigation. All renderer code and assets remain identical and are served directly from the website.

The noindex `embed.html` preview selects a visible study with the same Random selection logic on each refresh, avoiding the preceding choice when session storage is available. It starts paused, loads its renderer on demand and disables background study preparation. A same-origin parent controls playback through the validated `torus-preview-state` message; the preview reports its selected study after presenting a valid frame. The website supplies a reserved square, static fallback, deferred loading and offscreen/reduced-motion behaviour.

The [revision 24 report](docs/release-24.md) covers light effects, the simplified guide and profile preview; [revision 23](docs/release-23.md) records the four mathematical additions. Implementation notes: [Talbot and elliptic fields](scripts/REVIVALS-MATHEMATICS.md), [Spinor Loom](docs/spinor-loom.md), [Phason Tide](scripts/PHASON-TIDE.md).
