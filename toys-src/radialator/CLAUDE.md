# Radialator

Single-file op art explorer (`static-assets/toys/radialator/index.html`, edited in place, no build step, no dependencies beyond Google Fonts).
Generates radial "parity" patterns: N overlapping shapes on a ring, each pixel coloured by whether an
odd or even number of shapes covers it, XOR'd with optional spoke wedges and concentric rings.
The default parameters reproduce `reference/original.jpeg` (the image that started the project).

Read HANDOVER.md before making changes: it records how the default was fitted, the coordinate
conventions shared by the shader and the SVG exporter, and known gaps.

## Owner's conventions
- Generative single-page apps always have Randomise, Reset and an 8-way explorer (3×3 grid, centre =
  current, 8 mutated neighbours; click a neighbour to adopt it, the centre to leave explore with it, and
  New neighbours to reroll). Keep these.
- Keep it one self-contained HTML file.
- Communication: concise and technically precise; no hedged padding.

## Invariants
- The shader (`FS`) and `buildSVG()` must stay geometrically identical. Any change to the pattern
  maths goes into both, then run `python3 tools/check_svg.py` (expect mismatch < ~4%).
- Mosaic mode (Colours → Mosaic) has its own shader path, `mosaicAt()`; its SVG is traced from a render, so it needs no
  vector twin, but the San Marco preset must still match its plate: `node tools/compare_san_marco.mjs` (baseline in
  the script's header; see HANDOVER.md).
- Reset must still reproduce the reference: run `python3 tools/compare_reference.py`
  (baseline ~5.7% overall mismatch; regressions show up first in the 200–950px radius bands).
- Tools need `pip install playwright numpy pillow` and a Chromium for Playwright.
