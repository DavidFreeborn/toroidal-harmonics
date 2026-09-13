# Revision 24 — light effects and profile preview

The visible collection contains 102 studies and 311 constructions. Spinor Loom joins the suppressed studies; its renderer, construction, tests and original preset remain available in the source.

## Collection changes

Talbot Cathedral, Elliptic Eyes, Phason Tide and the archived Spinor Loom now support the existing six light effects, with choreography, strength and frequency controls. Effects default to off. The mathematical field or material shading is unchanged when effects are off or strength is zero. A hardware WebGL check compares 936 RGBA32F renders across 216 study/construction/phase/effect combinations: off/zero-strength output is bit-for-bit identical to the original shading, and each effect responds to its controls. The base elliptic reciprocal-image identity is distinct from optional external light modulation.

Readme entries now contain one brief note and their mathematical links. The five artistic influences appear once in a global section. All 40 mathematical concepts and the source credit are retained. The website catalogue description is now “Mathematical artistry on a torus.”

## Profile preview

The website pairs a 260px portrait with an equally sized square artwork, followed by academic profile links. At narrow widths the squares are 220px; the biography is placed between them to remain readily accessible. The square contains only the rendered artwork. A small caption links to the selected study, with a text Play/Pause control below the image.

The preview uses the production renderer through a generated `embed.html`, chooses from the visible collection with the same Random selection function, and avoids the previous choice when session storage is available. Framing is adjusted for the square aperture. The embedded document loads only nine core scripts plus its selected renderer and required data. It does not prepare other studies, load hidden thumbnails, or fetch the Moore field for unrelated studies.

The parent reserves the image dimensions, keeps a 42KB static WebP fallback, and waits for page load, idle time and visibility before creating the iframe. The first frame is paused until the parent grants playback. Offscreen/background states pause motion, reduced motion begins with a random still frame, and Save-Data keeps the static fallback. Failure leaves the fallback and artwork link available. Both sides validate message source and origin.

The biography remains static HTML. Existing canonical and Person/ProfilePage data are preserved; homepage social imagery identifies the actual portrait. The standalone embed is explicitly `noindex` and is omitted from the sitemap. These choices follow Google's guidance on [lazy-loaded secondary content](https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading) and [reserving image and iframe dimensions](https://web.dev/articles/optimize-cls). Search ranking and field Core Web Vitals cannot be guaranteed by a local test.

## Reproduction

The complete Node suite passes. Hardware Chrome/WebGL2 compiles all 16 shader pairs and renders all 311 visible constructions plus 48 extreme parameter cases. Pixel-coverage, recursive-Jacobian, six-effect and preview checks pass. The guide and controls pass desktop, tablet, mobile and 200%-equivalent reflow checks. Other browser engines and physical mobile hardware were not tested.

```sh
npm test
npm run test:browser
node scripts/verify-embed.cjs
node scripts/verify-release-ui.cjs
```

`node scripts/build-square-preview.cjs` recaptures the real curated artwork at 520×520 raster pixels. Run `npm run build:release` afterwards and use the website synchronizer to import the complete release. The website has separate layout, lifecycle and fallback checks alongside its Astro, build, SEO and link validation.
