// Render Radialator's San Marco preset at 1030px and compare it with reference/san-marco.jpeg, the plate's roundel
// rotated and scaled into the same frame (circle 0 on the +x axis, rim radius 1 at 1030/2/1.0089 px).
//
// Usage:  node tools/compare_san_marco.mjs [index.html]      (from toys-src/radialator; needs toys-src's npm install)
// Both images are reduced to the six stones (paper counts as the white ribbon, which it matches on the plate) and
// compared pixel by pixel. Writes out/san-marco-mine.png and out/san-marco-diff.png (white = agree).
// Baseline at 2026-11-07: medallion 0.82, inner ring 0.22, rosette 0.85, rim 0.59, frame 0.80, whole disc 0.78.
// The inner ring (just outside the medallion) is drawn differently on the plate: there the artist coarsened the
// lattice into larger blocks, which the shapes cannot reproduce.
import { chromium } from '../../node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = process.argv[2] || path.join(here, '..', '..', '..', 'static-assets', 'toys', 'radialator', 'index.html');
const ref = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(here, '..', 'reference', 'san-marco.jpeg')).toString('base64');
const out = path.join(here, '..', 'out'); fs.mkdirSync(out, { recursive: true });

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 1200, height: 900 } });
pg.on('pageerror', e => console.log('page error:', e.message));
await pg.setContent('<!doctype html><html><head><meta charset=utf-8>' + fs.readFileSync(html, 'utf8'));
await pg.waitForTimeout(1500);
const res = await pg.evaluate(async ref => {
  const n = 1030, p = { ...DEFAULTS, ...PRESETS['San Marco'] }, mine = document.createElement('canvas');
  render(p, mine, n);
  const img = new Image(); img.src = ref; await img.decode();
  const rc = document.createElement('canvas'); rc.width = rc.height = n; rc.getContext('2d').drawImage(img, 0, 0, n, n);
  const A = mine.getContext('2d').getImageData(0, 0, n, n).data, B = rc.getContext('2d').getImageData(0, 0, n, n).data;
  const m = MOSAICS[0], cols = [m.a[0], m.s[0], m.s[1], m.b[1], m.b[0], m.fr, m.pa].map(c => hex(c).map(v => v * 255)), cls = [0, 1, 2, 3, 4, 5, 4];
  const near = (D, i) => { let b = 0, bd = 1e9; for (let k = 0; k < cols.length; k++) { const d = (D[i] - cols[k][0]) ** 2 + (D[i + 1] - cols[k][1]) ** 2 + (D[i + 2] - cols[k][2]) ** 2; if (d < bd) { bd = d; b = k } } return cls[b] };
  const zones = [['medallion', 0, p.hub], ['inner ring', p.hub, .35], ['rosette', .35, .9], ['rim', .9, .951], ['frame', .951, 1], ['whole disc', 0, 1]];
  const hit = zones.map(() => [0, 0]), k = n / 2 / 1.0089, dc = document.createElement('canvas'); dc.width = dc.height = n;
  const dctx = dc.getContext('2d'), dd = dctx.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = 4 * (y * n + x), r = Math.hypot(x + .5 - n / 2, y + .5 - n / 2) / k, ok = near(A, i) === near(B, i);
    zones.forEach((z, j) => { if (r >= z[1] && r < z[2]) { hit[j][0] += ok; hit[j][1]++ } });
    dd.data[i] = dd.data[i + 1] = dd.data[i + 2] = r < 1 ? (ok ? 255 : 0) : 160; dd.data[i + 3] = 255;
  }
  dctx.putImageData(dd, 0, 0);
  return { zones: zones.map((z, j) => [z[0], hit[j][0] / hit[j][1]]), mine: mine.toDataURL(), diff: dc.toDataURL() };
}, ref);
await b.close();
for (const [name, v] of res.zones) console.log(name.padEnd(12), v.toFixed(3));
const save = (f, u) => fs.writeFileSync(path.join(out, f), Buffer.from(u.split(',')[1], 'base64'));
save('san-marco-mine.png', res.mine); save('san-marco-diff.png', res.diff);
