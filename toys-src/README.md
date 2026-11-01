# Toy sources

Most toys are a single `index.html` in `static-assets/<section>/<name>/` (the section being `games`, `toys` or `tools`), edited in place: that file is the toy's source, and nothing for it lives here. This folder holds what the others need beyond their published files: source and build scripts for the toys that are built, model-conversion tools, tests, and the working notes and handover documents that came with toys developed elsewhere (mostly as claude.ai artifacts).

Each toy's notes are in its `CLAUDE.md` or `HANDOVER.md`. Read them before making non-trivial changes. The generative trifles share one layout for their controls, explorer and frame-rate readout: see `PANELS.md`.

| Toy | Published file is | What's here |
|---|---|---|
| `quizbuzz` | **Built** by `build.mjs` (with `build-hook.mjs` for the question bank and fonts) | Source (`src/index.html`), question bank, fonts, tests |
| `meadow-games` | **Built**: `python3 tools/build.py --site` writes `index.html` and `models.js` | Source for three apps (only Meadow Games is published), the CC0 animal models, tests |
| `shared` | | Code that the built toys share: `lan.js` (LAN play over WebRTC and QR codes), the vendored QR libraries, and `test/lan.mjs` |
| `bowling-bear` | **Built** by `build.mjs` | Source (`src/index.html` and `src/bear-model.js`); notes; the original table-mode handover (`handover/`); the bear model (CC BY 4.0) and `tools/build_toy_model.py`, which writes `src/bear-model.js`; the handover's tests |
| `bear-beat` | Edited in place | Notes; the bear model and `tools/build_toy_model.py`; tests |
| `trackaholic` | **Built** by `build.mjs` | Source (`src/index.html` and `src/car-model.js`); handover notes; the car model (CC BY 4.0) and `tools/build_car_model.py`, which writes `src/car-model.js`; `test/gameplay.mjs`, a headless test of the handling with simulated drivers, compared with a committed baseline |
| `flowing-field` | Edited in place | Notes and `tools/render.mjs`, a headless render check. Its history, from its own repository, is merged into this one |
| `animal-island`, `trundle-world` | Edited in place | Notes and checks |
| `fractaliser`, `lala-yala`, `rug-addict` | Edited in place | Handover notes |
| `radialator` | Edited in place | Notes, the reference image it reproduces and its render checks (`tools/`, Python and Playwright) |
| `vectorious` | Edited in place | Handover notes, test images and the Python tracing experiments behind it |

A built toy starts with a comment naming the script that builds it. Don't edit it directly: change the source here, rebuild, and commit both.

## Building the multiplayer games

Quizbuzz, Bowling Bear and Trackaholic are built from `<toy>/src/index.html` by `build.mjs`:

```
node build.mjs                     # all three
node build.mjs trackaholic         # just one
```

Each published page is a single file that needs nothing but itself, Google Fonts and the site's `../pwa.js`, so it works offline and opened from disk. The source is an ordinary page that also runs as it is (serve `toys-src` and open `<toy>/src/index.html`), using three markers:
- `<script data-inline src="…"></script>` is replaced by the file's contents: the shared code, the QR libraries, a model.
- `<script type="importmap" data-dev>` points the source at `node_modules`; the build drops it.
- `<script type="module" data-bundle>` is bundled by esbuild, so three.js and cannon-es come from `node_modules` at the versions pinned in `package.json`, and are minified with the game's own code.

A toy can add a `build-hook.mjs` with `before(html)` and `after(html)` for anything else (Quizbuzz's question bank and fonts, and its artifact copies).

**LAN play** is the same in all three: `shared/lan.js`, whose header explains joining, the codes and reconnecting. A game makes `LAN.game({id, name, channel, store})` and uses its `host()` or `guest()` with callbacks for its own messages; the page also gets `LAN.drawQR`, the in-game scanner (`scan`) and `LAN.takeHash` for a code that arrives in the address. Change it there, rebuild all three, and run `node shared/test/lan.mjs`: a host and two phones per game in separate Chromium processes, joining, reconnecting over the spare links, rejoining after a reload and the messages for wrong codes. Codes carry the protocol version (`V`), so bump it when a change means old and new pages can't talk.

## Setting up

```
cd toys-src
npm install                      # Playwright for the tests; esbuild, three.js and cannon-es for build.mjs
npx playwright install chromium
```

Some toys have their own `package.json` for extra tools (for example `bowling-bear` uses gltf-transform to slim its model); run `npm install` in that folder when you need them. Python scripts need only Python 3, except Vectorious's experiments (`opencv-python`, `numpy`, `pypotrace`, `cairosvg`). Each test's header says what it serves and on which port.

## What isn't here

The repository is public. Private material, such as the original photographs that the cat sprites are cut from, lives in the gitignored `local/` folder at the root of the repo; the cat photos themselves are kept in Apple Photos. Keep anything personal out of this folder and out of the toys.
