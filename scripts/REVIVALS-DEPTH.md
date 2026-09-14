# Deeper controls for the revival studies

This revision retains every original Fourier and elliptic construction. The original shared light choreography continues to modulate the finished scalar-field shading; it is not duplicated in the mathematical model.

The earlier compositions exposed few independent choices: a fixed Gaussian Fourier spectrum, fixed elliptic inheritance phases and multiplicities, and a single thin contour treatment. Large uniform regions could conceal much of the interference and inherited structure. The new controls expose those mathematical degrees of freedom and offer wider level-set bands or continuous scalar shading. No noise field, decorative shape layer, extra Fourier loop or extra theta evaluation has been added.

## Talbot aperture

The aperture control changes the Gaussian coefficient width to `alpha = 0.07 + 0.12 balance`; write `r = alpha / 0.13`. Each one-dimensional temporal coefficient is

`sqrt(r) exp(-alpha n²) exp(-i n² t turns)`.

The crossed harmonic polynomial is multiplied by `r`, and the fourth-degree rosette polynomial by `r²`. Together with the `r` from the product of the two one-dimensional kernels, these are the Gaussian scaling factors that keep the spatial seed's core and derivative lobes at comparable amplitudes while changing its width. Finite truncation prevents this from being an exact dilation of an infinite-plane Gaussian, and wider seeds also interact with their periodic neighbours. It is an amplitude normalization, not a claim of identical finite-spectrum energy.

The zero-frequency coefficient must receive the same one-dimensional normalization as every other coefficient. The kernel therefore starts with the uploaded mode-zero coefficient. The former width `alpha=0.13` reproduces the original coefficients exactly.

All spatial frequencies and quadratic phase factors remain integers. The full-cycle identity and the rational-time translated-copy formula therefore hold for every aperture, order, lobe weight and construction. See [Berry and Klein (1996)](https://cris.technion.ac.il/en/publications/integer-fractional-and-fractal-talbot-effects/) for the underlying fractional-revival interpretation. The finite field here continues to use a smooth finite spectrum.

## Elliptic inheritance

The existing balanced theta ratio retains its zeros at `±a` and poles at `±b`. The orbit control now spans a visibly wider range of ellipse aspect ratios:

`rx = 0.26575 + 0.14 (wave - 0.55)`

`ry = 0.13375 + 0.15 (wave - 0.55)`.

The reference orbit at `wave=0.55` remains unchanged. Both radii stay strictly positive throughout the permitted range. Generation `j` evaluates the original reciprocal evolution at `t + j π balance`. A half-cycle still exchanges the unordered zero and pole pairs at every generation, for every inheritance phase.

The integer generation ratio is `q = spectral + 1`, so its permitted values are 1, 2 and 3. For `L` generations the displayed potential is the normalized sum

`sum_j q^(L-1-j) log|F(c^j z, t + j π balance)| / sum_j q^(L-1-j)`.

Its unnormalized numerator is the log modulus of an actual meromorphic product with integer multiplicities. Equal weights reveal more descendants; higher ratios emphasize their ancestors. Every constituent still uses one of the original Gaussian-integer covers `c=2`, `1+i`, or `2+i`. At one generation those cover choices, the inheritance phase and the generation ratio have no effect; the parameter profile can hide the latter two accordingly.

The theta periodicity and cancellation of the balanced divisor's quasi-period multipliers remain those given by [DLMF §20.2](https://dlmf.nist.gov/20.2). The existing covariant singularity filtering and unresolved-generation attenuation remain display approximations; they do not change the exact underlying meromorphic identity.

## Lattice charts and shading

Four integer matrices pull the original field back onto the torus display chart:

`[[1,0],[0,1]]`, `[[1,1],[0,1]]`, `[[1,0],[1,1]]`, `[[1,1],[1,2]]`.

Each has determinant one. Every integer lattice shift remains an integer lattice shift, so each chart preserves periodicity and the exact full-cycle join. Elliptic procession closes after a half-cycle even after the chart change. The analytic screen derivatives are taken after this uniform linear map and propagated through the covers. The Fourier dispersion and complex analyticity are defined in the model's chart; a display shear is not presented as a different isotropic wave equation or as a holomorphic map in the original unsheared complex coordinate.

All three scalar treatments expose an engraving-density control. The incised treatment retains narrow contour lines. Banded treatment widens those same resolved level sets. Tonal treatment maps continuous log intensity or elliptic log modulus to greys, retaining a finer set of contours. It does not create or claim geometrical relief.

For Elliptic Eyes, the sign-based treatment uses an even periodic contour mask. The continuous treatment uses `0.5 + 0.48 H / sqrt(1+H²)`, which complements under `H -> -H`; its contour mask is also even. The final symmetric contrast transfer therefore retains the half-cycle image complement when optional shared lighting is off. Shared lighting may intentionally break that image complement while leaving the function's reciprocal identity intact.

All hard level sets retain the shared analytic screen-footprint coverage. The number of Fourier terms and theta evaluations is unchanged; all added scalar and chart work has constant cost.

## Validation

`node scripts/verify-revivals-depth.cjs` checks actual production coefficient/divisor uploads against independent two-dimensional Fourier sums, fractional Gauss-sum copies, theta ratios, reciprocal exchange and integer lattice pullbacks. Its first run passed 7,441 checks, with maximum normalized error `3.88e-7` from Float32 coefficient uploads. The original 1,290-check suite also passes unchanged.

`node scripts/audit-revival-depth.cjs` is the hardware-browser capture, image-identity and parameter-sensitivity audit. Its saved report records the actual production options, frame sizes, GPU identification and image differences. Coordinate GPU access before running it.
