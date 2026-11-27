# Bear Scare — handover

Toddler "scary" game for iPad in landscape. Single self-contained `index.html` (three.js r160 via jsdelivr importmap; Creepster + Fredoka from Google Fonts). No build step.
Published artifact: https://claude.ai/artifact/JPvozBLVMYwuvMqR1kVTyK

## Concept
Third-person camera behind the bear, haunted-house corridors each ending in a T junction. Tap left 45% / right 45% of the screen (middle 10% ignored, taps ignored while walking). Bear walks to the junction, arcs round the corner, walks the new corridor, stops 3m before the next T. Endless, procedural. Generic haunted house, not Halloween.

## What exists
- **World**: corridor W=3.2, H=3.4, length 11–14m; side stubs 6.5m fading into fog. `buildNode()` builds corridor + junction + both stubs. Only 3 nodes kept (keeps same-direction loops from overlapping). The chosen stub is replaced by the next full corridor, inheriting the stub's theme.
- **Themes**: per-corridor canvas wallpaper (damask, stripes, eye trellis, thorny vines, moths, medallions × 9 palettes) with grime, panelled wainscot, carpet-runner floor. Two stubs at a T always differ.
- **Set dressing**: brass candle sconces with flicker + glow sprites, cobwebs, swaying threads (some with a tiny spider), corner webs, a portrait at each T with 3D eyes tracking the camera.
- **Lighting**: fixed pool of 8 PointLights reassigned to the nearest sconces every 0.2s — don't add lights at runtime (light-count change recompiles shaders). Warm bear-follow light, dim hemisphere, FogExp2.
- **Movement**: path of line + quarter-arc segments, `at(s)` gives position/tangent. Camera follows the same path `CAM_BACK`=3.2m behind the bear, so it never clips walls.
- **Events**: s-keyed timeline (`planEvents`); `pause()`/`resume()` counter stops walking.
  - Jump scares (~28% from turn 3, never twice running): monster / ghost / witch / bat swarm lunge at camera, flash, shake, "boing" retreat.
  - Quake (~14%): shake, light flicker, dust, rumble, moan.
  - Honey pot (~32%): collected with a hop, HUD counter.
  - Ambient: spider on thread, bats, ghost through walls, witch crossing the T, scurrying spiders.
  - Idle at T: witch, glowing eyes in a stub, spider, bats or ghost across the T, moan.
- **Audio**: all synthesised WebAudio (reverb, compressor, drone + wind ambience). `CONFIG.SAMPLES[name]` overrides with recorded files; on desktop, dropping files named e.g. `moan1.m4a` also works.
- **Bear**: `ProcBear` is a primitive-shape stand-in (walk/idle/scared/happy/head look). `GlbBear` wraps a GLTF: normalises height to `BEAR_H`=1.3, picks clips by regex (`/walk|run/`, `/idle|stand/`, `/jump|scare|fear/`, `/happy|cheer|dance/`), crossfades. Footsteps via `onStep()` from walk phase.
- **Debug**: arrows / A,D turn, R reset, M mute, keys 1–9,0 trigger each event; `window.__ts` time multiplier; `window.__bs` exposes hooks for scripted testing.

## First task: wire in the real bear
1. Use the same animated bear GLB as Bowling Bear / Bear Beat. Set `CONFIG.BEAR_GLB` to a relative path (e.g. `bear.glb` beside `index.html`). Check clip names against the `GlbBear` regexes and fix the mapping; fix facing (`BEAR_YAW`) so it walks away from the camera; check scale and feet on the floor.
2. `GlbBear` lacks head-look and a strong "scared" pose: use its jump clip if present, otherwise layer a procedural hop + shiver (and a head-bone turn back towards the camera if the rig has a head bone).
3. Keep footstep sync working with the walk clip's cadence.
4. GLB materials are probably MeshStandardMaterial — check it reads well in the dark under the bear light; prewarm its shaders like the creatures.

## Then, roughly in order
- Real-iPad test: frame rate with 8 point lights at DPR 1.75, audio unlock on first tap, no double-tap zoom. Add a quality fallback (DPR 1, fewer lights) if needed.
- Jeremy will record his own sounds: make a `sounds/` folder of files named by `CONFIG.SAMPLES` keys easy to drop in, loaded relatively.
- Tune scare/honey frequencies with him. Keep it toddler-scary: mostly moving creepies, occasional jumps, nothing nasty.
- Bear and creatures currently pass through each other; consider the bear reacting to nearby ambient creatures (e.g. looking at the spider).

## Constraints
Must stay publishable as a claude.ai artifact single page: CDN scripts only from jsdelivr / unpkg / cdnjs, Google Fonts; assets as relative files beside `index.html` or `data:` URIs (other hosts are blocked by the artifact CSP). Free fonts only.
