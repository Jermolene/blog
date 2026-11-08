// Run from toys-src/quadrille: node tests/smoke.js   (needs toys-src's npm install, with Chromium)
// Tests the published page, static-assets/toys/quadrille/index.html
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 860 }, acceptDownloads: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**fonts.g**', r => r.abort());
  await p.goto('file://' + path.join(__dirname, '..', '..', '..', 'static-assets', 'toys', 'quadrille', 'index.html'));
  await p.waitForTimeout(250);
  const st = () => p.evaluate(() => ({ view, L: mainL, g: JSON.stringify(g), hist: history.length }));
  const s0 = await st();
  assert.strictEqual(s0.view, null);

  await p.mouse.move(420, 380);
  for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, -200); await p.waitForTimeout(30); }
  await p.waitForTimeout(60);
  const s1 = await st();
  assert(s1.L.S > s0.L.S, 'wheel zooms');
  assert.strictEqual(s1.g, s0.g, 'wheel does not edit');

  await p.mouse.move(500, 400); await p.mouse.down(); await p.mouse.move(600, 460, { steps: 5 }); await p.mouse.up();
  await p.waitForTimeout(60);
  const s2 = await st();
  assert.strictEqual(s2.g, s0.g, 'drag does not edit');
  assert.strictEqual(s2.L.ox - s1.L.ox, 100, 'drag pans x');

  await p.mouse.click(500, 400); await p.waitForTimeout(40);
  assert.notStrictEqual((await st()).g, s0.g, 'tap edits');
  await p.click('#undo');
  assert.strictEqual((await st()).g, s0.g, 'undo restores');

  await p.evaluate(() => {
    const f = (t, id, x, y) => sheet.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id == 1 }));
    f('pointerdown', 1, 400, 400); f('pointerdown', 2, 500, 400); f('pointermove', 2, 600, 400); f('pointerup', 2, 600, 400); f('pointerup', 1, 400, 400);
  });
  await p.waitForTimeout(60);
  const s3 = await st();
  assert(Math.abs(s3.L.S / s2.L.S - 2) < 0.02, 'pinch doubles zoom');
  assert.strictEqual(s3.hist, 0, 'pinch does not edit');

  await p.click('#zfit'); await p.waitForTimeout(60);
  assert.strictEqual((await st()).view, null);
  for (let i = 0; i < 30; i++) await p.click('#rand');
  await p.click('#reset');
  assert.strictEqual((await st()).g, s0.g, 'reset returns to the opening pattern');
  await p.click('#exploreBtn'); await p.waitForTimeout(100);
  assert.strictEqual(await p.locator('.var').count(), 9);
  await p.locator('.var').nth(0).click(); await p.waitForTimeout(100);
  assert.notStrictEqual((await st()).g, s0.g, 'explore pick moves');
  await p.click('#exploreBtn');

  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#saveSvg')]);
  assert.strictEqual(dl.suggestedFilename(), 'quadrille.svg');
  const [dp] = await Promise.all([p.waitForEvent('download'), p.click('#savePng')]);
  assert.strictEqual(dp.suggestedFilename(), 'quadrille.png');

  const m = await b.newPage({ viewport: { width: 400, height: 800 } });
  await m.route('**fonts.g**', r => r.abort());
  m.on('pageerror', e => errs.push(e.message));
  await m.goto('file://' + path.join(__dirname, '..', '..', '..', 'static-assets', 'toys', 'quadrille', 'index.html')); await m.waitForTimeout(150);
  assert.strictEqual(await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, 'no sideways scroll at phone width');
  assert.deepStrictEqual(errs, []);
  await b.close();
  console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
