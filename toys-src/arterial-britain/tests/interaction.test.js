// Run from toys-src/arterial-britain after python3 build.py: node tests/interaction.test.js   (needs toys-src's npm install)
// Opens the published page; screenshots and exports go to out/ (gitignored)
const {chromium}=require('playwright');
(async()=>{const br=await chromium.launch();const p=await br.newPage({viewport:{width:1400,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+require('path').resolve(__dirname,'../../../static-assets/toys/arterial-britain/index.html'));await p.waitForFunction(()=>document.getElementById('load').hidden);await p.waitForTimeout(800);
const box=await p.locator('#poster').boundingBox();
const c=(fx,fy)=>[box.x+box.width*fx,box.y+box.height*fy];
await p.mouse.click(...c(.45,.45));await p.waitForTimeout(500);console.log('hubs after tap',await p.evaluate(()=>S.hubs&&[S.hubs.length,S.hubs.at(-1).name]));
await p.click('#reset');await p.mouse.move(...c(.6,.8));for(let i=0;i<6;i++){await p.mouse.wheel(0,-200);await p.waitForTimeout(40)}await p.waitForTimeout(500);console.log('zoom',await p.evaluate(()=>V));await p.mouse.move(...c(.6,.8));await p.waitForTimeout(300);console.log('tip',await p.textContent('#tip'));await p.screenshot({path:'out/z.png'});
await p.click('[data-m=one]');await p.waitForTimeout(800);await p.click('#zr');await p.waitForTimeout(800);await p.screenshot({path:'out/o.png'});
for(const m of ['shed','one','meet'])for(let i=0;i<4;i++){await p.click('[data-m='+m+']');await p.click('#rand');await p.waitForTimeout(350)}
await p.click('[data-m=meet]');
// A -> B symmetry & blob
console.log(await p.evaluate(async()=>{S=clone(DEF);S.mode='shed';update();const d=[];const F=fitOf(S);const c=document.createElement('canvas');c.width=3000;c.height=3750;const x=c.getContext('2d');x.setTransform(1.5,0,0,1.5,0,0);const t=performance.now();drawMapLayer(x,scene,F,V);drawOverlay(x,scene,F);const b=await new Promise(r=>c.toBlob(r));return [b.size,performance.now()-t]}));
await p.click('[data-m=one]');await p.evaluate(()=>{S.style='night';update()});await p.waitForTimeout(700);await p.screenshot({path:'out/n.png'});
console.log('errs',errs);await br.close()})();
