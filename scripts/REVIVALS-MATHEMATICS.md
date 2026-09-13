# Talbot Cathedral and Elliptic Eyes

These two studies use the periodic coordinates of the existing torus surface. They do not simulate a light wave travelling in the induced metric of the embedded torus. The mathematical domains are a flat periodic parameter torus for the Fourier field and the square complex torus `C / (Z + iZ)` for the elliptic field. The chart is pulled back to the unchanged torus geometry.

## Talbot Cathedral

For integer Fourier order `N` (4, 6 or 8), the field is the finite sum

\[
\Psi(x,y,t)=\sum_{n,m=-N}^{N}c_{nm}
\exp\{2\pi i(nx+my)-i(n^2+m^2)t\}.
\]

The seed coefficients are a Gaussian spectrum multiplied by a harmonic polynomial:

\[
c_{nm}=e^{-0.13(n^2+m^2)}
\left[A+B\,0.018(n^4-6n^2m^2+m^4)\right],
\quad A=0.06+0.12(1-w),\quad B=0.6+w.
\]

This fourth-degree polynomial produces the eight-petal seed. The crossed-rosette variant replaces it with `0.22(n²−m²)`. The diamond variant uses wave vectors `(n+m,n−m)`, whose squared length is `2(n²+m²)`. Its phase therefore includes precisely that factor of two. All variants use a quadratic phase in the actual spatial wave vector, rather than independently morphing a flower outline.

At `t+2π` each integer-frequency mode reconstructs exactly. At `t=2πp/q`, define

\[
g_j=\frac1q\sum_{n=0}^{q-1}
e^{-2\pi ipn^2/q}e^{2\pi inj/q}.
\]

The evolved field equals the coherent sum of translated initial fields

\[
\Psi(x,y,2\pi p/q)=\sum_{j,k=0}^{q-1}
g_jg_k\,\Psi(x-j/q,y-k/q,0).
\]

Thus the smaller constellations are genuine fractional revivals governed by quadratic Gauss sums. Their phases interfere before intensity is calculated. The model is finite and smooth: it does **not** claim the fractal behaviour of an ideal infinite spectrum. The finite-period wave model and its rational-distance interpretation are motivated by [Berry and Klein, *Integer, fractional and fractal Talbot effects* (1996)](https://cris.technion.ac.il/en/publications/integer-fractional-and-fractal-talbot-effects/).

The implementation separates the two-dimensional sum into one-dimensional zeroth, second and fourth moments. This evaluates the same field and analytic spatial derivatives in `O(N)` operations instead of `O(N²)`. Temporal coefficients are uploaded once per draw in reusable arrays; the pixel shader uses a harmonic recurrence. No image sequence or interpolation between unrelated shapes is involved.

Intensity is `|Ψ|²`. A logarithmic intensity level gives black filled rosettes with fine intensity contours. Both the fill boundary and contours use their analytic screen gradients with the shared pixel-area coverage filter. The shader translates the chart by one spatial period per full animation cycle; an optional integer revival count changes the quadratic evolution without breaking the full-cycle join.

Recommended presentation: density 88 (four root repeats), Fourier order 6, lobe weight 0.65, one revival per procession, phase zero. At the default speed 0.6 the full animation cycle takes approximately 53.3 seconds. Variants are **Eightfold revival**, **Crossed rosettes**, and **Diamond constellation**. Integer density choices give two, four or six root repeats; they do not change the torus topology.

## Elliptic Eyes

Write `θ(z)=θ₁(πz | i)`. The balanced meromorphic ratio is

\[
F(z,t)=\frac{\theta(z-a(t))\theta(z+a(t))}
{\theta(z-b(t))\theta(z+b(t))},
\]

with

\[
a(t)=r_x\cos(t/2)+ir_y\sin(t/2),\qquad
b(t)=-r_x\sin(t/2)+ir_y\cos(t/2).
\]

Here `rₓ=0.23+0.065w` and `rᵧ=0.12+0.025w`. The zeros and poles each sum to zero. Consequently the quasi-periodic multipliers of the four theta factors cancel, so `F(z+1,t)=F(z+i,t)=F(z,t)`. The Fourier expansion and quasi-periodicity used here are stated in [DLMF §20.2, Definitions and Periodic Properties](https://dlmf.nist.gov/20.2).

At half a cycle `a(t+π)=b(t)` and `b(t+π)=−a(t)`. The unordered zero and pole pairs swap, giving `F(z,t+π)=1/F(z,t)`. At a full cycle both pairs change sign and the original function returns. These are algebraic identities, not matching endpoints selected from an animation.

To evaluate stably in a reduced square, the shader uses the periodic Green potential

\[
G(z)=\log|\theta(z)|-\pi(\operatorname{Im}z)^2,
\]

\[
H=\log|F|=G(z-a)+G(z+a)-G(z-b)-G(z+b)
+2\pi\left[(\operatorname{Im}a)^2-(\operatorname{Im}b)^2\right].
\]

The final constant is necessary; omitting it changes the original balanced theta ratio. Each `G` argument is reduced to `[-½,½]²`. The first three terms of the theta Fourier series have absolute truncation error below `3×10⁻¹²` on that square; single-precision GPU arithmetic is the larger numerical limit. The potential gradient follows from the analytic logarithmic derivative.

The inherited eyes use successive holomorphic covering maps `z↦cz`. The three variants take `c=2`, `1+i` and `2+i`, of degrees 4, 2 and 5 respectively. For three levels the unnormalized potential is

\[
H_{\rm total}=4H(z,t)+2H(cz,t+0.25)+H(c^2z,t+0.50).
\]

This is the logarithmic modulus of the meromorphic product `F(z,t)⁴F(cz,t+0.25)²F(c²z,t+0.50)`. Dividing its displayed potential by seven changes contrast scale, not the underlying product or zero/pole multiplicities. One- and two-level choices use the corresponding integer weights. A half-cycle negates the complete potential at every fixed point. The chart procession travels an integer number of periods per half-cycle, preserving this statement on the rendered torus.

Black and white are selected by the sign of `H`. Even, periodic contours of `H` engrave the eyelids and iris levels, so negating `H` complements the base tone. The final contrast transfer is symmetric around one half. The shared light choreography is optional and defaults to off. When enabled, it modulates this base shading; the reciprocal-function identity remains unchanged, while the extra light need not preserve the image's half-cycle complement.

Recommended presentation: density 40 (two root repeats), three covering generations, divisor excursion 0.55, phase zero, speed 0.6. Variants are **Nested eyelids**, **Turning inheritance**, and **Fivefold descent**. Larger density choices remain available; the lower default keeps the branching arches and successive scales readable.

### Display filtering and numerical limits

The mathematical theta ratio has zeros and poles. For displaying these singularities over finite pixels, the shader regularizes the squared theta magnitude with the pixel variance times the squared norm of its covariant derivative. This preserves the potential's lattice periodicity; using the ordinary theta derivative would not. The regularization applies to the displayed potential, rather than claiming to remove the singularities from the meromorphic function. Very small covering generations are attenuated toward their spatial mean potential. Sign exchange remains algebraically exact through this filtering.

As with other implicit-curve shaders, analytic pixel coverage locally approximates curved contours by their tangent. It is not a closed-form two-dimensional area integral of the entire nonlinear function. Near a regularized singularity the gradient is a stable analytic approximation; the colour exchange and periodicity do not depend on it being an exact derivative of the regularizer. These limitations are distinct from the verified identities of the underlying functions.

## Reproducible checks

- `node scripts/verify-revivals.cjs` is dependency-free CI validation. It checks 1,290 identities, including the actual production draw's Float32 Fourier coefficients and zero/pole uniforms, fractional translated-copy reconstruction, theta lattice periods and reciprocal exchange. Maximum observed absolute error: `3.06×10⁻⁸` (Float32 uniforms).
- `python scripts/verify-revivals.py` independently compares the separable field to a direct 2D spectrum (729 cases), checks full revivals (729), rational Gauss-sum reconstruction (3,645), three-term theta truncation (10,000), lattice periods (6,579), direct theta ratios against Green potentials (2,193), reciprocity (2,193), and covering product/sign identities (19,737 each). Details are saved in `revivals-math-results.json`.
- `node scripts/verify-revivals-gpu.cjs` runs the production shader helpers and analytic gradients on a floating-point WebGL target. Its independently generated fixture comes from the preceding Python check. On the tested RTX 4070 Laptop / Chrome ANGLE driver, 7,776 Talbot values had maximum normalized error `2.65×10⁻⁴`; 1,728 elliptic values had maximum normalized error `2.76×10⁻⁵`.
- `node scripts/render-revivals-browser.cjs` captures the actual production renderer at exact phases, updating all CPU-supplied coefficients through its real draw function. Each set of 30 native captures covers three variants of each study at 0, π/4, π/2, π and 2π. `python scripts/analyse-revivals-images.py` verifies the resulting images independently: full-period images differ by at most one 8-bit intensity step at two repeats, or two steps at six repeats. Elliptic half-cycle image sums differ from perfect complements by at most two steps, including raster and colour quantization. No WebGL errors were reported.

Initial reference images are in `scripts/revivals-browser` (two repeats) and `scripts/revivals-browser-density6` (six repeats). The first density comparison attempted to set a raw value on an indexed UI slider and therefore selected its maximum; the stored capture metadata correctly records 136. The capture harness now overrides the renderer's physical density directly when requested. The final four-repeat Talbot thumbnail/preview is captured from the integrated preset after this correction, rather than relabelling the six-repeat image.
