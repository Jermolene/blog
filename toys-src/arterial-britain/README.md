# Arterial Britain

Single-page app (one self-contained HTML file) drawing road watersheds, "all roads lead to" maps and fairest meeting places for England, Scotland and Wales. Routing runs in the browser (Dijkstra over ~79k nodes / 114k edges).

Published at `/toys/arterial-britain/` on jermolene.com. **2026-11-08: integrated into jermolene.com** from a claude.ai handover. The published page is built: edit the source here, run `python3 build.py`, and commit both.

## Files
- `../../static-assets/toys/arterial-britain/index.html`: the published page, written by `build.py`. Everything is inlined (data, fonts), so it is about 2.2 MB and works offline and from disk.
- `app.html`: source: CSS, UI and all JS. Has three placeholders filled by `build.py`: `/*FONTS*/`, `/*META*/`, `/*BIN*/`. No `<html>/<head>/<body>`: it was written for the claude.ai artifact host, which wraps it.
- `build.py`: inlines fonts (`fonts/`) and data (`data/`) into `app.html` and wraps it in the site's toy skeleton (PWA tags, description, tagline, category; the description is set there). The handover's `arterial-britain.html` and `test.html` are no longer made.
- `prep.py`: rebuilds `data/` from raw sources (see below).
- `data/data.json`: metadata: node/edge counts, typed-array byte sizes, road names, towns `[name, x/20, y/20, pop, country E/S/W, isSuburb]`, coast rings. Coordinates are OSGB36 (EPSG:27700) metres ÷ 20.
- `data/data.b64`: base64 gzip of concatenated little-endian typed arrays, in order: node x (u16), node y (u16), edge u (u32), edge v (u32), length/10 m (u16), seconds (u16), road-name index (u16), geometry offsets (u32, m+1), geometry deltas (i16 pairs), land km² per node (f32), people per node (f32), edge class (u8: 0 motorway, 1 dual, 2 primary A, 3 other A, 4 slip, 5 roundabout, 6 B, 7 ferry, 8 connector).
- `fonts/`: Overpass and Overpass Mono woff2 (SIL OFL, `fonts/OFL.txt`), from @fontsource.
- `tests/`: Playwright scripts that open the published page, run from this folder with the Playwright in `toys-src` (see its README): `node tests/interaction.test.js` and `node tests/export.test.js`. Their screenshots and exports go to `out/` (gitignored); each prints `errs []` when the page raised no errors. `tests/drive-times.js` (run from `tests/`) is a Node sanity check of modelled times against known journeys.

## Rebuilding the data
Put sources in `src/` (gitignored; or set `SRC=`):
- `src/tm-impact-data` — `git clone https://github.com/samparkie-alt/tm-impact-data` (OS Open Roads motorways + A roads, 2026, OGL v3)
- `src/os-openroads-geodata` — `git clone https://github.com/wwymak/os-openroads-geodata` (B roads, 2015 cut)
- `src/ne/sub.geojson` — Natural Earth `ne_10m_admin_0_map_subunits.geojson`
Then `pip install shapely numpy pyproj scipy pyshp geonamescache` and `python3 prep.py && python3 build.py`, from this folder.

Speeds (km/h) are in `prep.py` `SPEED`; urban factors 0.55/0.72 by local density; ferries are a hand-entered list (terminals and times approximate). Better data would be full OS Open Roads (all classes, with road nodes) from the OS Downloads API — the B roads here are 2015 and minor roads are absent.

## App structure (app.html)
- Data load: `loadData()` decodes the blob, builds CSR adjacency, geometry arrays, edge bboxes, a snapping grid.
- Routing: `weights(s)`, `dijkstra(srcs,w)` (multi-source, labels), `flows()` accumulates land/people up the tree.
- Scenes: `solve(s)` returns a drawable scene for modes `shed`, `one`, `meet`.
- Drawing: `drawMapLayer` (sea, land, roads, routes, labels) and `drawOverlay` (title, stats, legend, credits, meet inset). Exports use `drawMapLayer` only; SVG goes through `SvgCtx`, a minimal canvas-API recorder.
- State: object `S` (defaults in `DEF`), `update()` re-solves, `render()` redraws. Randomise, Reset and 8 variations (`neighbours()`) work on `S`.
- Saving uses the claude.ai `downloads` capability when present, else a plain `<a download>` (which is what jermolene.com uses).

## Credits
Contains OS data © Crown copyright and database right 2026 (OGL v3). Places: GeoNames. Coast: Natural Earth. Inspired by "All Roads Lead to Richmond" by Arterial Mapping.
