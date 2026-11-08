# Lozengineer

Single-file WebGL 2 op-art toy. All the code is in `static-assets/toys/lozengineer/index.html`, edited in place: no build step and no runtime dependencies apart from Google Fonts (Monoton, Barlow Semi Condensed).

Started from a reference image. Its source and licence are unknown, so it is not committed: it is kept in the gitignored `local/lozengineer/reference.jpeg` at the root of the repository. The default state must keep reproducing that image: run the regression test (see Verification) after any change to geometry, stripe rendering or defaults.

**2026-11-08: integrated into jermolene.com** from a claude.ai handover. The page was wrapped in the site's toy skeleton (PWA tags, description, tagline, `toy-category` trifles), given an `icon.svg`, and given a browser download for saving outside claude.ai.

## House conventions

- Single self-contained HTML file.
- Every generative toy has Randomise, Reset and 8-way Explore.
- Opening state reproduces the reference image.
- British spelling in UI copy. Never use the phrase "load bearing".
- Keep UI text short and plain.

## Core insight

The pattern is a **lozenge tiling with each tile striped parallel to one diagonal**. Lozenge tilings are the 2D projections of stepped stacks of cubes.

- Each rhombus has corners A, B, C, D, with spine B–D. In tile coordinates A=(0,0), B=(1,0), C=(1,1), D=(0,1).
- Stripe coordinate: `T = N * min(r(u,v), r(1-u,1-v))`, where `r` is the p-norm. Ink sits at integer T.
- Every tile edge has T integer at both ends and linear between them, so N strands cross every edge at the same points. Neighbouring tiles join with no matching logic, for any rhombus tiling.
- Y-junctions and hook tips are not drawn. They emerge at tile corners, and tips get their half-hexagon cap automatically.
- `p=1` gives straight stripes. Other values are the Curve slider, `p = 2^curve`. The crease between the two halves is always `u+v=1`.

### Decoded reference (`tools/extract_lattice.py`)

- Source image 2576×1884. Repeat 896×776.
- Fine triangular lattice edge 51.73px, line spacing 44.8px.
- Every fine lattice vertex is inked. Per repeat there are 292 degree-2 vertices, 4 tips and 4 Y-junctions.
- Coarse lozenge side is 5 fine edges, so `strands=5`.
- Coarse repeat holds 12 lozenges: periods (4,-2) and (0,3) in axial coordinates, stored as `BRICK`.
- Ink `#1f1f20` (measured about 33,31,32), paper white.
- Default `size .1373` = 258.67/1884. Pan puts lattice origin on a Y-junction.

### Why stripes cannot crawl

Do not add a phase-animation slider without changing the model. Across some shared edges one tile's T equals `N - T` of its neighbour, so only phase 0 and 0.5 stay continuous. Black lines spiral and fork, so no single-valued global height field exists (tips and Ys behave like +½ and −½ line-field defects). This is also why ring colour uses the symmetric `|2k/N - 1|`.

## Code map (`index.html`, one classic script, in this order)

| Area | Key names |
|---|---|
| Model | `PALS`, `BRICK`, `DEFAULT`, `S` (current state), `regen` |
| Periodic cell | `{a,b,d,f}`, Hermite normal form periods (a,b),(0,d); `canon`, `flipAt` |
| Geometry | `lozenge`, `forTiles` (lattice, or de Bruijn multigrid for Star), `warpQ` |
| Rendering | `VS`, `FS`, `Sink`, `buildMesh`, `geomKey`, `setUniforms`, `drawPane`, `render` |
| Motion | `flips`, `startFlip`, `churnStep`, `buildOverlay`, `frame` (render on demand) |
| SVG | `exportSVG`: bands per half-tile, cancel opposite edges, chain outlines |
| UI | `SPEC`, `CHIPS`, `refresh`, `commit`/`undo`, `randomise`, `mutate`, `makePanes` |

Details that are easy to break:

- `f[idx]` is the dimer type of up-triangle (i,j): 0 = pairs with down(i,j), 1 = down(i,j-1), 2 = down(i-1,j). Valid only if each down-triangle is covered exactly once.
- A flip needs three lozenges around a vertex. The two valid states of (up(i,j), up(i-1,j), up(i,j-1)) are (2,1,0) and (1,0,2).
- Flip animation rotates those three lozenges 60° about the vertex, then commits. Chevron has no type 2 tiles, so it is frozen.
- `warpQ` in JS must stay identical to the warp in `VS`. It is used for tap picking and SVG.
- The band and swell maths in `exportSVG` must stay in step with `FS`.
- Mesh positions are world pixels. Pan is a uniform; rebuild happens when the key changes or pan leaves the margin.
- With warp on, tiles are subdivided (`subdiv`) so straight edges can bend.
- `S.size`, `S.panX`, `S.panY` are fractions of the smaller view dimension.

## State

`S` holds everything undoable, including the live cell. `churn` and `reach` are UI-only. `regen` rebuilds the cell, so changing tiling, Repeat, Scramble or seed discards tapped flips.

## Hosting

- Published at `/toys/lozengineer/` on jermolene.com. It began as a claude.ai artifact (body fragment, `capabilities: {downloads: true}`).
- Saving uses `await claude.use("downloads")` when it exists, inside claude.ai, and otherwise `linkSave`, an ordinary `<a download>`. Both Save SVG and Save PNG work either way.

## Verification

From `toys-src/lozengineer`, after `npm install` in `toys-src` (see its README) and `pip install pillow numpy`:

```
node tools/render_default.js && python3 tools/compare.py
```

The render goes to `out/` (gitignored). Without the reference image in `local/`, only the smoke test runs.

Expected: threshold mismatch about 1.65% at 2576×1884 and no page errors. The script fails above 2%. It also smoke-tests six modes, reports SVG size, and checks each cell is a valid dimer cover (`bad: 0`).

## Not tested

- Real iPad or touch hardware, including pinch and Explore performance. Only headless Chromium with software WebGL has run this.
- The claude.ai save prompt.
- Monoton and Barlow rendering: the test environment blocked Google Fonts.

## Known rough edges

- A tap whose flip is refused because that hexagon is already turning still adds an undo entry.
- Churn changes are not individually undoable.
- Tap does nothing in Star or Chevron. Star flips would need a vertex-based mesh, since the centre vertex moves in non-lozenge flips.
- SVG with Curve plus Swell or Warp can get large (5–6.5MB in Star tests).
- SVG with several colours uses a 0.3px same-colour stroke to hide seams.
- SVG edge cancellation relies on coordinates rounded to 1/40px; if a chain fails to close it is emitted as-is.
- No shareable state: no URL parameters or saved presets.
- `forTiles` stops at 60,000 Star tiles, which can leave gaps at extreme zoom-out with many directions.

## Suggested next steps

1. Check Explore and Churn on iPad; reduce pane resolution if slow.
2. Add named presets and URL-hash state.
3. Search small periodic cells for more Brick-like tilings. Scramble reaches them, but only at random.
4. Consider a tile-painting mode for larger hand-edited cells.

The reference image is only for the regression test; its source and licence are unknown, so never commit or ship it.
