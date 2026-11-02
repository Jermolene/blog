# R10 Field Guide

Single-file interactive guide to Jeremy's Canon EOS R10 (firmware 1.7.0) with RF-S18-150mm F3.5-6.3 IS STM. Destined for his blog (jermolene.com), so everything in it must be publishable.

Read HANDOVER.md before changing anything substantial.

The page is published from `static-assets/tools/canon-eos-r10-field-guide/index.html`, which is its source and is edited in place. This folder holds only the notes and the render check. The `<meta>` tags, icon and `../pwa.js` in the page's `<head>` are the site's (see the repo README).

## Ground rules

- **One file.** `index.html` holds all markup, CSS and JS. No build step, no bundler, no framework. Keep it that way unless Jeremy asks otherwise.
- **Only clean-licensed assets.** Everything is original code or MIT (three.js) plus Google Fonts (OFL). Do not add third-party 3D models, scans, textures, Canon imagery, logos or wordmarks. A licensed R10 scan was tried and dropped because its licence forbids hosting. Jeremy's own photos are fine.
- **No Canon wordmark** on the model. "EOS R10" and the lens name are used descriptively.
- **three.js r128, non-module (UMD) builds**, loaded from cdnjs/jsDelivr with exact pinned versions. `examples/js/*` (OrbitControls, RoomEnvironment) exist in r128 and were removed in later versions. Upgrading to modules is a deliberate job, not a drive-by.
- **Menu data must follow Canon's Advanced User Guide for fw 1.7.0** (cam.start.canon/C006). Do not invent menu items. If unsure, say so in the UI or leave it out.
- **British spelling** in UI copy (stabiliser, colour), except where quoting Canon's menu labels verbatim (e.g. "Customize buttons", "Color space").
- Light and dark themes are token-driven (`:root` plus two dark blocks). Never add a literal colour to a component rule. The camera LCD and menu screen are deliberately always black.
- Respect `prefers-reduced-motion`; tweens already short-circuit.

## Checking work

```
tools/screenshot.sh controls out.png     # or menus | display | firmware
```

This runs headless Chrome with SwiftShader. Offline, run `npm i three@0.128.0` first and the script swaps the CDN URLs for node_modules. Check the 3D view from each preset (Back/Top/Front/Side) after geometry changes.

## Owner preferences

Concise, technically precise. No hedged padding. Free fonts only. Never use the phrase "load bearing".
