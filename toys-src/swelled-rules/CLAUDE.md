# Swelled Rules

Single-page generative toy: columns of swelled rules (thick in the middle, hairline at the column edges), after Jeremy's sketches in `reference/sketches.jpeg`. Everything is in `static-assets/toys/swelled-rules/index.html`, edited in place: no build step, no dependencies beyond two Google Fonts (Bodoni Moda, Libre Franklin). Open the file directly to run it.

Published at `/toys/swelled-rules/` on jermolene.com. **2026-11-08: integrated into jermolene.com** from a claude.ai handover: the page was wrapped in the site's toy skeleton (PWA tags, description, tagline, `toy-category` trifles), given an `icon.svg`, and given `tests/smoke.mjs`. It began as the artifact https://claude.ai/artifact/CVZJJuLimtfmDvCzStLVzg, which is no longer kept up to date.

## Conventions to keep

- The opening state and the four Sketches presets reproduce the sketches. Check any geometry change against the reference image.
- The usual toy controls stay: Randomise, Reset, 8-way Explore. Also Undo, pan/zoom, and SVG/PNG output.
- Keep it one self-contained file, working at phone width and on iPad. Explore has been slow on iPad in other toys, so neighbours redraw only when a gesture settles.
- British spelling in the UI. Only free fonts.

## Model

Pattern state `S` is a flat object:

| Key | Meaning |
| --- | --- |
| `cols` | Array of column types: `x` crossed, `u` rising to the right, `d` falling to the right, `o` empty |
| `w` | Column width (sketch units, roughly the image's pixels) |
| `n`, `p` | Number of rules, vertical pitch |
| `rise` | Vertical travel across a column, in multiples of pitch |
| `k` | Tension, 0 to 1 |
| `t` | Rule weight as a fraction of pitch |
| `drift` | Weight gradient from the first rule to the last, -1 to 1 |
| `hair` | Stroke added round each rule so the tips stay visible |
| `stagger` | Vertical shift of odd columns, in pitches |
| `spine`, `spineW`, `tail`, `spineC` | Vertical bar at the centre of the sheet, and how far it runs past the last rule |
| `paper`, `rule`, `a`, `b`, `alpha` | Colours; `a`/`b` alternate as bands between rules at opacity `alpha` (0 means rules only) |
| `blend`, `riseOnTop` | Multiply the bands; swap the layer order |

`SLIDERS` describes each numeric control and its limits. `limit()` clamps to them, so random and Explore states stay inside the slider ranges.

## Geometry

Each rule is one cubic per column, with vertical tangents at both edges. For a falling rule with H = `rise * p` and base y:

    P0 = (L, y)   P1 = (L, y + k*H)   P2 = (R, y + H - k*H)   P3 = (R, y + H)

Rising rules are the vertical mirror. The swell needs no width calculation: a rule is the area between the curve and a copy shifted down by its weight, so its thickness is constant vertically and goes to nothing where the curve runs vertical.

`ribbon()` draws that shape. `traceRules()` and `traceBands()` write it to a sink with `m/l/c/z` methods, either `canvasOut()` or `svgOut()`, so the canvas and the SVG export share one generator. All ribbons of one colour and direction are one compound path, so translucent bands don't double up where they touch.

Paint order, for each direction (falling on top by default): bands at `alpha`, then opaque rules. The feather's olive lines are the lower layer's dark rules seen through the upper layer's 60% bands.

## Measurements from the sketches

- Rise equals column width in all four sketches; `k` is about 0.47.
- Mixed: 9 columns `x u d x d u x u u`, w 125.8, p 18.6, n 57.
- Feather: 2 crossed columns, w 125.5, p 18.6, n 56, band opacity 0.6, spine 9 wide with tail 98.
- Stripe: 1 rising column, w 124, p 18.6, n 56, opaque bands.
- Lattice: 4 crossed columns, w 132.5, p 9.35, n 57.

## Interaction

- The view is `{z, x, y}`, applied on top of the fitted sheet in `paint()`. `paint()` culls columns and rows outside the viewport, which keeps deep zoom quick. Export ignores the view and always writes the whole pattern.
- On the main view, a press that moves less than 5px is a click and cycles that column. Anything further pans; two pointers pinch. The element has `touch-action: none`.
- Each Explore neighbour varies one aspect (`AXES`, `MUTATE`). They share the main view's zoom and pan, redrawn after a 120ms pause.
- Undo history is a stack of state snapshots. Slider drags commit one entry on `change`.

## Output

`Save SVG` / `Save PNG` use the artifact `downloads` capability when `window.claude` exists, otherwise an ordinary browser download, which is what jermolene.com uses.

## Tested and not tested

`node tests/smoke.mjs` from this folder (with the Playwright in `toys-src`, see its README) checks the published page: a column click, Undo, Randomise, Reset, the presets, Explore, both saves and phone width, with no page errors.

Tested by hand in headless Chromium: column clicks, Undo, Explore, Randomise, wheel zoom, drag, synthetic pinch, zoom bar, phone-width layout.
Not tested: a real iPad or phone; Save inside the Claude viewer.
