// Quizbuzz's part of toys-src/build.mjs: the question bank and fonts go in before the shared build,
// and afterwards the page is also written as the Claude artifact version and a standalone copy for the tests.
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const KEY = Buffer.from('quizbuzz');
const CATS = ['hist', 'geo', 'tv', 'film', 'music', 'sport', 'food', 'words', 'sci', 'xmas'];
const FONTS = [['Shrikhand', 400, 'fontsource-shrikhand-5.3.0/package/files/shrikhand-latin-400-normal.woff2'],
  ['Michroma', 400, 'fontsource-michroma-5.3.0/package/files/michroma-latin-400-normal.woff2'],
  ...[400, 500, 600, 700, 800].map(w => ['Jost', w, `fontsource-jost-5.3.0/package/files/jost-latin-${w}-normal.woff2`])];
const readJSON = async p => JSON.parse(await readFile(p, 'utf8'));
const tryJSON = p => readJSON(p).catch(e => {if (e.code === 'ENOENT') return []; throw e;});

// the bank from questions/verified (or QB_BANK), deduplicated, XOR-scrambled with the key so answers aren't readable in the source
async function bank(dir) {
  const src = join(dir, process.env.QB_BANK || 'questions/verified'), out = [], seen = new Set();
  for (const c of CATS) {
    const items = [...await readJSON(join(src, c + '.json')), ...await tryJSON(join(src, c + '.pending.json')), ...await tryJSON(join(src, c + '.unverified.json'))];
    items.forEach((it, i) => {
      const a = it.a;
      if (a.length !== 4 || new Set(a).size !== 4 || ![0, 1, 2, 3].includes(it.k) || ![1, 2, 3].includes(it.d)) throw new Error(`bad question ${c} ${i}: ${JSON.stringify(it)}`);
      const key = it.q.trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({id: c + '-' + createHash('sha1').update(key).digest('hex').slice(0, 6), c, d: it.d, q: it.q.trim(), a: a.map(s => s.trim()), k: it.k});
    });
  }
  const raw = Buffer.from(JSON.stringify(out));
  console.log(`quizbuzz: ${out.length} questions`);
  return Buffer.from(raw.map((b, i) => b ^ KEY[i % KEY.length])).toString('base64');
}

export async function before(html, {dir}) {
  let faces = '';
  for (const [fam, w, p] of FONTS) faces += `@font-face{font-family:'${fam}';font-weight:${w};font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${(await readFile(join(dir, 'fonts', p))).toString('base64')}) format('woff2')}`;
  const enc = await bank(dir);
  return html.replace('__BANK__', () => enc).replace('/*__FONTS__*/', () => faces);
}

// The source is a page body without <html>, as the artifact wants it. On jermolene.com the site's shared
// service worker (../pwa.js) and generated manifest make it work offline and installable.
const META = `<meta name="description" content="A family quiz show for Christmas: a 1960s TV studio on the big screen, a buzzer on everyone's phone, joined by QR code over the same Wi-Fi, and a toddler button with real power">
<meta name="toy-tagline" content="A family quiz show: a 1960s TV studio on the big screen and a buzzer on every phone">
<meta name="toy-category" content="games">
<meta name="theme-color" content="#1d1411">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<script src="../pwa.js" defer></script>
`;
export async function after(html, {dir}) {
  const nl = html.indexOf('\n') + 1, note = html.slice(0, nl), body = html.slice(nl);
  await writeFile(join(dir, 'quizbuzz.html'), body);
  await writeFile(join(dir, 'quizbuzz-standalone.html'), '<!doctype html>\n<html lang="en-GB">\n' + body + '\n</html>\n');
  if (!body.includes('<title>Quizbuzz</title>\n')) throw new Error('no <title> to put the site meta after');
  return '<!doctype html>\n' + note + '<html lang="en-GB">\n' + body.replace('<title>Quizbuzz</title>\n', '<title>Quizbuzz</title>\n' + META) + '\n</html>\n';
}
