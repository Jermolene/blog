# Quadrille

A single-page pattern toy. It builds interlaced op-art bands from one element: a striped quarter disc on a square grid. It came from a sheet of hand-made vector sketches (`reference/sketches.jpeg`). Everything is in `static-assets/toys/quadrille/index.html`, edited in place, with no build step and no dependencies except three Google Fonts.

Published at `/toys/quadrille/` on jermolene.com. **2026-11-08: integrated into jermolene.com** from a claude.ai handover: the page was wrapped in the site's toy skeleton (PWA tags, description, tagline, `toy-category` trifles) and given an `icon.svg`. It began as the artifact https://claude.ai/artifact/3HhLv6z6Sxjg45nbgUphPo, which is no longer kept up to date.

## The model

- The sheet is a grid of cells. Each cell holds an ordered stack of quarter discs, at most one per corner, written as a string, bottom layer first. Corners: `a` top-left, `b` top-right, `c` bottom-right, `d` bottom-left. `"dc"` is a bottom-left disc under a bottom-right disc. `""` is empty.
- A disc paints an opaque paper wedge, then its stripes. Occlusion is what makes the interlacing. Discs never leave their cell, so a cell's look depends only on its own stack.
- Stripes: `n` bands, period `1/n` of the cell side, and each band is centred in its period, at `(k + 0.5)/n`. The outer radius is the outer edge of the last band, slightly under 1.
- That centring is the key fact. Bands are symmetric under `r -> 1 - r`, so stripes join across a shared edge whether the neighbouring disc is centred at the same end (an arch) or the opposite end (an S-bend, band `k` meets band `n-1-k`). It also gives the ring with a white centre at junctions.
- Anything applied to bands must stay palindromic in `k` to keep joins intact: swell uses `|2c - 1|`, Bands colouring uses `min(k, n-1-k)`.
- Slide and Drift shift bands by `+phase` on even lattice points and `-phase` on odd ones. Both ends of an edge have opposite parity, so joins survive.

## Fit to the sketches

`tools/fit_sketch.py` tries all 65 stacks per cell against the image and prints the best. Measured from the image: cell side 85.35px, period 9.48px, band about 4.75px, so `n = 9`, ink 50%. Ink colour is about `#4659a8`.

The loose sample tile on the sheet (right-hand side, below the fragment) has a solid dot at its corner and a radius of 81px. It is phased differently from the tiles in the compositions, and the presets follow the compositions. One Waves cell (column 5, row 2) fitted `ca` where its row is `ac`; the preset treats that as noise. The Chain sketch's bottom-right cell is displaced in the sketch; the preset uses the regular `b`.

Presets in `PRESETS`: Cable, Chain, Braid, Waves, Scales, Cloud and Fragment are fitted. Lattice is an invention. The opening pattern is Cable, the top-right sketch.

## State

`g` is the whole design:

`{ cols, rows, mw, mh, motif: [string; mw*mh], shift, n, ink, swell, phase, mode, inks: [4 colours], paper }`

`mode` is `one`, `strands`, `depth` or `bands`. `stackAt` maps a sheet cell to a motif index, with `shift` staggering each repeat row. `history` is an undo stack of JSON snapshots. `view` is `null` (fit) or `{ z, cx, cy }`: zoom over fit, and the cell coordinate at the stage centre. Whole-design changes go through `setG`, which resets the view. Edits and sliders keep it.

## Code map (`index.html`, one script)

- Geometry: `bandTable` (band radii and widths), `strands` (union-find over edge joins, using the topmost disc on each side), `walk` (visits every disc).
- Drawing: `paint` (Canvas 2D, culls off-screen discs), `layout` (fit), `viewLayout` (fit plus pan and zoom), `drawMain`, `drawThumb`.
- Input: pointer handlers on `#sheet`. Under 6px of movement is a tap. Two pointers pinch. `zoomAt` and `panBy` update `view`.
- Generation: `randomPattern`, `randomStripes`, `randomColour`, `MUTATIONS`, `mutate`, `rollVariants`.
- Export: `svgText` (always the whole sheet, 100 units per cell), `pngBlob`.

## Rules that are easy to break

- Cell size and origin must be whole device pixels. Butt-capped stripes then meet exactly at cell edges, with no anti-aliased seams. Do not add a canvas transform for pan, zoom or rotation without solving seams.
- The SVG overdraws each arc by 0.0015 rad for the same reason.
- The owner's standing requirements for these toys: randomise, reset and 8-way exploration of the parameter space, the opening pattern reproducing the original image, and SVG export. He tests on iPad. Keep Explore quick.
- Free fonts only.

## Saving

Save SVG and Save PNG use the claude.ai `downloads` capability when `window.claude` exists, and otherwise `linkSave`, an ordinary browser download, which is what jermolene.com uses.

## Testing

`node tests/smoke.js` from this folder, with the Playwright in `toys-src` (see its README). It tests the published page. It covers zoom, pan, tap, undo, a synthetic pinch, Random, Reset, Explore, both saves and phone width. It depends on the page's top-level names (`g`, `view`, `mainL`, `sheet`).

Not tested: a real pinch on an iPad.

## Open questions

- The sheet is finite, so zooming out shows paper. An endless repeat while panning would need a new definition of strand colouring, because strands computed over a finite window change as you pan.
- There is no way to save or share a design: no URL state and no persistence. Undo history is lost on reload.
- Random and Explore can produce sheets with many open edges. A connectivity score could bias the generator towards the closed bands of the sketches.
