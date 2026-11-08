// Run from toys-src/arterial-britain after python3 build.py: node tests/export.test.js   (needs toys-src's npm install)
// Opens the published page; screenshots and exports go to out/ (gitignored)
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const br=await chromium.launch();const p=await br.newPage({viewport:{width:1400,height:1000},acceptDownloads:true});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>m.type()=='error'&&errs.push(m.text()));
await p.goto('file://'+require('path').resolve(__dirname,'../../../static-assets/toys/arterial-britain/index.html'));await p.waitForFunction(()=>document.getElementById('load').hidden);await p.waitForTimeout(800);
await p.click('#names');await p.evaluate(()=>{const l=document.getElementById('landC');l.value='#e8dcc0';l.dispatchEvent(new Event('input'));const s=document.getElementById('seaC');s.value='#bcd4e0';s.dispatchEvent(new Event('input'))});await p.waitForTimeout(600);await p.screenshot({path:'out/c1.png'});
for(const id of['png','svg']){const [d]=await Promise.all([p.waitForEvent('download'),p.click('#'+id)]);await d.saveAs('out/out.'+id);console.log(id,fs.statSync('out/out.'+id).size)}
await p.click('#names');await p.click('[data-m=meet]');await p.waitForTimeout(800);const [d]=await Promise.all([p.waitForEvent('download'),p.click('#svg')]);await d.saveAs('out/meet.svg');
await p.click('[data-v=night]');await p.waitForTimeout(500);console.log(await p.evaluate(()=>[S.land,S.sea,document.getElementById('seaC').value]));
console.log('errs',errs);
const q=await br.newPage({viewport:{width:1200,height:1500}});await q.goto('file://'+require('path').resolve(__dirname,'../out/meet.svg'));await q.waitForTimeout(800);await q.screenshot({path:'out/msvg.png'});await br.close()})();
