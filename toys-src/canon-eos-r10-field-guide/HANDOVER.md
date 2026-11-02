# Handover: R10 Field Guide

State as of 2 Nov 2026. This version was built in a Claude chat session and published there as a private claude.ai artifact. `index.html` is the same page with the HTML skeleton (doctype, charset, viewport, base reset) that the artifact host used to inject, so it runs standalone. It is now published on jermolene.com from `static-assets/tools/canon-eos-r10-field-guide/index.html`, with the site's metadata, icon and service worker added to its `<head>`.

## What it is

Four views, routed on `location.hash`:

| Hash | View | Content |
|---|---|---|
| `#controls` | 3D body | Procedural three.js model of the R10 + RF-S18-150mm. Orbit, preset views, click a part to get its card. Vari-angle screen positions. Lens on/off. |
| `#menus` | Menu simulator | Black "camera screen" with the full tab/page/item tree for stills and movie mode. Arrow keys work like the dials; `[` `]` change main tab. Search across all items. |
| `#display` | Shooting screen | Representative live-view display (CSS, not WebGL) with clickable readouts. |
| `#firmware` | 1.7.0 | The five changes in fw 1.7.0. Menu items it touched carry a `new` flag. |

## Code map (index.html)

The order inside the single IIFE `<script>`:

1. **`C` (controls data).** One object per physical control: `id`, `f` (face: back/top/front/side), `n` (name), `no` (Canon part number from the manual's Part Names, B = back list, F = front list), `d` (description), `tip`. The legacy `x/y/r/shape` fields are left over from the old SVG schematic and are now unused. The `CUST` constant marks reassignable controls.
2. **CONTROLS: 3D BODY.** `V` holds the camera presets per face. `drawLegend`, `pickCtl`, `showCtl` drive the legend and card. `build3D()` builds everything:
   - Units are **cm**. Origin is the body centre. **+x = grip side, +y = up, +z = rear** (towards the photographer).
   - Helpers: `slab` (rounded extruded box), `cylZ/cylX`, `knurl` (ridged dial), `decal` (canvas-text plane; facing `z|y|-z|-x|-y`), `rb` (rear button + label).
   - `reg(mesh,id)` clones the material and registers the mesh for picking and highlighting under a control `id`. Meshes registered as `"body"` block picks without highlighting.
   - Vari-angle screen: `hinge` group (left edge, rotates y) contains `flip` group (rotates x). `setScreen(swingDeg, flipDeg)`.
   - Lens group: RF-S18-150 proportions (≈69mm Ø × 84.5mm, scaled to the model). Zoom ring (`zoom`), front focus/control ring (`ring`), name and focal-length decals.
   - `tint()` lerps the emissive or colour toward red for selected/hovered ids. Rendering is **on demand** (the `need` flag); the loop idles when `view !== "controls"`.
   - `RoomEnvironment` + PMREM give the environment reflections.
   - `indexedDB.deleteDatabase("r10-field-guide")` cleans up a scan cache left by an earlier, withdrawn version. It can be removed after a while.
3. **MENUS.** `T` is an array of tabs `{k, n, s, c, photo:[pages], movie:[pages]|null}`. A page is an array of `[name, description, flag?]`, and `flag === "new"` marks 1.7.0 items. Only the Shooting tab has a separate `movie` set; for other tabs, movie mode shows the stills layout with a note.
4. **LIVE VIEW.** `L` is the list of hotspots `{id, x%, y%, t (glyph text), n, d}`. The `box:1` entry is the AF frame.
5. **ROUTER.** `route()` on load and on `hashchange`.

## Sources

- Firmware 1.7.0 notes: https://www.canon.co.nz/support/support-news/firmware-updates/eos-r10-firmware-version-1-7-0
- Advanced User Guide (fw 1.7.0) PDF: https://cam.start.canon/en/C006/manual/c006.pdf. Part Names are on pp.30–33.
- Tab menu pages (HTML manual, base `https://cam.start.canon/en/C006/manual/html/`):
  - Shooting (stills) `UG-05_Shooting-1_0020.html`
  - Movie `UG-05_Shooting-2_0020.html`
  - AF `UG-06_AF-Drive_0020.html`
  - Playback `UG-07_Playback_0020.html`
  - Wireless `UG-08_Network_0020.html`
  - Set-up `UG-09_Set-up_0020.html`
  - Custom Functions `UG-10_Custom_0030.html`
- My Menu items are from general Canon EOS R behaviour. They were not checked against the R10 page.

## Known gaps and uncertainties

**Control positions on the 3D model are approximate.** These are the least certain and should be checked against the real camera:
- Power switch location and form (currently a small lever at the rear top right).
- Mode dial vs Quick Control dial: which is which, and their exact positions.
- M-Fn and Movie buttons: the order may be swapped.
- AF-ON / ✱ / AF point buttons and the multi-controller: the arrangement right of the EVF.
- INFO button, access lamp, dioptre slider and focal plane mark.
- Body proportions are simplified. The simple-model lens is slightly oversized relative to the body.

**Content:**
- "Show log" (Set-up 6) has a vague description; its exact function wasn't confirmed.
- Default Quick Control screen items are not listed.
- Live-view glyphs are stand-ins, not Canon's icons.
- AF tab in Basic Zone and Movie mode differs from the Creative Zone stills layout (fewer pages). Only noted, not modelled.

## Decisions already made

- **No third-party scan.** A third-party STL scan (Standard Digital File License: personal use only, no hosting, no derivatives) of an R10 + 18-150 was evaluated. It worked well technically but was rejected because Jeremy wants to publish this on his blog and the licence forbids hosting. Do not reintroduce scans or downloaded models.
- **Photoreal path, if wanted:** Jeremy's own photos, taken square-on to each face under even softbox light with a ruler in frame. Use them as textures on matched geometry and to correct control positions. He has a home product-photography setup (Godox SL60W + parabolic softboxes).
- Single-file and no-build, so it can be dropped into a blog post or an iframe.

## Suggested next steps

1. Get reference photos from Jeremy and correct control positions and body proportions.
2. Photo-texture pass. Project each face photo onto its side and keep procedural geometry for depth. Bake out the specular from the photos.
3. Blog embedding: decide between an iframe and an inline page. If inline, scope the CSS (everything is currently global: `body`, `h1`, `.card` etc.) or wrap it in a shadow root.
4. Optional: link each menu card to its page in Canon's HTML manual (the URLs follow the pattern above).
5. Optional: a Quick Control screen view and a playback-display view.
