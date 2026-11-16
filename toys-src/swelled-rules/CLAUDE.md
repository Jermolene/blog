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
| `wCurve` | Weight along the run of rules: `[x, y]` points in 0..1, x from first rule to last, y 0.5 meaning weight `t` and 1 twice it. Replaced the old `drift` slider (a straight line) |
| `sCurve` | Spacing: y is where rule x sits down the run `(n-1)*p`; the diagonal is even spacing |
| `hair` | Stroke added round each rule so the tips stay visible |
| `stagger` | Vertical shift of odd columns, in pitches |
| `spine`, `spineW`, `tail`, `spineC` | Vertical bar at the centre of the sheet, and how far it runs past the last rule |
| `paper`, `rule`, `alpha` | Colours; band opacity `alpha` (0 means rules only) |
| `bands`, `bandsR` | Band colours in turn down the run of rules, cycling; `""` is a gap. `bandsR` (or null) gives the rising rules their own sequence. Replaced the two alternating colours `a`/`b` on 2026-11-15; palettes still name two and set `bands` to them |
| `blend`, `riseOnTop` | Multiply the bands; swap the layer order |

`SLIDERS` describes each numeric control and its limits. `limit()` clamps to them, so random and Explore states stay inside the slider ranges.

## Geometry

Each rule is one cubic per column, with vertical tangents at both edges. For a falling rule with H = `rise * p` and base y:

    P0 = (L, y)   P1 = (L, y + k*H)   P2 = (R, y + H - k*H)   P3 = (R, y + H)

Rising rules are the vertical mirror. The swell needs no width calculation: a rule is the area between the curve and a copy shifted down by its weight, so its thickness is constant vertically and goes to nothing where the curve runs vertical.

`ribbon()` draws that shape. `traceRules()` and `traceBands()` write it to a sink with `m/l/c/z` methods, either `canvasOut()` or `svgOut()`, so the canvas and the SVG export share one generator. All ribbons of one colour and direction are one compound path, so translucent bands don't double up where they touch.

`rows()` turns the two curves into each rule's offset and weight. `curveFn()` interpolates the points with a monotone cubic (Fritsch and Carlson), so the curve never overshoots a point and an increasing spacing curve keeps the rules in order.

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
- The Weight and Spacing curve editors under Rules work like an image editor's Curves panel: drag a point, click empty space to add one, double-click (two presses within 350ms, so it works on touch too) or Delete to remove an inner one; the end points move only vertically. Arrow keys move the selected point, Page Up/Down select another. One Undo entry per drag. Randomise sometimes gives a drift, swell or squeeze; Explore's Curves neighbour nudges a curve or the stagger.
- Undo history is a stack of state snapshots. Slider drags commit one entry on `change`.

## Output

`Save SVG` / `Save PNG` use the artifact `downloads` capability when `window.claude` exists, otherwise an ordinary browser download, which is what jermolene.com uses.

## Tested and not tested

`node tests/smoke.mjs` from this folder (with the Playwright in `toys-src`, see its README) checks the published page: a column click, adding, dragging and removing curve points, Undo, Randomise, Reset, the presets, Explore, both saves and phone width, with no page errors.

Tested by hand in headless Chromium: column clicks, Undo, Explore, Randomise, wheel zoom, drag, synthetic pinch, zoom bar, phone-width layout.
Not tested: a real iPad or phone; Save inside the Claude viewer.

## Bargello presets (2026-11-15)

Two presets after Bargello needlework the owner sent, matched at the level of the shapes and the colour order, not the stitches:
- **Flame**: falling and rising columns in turn, low tension so the tips are sharp, no rules, opaque bands through a nine-colour cycle (rose, cream, sage greens, cream, blush).
- **Sawtooth**: three crossed columns with the rising rules on top. The rising sequence is six colours (teals, grey, black) and then gaps, as long as the run, so each column carries one diagonal that restarts at the foot of the next; the falling rules' peach-to-rust gradient shows through the gaps.

The band editor sits under Colour: a swatch per band, + Colour / + Gap, × on hover or focus to remove, a hatched gap fills when clicked. It only rebuilds when the sequence changes shape, so a colour picker stays open while it edits. The smoke test scrolls the curve editors into view, since the presets now wrap to a second row.

## Moving between states (2026-11-16)

The main view moves smoothly, over 650 ms with an eased curve (`TWEEN_MS`, `ease`), whenever the state changes as a whole or by a click: presets, palettes, rhythms, Randomise, Reset, Undo, picking an Explore neighbour, a column click, checkboxes, and band and curve buttons. Anything that calls `changed()` without `skipNeighbours` moves this way. Slider drags, colour pickers and curve-point drags (`changed(true)`) still show at once.

- `S` is always the real state; controls, Explore and export read only `S`. `shown` is what the main view shows: a state, or a spec `{a, b, e}`, the way from spec a to b, eased `e` of the way.
- `tweenTo()` starts a move from `shown`, so a change made mid-move carries on from what's on screen. Chains of interruptions deeper than three are cut to their latest target. A change that leaves the state as it is starts no move.
- Every value is read through the spec (`mixNum`, `mixRgb`, `mixBool`, `bandOf`), and `flatten()` turns it into a drawable `D`:
  - Numbers and colours are mixed. `blend` and `riseOnTop` switch half way.
  - The spine's width is scaled by its presence.
  - The rule count becomes fractional. The extra rule sits at the end and grows from zero weight.
  - Each column has a width presence, so columns that come or go narrow to nothing and the rest close up. It also has a presence for its falling layer and one for its rising layer, which scale that layer's rise, rule weight and band width. A falling column turns rising by flattening and lifting again.
  - The weight and spacing curves are mixed as functions (`curveFn` cached per point list), so different numbers of points don't matter.
  - Band colours are mixed rule by rule, with a gap fading out.
- `paintFlat()` draws `D`. It fills each rule's bands as one path in its own colour and opacity, and each column's rules on their own, without the zoomed-view culling. Its last frame differs from `paint(S)` by under 0.6% RMSE, so the hand-over at the end doesn't show.
- **Verified headless,** with a frozen clock to film fixed points of a move:
  - Mixed to Feather (nine columns to two);
  - Feather to Flame (paper colour, band sequences, column types);
  - a column click (rising to falling);
  - the smoke test passes.
- **Not verified:** how smooth it is on an iPad with many rules and columns.
