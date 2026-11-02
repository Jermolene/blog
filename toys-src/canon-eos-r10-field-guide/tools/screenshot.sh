#!/usr/bin/env bash
# Headless render check. Usage: tools/screenshot.sh [hash] [out.png]
#   hash: controls | menus | display | firmware   (default: controls)
# Needs Chrome/Chromium. SwiftShader makes WebGL work without a GPU.
# Renders the published page, static-assets/tools/canon-eos-r10-field-guide/index.html.
# Offline / no CDN access: run `npm i three@0.128.0` in this folder first;
# the script then renders a temp copy that loads three.js from node_modules.
set -euo pipefail
cd "$(dirname "$0")/.."
HASH="${1:-controls}"; OUT="${2:-shot-$HASH.png}"
CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser || echo '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')"
SRC="$PWD/../../static-assets/tools/canon-eos-r10-field-guide/index.html"
PAGE="$SRC"
if [ -d node_modules/three ]; then
  PAGE=.render-local.html
  sed -e 's#https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js#node_modules/three/build/three.min.js#' \
      -e 's#https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/#node_modules/three/examples/js/#g' "$SRC" > "$PAGE"
fi
"$CHROME" --headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=1200,1000 --virtual-time-budget=6000 \
  --screenshot="$OUT" "file://$(cd "$(dirname "$PAGE")" && pwd)/$(basename "$PAGE")#$HASH" >/dev/null 2>&1
[ "$PAGE" != "$SRC" ] && rm -f "$PAGE"
echo "wrote $OUT"
