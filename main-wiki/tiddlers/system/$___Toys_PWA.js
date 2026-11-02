/*\
title: $:/_Toys/PWA.js
type: application/javascript
tags: $:/tags/Static/JS

On the Toys, Games and Tools pages, which $:/_Toys/PWA marks with the app's
manifest and the name of their section, load the section's copy of the script
shared with the toys that registers the service worker. A <script> tag cannot
be written in the wikified head, so it is loaded from here instead.

In browsers that let a page offer to install itself (Chrome, Edge and their
relatives, which announce it with the beforeinstallprompt event) a button is
also shown above the listing that installs the app. Other browsers, such as
Safari, have no such event and so never show the button

\*/
(function(){

"use strict";

var section = document.querySelector('meta[name="toys-section"]');
if(section) {
	var script = document.createElement("script");
	script.src = "/" + section.getAttribute("content") + "/pwa.js";
	document.head.appendChild(script);
	window.addEventListener("beforeinstallprompt",function(event) {
		event.preventDefault();
		showInstallButton(event);
	});
}

function showInstallButton(installPrompt) {
	if(document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded",function() {
			showInstallButton(installPrompt);
		});
		return;
	}
	var listing = document.querySelector(".jermolene-toy-listing");
	if(!listing || document.querySelector(".jermolene-install")) {
		return;
	}
	var wrapper = document.createElement("div"),
		button = document.createElement("button"),
		note = document.createElement("span");
	wrapper.className = "jermolene-install";
	button.type = "button";
	button.textContent = "Install the app";
	note.textContent = "All the games, toys and tools in one app that works offline";
	wrapper.appendChild(button);
	wrapper.appendChild(note);
	listing.parentNode.insertBefore(wrapper,listing);
	button.addEventListener("click",function() {
		installPrompt.prompt();
		installPrompt.userChoice.then(function() {
			wrapper.remove();
		});
	});
	window.addEventListener("appinstalled",function() {
		wrapper.remove();
	});
}

})();
