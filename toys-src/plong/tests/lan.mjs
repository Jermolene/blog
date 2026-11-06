/*
Real WebRTC between separate Chromium processes on the built page (run node build.mjs plong first): a projector
with one robot, two phones and a toddler's phone join (the reply code is handed over by __acceptReply instead of the
camera), they play, the toddler attacks, one phone drops out (a robot takes over its paddle) and rejoins from a
fresh browser with the same pid, and the game is played to the end with results on the phones.
Usage: node toys-src/plong/tests/lan.mjs     (needs Playwright: cd toys-src && npm install)
*/
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {serve, sleep, errors} from './serve.mjs';
const SHOTS = join(dirname(fileURLToPath(import.meta.url)), '../shots');mkdirSync(SHOTS, {recursive: true});
const shot = (pg, n) => pg.screenshot({path: join(SHOTS, n + '.png')});
const ARGS = ['--disable-features=WebRtcHideLocalIpsWithMdns', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
const srv = await serve(), browsers = [], errs = [];let fails = 0;
const check = (ok, what) => {console.log((ok ? 'ok   ' : 'FAIL ') + what);if (!ok) fails++;};
async function mk(width, height, touch) {
  const b = await chromium.launch({args: ARGS});browsers.push(b);
  const pg = await (await b.newContext({viewport: {width, height}, hasTouch: touch})).newPage();errors(pg, errs);return {b, pg};
}
try {
  const {pg: host} = await mk(1280, 720, false);
  await host.goto(srv.url + '?speed=3&bots=1#host');
  await host.waitForFunction('window.__host&&__host.invite&&__host.invite.code', null, {timeout: 15000});
  await shot(host, 'host-lobby-empty');
  async function join(name, tod, ph) {
    ph = ph || await mk(390, 844, true);const pg = ph.pg;
    await host.waitForFunction('__host.invite&&__host.invite.code', null, {timeout: 15000});
    const code = await host.evaluate('__host.invite.code');
    console.log(`     ${name}: join URL ${srv.url.length + 3 + code.length} chars here (about ${'https://jermolene.com/games/plong/'.length + 3 + code.length} on the site)`);
    await pg.goto(srv.url + '#j=' + code);await pg.waitForSelector('button.big');
    await pg.fill('input[type=text]', name);if (tod) await pg.check('input[type=checkbox]');
    await pg.click('button.big');
    await pg.waitForFunction('window.__reply', null, {timeout: 15000});
    const reply = await pg.evaluate('__reply');console.log(`     ${name}: reply ${reply.length} chars`);
    await shot(pg, 'phone-reply-' + name);
    await host.evaluate(c => __acceptReply(c), reply);
    await pg.waitForFunction('__phone.connected', null, {timeout: 15000});await sleep(600);
    return ph;
  }
  const A = await join('ANNA'), B = await join('BEN'), T = await join('TOT', true);await sleep(1500);
  const names = await host.evaluate('__host.players.map(p=>p.name)');
  check(['ANNA', 'BEN'].every(n => names.includes(n)) && await host.evaluate('__host.toddlers.length') === 1, 'two players and a toddler joined: ' + names);
  await shot(host, 'host-lobby');await shot(A.pg, 'phone-lobby');
  await host.evaluate('__start()');await sleep(3000);
  for (let k = 0; k < 6; k++) {for (const {pg} of [A, B]) await pg.evaluate(() => {__phone.t = Math.random();__phone.dc.send(JSON.stringify({k: 'mv', t: __phone.t}));});await sleep(400);}
  const ta = await A.pg.evaluate('__phone.t'), hostT = await host.evaluate("GAME.P.find(p=>p.name==='ANNA').target");
  check(Math.abs(ta - hostT) < 1e-6, `paddle moves reach the projector (${ta.toFixed(2)} → ${hostT.toFixed(2)})`);
  await shot(host, 'host-game');await shot(A.pg, 'phone-play');
  // the toddler's attack, once the recharge allows it
  await T.pg.waitForFunction('__phone.view&&__phone.view.targets&&__phone.view.targets.length&&document.querySelector("button.tgt:not([disabled])")', null, {timeout: 25000}).catch(() => {});
  await T.pg.click('button.tgt').catch(() => {});await sleep(500);
  const fx = await host.evaluate('GAME.fx.map(f=>f.k)');check(fx.length > 0, 'toddler attack lands: ' + fx);await shot(T.pg, 'phone-toddler');
  // ANNA drops out and rejoins from a fresh browser with the same pid
  await A.b.close();await sleep(6000);
  check(await host.evaluate("GAME.P.find(p=>p.name==='ANNA').away"), 'dropped phone is marked away');await shot(host, 'host-away');
  const A2 = await mk(390, 844, true);await A2.pg.goto(srv.url + '?x');
  const pid = await host.evaluate("__host.players.find(p=>p.name==='ANNA').pid");
  await A2.pg.evaluate(p => {localStorage.setItem('plong.pid', p);localStorage.setItem('plong.name', 'ANNA');}, pid);
  await join('ANNA', false, A2);await sleep(2000);
  check(await host.evaluate("!GAME.P.find(p=>p.name==='ANNA').away&&__host.players.filter(p=>p.name==='ANNA').length===1"), 'rejoined the same seat');
  const t0 = Date.now();let st;
  while (Date.now() - t0 < 180000) {
    st = await host.evaluate('({ph:GAME.phase,lives:GAME.P.map(p=>p.lives)})');if (st.ph === 'over') break;
    for (const {pg} of [A2, B]) await pg.evaluate(() => {__phone.t = Math.random();__phone.dc.send(JSON.stringify({k: 'mv', t: __phone.t}));}).catch(() => {});
    await sleep(1000);
  }
  check(st.ph === 'over', 'game played to the end ' + JSON.stringify(st));await sleep(2500);
  await shot(host, 'host-over');await shot(B.pg, 'phone-over');
  const bv = await B.pg.evaluate('__phone.view');check(bv && /over|result/i.test(JSON.stringify(bv)), 'phone shows the results: ' + JSON.stringify(bv).slice(0, 120));
  check(!errs.length, 'no page errors ' + errs.slice(0, 3));
} finally {for (const b of browsers) await b.close().catch(() => {});srv.close();}
console.log(fails ? `${fails} failed` : 'all passed');process.exit(fails ? 1 : 0);
