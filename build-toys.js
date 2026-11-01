/*
Generate the tiddlers that drive the /toys, /games and /tools index pages.

Each immediate subdirectory of `static-assets/toys`, `static-assets/games` and
`static-assets/tools` that contains an `index.html` becomes a tiddler tagged
`toy`, with its `route` (eg `games/jumbleword`) in a field of that name and with its caption and description
read from the toy's own HTML `<title>` and `<meta>` tags. The caption comes from
`<meta name="toy-title">`, falling back to `og:title` and then `<title>`; the
description from `<meta name="toy-description">`, falling back to the standard
`description` and then `og:description`; and its category, one of `games`,
`trifles`, `kids-games` or `tools`, from `<meta name="toy-category">`. Games and kids games live in
games/, trifles in toys/ and tools in tools/. The toy is therefore
the single source of truth for its own listing: adding, renaming or
re-describing a toy automatically updates the index at build time.

If `build-screenshots.js` has captured a screenshot of the toy, its URL is
recorded in the `screenshot` field. For the web app manifests written by
build-pwa.js, `<meta name="theme-color">` is recorded in the `theme-color`
field, `<meta name="toy-short-title">` in `short-caption` and
`<meta name="toy-background-color">` in `background-color`. For the social media
cards written by build-social.js, `<meta name="toy-tagline">`, a line short
enough to fit on a card, is recorded in `tagline`.

Usage: node build-toys.js
*/

"use strict";

const fs = require("fs"),
	path = require("path");

// The categories the toys index is divided into, in the order it lists them
const categories = ["games","trifles","kids-games","tools"];

// The sections of the site that the toys are published in
const sections = ["toys","games","tools"];

const rootDir = __dirname,
	staticDir = path.join(rootDir,"static-assets"),
	screenshotsDir = path.join(staticDir,"screenshots"),
	outputFile = path.join(rootDir,"main-wiki","tiddlers","generated","toys.json");

function decodeEntities(text) {
	return text
		.replace(/&lt;/g,"<")
		.replace(/&gt;/g,">")
		.replace(/&quot;/g,'"')
		.replace(/&#0?39;|&apos;/g,"'")
		.replace(/&nbsp;/g," ")
		.replace(/&amp;/g,"&");
}

function tidy(text) {
	return decodeEntities(text).replace(/\s+/g," ").trim();
}

// Collect the content of the `<meta>` tags of an HTML document, keyed by
// their `name` or `property` attribute
function parseMetaTags(html) {
	const metaTags = Object.create(null),
		metaRegExp = /<meta\b([^>]*)>/gi;
	let match;
	while((match = metaRegExp.exec(html))) {
		const attributes = Object.create(null),
			attributeRegExp = /([a-zA-Z][-a-zA-Z0-9:_.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
		let attributeMatch;
		while((attributeMatch = attributeRegExp.exec(match[1]))) {
			const value = attributeMatch[3] !== undefined ? attributeMatch[3] :
				attributeMatch[4] !== undefined ? attributeMatch[4] : attributeMatch[5];
			attributes[attributeMatch[1].toLowerCase()] = value;
		}
		const key = attributes.name || attributes.property;
		if(key && attributes.content !== undefined) {
			metaTags[key.toLowerCase()] = tidy(attributes.content);
		}
	}
	return metaTags;
}

function readToy(section,name) {
	const route = section + "/" + name,
		indexFile = path.join(staticDir,route,"index.html");
	if(!fs.existsSync(indexFile)) {
		return null;
	}
	const html = fs.readFileSync(indexFile,"utf8"),
		metaTags = parseMetaTags(html),
		titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html),
		caption = metaTags["toy-title"] || metaTags["og:title"] || (titleMatch ? tidy(titleMatch[1]) : name),
		description = metaTags["toy-description"] || metaTags.description || metaTags["og:description"] || "",
		shortCaption = metaTags["toy-short-title"] || "",
		tagline = metaTags["toy-tagline"] || "",
		themeColor = metaTags["theme-color"] || "",
		backgroundColor = metaTags["toy-background-color"] || "",
		category = metaTags["toy-category"] || "";
	if(!description) {
		console.log("build-toys: warning: " + route + " has no description meta tag");
	}
	const toy = {
		title: "Toys/" + name,
		caption: caption,
		description: description,
		route: route,
		section: section,
		url: "/" + route + "/",
		tags: "toy",
		text: ""
	};
	if(categories.indexOf(category) !== -1) {
		toy.category = category;
	} else {
		console.log("build-toys: warning: " + route + " has " + (category ? "an unknown category '" + category + "'" :
			"no toy-category meta tag") + "; it should be one of " + categories.join(", "));
	}
	if(shortCaption) {
		toy["short-caption"] = shortCaption;
	}
	if(tagline) {
		toy.tagline = tagline;
	} else {
		console.log("build-toys: warning: " + route + " has no toy-tagline meta tag");
	}
	if(themeColor) {
		toy["theme-color"] = themeColor;
	} else {
		console.log("build-toys: warning: " + route + " has no theme-color meta tag");
	}
	if(backgroundColor) {
		toy["background-color"] = backgroundColor;
	}
	if(fs.existsSync(path.join(screenshotsDir,route + ".webp"))) {
		toy.screenshot = "/screenshots/" + route + ".webp";
	} else {
		console.log("build-toys: warning: " + route + " has no screenshot; run build-screenshots.js");
	}
	return toy;
}

const toys = sections.flatMap(section => fs.readdirSync(path.join(staticDir,section),{withFileTypes: true})
	.filter(entry => entry.isDirectory())
	.map(entry => readToy(section,entry.name)))
	.filter(toy => !!toy)
	.sort((a,b) => a.caption.toLowerCase().localeCompare(b.caption.toLowerCase()));

fs.mkdirSync(path.dirname(outputFile),{recursive: true});
fs.writeFileSync(outputFile,JSON.stringify(toys,null,"\t") + "\n","utf8");

console.log("build-toys: wrote " + toys.length + " toys to " + path.relative(rootDir,outputFile));
