# Revision 23 — revivals and rearrangements

The collection now contains 103 studies and 314 constructions. This release retains the rendering and transition overhaul documented in [revision 22](../scripts/RENDERING-OVERHAUL.md).

## Four new studies

- **Talbot Cathedral:** a finite Fourier field with quadratic temporal phases reconstructs rosettes exactly. Fractional revivals create shifted copies through interference; integer spatial procession preserves the full cycle. [Equations and checks](../scripts/REVIVALS-MATHEMATICS.md).
- **Elliptic Eyes:** balanced Jacobi theta ratios on a square complex torus exchange zeros and poles after half a cycle. Torus covering maps generate the hierarchy; reciprocal shading exchanges black and white. [Equations and checks](../scripts/REVIVALS-MATHEMATICS.md).
- **Spinor Loom:** a based quaternion contraction realizes the 720° belt trick with turning cubes, fixed outer anchors and material ribbon colours. The construction uses an invertible ambient deformation and separated mechanisms. [Geometry and checks](spinor-loom.md).
- **Phason Tide:** local degree-three flips change tile adjacency in a periodic pentagrid. A travelling front moves through disjoint hexagonal patches. The gapless intermediate shapes are deforming pentagons; only the endpoints are rhomb tilings. [Construction and checks](../scripts/PHASON-TIDE.md).

Each study has three constructions and begins at its cycle origin after preparation. The selected pause state is preserved. The new renderers use the existing asynchronous preparation, program caches and display-resolution controls.

## Explanation and publication

The small Readme link opens the current study's brief. All 103 explanations have direct study links and concise mathematical and artistic references, supported by 40 linked concepts and five artist entries. Search and expandable sections keep it compact.

The website imports the complete static runtime, independently serves every renderer and asset, and adapts only HTML metadata and navigation. A SHA-256 release manifest makes the copies reproducibly comparable. The Parameters panel now leaves the study navigation usable on smaller screens.

## Verification

- The full Node suite passes, including numerical revival, theta-field, quaternion, tiling and guide checks.
- Hardware Chrome/WebGL2 compiles all 16 shader source pairs and renders all 314 constructions, including 54 extreme parameter cases, without browser or GL errors.
- Independent shader coverage, recursive Jacobian, new-field, ribbon and tile-area checks pass; detailed numerical results accompany the mathematical notes.
- Browser checks cover the four actual curated presets, pause retention, guide navigation/search, and desktop, tablet, mobile and 200%-equivalent CSS reflow. Both standalone and website copies pass.
- The website passes Astro checking, production build, SEO and link validation. Three pre-existing Astro hints and two unrelated duplicate-heading SEO warnings remain.

Timing evidence applies to the tested Chrome/ANGLE/NVIDIA system. Actual browser zoom, other browser engines and physical mobile hardware were not tested. Talbot evolution uses the flat periodic coordinate domain, rather than physical wave propagation on the curved embedded torus. Finite sampling cannot resolve arbitrary fractal detail.
