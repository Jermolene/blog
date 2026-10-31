#!/usr/bin/env node
// Builds the toys that have a source folder here into single self-contained pages:
// toys-src/<toy>/src/index.html -> static-assets/toys/<toy>/index.html
//
//   node build.mjs              every toy with a src/index.html
//   node build.mjs trackaholic  just the ones named
//
// The source is an ordinary page that also runs as it is (serve toys-src and open <toy>/src/index.html). The build:
// - inlines each <script data-inline src="…"></script> (shared code, vendored libraries, models);
// - drops <script type="importmap" data-dev>, which points the source at node_modules;
// - bundles each <script type="module" data-bundle> with esbuild, so three.js and the rest come from node_modules
//   (the versions pinned in package.json) instead of a CDN;
// - runs the toy's own build-hook.mjs, if it has one, for anything else (Quizbuzz's question bank and fonts).
// So the published page needs nothing but itself, Google Fonts and the site's ../pwa.js.
import {readFile, writeFile, readdir, access} from 'node:fs/promises';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(ROOT, '../static-assets/toys');
const exists = p => access(p).then(() => true, () => false);

// a script's text can't contain "</script" inside an inline <script>; "<\/script" means the same in JS strings and regexes
const scriptSafe = js => js.replace(/<\/(script)/gi, '<\\/$1');

async function replaceAsync(s, re, fn) {
  const parts = [];let last = 0;
  for (const m of s.matchAll(re)) {parts.push(s.slice(last, m.index), await fn(...m));last = m.index + m[0].length;}
  return parts.join('') + s.slice(last);
}

export async function buildPage(html, srcDir) {
  html = html.replace(/<script type="importmap" data-dev>[\s\S]*?<\/script>\n?/g, '');
  html = await replaceAsync(html, /<script\b([^>]*)\bdata-inline\b([^>]*)><\/script>/g, async (all, a, b) => {
    const src = /\bsrc="([^"]+)"/.exec(a + b);if (!src) throw new Error('data-inline without src: ' + all);
    const file = resolve(srcDir, src[1]);
    return '<script>' + scriptSafe((await readFile(file, 'utf8')).trimEnd()) + '</script>';
  });
  html = await replaceAsync(html, /<script type="module" data-bundle>([\s\S]*?)<\/script>/g, async (all, code) => {
    const out = await esbuild.build({
      stdin: {contents: code, resolveDir: srcDir, sourcefile: 'page-module.js', loader: 'js'},
      bundle: true, format: 'esm', target: 'es2020', write: false, logLevel: 'warning',
      nodePaths: [join(ROOT, 'node_modules')], minify: true, legalComments: 'inline', charset: 'utf8',
    });
    return '<script type="module">\n' + scriptSafe(out.outputFiles[0].text.trimEnd()) + '\n</script>';
  });
  return html;
}

async function build(toy) {
  const dir = join(ROOT, toy), srcDir = join(dir, 'src'), hookFile = join(dir, 'build-hook.mjs');
  const hook = await exists(hookFile) ? await import(pathToFileURL(hookFile).href) : {};
  let html = await readFile(join(srcDir, 'index.html'), 'utf8');
  if (hook.before) html = await hook.before(html, {dir, srcDir});
  html = await buildPage(html, srcDir);
  const note = `<!-- Built by toys-src/build.mjs from toys-src/${toy}/src/ in the blog repo: edit the source there, not this file -->\n`;
  html = /^<!doctype html>\n/i.test(html) ? html.replace(/^(<!doctype html>\n)/i, '$1' + note) : note + html;
  if (hook.after) html = await hook.after(html, {dir, srcDir});
  const out = join(SITE, toy, 'index.html');
  await writeFile(out, html);
  console.log(`${toy}: ${relative(process.cwd(), out)} (${Math.round(html.length / 1024)} KB)`);
}

const named = process.argv.slice(2);
const toys = named.length ? named : (await Promise.all((await readdir(ROOT, {withFileTypes: true}))
  .filter(d => d.isDirectory()).map(async d => await exists(join(ROOT, d.name, 'src/index.html')) ? d.name : null))).filter(Boolean);
for (const toy of toys) await build(toy);
