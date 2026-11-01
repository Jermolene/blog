# Flowing Field

Single-file WebGL2 toy, published at jermolene.com/toys/flowing-field/ from `static-assets/toys/flowing-field/index.html` (no build, no dependencies besides Google Fonts). Edit that file in place. Read HANDOVER.md before changing anything.

- Owner's standing preferences for generative toys: randomise, reset and 8-way exploration of parameter space must keep working.
- Main target device is an iPad (Safari). Performance regressions matter more than anything else; check with the in-page debug panel (press D).
- Verify every change with `node tools/render.mjs out.png` (and `--slow`, `--explore`, `--random` as relevant), then look at the PNG. It prints shader compile errors. It uses the Playwright installed in `toys-src` (`cd toys-src && npm install`).
- Commit each logical change separately with a descriptive message so changes stay individually revertible.
- Terminology is inking/line-drawing (pen, nib, feathering, strokes, marks). Do not reintroduce the old fur/cat wording.

## 2026-11-01: panel standard
The page now follows `toys-src/PANELS.md`: the canvas lives in `#stage` with the panel docked on the right (stacked below at ≤820px), the action row (Explore 8 ways · Randomise · Reset · Download PNG) is in the panel, and the bottom toolbar holds only Pause and Nib sound. Explore neighbours are stored as deltas from the centre, mutated only in ticked groups. Where HANDOVER.md describes the floating panel, the Controls toggle or the Mutation/Done bar, this supersedes it.
