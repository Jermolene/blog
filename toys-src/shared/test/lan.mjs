// LAN play in all three games, through toys-src/shared/lan.js: a host and two phones in separate Chromium processes.
//   node shared/test/lan.mjs [quizbuzz|bowling-bear|trackaholic ...]      (from toys-src, after node build.mjs)
// Serves static-assets/toys on port 8770. The host's camera is bypassed: each reply code is handed to the host as
// the camera (or a paste) would. Checks joining by link and by a code put into an open page, the QR sizes, a phone
// coming back over a spare after its link is killed or goes silent, a reloaded phone rejoining into its old place,
// the messages for codes from an older version or another game, and (Trackaholic) a racer who drops mid-race.
import {chromium} from 'playwright';
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../static-assets/toys'),PORT=8770,BASE=`http://127.0.0.1:${PORT}/`;
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split(/[?#]/)[0]);if(u.endsWith('/'))u+='index.html';
  fs.readFile(path.join(ROOT,u),(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':u.endsWith('.html')?'text/html':'text/javascript'});r.end(d)})}).listen(PORT);
const ARGS=['--disable-features=WebRtcHideLocalIpsWithMdns','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-angle=swiftshader','--enable-unsafe-swiftshader'];

const GAMES={
  quizbuzz:{id:'QB',hostSize:[1180,820],
    async host(pg){await pg.goto(BASE+'quizbuzz/#host')},
    async join(pg,name){await pg.click('[data-rtc="player"]')},
    async named(pg,name,again){if(again)return;await pg.waitForSelector('.go',{timeout:15000});await pg.fill('.pad input',name);await pg.click('.go')},
    roster:'H.players.map(p=>p.name)'},
  'bowling-bear':{id:'BB',hostSize:[390,800],
    async host(pg){await pg.goto(BASE+'bowling-bear/');await pg.fill('#name','Hal');await pg.click('#bHost');await pg.click('#bInvite')},
    async join(pg,name){await pg.fill('#name2',name);await pg.click('#bJoinLink')},
    async named(){},
    roster:"__n.S.players.filter(p=>p.id!=='h').map(p=>p.name)"},
  trackaholic:{id:'TA',hostSize:[1180,820],
    async host(pg){await pg.addInitScript(()=>{localStorage.setItem('trackaholic.hostbots','0');localStorage.setItem('trackaholic.laps','1')});await pg.goto(BASE+'trackaholic/#host')},
    async join(pg,name){await pg.fill('#nameIn',name);await pg.click('#bJoin')},
    async named(){},
    roster:'GW.HOST.players.map(p=>p.name+(p.gone?"(gone)":""))'},
};

const errs=[],failures=[];
const check=(ok,what)=>{console.log((ok?'  ok   ':'  FAIL ')+what);if(!ok)failures.push(what)};
const watch=(pg,n)=>{pg.on('pageerror',e=>errs.push(n+': '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!/404|favicon/.test(m.text()))errs.push(n+': '+m.text())})};

async function run(name){
  const g=GAMES[name];console.log(name);
  const browsers=[],open=async(n,w=390,h=800)=>{const b=await chromium.launch({args:ARGS});browsers.push(b);
    const pg=await (await b.newContext({permissions:['camera'],viewport:{width:w,height:h}})).newPage();watch(pg,name+' '+n);return pg};
  const host=await open('host',...g.hostSize);await g.host(host);
  const invite=async old=>{await host.waitForFunction(o=>LAN.last.host&&LAN.last.host.url&&LAN.last.host.url!==o,old||'',{timeout:30000});return host.evaluate(()=>LAN.last.host.url)};
  const roster=()=>host.evaluate(g.roster);
  const modules=(pg,text)=>pg.evaluate(t=>{const q=qrcode(0,'L'),k=t.lastIndexOf('#');if(k>=0)q.addData(t.slice(0,k+1),'Byte');q.addData(t.slice(k+1),'Alphanumeric');q.make();return q.getModuleCount()},text);
  // a phone on the page joins: makes its reply, which the host reads; then gives its name if the game asks after connecting
  async function join(pg,who,url,again){
    await g.join(pg,who);
    await pg.waitForFunction(()=>LAN.last.guest&&LAN.last.guest.reply,null,{timeout:20000});
    const reply=await pg.evaluate(()=>LAN.last.guest.reply);
    await host.evaluate(c=>LAN.last.host.accept(c),reply);
    await pg.waitForFunction(()=>LAN.last.guest.connected,null,{timeout:20000});
    await g.named(pg,who,again);await invite(url);return reply;
  }

  let url=await invite();
  const site=url.replace(BASE,'https://jermolene.com/toys/');
  // Ann opens the link, as from the phone's camera app
  const ann=await open('Ann');await ann.goto(url);await ann.waitForTimeout(300);
  check(!/[A-Z]{2}\d/.test(await ann.evaluate(()=>location.hash)),'the code is taken out of the address');
  const reply=await join(ann,'Ann',url);
  console.log(`       join QR ${await modules(host,site)}×, reply QR ${await modules(ann,reply)}× modules (${site.length} and ${reply.length} characters)`);
  // Bob's page is already open; a scanned or pasted code changes the # and the page reloads into joining
  url=await host.evaluate(()=>LAN.last.host.url);
  const bob=await open('Bob');await bob.goto(BASE+name+'/');await bob.waitForTimeout(500);
  await bob.evaluate(c=>{location.hash=c},url.split('#')[1]);await bob.waitForLoadState('load');await bob.waitForTimeout(800);
  await join(bob,'Bob',url);
  await host.waitForTimeout(800);
  check(JSON.stringify(await roster())===JSON.stringify(['Ann','Bob']),'both phones join: '+JSON.stringify(await roster()));
  for(const pg of [ann,bob])await pg.waitForFunction(()=>LAN.last.guest.debug().ready>=1,null,{timeout:20000});

  if(name==='trackaholic'){ // a race, so that a drop and return happens mid-race
    await host.evaluate(()=>GW.HOST.start());await ann.waitForFunction(()=>GW.G.phase==='race'||GW.G.phase==='count',null,{timeout:30000});
    await ann.waitForFunction(()=>LAN.last.guest.debug().ready>=1,null,{timeout:20000});
  }
  // Ann's link is killed: she comes back over a spare
  await ann.evaluate(()=>LAN.last.guest.debug().kill());
  await ann.waitForFunction(()=>LAN.last.guest.debug().opens===2&&LAN.last.guest.connected,null,{timeout:30000});
  check(true,'a killed link comes back over a spare');
  if(name==='trackaholic'){await ann.waitForTimeout(1500);check(await ann.evaluate(()=>!!GW.G.me&&GW.G.me.id===GW.GU.id),'the racer is still driving after coming back, not watching')}
  // Bob's link goes silent: he notices within 6 s and comes back
  await bob.evaluate(()=>LAN.last.guest.debug().mute());
  await bob.waitForFunction(()=>LAN.last.guest.debug().opens===2,null,{timeout:30000});
  check(true,'a silent link is noticed and replaced');
  await host.waitForTimeout(800);
  check(JSON.stringify(await roster())===JSON.stringify(['Ann','Bob']),'nobody lost their place: '+JSON.stringify(await roster()));
  // Ann's page reloads: she joins again through a fresh invite and gets her own place back
  if(name!=='trackaholic'){
    url=await host.evaluate(()=>LAN.last.host.url);
    await ann.goto(url);await ann.waitForTimeout(300);await join(ann,'Ann',url,true);await host.waitForTimeout(1000);
    check(JSON.stringify(await roster())===JSON.stringify(['Ann','Bob']),'a reloaded phone rejoins into its old place: '+JSON.stringify(await roster()));
  }
  // codes that aren't for this page
  const msgs=await ann.evaluate(id=>{const G=LAN.game({id,name:'This game',channel:'x',store:'x'}),m=t=>{try{G.check(t,'O');return 'accepted'}catch(e){return e.message}};
    const other=id==='BB'?'QB':'BB';
    return[m(id+'3OABC*'),m('https://example.com/#j=QB1oz'),m(other+LAN.V+'OABC*'),m(id+LAN.V+'AABC*'),m('hello')]},g.id);
  check(/older/.test(msgs[0])&&/older/.test(msgs[1]),'old codes: '+msgs[0]);
  check(/is for /.test(msgs[2]),'another game’s code: '+msgs[2]);
  check(/reply code/.test(msgs[3]),'a reply where a join code belongs: '+msgs[3]);
  for(const b of browsers)await b.close();
}

for(const name of process.argv.slice(2).length?process.argv.slice(2):Object.keys(GAMES))await run(name);
check(!errs.length,'no page errors'+(errs.length?': '+errs.join(' | '):''));
srv.close();
console.log(failures.length?failures.length+' failed':'all passed');
process.exit(failures.length?1:0);
