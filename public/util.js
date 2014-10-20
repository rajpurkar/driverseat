angular.module('roadglApp').
factory('util', ['$http', function($http) {
	return {
		distance: function(a, b) {
			return Math.sqrt((a[0]-b[0])*(a[0]-b[0]) + (a[1]-b[1])*(a[1]-b[1]) + (a[2]-b[2])*(a[2]-b[2]));
		},
		midpoint: function(a, b) {
			return new Float32Array([(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2]);
		},
		getPos: function(array, index) {
			return array.subarray(3*index, 3*index+3);
		},
		/**
		 * Algorithm to calculate a single RGB channel (0-255) from HSL hue (0-1.0)
		 */
		HUEtoRGB: function(hue) {
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
		},
		loadJSON: function(url, success, fail) {
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
		},
		paintPoint: function(pointColors, index, r, g, b) {
			pointColors.array[3*index] = r;
			pointColors.array[3*index+1] = g;
			pointColors.array[3*index+2] = b;
			pointColors.needsUpdate = true;
		}
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
		A: 65, B: 66, C: 67, D: 68, E: 69, F: 70, G: 71, H: 72, I: 73, J: 74, K: 75, L: 76, M: 77,
		N: 78, O: 79, P: 80, Q: 81, R: 82, S: 83, T: 84, U: 85, V: 86, W: 87, X: 88, Y: 89, Z: 90,
		a: 97, b: 98, c: 99, d: 100, e: 101, f: 102, g: 103, h: 104, i: 105, j: 106, k: 107, l: 108, m: 109,
		n: 110, o: 111, p: 112, q: 113, r: 114, s: 115, t: 116, u: 117, v: 118, w: 119, x: 120, y: 121, z: 122
	};
	// var codeMap = {
	//     8: "backspace",
	//     9: "tab",
	//     13: "enter",
	//     16: "shift", 17: "ctrl", 18: "alt",
	//     27: "escape",
	//     32: "space",
	//     33: "pageup", 34: "pagedown", 35: "end", 36: "home",
	//     37: "left", 38: "up", 39: "right", 40: "down",
	//     48: "0", 49: "1", 50: "2", 51: "3", 52: "4", 53: "5", 54: "6", 55: "7", 56: "8", 57: "9",
	//     65: "a", 66: "b", 67: "c", 68: "d", 69: "e", 70: "f", 71: "g", 72: "h", 73: "i", 74: "j", 75: "k", 76: "l", 77: "m",
	//     78: "n", 79: "o", 80: "p", 81: "q", 82: "r", 83: "s", 84: "t", 85: "u", 86: "v", 87: "w", 88: "x", 89: "y", 90: "z",
	//     97: "a", 98: "b", 99: "c", 100: "d", 101: "e", 102: "f", 103: "g", 104: "h", 105: "i", 106: "j", 107: "k", 108: "l", 109: "m",
	//     110: "n", 111: "o", 112: "p", 113: "q", 114: "r", 115: "s", 116: "t", 117: "u", 118: "v", 119: "w", 120: "x", 121: "y", 122: "z"
	// };
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
		keyMap: keyMap,		// key to code
		isDown: function(key) {
			return key in keyMap && pressedKeys.indexOf(keyMap[key]) != -1;
		},
		watchToggle: function(key) {
			if (!(key in keyMap)) throw Error("Key <" + key + "> not in keyMap");
			toggleKeys[keyMap[key]] = false;
		},
		isToggledOn: function(key) {
			return key in keyMap && toggleKeys[keyMap[key]];
		}
	};
});
