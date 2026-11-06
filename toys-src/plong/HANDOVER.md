# Plong

Multiplayer polygon Pong for the family LAN setup. One self-contained HTML file (`static-assets/games/plong/index.html` in this repo, ~220 KB) with qrcode-generator 1.4.4 (MIT), jsQR 1.4.0 (Apache-2.0) and Press Start 2P (OFL) all inlined, so it works with no internet. Hosted at `jermolene.com/games/plong/` over HTTPS (camera and WebRTC need it).

## Build
Since integration into jermolene.com: `node build.mjs plong` from `toys-src` (see CLAUDE.md). Source: `src/index.html`. The handover's `build.py` and `dist/` were replaced by that build.

## Modes (URL hash)
| URL | What it is |
|---|---|
| `index.html` | Local: iPad = 4 seats (one per edge), phone = 2 (top/bottom). Each seat Player / Robot / Off. Drag along your own edge. Keys: bottom ←→, right I/K, top A/D, left W/S; space pauses. |
| `#host` | Projector page. Join QR is a URL; Start camera reads phone replies with the front camera (paste box as fallback). +Robot, Lives 3/5/7, Power-ups, Toddler toggles. |
| `#j=PL1<id>.<b64url>` | Phone from the projector QR: name, optional "toddler's phone", Join, hold reply QR to the iPad. Then becomes a controller. |
Test hooks: `?speed=N`, `?auto` (local seats all robots), `?bots=N` (host).

## Game
- Arena: n players → square (2, players left/right), hexagon with alternating walls (3), else regular n-gon; stretched ×1.38 for 16:9. Corner bumpers 0.06.
- Paddle hit: off-centre angle up to ~57°, paddle velocity adds angle and spin (curve); speed +4.5% per hit to a cap.
- Lives (default 3). Out → your side becomes a wall and you are a ghost: every 10 s you pick a player and the ball homes towards them for 1.4 s. Robot ghosts haunt too.
- Balls: 1, or 2 with 5+ alive; +1 after 100 s and +1 after 200 s of play so games end (robot games 2–5 min).
- Power-ups (on by default): W wide paddle 10 s, M multiball, C next 3 hits curve. Credit goes to whoever last hit the ball.
- Toddler: 20 s recharge, taps a player: shrink 7 s, wobble 5 s, or a splat ball aimed at them.
- Robots predict the intercept with a speed-dependent miss.

## Network
- Host: one invite pc at a time, offer SDP compacted (UDP host candidates only), deflate-raw, base64url in the URL. Reply: `PL1A` + base45 of [invite id (2 bytes) + deflated answer], QR alphanumeric mode (~560 chars). Stale-invite replies get a "scan again" toast.
- Phone primes the camera before answering (Safari LAN candidates). Persistent pid in localStorage; hello reclaims the seat. Phone re-sends hello until it gets a view; host answers unknown senders with `who`.
- Up: `hello{pid,name,tod}`, `mv{t}` (paddle 0–1, ≤33 Hz while dragging), `act{target}`, `ping` (1 s). Down: `v` (view snapshot, sent on change + every 2 s), `e` (hit/goal → flash + vibrate).
- Away after 4 s silence: a robot plays that paddle and the projector auto-shows a small rejoin QR + camera. Phone has an in-page rear-camera rescan.
- Phone drag is projected onto that side's on-screen direction, so diagonal edges are dragged diagonally.

## Verified (headless Chromium)
- Local 4-robot games at 1180×820 and phone 390×844; no errors.
- Projector robot games with 2, 5 and 8 players to completion.
- Separate browser processes over real WebRTC: two phones + toddler join, play, toddler attack lands, one phone closes (marked away, robot takes over), rejoins from a fresh browser with the same pid and gets its seat back, game ends, results on phones.

## Not yet verified
- Real iPad/iPhones: Safari ICE, CompressionStream (Safari 16.4+), front camera reading reply QRs, projector readability of the ~600-char join URL (QR v~22).
- Sound over AirPlay latency.
