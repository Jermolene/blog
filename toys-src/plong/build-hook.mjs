// Plong's part of toys-src/build.mjs: the Press Start 2P font goes in as a data URL before the shared build
// (so the page needs no internet at all), and afterwards the page is also written as plong.html, the Claude
// artifact body (no doctype/head/body; PLONG_ARTIFACT hides the host button, since artifacts block WebRTC
// and the camera). plong.html is gitignored.
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

export async function before(html, {dir}) {
  const font = (await readFile(join(dir, 'fonts/ps2p.woff2'))).toString('base64');
  if (!html.includes('/*__FONT__*/')) throw new Error('no /*__FONT__*/ marker');
  return html.replace('/*__FONT__*/', () => `@font-face{font-family:PS2P;src:url(data:font/woff2;base64,${font}) format('woff2');font-display:block}`);
}

export async function after(html, {dir}) {
  const art = html
    .replace(/^[\s\S]*?<head>\s*/i, '')
    .replace(/<meta name="viewport"[^>]*>\n/, '')
    .replace(/<link rel="(manifest|apple-touch-icon)"[^>]*>\n/g, '')
    .replace(/<script src="\.\.\/pwa\.js"[^>]*><\/script>\n/, '')
    .replace('</head>\n<body>\n', '')
    .replace(/<\/body>\s*<\/html>\s*$/i, '')
    .replace("<script>\n'use strict';", "<script>window.PLONG_ARTIFACT=true</script>\n<script>\n'use strict';");
  await writeFile(join(dir, 'plong.html'), art);
  return html;
}
