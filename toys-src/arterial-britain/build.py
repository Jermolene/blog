"""Build Arterial Britain's published page, static-assets/toys/arterial-britain/index.html.

Inlines the fonts (fonts/) and the road data (data/) into app.html and wraps it in the site's toy skeleton:
PWA tags, description, tagline and category. Run from toys-src/arterial-britain: python3 build.py
"""
import base64, html, os, re

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', '..', 'static-assets', 'toys', 'arterial-britain', 'index.html')

TITLE = 'Arterial Britain'
THEME = '#e9e7e0'
DESC = ('Posters of the roads of England, Scotland and Wales, drawn by where they take you: watersheds that split the '
        'country by which of a few places is nearest by car, all roads leading to one place with each road as thick as '
        'the land or people it serves, and the fairest place for up to eight travellers to meet. Routing runs in the '
        'browser over motorways, A and B roads and ferries. Tap the map to choose places, randomise, explore variations '
        'and save SVG or PNG')
TAGLINE = 'Every road in Britain, drawn by where it takes you'

os.chdir(here)
ff = ''
for fam, pk, w in [('Overpass', 'overpass', 300), ('Overpass', 'overpass', 400), ('Overpass', 'overpass', 600),
                   ('Overpass', 'overpass', 700), ('Overpass', 'overpass', 800), ('Overpass Mono', 'overpass-mono', 400),
                   ('Overpass Mono', 'overpass-mono', 600)]:
    d = base64.b64encode(open(f'fonts/{pk}-latin-{w}-normal.woff2', 'rb').read()).decode()
    ff += f"@font-face{{font-family:'{fam}';font-weight:{w};src:url(data:font/woff2;base64,{d})}}"
a = open('app.html', encoding='utf8').read()
m = open('data/data.json', encoding='utf8').read().replace('</', '<\\/')
b = open('data/data.b64').read()
body = a.replace('/*FONTS*/', ff).replace('/*META*/', m).replace('/*BIN*/', b)

# app.html was written for the claude.ai artifact host, which supplies the document skeleton: drop its title and
# host-only meta, and move its leading stylesheets into the head
body = re.sub(r'^\s*<title>.*?</title>\s*', '', body, flags=re.S)
body = re.sub(r'<meta name="claude:[^>]*>\s*', '', body)
styles = []
while True:
    mm = re.match(r'\s*(<style[^>]*>.*?</style>)', body, re.S)
    if not mm:
        break
    styles.append(mm.group(1))
    body = body[mm.end():]
q = lambda t: html.escape(t, quote=False).replace('"', '&quot;')
page = f'''<!doctype html>
<!-- Built by toys-src/arterial-britain/build.py from app.html, data/ and fonts/ in the blog repo: edit the source there, not this file -->
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="{THEME}">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<script src="../pwa.js" defer></script>
<title>{q(TITLE)}</title>
<meta name="description" content="{q(DESC)}">
<meta name="toy-tagline" content="{q(TAGLINE)}">
<meta name="toy-category" content="trifles">
<style>:root{{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0;font:14px system-ui,sans-serif}}[hidden]{{display:none!important}}</style>
''' + '\n'.join(styles) + '\n</head>\n<body>\n' + body.strip() + '\n</body>\n</html>\n'
open(out, 'w', encoding='utf8').write(page)
print(f'wrote {os.path.relpath(out)} ({len(page) // 1024} KB)')
