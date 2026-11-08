// Smoke test of the published page, static-assets/toys/swelled-rules/index.html, opened from disk.
// Run from toys-src/swelled-rules: node tests/smoke.mjs   (needs toys-src's npm install, with Chromium)
// Covers a column click, Undo, Randomise, Reset, the presets, Explore, both saves and phone width.
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

const presets = await p.evaluate(() => PRESETS.length);
for (let i = 0; i < presets; i++) await p.evaluate(i => { S = fromPreset(i); changed(); }, i);
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
