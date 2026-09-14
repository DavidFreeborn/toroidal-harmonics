# Revision 25 — deeper revival and phason studies

Talbot Cathedral, Elliptic Eyes and Phason Tide now expose more of their mathematical structure through meaningful controls, more substantial contour treatments and curated light effects. The collection retains 102 visible studies and 311 constructions. Spinor Loom remains archived with its code and tests intact.

The previous presets switched the shared lighting off, which also concealed strength and frequency controls. The wave renderers had fixed spectral/inheritance choices and only thin incised contours; Phason's application dispatch always selected its coarsest tiling, despite finer approximants already existing in the renderer.

## Construction and presentation

| Study | Added controls and behavior |
| --- | --- |
| Talbot Cathedral | Aperture width controls the Gaussian spectrum independently of Fourier order. Four integer lattice charts alter the arrangement around the chamber. Engraving density and incised, banded or tonal treatments expose the evolving interference field. The starting composition uses Fourier order eight, broad bands and mild winding light. |
| Elliptic Eyes | Generation phase and integer multiplicity weighting change how descendants inherit their ancestors' arrangement. A wider zero/pole orbit range, four lattice charts and three contour treatments produce different connected level-set structures. Controls without an effect at one generation are hidden. |
| Phason Tide | All three periodic approximants are available: 204, 492 and 1,210 rhombi. Plain, one-inset and two-inset treatments follow actual moving tile boundaries. Front direction, number, breadth and three systematic pigment assignments are adjustable. Countertides and Star relay use distinct phase arrangements. |

These are changes to the existing fields and tilings, rather than unrelated decorative layers. Shared light choreography remains independent and can be disabled. Mathematical full-cycle identities are preserved; Elliptic Eyes' half-cycle reciprocal/complement identity applies to its underlying field and light-off shading. Optional light modulation is not claimed to obey that complementary image identity.

The mathematical construction, normalization and numerical limits are documented in [REVIVALS-DEPTH.md](../scripts/REVIVALS-DEPTH.md), [REVIVALS-MATHEMATICS.md](../scripts/REVIVALS-MATHEMATICS.md) and [PHASON-TIDE.md](../scripts/PHASON-TIDE.md).

## Interaction and rendering

Phason density and construction edits now prepare and stage the requested tiling offscreen before committing it. Superseded edits cannot replace a newer selection. Current time, pause and independent uniform controls survive preparation. Extra random selects controlling parameters before newly revealed dependent controls.

The two wave studies keep the same number of field evaluations. Phason uses a finite nine-entry geometry cache, shared clipping planes and analytic pixel coverage. Endpoint rhombi are handled explicitly so vanishing polygon edges cannot become spurious clipping planes and create grey gaps.

## Verification

The expanded numerical suites check production Fourier/divisor uploads against independent Fourier sums, fractional-copy reconstruction, theta ratios and torus periodicity. GPU comparisons check actual images, light-off equivalence, parameter sensitivity, tile coverage and inset coverage. Separate application tests exercise pending geometry edits, selection races, parameter dependencies and preserved playback state.

Reproduce the release checks with:

```sh
npm test
npm run test:browser
node scripts/audit-revival-depth.cjs
node scripts/verify-embed.cjs dist 145 146 148
node scripts/verify-release-ui.cjs
node scripts/audit-new-study-performance.cjs dist report.json
```

Run hardware timing audits sequentially, without another GPU workload. The independent website edition imports the complete SHA-256-verified release; its home-page preview continues to use the same renderer and visible catalogue.
