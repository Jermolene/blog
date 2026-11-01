# Parameter panels, explorers and frame rate

The generative trifles (Blobbles, Flowing Field, Fractaliser, Marblelous, Radialator, Rug Addict, Spotty Sphericle, Sunthesis) share one way of laying out and driving their controls. Each toy keeps its own look (fonts, colours, button shapes); what's shared is the structure and the behaviour below. Sunthesis is the reference implementation.

## Layout

- The panel sits on the right of the stage, 320–340px wide, and scrolls on its own if it's taller than the window.
- At 820px wide and below it stacks under the stage at full width, with the usual 16px (safe-area) gutters.

## Order, top to bottom

1. The toy's title and one-line description, if the toy puts them in the panel.
2. **Action row**, in this order: **Explore 8 ways** (the primary button; it reads **Leave explore** while exploring) · **Randomise** · **Undo** (only if the toy has undo) · **Reset** · **Download**. Download is a `Download ▾` menu when there's more than one format, and `Download PNG` (or the one format) otherwise.
3. **Explore box**, visible only while exploring:
   - a **Variation** slider (how far the neighbours stray);
   - "Parameters allowed to change:" followed by one checkbox per panel group, in two columns;
   - a **New neighbours** button, which rerolls the eight;
   - the hint "Tap a neighbour to adopt it and breed eight more. Tap the centre to leave explore with it."
4. The toy's own presets or pickers, if it has any.
5. **Parameter groups**, each a `<details>` whose `<summary>` is the group heading, with a `+`/`–` marker on the right. Open the one or two groups people reach for first; leave the rest closed.
6. A last group (**Settings** or **Display**) for things that aren't the picture: quality, JSON copy and paste, **Show frame rate**.
7. A note at the bottom: "Double-click a control or heading to reset it."

## Behaviour

- **Double-click a control's label or slider** to reset it to its default. **Double-click a group heading** to reset every control in that group (the two clicks toggle the group twice, so it ends as it was). When the panel is scrolled to the end, collapsing a group can scroll the panel so the second click lands elsewhere; keep a closing group's height for about 450 ms to stop that (see Radialator). Both go through the toy's normal change path, so undo, explore and rendering follow. Double-clicking the Settings/Display heading puts its checkboxes and menus back to their HTML defaults. On touch screens a double-tap is a double-click: `pwa.js` stops Safari's double-tap zoom and sends the click and dblclick itself.
- **Explore** is a 3×3 grid over the stage: the current picture in the centre, eight mutated neighbours around it. Tapping a neighbour adopts it and breeds eight more; tapping the centre leaves explore with the current picture. The neighbours are mutated only in the groups that are ticked. Sliders still edit the centre while exploring, and the neighbours follow. Leave a group unticked by default only if changing it would throw away what the person is working on (Sunthesis leaves Shapes, Camera and Scene unticked).
- Neighbours render at tile size, never at full resolution. A live toy (Blobbles, Flowing Field) may show still frames or run the nine tiles at a lower rate, but the page must stay responsive.

## Frame rate

Toys that animate have a **Show frame rate** checkbox in their Settings/Display group, off by default. The readout sits in the top-right corner of the stage: small monospace text on a translucent dark background, `pointer-events:none`, updated every 500 ms, in this format:

```
60 fps
16.7 ms avg · 21.0 ms worst
1280×720 px
```

The third line (the canvas's backing size) is optional. The times are the gap between frames, measured with `performance.now()` in the frame loop, and reset every time the readout updates.
