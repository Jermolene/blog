# Plong — notes for Claude Code

Read HANDOVER.md first (design, rules, network protocol, what's verified).

- Integrated into jermolene.com on 2026-11-06. Published at `static-assets/games/plong/index.html` (https://jermolene.com/games/plong/), which is a **build output**: edit `src/index.html` here, then `node build.mjs plong` from `toys-src`, and commit both. The site's GitHub Action publishes on push to master. Must be served over HTTPS (camera, WebRTC).
- The build (`toys-src/build.mjs` plus `build-hook.mjs` here) inlines the QR libraries from `toys-src/shared/vendor/` (qrcode-generator 1.4.4, MIT; jsQR 1.4.0, Apache-2.0; the same versions the handover vendored) and the Press Start 2P font (`fonts/`, OFL) as a data URL, so the page needs no internet. It also writes `plong.html`, the Claude artifact body (no doctype/head/body; `window.PLONG_ARTIFACT=true` hides the host button since artifacts block WebRTC/camera); that file is gitignored.
- The site's `../pwa.js` makes it installable and offline-capable like the other games; the manifest and icons (`icon.svg` → PNGs via `build-icons.sh`) are in the published folder. Listing text comes from the `<meta>` tags in the source head.
- Plong keeps its own WebRTC/QR transport rather than `toys-src/shared/lan.js` (used by Quizbuzz, Bowling Bear and Trackaholic). Porting it is an open decision; see `shared/lan.js`'s header.
- British English in all UI text.

## Tests (Node Playwright, headless Chromium; `cd toys-src && npm install` first)
Run from anywhere after building; each serves the built page itself and writes screenshots to `shots/` (gitignored):
- `node toys-src/plong/tests/play.mjs` — 4-robot local game to the end at iPad size, the phone-size local layout, the page opened from disk (file://), and projector games with 2, 5 and 8 robots to the end.
- `node toys-src/plong/tests/lan.mjs` — real WebRTC across separate Chromium processes: 2 phones + toddler join, paddle moves arrive, toddler attack lands, one phone drops (robot takes over) and rejoins from a fresh browser with the same pid, game to the end, results on phones. Prints the join URL and reply code lengths. Launch flags `--disable-features=WebRtcHideLocalIpsWithMdns` plus fake media are required.
(The handover's Python tests, including `joinonly.py` used to chase a once-seen missing-player flake fixed by hello retry + `who`, were ported to these two; Python Playwright isn't installed here.)
Test hooks: `?speed=N`, `?auto`, `?bots=N`; globals `__host`, `__acceptReply(code)`, `__start()`, `__phone`, `__reply`, `GAME`.
Headless Chromium reports reduced motion, so the CRT flicker is off in screenshots. `shots-sample/` holds the handover's reference screenshots.

## First real-device test
iPad on `https://jermolene.com/games/plong/#host`, AirPlay to the projector, Start camera, two iPhones scan the QR, Join, hold reply QR to the iPad's front camera. Check: Safari ICE (camera priming), CompressionStream (Safari 16.4+), reply-QR reading distance, projector QR readability (~540-char URL on jermolene.com), latency of paddle moves, sound over AirPlay.

## Ideas not done
- Smaller join payload (slot design in the project's lan-webrtc-transport handover) if the projector QR doesn't read.
- Neighbour relay of reply codes.
- Host controls on a quizmaster phone instead of the mirrored screen.
