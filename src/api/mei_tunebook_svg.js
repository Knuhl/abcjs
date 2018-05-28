var EngraverController = require('../write/abc_engraver_controller');
var xml2js = require('xml-js');
var parser = require('../mei/parse');

var resizeDivs = {};

function resizeOuter() {
	var width = window.innerWidth;
	for (var id in resizeDivs) {
		if (resizeDivs.hasOwnProperty(id)) {
			var outer = resizeDivs[id];
			var ofs = outer.offsetLeft;
			width -= ofs * 2;
			outer.style.width = width + "px";
		}
	}
}

window.addEventListener("resize", resizeOuter);
window.addEventListener("orientationChange", resizeOuter);

function renderOne(div, tune, params) {
	var width = params.width ? params.width : 800;
	if (params.viewportHorizontal) {
		// Create an inner div that holds the music, so that the passed in div will be the viewport.
		div.innerHTML = '<div class="abcjs-inner"></div>';
		if (params.scrollHorizontal) {
			div.style.overflowX = "auto";
			div.style.overflowY = "hidden";
		} else
			div.style.overflow = "hidden";
		resizeDivs[div.id] = div; // We use a hash on the element's id so that multiple calls won't keep adding to the list.
		div = div.children[0]; // The music should be rendered in the inner div.
	}
	else if (params.viewportVertical) {
		// Create an inner div that holds the music, so that the passed in div will be the viewport.
		div.innerHTML = '<div class="abcjs-inner scroll-amount"></div>';
		div.style.overflowX = "hidden";
		div.style.overflowY = "auto";
		div = div.children[0]; // The music should be rendered in the inner div.
	}
	else
		div.innerHTML = "";
	//div.innerHTML = tune.metaText.title; // TODO-PER: stub until the mei is parsed.
	var engraver_controller = new EngraverController(div, params);
	engraver_controller.engraveABC(tune, 0);
	tune.engraver = engraver_controller;
	if (params.viewportVertical || params.viewportHorizontal) {
		// If we added a wrapper around the div, then we need to size the wrapper, too.
		var parent = div.parentNode;
		parent.style.width = div.style.width;
	}
}

function renderEachLineSeparately(div, tune, params, tuneNumber) {
	function initializeTuneLine(tune) {
		return {
			formatting: tune.formatting,
			media: tune.media,
			version: tune.version,
			metaText: {},
			lines: []
		};
	}

	// Before rendering, chop up the returned tune into an array where each element is a line.
	// The first element of the array gets the title and other items that go on top, the last element
	// of the array gets the extra text that goes on bottom. Each element gets any non-music info that comes before it.
	var tunes = [];
	var tuneLine;
	for (var i = 0; i < tune.lines.length; i++) {
		var line = tune.lines[i];
		if (!tuneLine)
			tuneLine = initializeTuneLine(tune);

		if (i === 0) {
			// These items go on top of the music
			tuneLine.metaText.tempo = tune.metaText.tempo;
			tuneLine.metaText.title = tune.metaText.title;
			tuneLine.metaText.header = tune.metaText.header;
			tuneLine.metaText.rhythm = tune.metaText.rhythm;
			tuneLine.metaText.origin = tune.metaText.origin;
			tuneLine.metaText.composer = tune.metaText.composer;
			tuneLine.metaText.author = tune.metaText.author;
			tuneLine.metaText.partOrder = tune.metaText.partOrder;
		}

		// push the lines until we get to a music line
		tuneLine.lines.push(line);
		if (line.staff) {
			tunes.push(tuneLine);
			tuneLine = undefined;
		}
	}
	// Add any extra stuff to the last line.
	if (tuneLine) {
		var lastLine = tunes[tunes.length - 1];
		for (var j = 0; j < tuneLine.lines.length; j++)
			lastLine.lines.push(tuneLine.lines[j]);
	}

	// These items go below the music
	tuneLine = tunes[tunes.length - 1];
	tuneLine.metaText.unalignedWords = tune.metaText.unalignedWords;
	tuneLine.metaText.book = tune.metaText.book;
	tuneLine.metaText.source = tune.metaText.source;
	tuneLine.metaText.discography = tune.metaText.discography;
	tuneLine.metaText.notes = tune.metaText.notes;
	tuneLine.metaText.transcription = tune.metaText.transcription;
	tuneLine.metaText.history = tune.metaText.history;
	tuneLine.metaText['abc-copyright'] = tune.metaText['abc-copyright'];
	tuneLine.metaText['abc-creator'] = tune.metaText['abc-creator'];
	tuneLine.metaText['abc-edited-by'] = tune.metaText['abc-edited-by'];
	tuneLine.metaText.footer = tune.metaText.footer;

	// Now create sub-divs and render each line. Need to copy the params to change the padding for the interior slices.
	var ep = {};
	for (var key in params) {
		if (params.hasOwnProperty(key)) {
			ep[key] = params[key];
		}
	}
	var origPaddingTop = ep.paddingtop;
	var origPaddingBottom = ep.paddingbottom;
	div.innerHTML = "";
	for (var k = 0; k < tunes.length; k++) {
		var lineEl = document.createElement("div");
		div.appendChild(lineEl);

		if (k === 0) {
			ep.paddingtop = origPaddingTop;
			ep.paddingbottom = -20;
		} else if (k === tunes.length - 1) {
			ep.paddingtop = 10;
			ep.paddingbottom = origPaddingBottom;
		} else {
			ep.paddingtop = 10;
			ep.paddingbottom = -20;
		}
		renderOne(lineEl, tunes[k], ep, tuneNumber);
	}
}

var renderMei = function (output, mei, parserParams, engraverParams, renderParams) {
	// Note: all parameters have been condensed into the first ones. It doesn't hurt anything to allow the old format, so just copy them here.
	var params = {};
	var key;
	if (parserParams) {
		for (key in parserParams) {
			if (parserParams.hasOwnProperty(key)) {
				params[key] = parserParams[key];
			}
		}
	}
	if (engraverParams) {
		for (key in engraverParams) {
			if (engraverParams.hasOwnProperty(key)) {
				// There is a conflict with the name of the parameter "listener". If it is in the second parameter, then it is for click.
				if (key === "listener") {
					if (engraverParams[key].highlight)
						params.clickListener = engraverParams[key].highlight;
				} else
					params[key] = engraverParams[key];
			}
		}
	}
	if (renderParams) {
		for (key in renderParams) {
			if (renderParams.hasOwnProperty(key)) {
				params[key] = renderParams[key];
			}
		}
	}

	function callback(div, tune) {
		if (!params.oneSvgPerLine || tune.lines.length < 2)
			renderOne(div, tune, params);
		else
			renderEachLineSeparately(div, tune, params);
	}

	return renderEngine(callback, output, mei, params);
};

function renderEngine(callback, output, mei, params) {
	var ret = [];

	// check and normalize input parameters
	if (output === undefined || mei === undefined)
		return;
	if (params === undefined)
		params = {};

	// output each tune, if it exists. Otherwise clear the div.
	var div = output;
	if (typeof(div) === "string")
		div = document.getElementById(div);
	if (div) {
		var tune = parseMei(mei);
		ret.push(tune);
		callback(div, tune);
	}

	return ret;
}

function parseMei(mei) {
	var json = xml2js.xml2json(mei, {});
	json = JSON.parse(json);
	return parser(json);
}

module.exports = { renderMei: renderMei, parseMei: parseMei };
