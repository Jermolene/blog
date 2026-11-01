# Radialator — handover

Status: working prototype, published as a claude.ai artifact (originally named "Parity Rosette").
Everything is in `index.html`.

## Layout of index.html
| Section | What it does |
|---|---|
| CSS `:root` tokens | Light/dark theme tokens (fonts: Big Shoulders Display, Instrument Sans, IBM Plex Mono). |
| `SPEC` | Every slider: key, label, range, step, default, panel group (A = shapes, B = overlays & motion; C = colour & clip holds the three selects, see `GROUPS`). Each group is a `<details>`; double-clicking a control or heading resets it to `DEFAULTS` via `resetKeys`. Adding a parameter = add a SPEC row + uniform + shader use + `buildSVG` use. |
| `PALETTES` / `DEFAULTS` | Ink/paper pairs. `DEFAULTS` also sets `clip=3` (star rim), `invert=1`, `palette=0`. |
| `FS` (fragment shader) | The whole pattern, evaluated per pixel with 4× rotated-grid supersampling. One offscreen WebGL canvas (`glc`) renders everything; results are copied to the visible canvas or to explore tiles. |
| `extent(p)` | World radius that fills the view (`rim` when clip = star rim, else the shapes' outer reach). View half-width = `extent × 1.0089`. |
| `render(p, target, size, phase)` | Sets uniforms and draws. `target=null` leaves the result in `glc` (used by the explorer, which converts to PNG data URLs). |
| Explore | 3×3 grid of `div.cell` with background-image tiles. Was canvases originally; Safari stretched them vertically, so tiles are now images scaled with `contain`. |
| `mutate` / `randomise` | Mutation picks 1–3 SPEC params and nudges by ±strength×range; small chance to flip invert/palette/clip. Only groups ticked in the explore box (`allowed`) are mutated; speed never is. Randomise biases toward "classic" settings (circles, no twist, 1 layer) about half the time. |
| `buildSVG(p, phase)` | Vector export (see below). |
| Save SVG | Uses the artifact `downloads` capability when `window.claude` exists; standalone it falls back to a blob link. |

## The pattern maths (shader order — mirror this exactly)
For a screen point `p0` (world units, y up), `rad0 = |p0|`, `E = extent`:
1. **Dome warp** (`dome = w`, skipped if w ≤ 0.001): `t = min(rad0/E, 1/w)`; pattern radius `= E·asin(w·t)/asin(w)`. This is an orthographic-sphere-style projection: cells compress toward the rim.
2. **Twist**: rotate by `twist × rad` (rad = warped radius).
3. **Shapes**: for layer l (scale `layerScale^l`, alternating phase direction, offset by π/N per layer) and i < N: centre at `offset·(cos a, sin a)`, `a = 2πi/N + lπ/N ± phase`; local frame rotated by `a·spin + tilt`; x divided by `aspect`; superellipse `|x|^P + |y|^P < 1` scaled by `radius`. Count hits.
4. `par = count mod 2`, XOR ring index `floor(rad/E × rings)`, XOR sector index with `S = 2·round(spokes·N/2)` sectors starting at angle `phase − π`.
5. XOR `invert`. Hub: `rad0 < hub·E` forces ink.
6. **Clip**: 0 none; 1 union of shapes (outline = |union SDF| < w/2); 2 disc radius E; 3 star rim = 2N-gon with vertices at radius `rim` (angles k·2π/N) and `rim·(1−notch)` (mid-angles), outlined.
7. Outline width in world units = `outline × E × 1.0089 / 500` (i.e. `outline` px at a 1000px render).

## SVG export
One `<path fill-rule="evenodd">` containing every shape outline, every odd sector wedge, every ring boundary circle and (if inverted) a full-view rectangle. Even-odd fill of overlapping subpaths gives the same coverage-parity result as the shader. Points are built in pattern space and mapped back to the screen with the inverse of steps 1–2 (`toScreen`). Shapes are 360-point polylines; wedges are 96-point rays (so twist spirals are curved) extended radially to 2× view to cover corners beyond the dome clamp. Clip is a `<clipPath>`; hub is a circle; the star outline is a stroke on top.

Known gap: in clip mode 1 (to shapes) the outline is a 2w stroke **under** the clipped pattern, so only the outer half shows. The boundary sits w/2 further out than on screen. A true union outline needs path boolean ops (e.g. a clipper library).

## How the default was fitted to reference/original.jpeg
- Transition counts round circles at several radii → 96 black/white flips → 48 circles × 2 spokes per circle (96 sectors).
- Vertex radii along one spoke didn't fit a flat circle family; fitting with the asin projection did (residual < 0.3°). This is the dome parameter.
- Rim profile (61 local maxima over 360°, ~22px notch) → 48-point star polygon.
- Final coordinate-descent fit over offset, radius, dome, notch and rim against the reference pixels: offset 0.6705, radius 0.694, dome 0.9785, notch 0.0242, rim 0.989. Odd count = paper (invert = 1). Hub 0.042.
- Result: ~94% pixel agreement at 2048px. The remaining error is edge antialiasing and the centre, where the spokes are sub-pixel and the two renderers blur them differently.

## Ideas not yet done
- PNG export at arbitrary resolution (render offscreen at e.g. 4096 via `render(P, canvas, 4096)` and save with `downloads`).
- URL or JSON parameter sharing / a saved-favourites strip.
- A true vector union for the clip-to-shapes outline.
- Spin animation is phase-only. Animating other parameters (dome, twist) would be cheap in the shader.

## Running the checks
```
pip install playwright numpy pillow && python3 -m playwright install chromium
python3 tools/compare_reference.py   # default vs reference image
python3 tools/check_svg.py 5         # SVG export vs WebGL, default + 5 random
```
Outputs go to `out/`.

## Dots mode (2026-11-01)
The Dots group draws the pattern as a halftone instead of solid ink. `dotCentre()` in the shader finds the nearest dot on a grid, a hex lattice, a sunflower spiral (`spiralCentre()`: dot n at radius h·√((n+½)/π) turned n golden angles; it inverts the local lattice spanned by two consecutive Fibonacci neighbours, with the residuals F·g − round(F·g) passed in double precision as `uFE`) or rings (each ring's dot count is a multiple of `count`, so the N-fold symmetry survives); `dotInk()` averages the solid pattern over a 3×3 box across the cell and optionally lights it as a dome (bigger dots where lit, as in Spotty Sphericle). The radius is `0.5·h·dotSize·√ink`, h = 2·extent/dotN. `buildDotsSVG()` enumerates the same centres and reads the coverage back from a 2048px solid render, so the SVG matches the screen (under 1% mismatch on all layouts). Keep the two in step as with the solid geometry.
