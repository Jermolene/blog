/* LAN play for the toys (Quizbuzz, Bowling Bear, Trackaholic): devices on the same Wi-Fi talk directly over WebRTC,
   introduced to each other by QR codes, with no server. toys-src/build.mjs inlines this file into each game, after
   qrcode-generator and jsQR.

   Joining. The host shows a link (…/bowling-bear/#BB4O…*) carrying its offer after the #. A phone's own camera app
   opens it (or the game's Scan button reads it); the phone makes an answer and shows it as a QR code; the host's camera,
   watching all the time, reads it, and the data channel opens. The host then makes a fresh invite for the next phone.
   Either code can also be copied and pasted as text.

   Codes. A code carries only what the other side can't guess: ICE ufrag and password, the DTLS fingerprint, the setup
   role and up to three host candidates as raw addresses; the rest of the SDP is rebuilt from a template. The bytes are
   written in a 41-character alphabet (three characters per two bytes) that is safe after a # and fits a QR code's
   alphanumeric mode, so the codes stay small and sparse: about 41×41 modules for a link, 33×33 for a reply.
   A code starts with the game's two letters, the version of this file's protocol, and O (offer) or A (answer).

   Staying connected. A dropped link can't be revived from storage: each connection needs fresh keys and addresses
   swapped, and the QR codes are the only way to swap them. So while a phone is connected, the host sets up a pool of
   spare links with it over the live one, both sides holding back their addresses so the spares sit idle. When the live
   link dies (the phone locks, someone answers a message) the phone feeds the host's addresses into a spare; the host
   learns the phone's address from its first check and the spare opens. If the host is the one away, each try fails
   after TRY_MS, so the pool covers about a minute and a half. The host keeps a lost player's place for GRACE.
   Phones notice a dead link by: the channel closing, the connection failing, or staying disconnected for 2.5 s, nothing
   heard for 6 s (they ping every 2 s), or no answer within 1.5 s of the page coming back into view.

   Messages. Each game sends its own JSON objects; this file's own messages have a `lan` field (hello, ping, pong, spare).
   Every phone has a lasting id (`<store>.pid` in localStorage) that it sends in its hello, so a phone that reloads and
   joins again gets its own place back. */
const LAN=(()=>{
'use strict';
const V=4,GAMES={QB:'Quizbuzz',BB:'Bowling Bear',TA:'Trackaholic'};
const SPARES=4,TRY_MS=20000,GRACE=120000;
const FAIL='Couldn’t connect. Both devices need to be on the same Wi-Fi, and some guest or office networks block devices from talking to each other.';
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const now=()=>Date.now();

/* ---------------- codes ---------------- */
// bytes: flags (setup 0 actpass, 1 active, 2 passive; +4 if a mid other than 0 follows) | [mid] | ufrag | pwd
//   (each a length then 6 bits a character) | 32-byte sha-256 | n | n × candidate (kind 4 IPv4, 6 IPv6, 16 mDNS uuid | address | port)
const B41='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+-./:',SETUPS=['actpass','active','passive'];
const ICE64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const b41=bytes=>{let s='';for(let i=0;i<bytes.length;i+=2){
  if(i+1<bytes.length){const n=bytes[i]*256+bytes[i+1];s+=B41[n%41]+B41[(n/41|0)%41]+B41[n/1681|0]}
  else s+=B41[bytes[i]%41]+B41[bytes[i]/41|0]}return s};
const unb41=s=>{const o=[],v=[...s].map(c=>{const k=B41.indexOf(c);if(k<0)throw 0;return k});
  for(let i=0;i<v.length;i+=3){
    if(i+2<v.length){const n=v[i]+v[i+1]*41+v[i+2]*1681;if(n>65535)throw 0;o.push(n>>8,n&255)}
    else if(i+1<v.length){const n=v[i]+v[i+1]*41;if(n>255)throw 0;o.push(n)}else throw 0}
  return new Uint8Array(o)};
const ice6=s=>{const o=[s.length];let acc=0,bits=0;for(const ch of s){const k=ICE64.indexOf(ch);if(k<0)throw new Error('Unexpected connection details (ice).');
  acc=acc<<6|k;bits+=6;if(bits>=8){bits-=8;o.push(acc>>bits&255)}}if(bits)o.push(acc<<(8-bits)&255);return o};
function ip6Bytes(a){const[h,t]=a.split('::'),w=s=>s?s.split(':'):[],hw=w(h),tw=t===undefined?[]:w(t);
  const all=[...hw,...Array(8-hw.length-tw.length).fill('0'),...tw],o=[];for(const x of all){const n=parseInt(x,16);o.push(n>>8,n&255)}return o}
const ip6Text=b=>Array.from({length:8},(_,i)=>(b[2*i]*256+b[2*i+1]).toString(16)).join(':');
const UUID_LOCAL=/^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/i;

function pack(game,kind,sdp){
  const get=k=>{const m=new RegExp('^a='+k+':(.*)$','m').exec(sdp);if(!m)throw new Error('Unexpected connection details ('+k+').');return m[1].trim()};
  const fp=get('fingerprint').split(' ');if(fp[0].toLowerCase()!=='sha-256')throw new Error('Unexpected connection details (fingerprint).');
  const cands=[];
  for(const m of sdp.matchAll(/^a=candidate:\S+ 1 udp \d+ (\S+) (\d+) typ host/gim)){
    const[,addr,port]=m;let c;
    if(/^\d+\.\d+\.\d+\.\d+$/.test(addr))c=[4,...addr.split('.').map(Number)];
    else if(UUID_LOCAL.test(addr))c=[16,...addr.slice(0,36).replace(/-/g,'').match(/../g).map(h=>parseInt(h,16))];
    else if(addr.includes(':'))c=[6,...ip6Bytes(addr)];
    else continue;
    c.push(+port>>8,+port&255);if(!cands.some(x=>x.join()===c.join()))cands.push(c);
  }
  // plain addresses first, then mDNS names; IPv6 only when there is nothing else (it makes the code bigger and rarely helps on home Wi-Fi)
  let use=[...cands.filter(c=>c[0]===4),...cands.filter(c=>c[0]===16)];if(!use.length)use=cands;use=use.slice(0,3);
  const mid=get('mid'),str=s=>[s.length,...[...s].map(ch=>ch.charCodeAt(0))];
  const bytes=[SETUPS.indexOf(get('setup'))|(mid==='0'?0:4),...(mid==='0'?[]:str(mid)),...ice6(get('ice-ufrag')),...ice6(get('ice-pwd')),
    ...fp[1].split(':').map(h=>parseInt(h,16)),use.length,...use.flat()];
  return game.id+V+kind+b41(new Uint8Array(bytes))+'*';
}
// the code in a link, a scan or a paste
const codeOf=text=>String(text||'').trim().replace(/^.*#/,'').replace(/^j=/i,'').toUpperCase();
const looksLikeCode=text=>/^[A-Z]{2}\d+[OA]/.test(codeOf(text))||/#j=/i.test(text);
// the code, if it is this game's and of the kind wanted; otherwise an error that says what's wrong
function check(game,text,kind){
  const code=codeOf(text),m=/^([A-Z]{2})(\d+)([OA])/.exec(code),older=()=>new Error('That code is from an older '+game.name+'. Reload the page on the other device.');
  if(/#j=/i.test(text))throw older();
  if(!m)throw new Error('That isn’t a '+game.name+' code.');
  if(m[1]!==game.id)throw new Error(GAMES[m[1]]?'That code is for '+GAMES[m[1]]+', not '+game.name+'.':'That isn’t a '+game.name+' code.');
  if(+m[2]<V)throw older();
  if(+m[2]>V)throw new Error('That code is from a newer '+game.name+'. Reload this page.');
  if(kind&&m[3]!==kind)throw new Error(kind==='A'?'That’s the join code. Show the reply code from the phone.':'That’s a reply code. Use the code on the host’s screen.');
  return code;
}
function unpack(game,text,kind){
  const code=check(game,text,kind),bad=()=>new Error('That isn’t a '+game.name+' code.');
  if(!code.endsWith('*'))throw bad();
  let b;try{b=unb41(code.slice(game.id.length+String(V).length+1,-1))}catch(e){throw bad()}
  let i=0;const str=()=>{const n=b[i++];return String.fromCharCode(...b.slice(i,i+=n))};
  const ice=()=>{const n=b[i++];let s='',acc=0,bits=0;while(s.length<n){if(bits<6){acc=(acc<<8|b[i++])&0xffff;bits+=8}bits-=6;s+=ICE64[acc>>bits&63]}return s};
  const f=b[i++],setup=SETUPS[f&3],mid=f&4?str():'0',ufrag=ice(),pwd=ice();
  const hex=Array.from(b.slice(i,i+=32),x=>x.toString(16).padStart(2,'0').toUpperCase()).join(':');
  const L=['v=0','o=- '+Math.floor(Math.random()*1e15)+' 2 IN IP4 127.0.0.1','s=-','t=0 0','a=group:BUNDLE '+mid,'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel','c=IN IP4 0.0.0.0'];
  for(let n=b[i++],k=0;k<n;k++){
    const t=b[i++],a=b.slice(i,i+=t===4?4:16);let addr;
    if(t===4)addr=a.join('.');
    else if(t===6)addr=ip6Text(a);
    else{const h=Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');addr=[h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-')+'.local'}
    const port=b[i]*256+b[i+1];i+=2;
    L.push('a=candidate:'+(k+1)+' 1 udp '+(2122260223-k)+' '+addr+' '+port+' typ host generation 0');
  }
  if(!setup||i!==b.length||hex.length!==95)throw bad();
  L.push('a=end-of-candidates','a=ice-ufrag:'+ufrag,'a=ice-pwd:'+pwd,'a=fingerprint:sha-256 '+hex,'a=setup:'+setup,'a=mid:'+mid,'a=sctp-port:5000','a=max-message-size:262144');
  return{kind:code[game.id.length+String(V).length],sdp:L.join('\r\n')+'\r\n'};
}

/* ---------------- QR codes ---------------- */
// a link: its address as bytes, the code after # in alphanumeric mode; a bare code is all alphanumeric
function drawQR(canvas,text,px=560){
  const q=qrcode(0,'L'),k=text.lastIndexOf('#');
  if(k>=0)q.addData(text.slice(0,k+1),'Byte');q.addData(text.slice(k+1),'Alphanumeric');q.make();
  const n=q.getModuleCount(),quiet=4,s=Math.max(2,Math.floor(px/(n+quiet*2)));
  canvas.width=canvas.height=(n+quiet*2)*s;
  const g=canvas.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,canvas.width,canvas.height);g.fillStyle='#000';
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(q.isDark(r,c))g.fillRect((c+quiet)*s,(r+quiet)*s,s,s);
  return canvas;
}
const qrDataURL=(text,px)=>drawQR(document.createElement('canvas'),text,px).toDataURL();

// a camera that reads QR codes continuously into onText; returns stop()
function reader(video,facing,onText,onError){
  let alive=true,stream=null;
  (async()=>{
    try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing},audio:false})}
    catch(e){if(alive)onError('The camera isn’t available. Allow camera access for this page, or paste the code instead.');return}
    if(!alive){stream.getTracks().forEach(t=>t.stop());return}
    video.muted=true;video.playsInline=true;video.setAttribute('playsinline','');video.style.transform=facing==='user'?'scaleX(-1)':'';
    video.srcObject=stream;try{await video.play()}catch(e){}
    let det=null;try{if('BarcodeDetector' in window&&(await BarcodeDetector.getSupportedFormats()).includes('qr_code'))det=new BarcodeDetector({formats:['qr_code']})}catch(e){}
    const cv=document.createElement('canvas'),g=cv.getContext('2d',{willReadFrequently:true});
    const tick=async()=>{
      if(!alive)return;
      if(video.readyState>=2&&video.videoWidth){let t=null;
        try{if(det){const r=await det.detect(video);if(r[0])t=r[0].rawValue}
          else{const w=Math.min(720,video.videoWidth),h=Math.round(video.videoHeight*w/video.videoWidth);cv.width=w;cv.height=h;g.drawImage(video,0,0,w,h);
            const r=jsQR(g.getImageData(0,0,w,h).data,w,h,{inversionAttempts:'dontInvert'});if(r)t=r.data}}catch(e){}
        if(t&&alive)onText(t)}
      setTimeout(tick,120);
    };
    tick();
  })();
  return()=>{alive=false;if(stream)stream.getTracks().forEach(t=>t.stop());video.srcObject=null};
}

// the full-screen scanner behind a game's Scan button: the back camera, until it sees a code of the kind wanted
let scanUI=null,scanning=null;
function scanOverlay(){
  if(scanUI)return scanUI;
  const st=document.createElement('style');
  st.textContent='.lan-scan{position:fixed;inset:0;z-index:2147483000;background:#000;display:flex;flex-direction:column}.lan-scan[hidden]{display:none}'
    +'.lan-scan video{flex:1;min-height:0;width:100%;object-fit:cover}'
    +'.lan-scan .lan-frame{position:absolute;left:50%;top:45%;width:min(64vw,52vh);aspect-ratio:1;transform:translate(-50%,-50%);border:3px solid rgba(255,255,255,.9);border-radius:18px;box-shadow:0 0 0 100vmax rgba(0,0,0,.35);pointer-events:none}'
    +'.lan-scan .lan-bar{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:14px 16px calc(14px + env(safe-area-inset-bottom));background:#111;color:#fff;font-size:16px;line-height:1.3}'
    +'.lan-scan .lan-bar button:not([class]){font:inherit;font-weight:600;padding:10px 18px;border-radius:999px;border:0;background:#fff;color:#111;flex:none}';
  document.head.appendChild(st);
  const root=document.createElement('div');root.className='lan-scan';root.hidden=true;
  root.innerHTML='<video playsinline muted></video><div class="lan-frame"></div><div class="lan-bar"><span></span><button type="button">Cancel</button></div>';
  document.body.appendChild(root);
  return scanUI={root,video:root.querySelector('video'),msg:root.querySelector('span'),cancel:root.querySelector('button')};
}
function scan(game,kind,opts={}){
  if(scanning)scanning.cancel();
  return new Promise((resolve,reject)=>{
    const ui=scanOverlay();if(opts.buttonClass)ui.cancel.className=opts.buttonClass;
    ui.msg.textContent=kind==='O'?'Point the camera at the code on the host’s screen':'Point the camera at the reply code';
    const done=()=>{stop();ui.root.hidden=true;scanning=null};
    const stop=reader(ui.video,'environment',text=>{try{check(game,text,kind)}catch(e){ui.msg.textContent=e.message;return}done();resolve(text)},err=>{done();reject(new Error(err))});
    scanning={cancel(){done();reject(new Error('cancelled'))}};
    ui.cancel.onclick=()=>scanning&&scanning.cancel();
    ui.root.hidden=false;
  });
}

/* ---------------- shared pieces ---------------- */
function waitIce(pc){return new Promise(res=>{
  if(pc.iceGatheringState==='complete')return res();
  const t=setTimeout(res,3000);
  pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete'){clearTimeout(t);res()}});
})}
async function primeCamera(){ // Safari only offers LAN candidates once the page has camera permission
  try{const s=await navigator.mediaDevices.getUserMedia({video:true});s.getTracks().forEach(t=>t.stop())}catch(e){}
}
function keepAwake(){ // the screen stays on while this device is in a game
  if(keepAwake.on||!('wakeLock' in navigator))return;keepAwake.on=true;let lock=null;
  const ask=()=>{if(lock||document.visibilityState!=='visible')return;navigator.wakeLock.request('screen').then(l=>{lock=l;l.addEventListener('release',()=>{lock=null})}).catch(()=>{})};
  document.addEventListener('visibilitychange',ask);addEventListener('pointerdown',ask);ask();
}
const noCands=sdp=>sdp.split(/\r?\n/).filter(l=>l&&!/^a=(candidate|end-of-candidates)/.test(l)).join('\r\n')+'\r\n';
const sendOn=(line,m)=>{const dc=line&&line.dc;if(dc&&dc.readyState==='open')try{dc.send(typeof m==='string'?m:JSON.stringify(m))}catch(e){}};
const call=(cb,k,...a)=>{if(cb[k])try{return cb[k](...a)}catch(e){console.warn(e)}};
function myPid(game){let id=store.get(game.store+'.pid');if(!id){id='p'+Math.random().toString(36).slice(2,10);store.set(game.store+'.pid',id)}return id}

// a code in the address the page was opened with: taken out of the address, so a reload doesn't reuse a stale offer.
// A later scan that lands in the same tab only changes the #, so the page reloads to act on it.
function takeHash(keep=''){
  if(!takeHash.on){takeHash.on=true;addEventListener('hashchange',()=>{if(looksLikeCode(location.href))location.reload()})}
  if(!looksLikeCode(location.href))return null;
  const text=location.href;
  try{history.replaceState(null,'',location.pathname+location.search+keep)}catch(e){}
  return text;
}

/* ---------------- the host ---------------- */
// cb: onInvite(url) a new join link ('' while one is being made); onStatus(text, isError) for the host's screen;
// onJoin(pid, info, {back}) on each hello, back if the phone was here before; onMessage(pid, msg);
// onLost(pid) when a phone's link drops, and onGone(pid) if it isn't back within GRACE
function host(game,cb={}){
  const peers=new Map(),spares=new Map(),grace=new Map(),last=new Map(),used=new Set();
  let pending=null,n=0,cam=null,camVideo=null,errText='',errAt=0;
  let facing=/environment/.test(store.get(game.store+'.cam'))?'environment':'user'; // Quizbuzz stores it as JSON
  const api={url:'',code:'',get facing(){return facing}};
  const status=(t,err)=>call(cb,'onStatus',t||'',!!err);
  function line(pid){
    const pc=new RTCPeerConnection({iceServers:[]}),dc=pc.createDataChannel(game.channel,{ordered:true}),e={pc,dc,pid,n:++n};
    dc.onmessage=ev=>{let m;try{m=JSON.parse(ev.data)}catch(x){return}
      if(m&&m.lan){
        if(m.lan==='hello')return hello(e,m);
        if(!e.pid)return;last.set(e.pid,now());
        if(m.lan==='ping')sendOn(e,'{"lan":"pong"}');
        else if(m.lan==='spare'){const s=(spares.get(e.pid)||[]).find(x=>x.n===m.n);if(s)s.pc.setRemoteDescription({type:'answer',sdp:m.sdp}).catch(()=>{})}
        return}
      if(!e.pid||peers.get(e.pid)!==e)return;
      last.set(e.pid,now());call(cb,'onMessage',e.pid,m)};
    dc.onclose=()=>lost(e);
    pc.onconnectionstatechange=()=>{if(pc.connectionState!=='failed')return;if(pending===e){status(FAIL,true);invite()}else lost(e)};
    return e;
  }
  function hello(e,m){
    const pid=String(m.pid||('r'+e.n)).slice(0,24),old=peers.get(pid),back=grace.has(pid)||!!old;
    e.pid=pid;if(old&&old!==e){old.dead=true;try{old.pc.close()}catch(x){}}
    const sl=spares.get(pid);if(sl&&sl.includes(e))sl.splice(sl.indexOf(e),1);
    peers.set(pid,e);last.set(pid,now());clearTimeout(grace.get(pid));grace.delete(pid);
    call(cb,'onJoin',pid,m.info||{},{back});
    makeSpares(e);
  }
  function lost(e){
    if(e.dead||!e.pid||peers.get(e.pid)!==e)return;
    e.dead=true;const pid=e.pid;peers.delete(pid);
    if(grace.has(pid))return;
    grace.set(pid,setTimeout(()=>{grace.delete(pid);if(peers.has(pid))return;
      for(const s of spares.get(pid)||[])try{s.pc.close()}catch(x){}spares.delete(pid);call(cb,'onGone',pid)},GRACE));
    call(cb,'onLost',pid);
  }
  async function makeSpares(via){
    const pid=via.pid;for(const s of spares.get(pid)||[]){s.dead=true;try{s.pc.close()}catch(x){}}
    const list=[];spares.set(pid,list);
    for(let k=0;k<SPARES;k++){
      const s=line(pid);list.push(s);
      await s.pc.setLocalDescription(await s.pc.createOffer());await waitIce(s.pc);
      if(spares.get(pid)!==list||via.dc.readyState!=='open')return;
      sendOn(via,{lan:'spare',n:s.n,sdp:s.pc.localDescription.sdp});
    }
  }
  async function invite(){
    if(pending){pending.dead=true;try{pending.pc.close()}catch(x){}}
    const e=line(null);pending=e;api.url=api.code='';call(cb,'onInvite','');
    e.dc.addEventListener('open',()=>{if(pending===e){pending=null;status('');invite()}});
    try{await e.pc.setLocalDescription(await e.pc.createOffer());await waitIce(e.pc);
      if(pending!==e)return;
      api.code=pack(game,'O',e.pc.localDescription.sdp);api.url=location.origin+location.pathname+location.search+'#'+api.code;
      call(cb,'onInvite',api.url)}
    catch(err){if(pending===e)status('This device can’t make join codes: '+err.message,true)}
  }
  // a reply code from the camera or pasted; each is used once
  api.accept=async text=>{
    const code=codeOf(text);if(!code||used.has(code))return;
    try{const{sdp}=unpack(game,text,'A'),e=pending;
      if(!e||!e.pc.localDescription||e.pc.remoteDescription)throw new Error('One phone at a time: show the code again in a moment.');
      used.add(code);await e.pc.setRemoteDescription({type:'answer',sdp});status('Connecting…')}
    catch(err){if(err.message!==errText||now()-errAt>4000){errText=err.message;errAt=now();status(err.message,true)}}
  };
  // the camera that watches for reply codes, shown in the game's own <video>
  api.watch=video=>{api.unwatch();camVideo=video;
    cam=reader(video,facing,t=>{if(looksLikeCode(t))api.accept(t)},err=>status(err,true))};
  api.unwatch=()=>{if(cam){cam();cam=null}};
  api.flip=()=>{facing=facing==='user'?'environment':'user';store.set(game.store+'.cam',JSON.stringify(facing));if(cam)api.watch(camVideo);return facing};
  api.start=async()=>{await primeCamera();return invite()};
  api.invite=invite;
  api.send=(pid,m)=>sendOn(peers.get(pid),m);
  api.broadcast=(m,except)=>{const s=JSON.stringify(m);for(const[pid,e]of peers)if(pid!==except)sendOn(e,s)};
  api.has=pid=>{const e=peers.get(pid);return !!e&&e.dc.readyState==='open'};
  api.seen=pid=>last.get(pid)||0;
  api.away=()=>[...grace.keys()];
  return api;
}

/* ---------------- a phone ---------------- */
// cb: hello() the info sent with each hello (a name, say); onReply(code) the reply to show the host;
// onOpen({first, back}) when a link opens; onMessage(msg); onReconnecting() while trying the spares;
// onLost() when they are used up; onStatus(text, isError) if the first link fails. pid: to use instead of <store>.pid
function guest(game,cb={}){
  const pid=cb.pid||myPid(game);
  let live=null,spares=[],heard=0,rescuing=false,ping=0,tryT=0,opens=0;
  const api={reply:'',pid,get connected(){return !!live}};
  api.send=m=>sendOn(live,m);
  function wire(line){
    line.pc.ondatachannel=e=>{const dc=line.dc=e.channel;
      dc.onopen=()=>{
        if(live&&live!==line){try{live.pc.close()}catch(x){}}
        for(const s of spares)if(s!==line)try{s.pc.close()}catch(x){}
        live=line;spares=[];opens++;heard=now();clearTimeout(tryT);const back=rescuing;rescuing=false;
        sendOn(line,{lan:'hello',pid,info:call(cb,'hello')||{}});
        if(!ping){keepAwake();
          ping=setInterval(()=>{if(!live)return;sendOn(live,'{"lan":"ping"}');if(now()-heard>6000)rescue()},2000);
          document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible'||!live)return;
            if(rescuing){clearTimeout(tryT);tryNext(true);return}
            const t=now();sendOn(live,'{"lan":"ping"}');setTimeout(()=>{if(heard<t)rescue()},1500)})}
        call(cb,'onOpen',{first:opens===1,back})};
      dc.onmessage=ev=>{if(live!==line)return;heard=now();let m;try{m=JSON.parse(ev.data)}catch(x){return}
        if(m&&m.lan){if(m.lan==='spare')prepare(m);return}
        call(cb,'onMessage',m)};
      dc.onclose=()=>{if(live===line)rescue()}};
    line.pc.onconnectionstatechange=()=>{const st=line.pc.connectionState;
      if(live===line&&st==='failed')rescue();
      if(live===line&&st==='disconnected')setTimeout(()=>{if(live===line&&line.pc.connectionState!=='connected')rescue()},2500);
      if(line.trying&&st==='failed'&&live!==line&&rescuing){clearTimeout(tryT);tryNext()}
      if(line.first&&!live&&st==='failed')call(cb,'onStatus',FAIL,true)};
  }
  async function prepare(m){ // the host's spare offer, minus its addresses until it's needed
    const line={pc:new RTCPeerConnection({iceServers:[]}),cands:m.sdp.split(/\r?\n/).filter(l=>l.startsWith('a=candidate:')).map(l=>l.slice(2)),mid:(/^a=mid:(\S+)/m.exec(m.sdp)||[])[1]||'0'};
    spares.push(line);wire(line);
    try{await line.pc.setRemoteDescription({type:'offer',sdp:noCands(m.sdp)});await line.pc.setLocalDescription(await line.pc.createAnswer());
      sendOn(live,{lan:'spare',n:m.n,sdp:noCands(line.pc.localDescription.sdp)})}
    catch(err){spares=spares.filter(s=>s!==line)}
  }
  function lostAll(){rescuing=false;live=null;call(cb,'onLost')}
  function rescue(){
    if(rescuing)return;
    if(!spares.length)return lostAll();
    rescuing=true;call(cb,'onReconnecting');tryNext();
  }
  function tryNext(again){ // again: the page is back in view, so the spare being tried gets a fresh go
    let line=again&&spares.find(s=>s.trying&&s.pc.connectionState!=='failed');
    if(!line){for(const s of spares)if(s.trying)try{s.pc.close()}catch(x){}
      spares=spares.filter(s=>!s.trying);line=spares[0]}
    if(!line)return lostAll();
    if(!line.trying){line.trying=true;line.cands.forEach(c=>line.pc.addIceCandidate({candidate:c,sdpMid:line.mid}).catch(()=>{}))}
    tryT=setTimeout(()=>{if(live!==line)tryNext()},TRY_MS);
  }
  // join with the host's code (a link, a scan or a paste); resolves with the reply code, which onReply also gets
  api.join=async text=>{
    const{sdp}=unpack(game,text,'O');
    await primeCamera();
    const line={pc:new RTCPeerConnection({iceServers:[]}),first:true};wire(line);
    await line.pc.setRemoteDescription({type:'offer',sdp});
    await line.pc.setLocalDescription(await line.pc.createAnswer());await waitIce(line.pc);
    api.reply=pack(game,'A',line.pc.localDescription.sdp);call(cb,'onReply',api.reply);
    return api.reply;
  };
  api.debug=()=>({opens,state:live&&live.pc.connectionState,spares:spares.length,ready:spares.filter(s=>s.pc.localDescription).length,
    kill(){live.pc.close()},mute(){live.dc.onmessage=null}});
  return api;
}

const ok=typeof RTCPeerConnection!=='undefined'&&window.isSecureContext!==false;
// game: {id: two capital letters, name, channel: the data channel's label, store: the prefix of its localStorage keys}
const last={}; // the latest host and phone on this page, for toys-src/shared/test/lan.mjs
function game(g){return{...g,ok,FAIL,
  host:cb=>last.host=host(g,cb),guest:cb=>last.guest=guest(g,cb),scan:(kind,opts)=>scan(g,kind,opts),
  check:(text,kind)=>check(g,text,kind),unpack:(text,kind)=>unpack(g,text,kind),pack:(kind,sdp)=>pack(g,kind,sdp)}}
return{game,last,V,ok,FAIL,codeOf,looksLikeCode,takeHash,drawQR,qrDataURL,keepAwake,primeCamera};
})();
