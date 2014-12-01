myApp.
service('util', function($http) {
    function distance(a, b) {
        return Math.sqrt((a[0]-b[0])*(a[0]-b[0]) + (a[1]-b[1])*(a[1]-b[1]) + (a[2]-b[2])*(a[2]-b[2]));
    }
    function difference(a, b) {
        return new Float32Array([a[0]-b[0], a[1]-b[1], a[2]-b[2]]);
    }
    function sum(a, b) {
        return new Float32Array([a[0]+b[0], a[1]+b[1], a[2]+b[2]]);
    }
    function normalize(a) {
        var magnitude = Math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2]);
        a[0] /= magnitude;
        a[1] /= magnitude;
        a[2] /= magnitude;
    }
    function scale(a, scalar) {
        a[0] *= scalar;
        a[1] *= scalar;
        a[2] *= scalar;
    }
    var INTERPOLATE_STEP = 0.6;

    /**
     * Algorithm to calculate a single RGB channel (0-1.0) from HSL hue (0-1.0)
     */
    function HUEtoRGB(hue) {
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
        return rgb;
        // return Math.round(rgb * 255);
    }

    return {
        distance: distance,
        midpoint: function(a, b) {
            return new Float32Array([(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2]);
        },
        difference: difference,
        sum: sum,
        normalize: normalize,
        scale: scale,
        INTERPOLATE_STEP: INTERPOLATE_STEP,
        interpolate: function(startPos, endPos) {
            var fillPositions = [];
            var stepVec = difference(endPos, startPos);
            normalize(stepVec);
            scale(stepVec, INTERPOLATE_STEP);
            var currPos = startPos;
            while (distance(currPos, endPos) > INTERPOLATE_STEP) {
                currPos = sum(currPos, stepVec);
                fillPositions.push(currPos[0]);
                fillPositions.push(currPos[1]);
                fillPositions.push(currPos[2]);
            }
            return fillPositions;
        },
        getPos: function(array, index) {
            return array.subarray(3*index, 3*index+3);
        },
        HUEtoRGB: HUEtoRGB,
        /**
         * Generate a color (for use with laneNum 1,2,3...)
         */
        generateRGB: function(seed) {
            seed = ((parseInt(seed, 10) * 17) % 100) / 100;
            var color = {
                r: HUEtoRGB(seed+1/3),
                g: HUEtoRGB(seed),
                b: HUEtoRGB(seed-1/3)
            };
            if (seed < 0.76 && seed > 0.56) {
                color.r += 0.5;
                color.g += 0.5;
            }
            return color;
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
        loadDataFromZip: function(zip_data_buffer, fname_in_zip) 
        {
            var loader = new JSZip(zip_data_buffer);
            console.log(fname_in_zip);
            return loader.file(fname_in_zip).asBinary();
        },

        Matrix4FromJSON4x4: function(j) {
            return new THREE.Matrix4(
                    j[0][0], j[0][1], j[0][2], j[0][3],
                    j[1][0], j[1][1], j[1][2], j[1][3],
                    j[2][0], j[2][1], j[2][2], j[2][3],
                    j[3][0], j[3][1], j[3][2], j[3][3]
                    );
        },
        Matrix4FromJSON3x3: function(j) {
            return new THREE.Matrix4(
                    j[0][0], j[0][1], j[0][2], 0,
                    j[1][0], j[1][1], j[1][2], 0,
                    j[2][0], j[2][1], j[2][2], 0,
                    0,       0,       0,       1
                    );
        },
        paintPoint: function(pointColors, index, r, g, b) {
            pointColors.array[3*index] = r;
            pointColors.array[3*index+1] = g;
            pointColors.array[3*index+2] = b;
            pointColors.needsUpdate = true;
        }
    };
});

myApp.
factory('key', function() {
    var pressedKeys = [];
    var toggleKeys = {};
    var keyMap = {
        backspace: 8,
    tab: 9,
    enter: 13,
    shift: 16, ctrl: 17, alt: 18,
    esc: 27,
    space: 32,
    pageup: 33, pagedown: 34, end: 35, home: 36,
    left: 37, up: 38, right: 39, down: 40,
    del: 46,
    0: 48, 1: 49, 2: 50, 3: 51, 4: 52, 5: 53, 6: 54, 7: 55, 8: 56, 9: 57,
    A: 65, B: 66, C: 67, D: 68, E: 69, F: 70, G: 71, H: 72, I: 73, J: 74, K: 75, L: 76, M: 77,
    N: 78, O: 79, P: 80, Q: 81, R: 82, S: 83, T: 84, U: 85, V: 86, W: 87, X: 88, Y: 89, Z: 90,
    a: 97, b: 98, c: 99, d: 100, e: 101, f: 102, g: 103, h: 104, i: 105, j: 106, k: 107, l: 108, m: 109,
    n: 110, o: 111, p: 112, q: 113, r: 114, s: 115, t: 116, u: 117, v: 118, w: 119, x: 120, y: 121, z: 122
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

myApp.
factory('cache', function($q, $timeout) {

    //see https://github.com/maciel310/angular-filesystem/blob/master/src/filesystem.js
    function safeResolve(deferral, message) {
        $timeout(function() {
            deferral.resolve(message);
        });
    }
    function safeReject(deferral, message) {
        $timeout(function() {
            deferral.reject(message);
        });
    }
    var fsDefer = $q.defer();

    window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
    var storageSize = 5*1024*1024;
    //TODO use persistent storage
    window.requestFileSystem(window.TEMPORARY, storageSize, function(fileSystem) {
        safeResolve(fsDefer, fileSystem);
        //fs = fileSystem;
        readEntries(fileSystem.root.createReader(), [], function(entries) {
            for (var i = 0; i < entries.length; i++) {
                remove(entries[i].name);
            }
        });
    }, function(fe) {
        console.log("Error loading filesystem", fe);
        safeReject(fsDefer, {text: "error loading fs", error: fe});
    });

    function readEntries(dirReader, entries, callback) {
        dirReader.readEntries(function(results) {
            if (results.length === 0) {
                callback(entries);
                return;
            }
            entries = entries.concat(results.slice(0));
            readEntries(dirReader, entries, callback);
        });
    }

    function remove(filename, callback) {
        fsDefer.promise.then(function(fs) { 
            fs.root.getFile(filename, {create: false}, function(fileEntry) {
                fileEntry.remove(function() {
                    if (callback) callback();
                });
            });
        });
    }

    return {
        write: function(filename, data, callback) {
            //var error = new Error();
            //throw error.stack;
            fsDefer.promise.then(function(fs) { 
                fs.root.getFile(filename, {create: true}, function(fileEntry) {
                    fileEntry.createWriter(function(fileWriter) {
                        fileWriter.onwriteend = callback;
                        fileWriter.onerror = function(e) {
                            console.log("Write failed:", e);
                        };
                        var blob = new Blob([data]);
                        fileWriter.write(blob);
                    });
                });
            });
        }, 
        read: function(filename, callback) {
            fsDefer.promise.then(function(fs) { 
                fs.root.getFile(filename, {create: false}, function(fileEntry) {
                    fileEntry.file(function(file) {
                        var reader = new FileReader();
                        reader.onloadend = function(e) {
                            // this.result: arrayBuffer
                            callback(this.result);
                        };
                        reader.readAsArrayBuffer(file);
                    });
                });
            });
        }, remove: function(filename, callback) {
            remove(filename, callback);
        }, ls: function(callback) {
            fsDefer.promise.then(function(fs) { readEntries(fs.root.createReader(), [], callback); });
        }
    };
});

myApp.
factory('history', function(cache) {
    var undoHistory = [],
    redoHistory = [],
    maxHistorySize = 300;	//TODO max size should depend on available storage size
    return {
        push: function(action, lanePositions, laneNum) {
            var entry = {
                laneNum: parseInt(laneNum, 10),
                action: action,
                filename: Date.now().toString()
            };
            undoHistory.push(entry);
            for (var i = 0; i < redoHistory.length; i++) {
                cache.remove(redoHistory[i].filename);
            }
            redoHistory = [];
            cache.write(entry.filename, lanePositions, function() {
                // cache.ls(function(entries) {
                //     console.log(entries);
                // });
            });
            if (undoHistory.length > maxHistorySize) {
                cache.remove(undoHistory.shift().filename);
            }
        },
        undo: function(callback) {
            if (undoHistory[undoHistory.length-1].action == "original") {
                console.log("Nothing left to undo");
                return;
            }
            var entry = undoHistory.pop();
            redoHistory.push(entry);
            var filename = "";
            for (var i = undoHistory.length-1; i >= 0; i--) {
                if (undoHistory[i].laneNum == entry.laneNum) {
                    filename = undoHistory[i].filename;
                    break;
                }
            }
            if (i < 0) {
                callback(entry.action, null, entry.laneNum);
                return;
            }
            cache.read(filename, function(arrayBuffer) {
                callback(entry.action, arrayBuffer, entry.laneNum);
            });
        },
        redo: function(callback) {
            if (redoHistory.length === 0) {
                console.log("Nothing left to redo");
                return;
            }
            var entry = redoHistory.pop();
            undoHistory.push(entry);
            cache.read(entry.filename, function(arrayBuffer) {
                callback(entry.laneNum, entry.action, arrayBuffer);
            });
        }
    };
});
