"""Check that buildSVG() matches the WebGL render, for the default pattern and N random ones.

Usage:  python3 tools/check_svg.py [index.html] [N]   (N random patterns, default 3)
Rasterises each SVG in Chromium at 1000px, renders the same params with WebGL, prints the
pixel mismatch, and writes out/*.svg and out/*_{gl,svg}.png. Baseline at handover:
default ~1.3%, random ~2-4% (edge antialiasing differences).
"""
import base64, io, os, sys
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

here = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[1:]
n = int(args.pop()) if args and args[-1].isdigit() else 3
html = args[0] if args else os.path.join(here, '..', '..', '..', 'static-assets', 'toys', 'radialator', 'index.html')
out = os.path.join(here, '..', 'out'); os.makedirs(out, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1200, "height": 900})
    pg.on('pageerror', lambda e: print('page error:', e))
    pg.set_content('<!doctype html><html><head><meta charset=utf-8>' + open(html).read())
    pg.wait_for_timeout(1000)
    for i in range(n + 1):
        name = 'default' if i == 0 else f'random{i}'
        svg = pg.evaluate("d=>{window._p=d?{...DEFAULTS}:randomise();return buildSVG(window._p,0)}", i == 0)
        open(os.path.join(out, name + '.svg'), 'w').write(svg)
        gl = pg.evaluate("()=>{const c=document.createElement('canvas');render(window._p,c,1000);return c.toDataURL()}")
        Image.open(io.BytesIO(base64.b64decode(gl.split(',')[1]))).save(os.path.join(out, name + '_gl.png'))
        pg2 = b.new_page(viewport={"width": 1000, "height": 1000})
        pg2.set_content('<body style="margin:0"><img width=1000 height=1000 src="data:image/svg+xml;base64,'
                        + base64.b64encode(svg.encode()).decode() + '">')
        pg2.wait_for_timeout(500); pg2.screenshot(path=os.path.join(out, name + '_svg.png')); pg2.close()
        a = np.array(Image.open(os.path.join(out, name + '_gl.png')).convert('L')) < 128
        c = np.array(Image.open(os.path.join(out, name + '_svg.png')).convert('L')) < 128
        print(f'{name}: svg {len(svg)//1024} KB, mismatch {(a != c).mean():.4f}')
    b.close()
