// Serves the built game (static-assets/games/plong) on a free port for the tests; returns its base URL.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join, extname, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
export const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../static-assets/games/plong');
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml'};
export function serve() {
  const srv = createServer(async (req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html');
    let body;try {body = await readFile(join(DIR, p));} catch {res.writeHead(404);res.end();return;}
    res.writeHead(200, {'content-type': TYPES[extname(p)] || 'application/octet-stream'});res.end(body);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close()})));
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const errors = (pg, list) => {pg.on('pageerror', e => list.push(String(e)));pg.on('console', m => m.type() === 'error' && !/pwa\.js|manifest|404|ERR_FILE_NOT_FOUND/.test(m.text()) && list.push(m.text()));};
