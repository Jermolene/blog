// Smoke test of the published page, static-assets/toys/swelled-rules/index.html, opened from disk.
// Run from toys-src/swelled-rules: node tests/smoke.mjs   (needs toys-src's npm install, with Chromium)
// Covers a column click, the weight and spacing curves, band sequences, Undo, Randomise, Reset, the presets, Explore, both saves and phone width.
import { chromium } from '../../node_modules/playwright/index.mjs';
import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = path.join(here, '..', '..', '..', 'static-assets', 'toys', 'swelled-rules', 'index.html');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 860 }, acceptDownloads: true });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.route('**fonts.g**', r => r.abort());
await p.goto('file://' + page);
await p.waitForTimeout(400);
const st = () => p.evaluate(() => JSON.stringify(S));
const s0 = await st();

// a click on a column cycles its type
const box = await p.locator('#mainCanvas').boundingBox();
await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(60);
const s1 = await st();
assert.notStrictEqual(s1, s0, 'click changes a column');
await p.click('#undo'); await p.waitForTimeout(60);
assert.strictEqual(await st(), s0, 'undo restores');

await p.click('#randomise'); await p.waitForTimeout(60);
assert.notStrictEqual(await st(), s0, 'randomise changes the pattern');
await p.click('#reset'); await p.waitForTimeout(60);
assert.strictEqual(await st(), s0, 'reset restores the opening sketch');

// curve editors: click adds a point and dragging moves it, double-click removes it, Undo and Reset
const curve = async (key, i) => {
  await p.locator('#curves svg').nth(i).scrollIntoViewIfNeeded();
  const r = await p.locator('#curves svg').nth(i).boundingBox(), sc = r.width / 110;
  return { at: (x, y) => [r.x + (5 + x * 100) * sc, r.y + (5 + (1 - y) * 100) * sc] };
};
for (const [key, i] of [['wCurve', 0], ['sCurve', 1]]) {
  const c = await curve(key, i);
  await p.mouse.move(...c.at(.5, .5)); await p.mouse.down();
  await p.mouse.move(...c.at(.55, .85), { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(60);
  const pts = await p.evaluate(k => S[k], key);
  assert.strictEqual(pts.length, 3, key + ' gains a point');
  assert(Math.abs(pts[1][0] - .55) < .02 && Math.abs(pts[1][1] - .85) < .02, key + ' point follows the drag ' + JSON.stringify(pts));
  await p.mouse.dblclick(...c.at(pts[1][0], pts[1][1])); await p.waitForTimeout(60);
  assert.strictEqual((await p.evaluate(k => S[k], key)).length, 2, key + ' double-click removes the point');
  await p.click('#undo'); await p.waitForTimeout(60);
  assert.strictEqual((await p.evaluate(k => S[k], key)).length, 3, key + ' undo brings it back');
}
const bodies = await p.evaluate(() => [bounds(S).body, rows(S).ys[28], rows(fromPreset(0)).ys[28]]);
assert(bodies[1] > bodies[2] + 1, 'spacing curve moves the middle rule down');
await p.click('#reset'); await p.waitForTimeout(60);
assert.strictEqual(await st(), s0, 'reset clears the curves');

const presets = await p.evaluate(() => PRESETS.length);
for (let i = 0; i < presets; i++) await p.evaluate(i => { S = fromPreset(i); changed(); }, i);

// band sequences: add a colour and a gap, remove one, give rising rules their own, and the SVG carries every colour but no gap
await p.evaluate(() => { S = fromPreset(PRESETS.findIndex(q => q.name === 'Flame')); changed(); });
const nF = await p.evaluate(() => S.bands.length);
await p.click('#addF'); await p.click('#gapF');
assert.strictEqual(await p.evaluate(() => S.bands.length), nF + 2, 'a colour and a gap are added');
assert.strictEqual(await p.evaluate(() => S.bands.at(-1)), '', 'the gap is empty');
await p.locator('#seqF > div').first().hover(); await p.locator('#seqF .del').first().click();
assert.strictEqual(await p.evaluate(() => S.bands.length), nF + 1, 'a band is removed');
await p.click('#ownR');
assert(await p.evaluate(() => Array.isArray(S.bandsR) && !document.getElementById('wrapR').hidden), 'rising rules get their own bands');
await p.evaluate(() => { S = fromPreset(PRESETS.findIndex(q => q.name === 'Sawtooth')); changed(); });
const svg = await p.evaluate(() => toSVG(S));
assert(await p.evaluate(svg => [...S.bands, ...S.bandsR].filter(Boolean).every(c => svg.includes(c)), svg), 'the SVG has every band colour');
assert(!svg.includes('fill=""'), 'gaps are not drawn');
await p.evaluate(() => { S = fromPreset(0); changed(); });

await p.click('#explore'); await p.waitForTimeout(500);
assert.strictEqual(await p.getAttribute('#explore', 'aria-pressed'), 'true', 'explore opens');
await p.click('#explore'); await p.waitForTimeout(100);

for (const id of ['saveSvg', 'savePng']) {
  assert(await p.isVisible('#' + id), id + ' is shown outside claude.ai');
  const [d] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.click('#' + id)]);
  console.log(id, d.suggestedFilename());
}

await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
assert(overflow <= 0, 'no sideways scroll at phone width (' + overflow + 'px)');

assert.deepStrictEqual(errs, [], 'no page errors');
await b.close();
console.log('ok');
