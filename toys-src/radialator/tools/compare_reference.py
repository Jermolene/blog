"""Render Radialator's default pattern at 2048px and diff it against reference/original.jpeg.

Usage:  python3 tools/compare_reference.py [index.html] [reference.jpeg]
Writes out/mine.png, out/diff.png (red = only in reference, blue = only in render) and prints
the overall and per-radius mismatch fractions. Needs: playwright (Chromium), numpy, pillow.
Baseline at handover: ~5.7% overall; most of it along edges and inside r<200px where the
spokes are sub-pixel.
"""
import base64, io, os, sys
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

here = os.path.dirname(os.path.abspath(__file__))
html = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '..', '..', '..', 'static-assets', 'toys', 'radialator', 'index.html')
ref = sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, '..', 'reference', 'original.jpeg')
out = os.path.join(here, '..', 'out'); os.makedirs(out, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1200, "height": 900})
    pg.on('pageerror', lambda e: print('page error:', e))
    pg.set_content('<!doctype html><html><head><meta charset=utf-8>' + open(html).read())
    pg.wait_for_timeout(1500)
    url = pg.evaluate("(()=>{const c=document.createElement('canvas');render(DEFAULTS,c,2048);return c.toDataURL()})()")
    b.close()

im = Image.open(io.BytesIO(base64.b64decode(url.split(',')[1]))).convert('L')
im.save(os.path.join(out, 'mine.png'))
o = np.array(Image.open(ref).convert('L').resize(im.size)) < 128
m = np.array(im) < 128
print('mismatch', round((o != m).mean(), 4))
y, x = np.mgrid[0:im.size[1], 0:im.size[0]]
R = np.hypot(x - im.size[0] / 2, y - im.size[1] / 2)
for a, c in [(0, 100), (100, 200), (200, 400), (400, 600), (600, 800), (800, 950), (950, 1030)]:
    s = (R >= a) & (R < c); print(f'  r {a}-{c}: {(o != m)[s].mean():.3f}')
d = np.full(o.shape + (3,), 255, np.uint8); d[o & ~m] = [255, 0, 0]; d[m & ~o] = [0, 0, 255]; d[o & m] = 0
Image.fromarray(d).save(os.path.join(out, 'diff.png'))
