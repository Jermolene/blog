// Renders the default pattern at the reference image's size to out/default.png and smoke-tests other modes.
// Usage: node tools/render_default.js && python3 tools/compare.py   (from toys-src/lozengineer; needs toys-src's npm install)
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..'),out=path.join(root,'out'),page=path.join(root,'..','..','static-assets','toys','lozengineer','index.html');
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
  const p=await b.newPage({viewport:{width:2576,height:1884},deviceScaleFactor:1});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+page);await p.waitForTimeout(600);
  await p.keyboard.press('h');await p.waitForTimeout(400);
  const u=await p.evaluate(()=>{render(performance.now());return cv.toDataURL('image/png')});
  fs.writeFileSync(path.join(out,'default.png'),Buffer.from(u.split(',')[1],'base64'));
  const modes=[{tile:'cube'},{tile:'chevron',cellN:2},{tile:'brick',cellN:3,scramble:.6,seed:4},{tile:'brick',diag:'long'},{tile:'star',folds:5,panX:0,panY:0},{tile:'star',folds:4,curve:1,warp:'twist',warpAmt:.6,swell:.2}];
  for(const m of modes){
    const r=await p.evaluate(m=>{S=regen({...DEFAULT,...m});afterChange();render(performance.now());const s=exportSVG();
      if(S.cell){const c=S.cell;let bad=0;for(let i=0;i<c.a;i++)for(let j=0;j<c.d;j++){const n=(c.f[canon(c,i,j)]===0)+(c.f[canon(c,i,j+1)]===1)+(c.f[canon(c,i+1,j)]===2);if(n!==1)bad++}return{svgKB:Math.round(s.length/1024),bad}}
      return{svgKB:Math.round(s.length/1024)}},m);
    console.log(JSON.stringify(m),JSON.stringify(r));
  }
  console.log('page errors:',errs.length?errs:'none');
  await b.close();if(errs.length)process.exit(1);
})();
