angular.module('roadglApp').
factory('util', ['$http', function($http) {
	var distanceFunction = function(a, b) {
		return (a[0]-b[0])*(a[0]-b[0]) + (a[1]-b[1])*(a[1]-b[1]) + (a[2]-b[2])*(a[2]-b[2]);
	};

	/**
	 * Algorithm to calculate a single RGB channel (0-255) from HSL hue (0-1.0)
	 */
	var HUEtoRGB = function(hue) {
		if (hue < 0) {
			hue += 1;
		} else if (hue > 1) {
			hue -= 1;
		}
		var rgb = 0;
		if (hue < 1/6) {
			rgb = hue*6;
		} else if (hue < 1/2) {
			rgb = 1;
		} else if (hue < 2/3) {
			rgb = (2/3 - hue)*6;
		}
		return Math.round(rgb * 255);
	};

	var loadJSON = function(url, success, fail) {
		$http.get(url)
			.success(function(data) {
				success(data);
			})
			.error(function(data, status) {
				if (fail) {
					fail(data);
				} else {
					throw Error("Data " + url + " could not be loaded.");
				}
			});
	};

	return {
		distanceFunction: distanceFunction,
		HUEtoRGB: HUEtoRGB,
		loadJSON: loadJSON
	};
}]);

angular.module('roadglApp').
factory('key', function() {
	var pressedKeys = [];
	var toggleKeys = {};
	var keyMap = {
		backspace: 8,
		tab: 9,
		enter: 13,
		shift: 16, ctrl: 17, alt: 18,
		escape: 27,
		space: 32,
		pageup: 33, pagedown: 34, end: 35, home: 36,
		left: 37, up: 38, right: 39, down: 40,
		0: 48, 1: 49, 2: 50, 3: 51, 4: 52, 5: 53, 6: 54, 7: 55, 8: 56, 9: 57,
		a: 65, b: 66, c: 67, d: 68, e: 69, f: 70, g: 71, h: 72, i: 73, j: 74, k: 75, l: 76, m: 77,
		n: 78, o: 79, p: 80, q: 81, r: 82, s: 83, t: 84, u: 85, v: 86, w: 87, x: 88, y: 89, z: 90
	};
	var isDown = function(key) {
		return key in keyMap && pressedKeys.indexOf(keyMap[key]) != -1;
	};
	var watchToggle = function(key) {
		if (!(key in keyMap)) throw Error("Key <" + key + "> not in keyMap");
		toggleKeys[keyMap[key]] = false;
	};
	var isToggledOn = function(key) {
		return key in keyMap && toggleKeys[keyMap[key]];
	};
	var onDocumentKeyDown = function(event) {
		if (pressedKeys.indexOf(event.keyCode) == -1)
			pressedKeys.push(event.keyCode);
	};
	var onDocumentKeyUp = function(event) {
		var i = pressedKeys.indexOf(event.keyCode);
		if (i != -1) pressedKeys.splice(i, 1);
		if (event.keyCode in toggleKeys) {
			toggleKeys[event.keyCode] = !toggleKeys[event.keyCode];
		}
	};
	document.addEventListener('keydown', onDocumentKeyDown, false);
	document.addEventListener('keyup', onDocumentKeyUp, false);

	return {
		isDown: isDown,
		watchToggle: watchToggle,
		isToggledOn: isToggledOn
	};
});
