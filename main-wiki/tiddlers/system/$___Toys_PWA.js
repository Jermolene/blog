/*\
title: $:/_Toys/PWA.js
type: application/javascript
tags: $:/tags/Static/JS

On the Toys, Games and Tools pages, which $:/_Toys/PWA marks with their web app
manifests, load the script shared with the toys that registers the service worker. A <script> tag
cannot be written in the wikified head, so it is loaded from here instead

\*/
(function(){

"use strict";

var manifest = document.querySelector('link[rel="manifest"][href$="/manifest.webmanifest"]');
if(manifest) {
	var script = document.createElement("script");
	script.src = manifest.getAttribute("href").replace(/manifest\.webmanifest$/,"pwa.js");
	document.head.appendChild(script);
}

})();
