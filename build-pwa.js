/*
Generate the files that make the toys, games and tools installable as
Progressive Web Apps: together, as one app whose index pages are at /games,
/toys and /tools, and each toy alone. The output goes straight into the
assembled site, so this runs at the end of bld.sh. A service worker can only
look after the folder it is served from, and the only folder the three
sections share is the root of the site, so that is where the one worker and
the app's manifest go:

* `site/manifest.webmanifest` describes the app, which opens on the games and
  has the three index pages as its shortcuts
* `site/<section>/<name>/manifest.webmanifest` describes each toy as an app of
  its own, with its name, description and colours taken from the toy's `<meta>`
  tags via the tiddlers written by build-toys.js. The theme colour comes from
  `<meta name="theme-color">` and the short name from `<meta name="toy-short-title">`
* `site/sw.js`, the service worker copied from `static-assets/sw.js`, has the
  list of files it caches on installation written into it, along with a
  version derived from their contents

`static-assets/toys` holds the one copy of the files the index pages and the
toys share (pwa.js and the app's icons), which are copied into `site/games`
and `site/tools` here.

Everything under the three sections is precached, except source maps and
licences, and images over LARGE_IMAGE_BYTES (such as the Lenticulator's sample
photographs), which are cached as they are first used instead. The index pages'
own stylesheet, banner and toy screenshots are precached too, so that they work
offline as well as the toys. Third party scripts and stylesheets referenced by
the toys are listed separately for the worker to fetch on a best-effort basis.

Icons are expected at `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
and `icon.svg` in `static-assets/toys` and in each toy's folder; see
build-icons.sh. A toy without icons generates a warning and no manifest
icons, so the browser will not offer to install it.

Usage: node build-pwa.js
*/

"use strict";

const fs = require("fs"),
	path = require("path"),
	crypto = require("crypto");

const rootDir = __dirname,
	siteDir = path.join(rootDir,"site"),
	sharedDir = path.join(siteDir,"toys"),
	toysFile = path.join(rootDir,"main-wiki","tiddlers","generated","toys.json");

const LARGE_IMAGE_BYTES = 512 * 1024,
	IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?)$/i,
	NEVER_PRECACHED = /(^|\/)(sw\.js|precache\.js|\.DS_Store)$|\.(map|md)$/i;

const SECTIONS = [
	{name: "games", caption: "Games", description: "Games and kids games"},
	{name: "toys", caption: "Toys", description: "Trifles to play with"},
	{name: "tools", caption: "Tools", description: "Useful things"}
];

const APP = {
	name: "Jermolene's Games, Toys and Tools",
	short_name: "Jermolene",
	description: "Games, toys and tools from jermolene.com, all in one app that works offline",
	start: "/games/"
};

const HUB_THEME_COLOR = "#5c59a7",
	HUB_BACKGROUND_COLOR = "#ffffff";

// The files shared by the sections, copied from site/toys into the others
const SHARED_FILES = ["pwa.js","icon-192.png","icon-512.png","apple-touch-icon.png"];

// Files precached for the index pages in addition to those under the sections
const hubExtras = ["/static/static.css","/images/banner.jpg","/favicon.ico"];

function readToys() {
	return JSON.parse(fs.readFileSync(toysFile,"utf8"));
}

// Walk a folder in the site, returning the published URL paths of its files
function listFiles(dir,prefix) {
	const urls = [];
	fs.readdirSync(dir,{withFileTypes: true}).sort((a,b) => a.name.localeCompare(b.name)).forEach(entry => {
		const fullPath = path.join(dir,entry.name),
			// A folder's index.html is precached under the folder's URL, which
			// is how the pages link to it
			url = entry.name === "index.html" ? prefix : prefix + encodeURIComponent(entry.name);
		if(entry.isDirectory()) {
			urls.push(...listFiles(fullPath,url + "/"));
		} else if(entry.isFile()) {
			urls.push(url);
		}
	});
	return urls;
}

function siteFile(url) {
	let filePath = path.join(siteDir,decodeURIComponent(url));
	if(url.endsWith("/")) {
		filePath = path.join(filePath,"index.html");
	}
	return filePath;
}

function isPrecached(url) {
	if(NEVER_PRECACHED.test(url)) {
		return false;
	}
	if(IMAGE_EXTENSIONS.test(url) && fs.statSync(siteFile(url)).size > LARGE_IMAGE_BYTES) {
		return false;
	}
	return true;
}

// Third party scripts and stylesheets loaded by a page
function externalResources(html) {
	const urls = new Set(),
		tagRegExp = /<(script|link)\b([^>]*)>/gi;
	let match;
	while((match = tagRegExp.exec(html))) {
		const attributes = match[2],
			isStylesheet = match[1].toLowerCase() === "link" && /\brel\s*=\s*["']?stylesheet\b/i.test(attributes),
			isScript = match[1].toLowerCase() === "script",
			urlMatch = /\b(?:src|href)\s*=\s*["']?(https?:\/\/[^"'\s>]+)/i.exec(attributes);
		if(urlMatch && (isScript || isStylesheet)) {
			urls.add(urlMatch[1].replace(/&amp;/g,"&"));
		}
	}
	return Array.from(urls);
}

function icons(dir,prefix) {
	const list = [],
		missing = [];
	[["icon-192.png",192],["icon-512.png",512]].forEach(([file,size]) => {
		if(fs.existsSync(path.join(dir,file))) {
			["any","maskable"].forEach(purpose => {
				list.push({src: prefix + file, sizes: size + "x" + size, type: "image/png", purpose: purpose});
			});
		} else {
			missing.push(file);
		}
	});
	if(fs.existsSync(path.join(dir,"icon.svg"))) {
		list.push({src: prefix + "icon.svg", sizes: "any", type: "image/svg+xml"});
	}
	return {list, missing};
}

function writeJson(filePath,data) {
	fs.writeFileSync(filePath,JSON.stringify(data,null,"\t") + "\n","utf8");
}

function toyManifest(toy) {
	const dir = path.join(siteDir,toy.route),
		toyIcons = icons(dir,""),
		themeColor = toy["theme-color"] || "#ffffff";
	if(toyIcons.missing.length) {
		console.log("build-pwa: warning: " + toy.route + " is missing " + toyIcons.missing.join(", ") + "; run build-icons.sh");
	}
	return {
		name: toy.caption,
		short_name: toy["short-caption"] || toy.caption,
		description: toy.description,
		id: toy.url,
		start_url: toy.url,
		scope: toy.url,
		display: "standalone",
		orientation: "any",
		theme_color: themeColor,
		background_color: toy["background-color"] || themeColor,
		icons: toyIcons.list
	};
}

function appManifest() {
	const appIcons = icons(sharedDir,"/toys/");
	if(appIcons.missing.length) {
		console.log("build-pwa: warning: toys is missing " + appIcons.missing.join(", ") + "; run build-icons.sh");
	}
	return {
		name: APP.name,
		short_name: APP.short_name,
		description: APP.description,
		id: "/apps",
		start_url: APP.start,
		scope: "/",
		display: "standalone",
		theme_color: HUB_THEME_COLOR,
		background_color: HUB_BACKGROUND_COLOR,
		icons: appIcons.list,
		shortcuts: SECTIONS.map(section => ({name: section.caption, description: section.description, url: "/" + section.name + "/", icons: [{src: "/toys/icon-192.png", sizes: "192x192", type: "image/png"}]}))
	};
}

function main() {
	if(!fs.existsSync(sharedDir)) {
		throw new Error("site/toys does not exist; run bld.sh first");
	}
	const toys = readToys();
	SECTIONS.filter(section => section.name !== "toys").forEach(section => {
		SHARED_FILES.forEach(file => fs.copyFileSync(path.join(sharedDir,file),path.join(siteDir,section.name,file)));
	});
	toys.forEach(toy => {
		writeJson(path.join(siteDir,toy.route,"manifest.webmanifest"),toyManifest(toy));
	});
	writeJson(path.join(siteDir,"manifest.webmanifest"),appManifest());
	// The precache: the index pages, everything under the sections that
	// qualifies, and the index pages' own dependencies
	const urls = Array.from(new Set(SECTIONS.map(section => "/" + section.name + "/")
		.concat(...SECTIONS.map(section => listFiles(path.join(siteDir,section.name),"/" + section.name + "/").filter(isPrecached)))
		.concat(hubExtras)
		.concat(toys.map(toy => toy.screenshot).filter(Boolean))))
		.filter(url => {
			if(fs.existsSync(siteFile(url))) {
				return true;
			}
			console.log("build-pwa: warning: " + url + " is not in the site, so not precaching it");
			return false;
		});
	const external = new Set();
	toys.forEach(toy => {
		externalResources(fs.readFileSync(siteFile(toy.url),"utf8")).forEach(url => external.add(url));
	});
	const hash = crypto.createHash("sha256");
	urls.forEach(url => {
		hash.update(url + "\0");
		hash.update(fs.readFileSync(siteFile(url)));
		hash.update("\0");
	});
	hash.update(JSON.stringify(Array.from(external)));
	const precache = {
		version: hash.digest("hex").slice(0,16),
		urls: urls,
		external: Array.from(external)
	};
	const totalBytes = urls.reduce((total,url) => total + fs.statSync(siteFile(url)).size,0);
	// The precache goes inside the worker itself, so that the worker's own
	// bytes change whenever a toy does. Browsers compare the worker script
	// when checking for updates, but Safari ignores changes to scripts that
	// it imports, so a separate precache.js left iPads on old versions
	const workerFile = path.join(siteDir,"sw.js"),
		worker = fs.readFileSync(workerFile,"utf8"),
		placeholder = 'importScripts("precache.js");';
	if(!worker.includes(placeholder)) {
		throw new Error("build-pwa: " + workerFile + " has no " + placeholder + " to replace");
	}
	fs.writeFileSync(workerFile,worker.replace(placeholder,() => "self.PRECACHE = " + JSON.stringify(precache,null,"\t") + ";"),"utf8");
	console.log("build-pwa: wrote manifests for " + toys.length + " toys and a precache of " + urls.length + " files (" + Math.round(totalBytes / 1024) + "KB) plus " + external.size + " external resources, version " + precache.version);
}

try {
	main();
} catch(e) {
	console.error("build-pwa: " + e.message);
	process.exitCode = 1;
}
