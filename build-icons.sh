#!/bin/bash

# Render the PNG app icons for each toy from the icon.svg in the same folder:
# icon-192.png and icon-512.png for the web app manifest and
# apple-touch-icon.png (180px) for iOS. The PNGs are committed, so this
# only needs running after an icon.svg is added or changed. Needs rsvg-convert
# (brew install librsvg)

cd "$(dirname "$0")" || exit 1

if ! command -v rsvg-convert >/dev/null 2>&1; then
	echo "build-icons: rsvg-convert not found (brew install librsvg)"
	exit 1
fi

# The toys index uses the site icon, a photo, so its PNGs are scaled from the
# JPEG rather than rendered from an SVG. The favicon is made from it too
if command -v magick >/dev/null 2>&1; then
	for size in 192 512; do
		magick artwork/site-icon.jpg -strip -resize ${size}x${size} "static-assets/toys/icon-$size.png" || exit 1
	done
	magick artwork/site-icon.jpg -strip -resize 180x180 static-assets/toys/apple-touch-icon.png || exit 1
	magick artwork/site-icon.jpg -define icon:auto-resize=128,64,48,32,16 artwork/favicon.ico || exit 1
	cp artwork/favicon.ico 'main-wiki/tiddlers/system/$__favicon.ico'
	echo "build-icons: rendered static-assets/toys and the favicon from artwork/site-icon.jpg"
else
	echo "build-icons: magick not found (brew install imagemagick); skipping the site icon"
fi

for svg in static-assets/toys/*/icon.svg; do
	[ -f "$svg" ] || continue
	dir="$(dirname "$svg")"
	rsvg-convert -w 192 -h 192 "$svg" -o "$dir/icon-192.png" || exit 1
	rsvg-convert -w 512 -h 512 "$svg" -o "$dir/icon-512.png" || exit 1
	rsvg-convert -w 180 -h 180 "$svg" -o "$dir/apple-touch-icon.png" || exit 1
	echo "build-icons: rendered $dir"
done
