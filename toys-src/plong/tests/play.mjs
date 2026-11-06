/*
Plays Plong headlessly with robots on the built page (static-assets/games/plong; run node build.mjs plong first):
a 4-robot local game to the end on an iPad-sized screen, the phone-sized local layout, the page opened from disk,
and projector games with 2, 5 and 8 robots to the end. Screenshots go in toys-src/plong/shots/.
Usage: node toys-src/plong/tests/play.mjs     (needs Playwright: cd toys-src && npm install)
*/
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {serve, sleep, errors, DIR} from './serve.mjs';
const SHOTS = join(dirname(fileURLToPath(import.meta.url)), '../shots');mkdirSync(SHOTS, {recursive: true});
const shot = (pg, n) => pg.screenshot({path: join(SHOTS, n + '.png')});
const srv = await serve(), b = await chromium.launch();let fails = 0;
const check = (ok, what) => {console.log((ok ? 'ok   ' : 'FAIL ') + what);if (!ok) fails++;};
async function toEnd(pg, secs) {
  const t0 = Date.now();let st;
  while (Date.now() - t0 < secs * 1000) {st = await pg.evaluate('GAME&&{ph:GAME.phase,t:Math.round(GAME.time),hits:GAME.hits,lives:GAME.P.map(p=>p.lives)}');if (st && st.ph === 'over') break;await sleep(1000);}
  return st;
}
try {
  {const errs = [], pg = await b.newPage({viewport: {width: 1180, height: 820}});errors(pg, errs);
    await pg.goto(srv.url + '?auto&speed=4');await sleep(800);await shot(pg, 'local-menu');
    await pg.click('button.big');await sleep(3000);await shot(pg, 'local-play');
    const st = await toEnd(pg, 120);await sleep(2000);await shot(pg, 'local-over');
    check(st && st.ph === 'over', `local 4 robots to the end ${JSON.stringify(st)}`);check(!errs.length, 'local: no errors ' + errs.slice(0, 3));await pg.close();}
  {const errs = [], pg = await b.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, hasTouch: true});errors(pg, errs);
    await pg.goto(srv.url + '?auto&speed=2');await sleep(800);await shot(pg, 'phone-menu');
    await pg.click('button.big');await sleep(4000);await shot(pg, 'phone-local-play');
    check(await pg.evaluate('GAME.P.length===2&&GAME.phase'), 'phone local: two seats, playing');check(!errs.length, 'phone local: no errors ' + errs.slice(0, 3));await pg.close();}
  {const errs = [], pg = await b.newPage({viewport: {width: 1180, height: 820}});errors(pg, errs);
    await pg.goto(pathToFileURL(join(DIR, 'index.html')).href + '?auto&speed=4');await sleep(800);
    await pg.click('button.big');await sleep(3000);await shot(pg, 'file-play');
    check(await pg.evaluate('GAME.hits>0||GAME.time>1'), 'opened from disk: plays');check(!errs.length, 'from disk: no errors ' + errs.slice(0, 3));await pg.close();}
  for (const n of [2, 5, 8]) {
    const errs = [], pg = await b.newPage({viewport: {width: 1280, height: 720}});errors(pg, errs);
    await pg.goto(srv.url + `?speed=6&bots=${n}#host`);await sleep(1500);
    await pg.evaluate('__start()');await sleep(3000);await shot(pg, `host-bots${n}`);
    const st = await toEnd(pg, 120);await sleep(2500);await shot(pg, `host-bots${n}-over`);
    check(st && st.ph === 'over' && st.lives.length === n, `projector ${n} robots to the end ${JSON.stringify(st)}`);check(!errs.length, `projector ${n}: no errors ` + errs.slice(0, 3));await pg.close();
  }
} finally {await b.close();srv.close();}
console.log(fails ? `${fails} failed` : 'all passed');process.exit(fails ? 1 : 0);
