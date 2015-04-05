myApp.
factory('laneEditor', function(util, key, history, $http) {
    var $scope,
        selectedPoint = [null, null],
        selectedPointBox = [null, null],
        selectedPositions = {}, // index => position array
        selectedPositionsDir = -1,
        selectedLane = -1,
        action = {
            laneNum: 0,
            type: ""
        },
        autosaveInterval = 30000,
        autosaveTimer = null,
        lastSave = null,
        isDisableKeyDown = false,
        showButton = {
            append: false,
            fork: false,
            copy: false,
            delete: false,
            join: false,
            laneType: false
        },
        laneTypeColors = {};

    function initLane(laneNum) {
        var positions = $scope.geometries["lane" + laneNum].attributes.position;
        history.push("original", laneNum, positions.array, $scope.laneTypes[laneNum]);
    }

    function setPointBoxVisibility(box1, box2) {
        if (box1 !== null) {
            selectedPointBox[0].visible = box1;
        }
        if (box2 !== null) {
            selectedPointBox[1].visible = box2;
        }

        if (selectedPointBox[0].visible === true && selectedPointBox[1].visible === false) {
            showButton.append = showButton.fork = true;
        } else {
            showButton.append = showButton.fork = false;
        }

        if (selectedPointBox[0].visible === true && selectedPointBox[1].visible === true) {
            showButton.copy = showButton.delete = showButton.laneType = showButton.join = true;
        } else {
            showButton.copy = showButton.delete = showButton.laneType = showButton.join = false;
        }
        $scope.flush();
    }

    function createSelectedPointBoxes() {
        var geometry = new THREE.SphereGeometry(0.2, 20, 20);
        var material = new THREE.MeshNormalMaterial();
        selectedPointBox[0] = new THREE.Mesh(geometry, material);
        selectedPointBox[1] = new THREE.Mesh(geometry, material);
        setPointBoxVisibility(false, false);
        $scope.scene.add(selectedPointBox[0]);
        $scope.scene.add(selectedPointBox[1]);
    }

    function deleteSelectedPointBoxes() {
        $scope.scene.remove(selectedPointBox[0]);
        $scope.scene.remove(selectedPointBox[1]);
        delete selectedPointBox[0];
        delete selectedPointBox[1];
    }

    function init(scope) {
        $scope = scope;
        document.addEventListener('mousedown', onDocumentMouseDown, false);
        document.addEventListener('mouseup', onDocumentMouseUp, false);
        document.addEventListener('keydown', onDocumentKeyDown, false);
        document.addEventListener('dblclick', onDocumentDblClick, false);
        createSelectedPointBoxes();

        for (var lane in $scope.pointClouds.lanes) {
            initLane(lane);
        }
        for (var i = 0; i < $scope.numLaneTypes; i++) {
            var color = util.laneTypeColor(i);
            laneTypeColors[util.colorHash(color)] = i;
            var rgb = [];
            rgb.push(Math.round(color.r * 255));
            rgb.push(Math.round(color.g * 255));
            rgb.push(Math.round(color.b * 255));
            $("#laneTypeSelector > option[value=" + i + "]").css("background-color", "rgb(" + rgb.join(',') + ")");
        }
        laneTypeColors["0.5,0.5,0.5"] = -1;

        autosaveTimer = setInterval(function() {
            save(true);
        }, autosaveInterval);
        lastSave = history.undoHistoryHash();
    }

    function exit() {
        document.removeEventListener('mousedown', onDocumentMouseDown, false);
        document.removeEventListener('mouseup', onDocumentMouseUp, false);
        document.removeEventListener('keydown', onDocumentKeyDown, false);
        document.removeEventListener('dblclick', onDocumentDblClick, false);
        deleteSelectedPointBoxes();
        clearInterval(autosaveTimer);
    }


    function finishAction() {
        deselectPoints(action.laneNum);
        action = {
            laneNum: 0,
            type: ""
        };
    }

    function save(autosave) {
        document.getElementById("save").removeEventListener("click", save);
        autosave = typeof autosave === "boolean" ? autosave : false;
        if (autosave) {
            var currSave = history.undoHistoryHash();
            if (currSave == lastSave) return;
            lastSave = currSave;
            $scope.log("Autosaving...");
        } else {
            lastSave = history.undoHistoryHash();
            $scope.log("Saving...");
        }

        var trackName = $scope.trackInfo.track;

        var lanes = {};
        var laneTypes = {};
        for (var laneNum in $scope.pointClouds.lanes) {
            var positions = $scope.geometries["lane" + laneNum].attributes.position.array;
            var posVectors = [];
            for (var i = 0; i < positions.length; i += 3) {
                posVectors.push([positions[i + 2], positions[i], positions[i + 1]]);
            }
            lanes[laneNum] = posVectors;
            laneTypes[laneNum] = Array.prototype.slice.call($scope.laneTypes[laneNum]);
        }
        var data = {};
        var serializedLanes = JSON.stringify(lanes);
        var serializedLaneTypes = JSON.stringify(laneTypes);
        var zip = new JSZip();
        zip.file("lanes.json", serializedLanes);
        zip.file("lane_types.json", serializedLaneTypes);
        data[trackName] = zip.generate({
            compression: "DEFLATE",
            type: "blob"
        });

        var postUrl = autosave ? "/autosave" : "/save";
        $http.post(postUrl, data, {
            // browser turns undefined into "multipart/form-data" with correct boundary
            headers: {
                "Content-Type": undefined
            },
            // create FormData from the data object
            transformRequest: function(data) {
                var fd = new FormData();
                for (var key in data) {
                    fd.append(key, data[key]);
                }
                return fd;
            }
        }).success(function(data, status, headers, config) {
            if (autosave) {
                $scope.log("");
            } else {
                $scope.log("Saved!");
            }
            document.getElementById("save").addEventListener("click", save, false);
        }).error(function(data, status, headers, config) {
            $scope.log("Unable to save file");
            document.getElementById("save").addEventListener("click", save, false);
        });
    }

    function onDocumentKeyDown(event) {
        if (!$scope.shortcutsEnabled) return;
        var preventDefault = true;
        if (event.metaKey || event.ctrlKey){
            switch (event.keyCode) {
                case key.keyMap.Z:
                case key.keyMap.z:
                    undo();
                    break;
                case key.keyMap.S:
                case key.keyMap.s:
                    save();
                    break;
                case key.keyMap.Y:
                case key.keyMap.y:
                    redo();
                    break;
                default:
                    preventDefault = false;
            }
        }
        else{
            switch (event.keyCode) {
                case key.keyMap.esc:
                    finishAction();
                    break;
                case key.keyMap.backspace:
                case key.keyMap.del:
                case key.keyMap.D:
                case key.keyMap.d:
                    deleteSegment();
                    break;
                case key.keyMap.J:
                case key.keyMap.j:
                    joinLanes();
                    break;
                case key.keyMap.C:
                case key.keyMap.c:
                    copySegment();
                    break;
                case key.keyMap.A:
                case key.keyMap.a:
                    append();
                    break;
                case key.keyMap.F:
                case key.keyMap.f:
                    fork();
                    break;
                default:
                    preventDefault = false;
            }
        }
        if (preventDefault) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    function onDocumentMouseDown(event) {
        if(event.which !== 1) return; //just left click
        if (key.isDown("ctrl")) return;
        // event.stopPropagation();

        var intersects, laneNum;
        $scope.updateMouse();

        if (action.type == "fork" || action.type == "append" || action.type == "copy") {
            for (i = 0; i < $scope.meshes.groundPlanes.length; i++) {
                intersects = $scope.raycaster.intersectObject($scope.meshes.groundPlanes[i]);
                if (intersects.length > 0) break;
            }
            if (intersects.length === 0) return;
            var point = intersects[0].point;
            var newPos = new Float32Array([point.x, point.y, point.z]);
            if (action.type == "fork")
                forkLane(newPos);
            else if (action.type == "append")
                appendLane(newPos);
            else
                pasteSegment(newPos);
            return;
        }

        for (laneNum in $scope.pointClouds.lanes) {
            intersects = $scope.raycaster.intersectObject($scope.pointClouds.lanes[laneNum]);
            if (intersects.length > 0) break;
        }
        if (intersects.length === 0) return;

        if (key.isDown("shift")) {
            selectRange(intersects[0], laneNum);
            return;
        }
        deselectPoints(action.laneNum);
        // select point for dragging
        action = {
            laneNum: laneNum,
            type: ""
        };
        selectedPoint = [intersects[0], null];
        var positions = selectedPoint[0].object.geometry.attributes.position.array;
        var selectedPos = util.getPos(positions, selectedPoint[0].index);
        selectedPointBox[0].position.set(selectedPos[0], selectedPos[1], selectedPos[2]);
        setPointBoxVisibility(true, null);
        util.paintPoint($scope.geometries["lane" + laneNum].attributes.color, selectedPoint[0].index, 255, 255, 255);
        selectedPositions = {};
        selectedPositions[selectedPoint[0].index] = selectedPos;

        var nearestPoints = $scope.kdtrees["lane" + laneNum].nearest(selectedPos, 2).filter(function(kdPoint) {
            // filter out same point
            return kdPoint[1] > 0;
        });
        if (nearestPoints.length < 1) {
            selectedPositionsDir = -1;
        } else {
            var neighborPos = util.getPos(positions, nearestPoints[0][0].pos);
            selectedPositionsDir = util.maxDirectionComponent(selectedPos, neighborPos);
        }

        //TODO: find nearest plane instead of raycasting
        for (var i = 0; i < $scope.meshes.groundPlanes.length; i++) {
            intersects = $scope.raycaster.intersectObject($scope.meshes.groundPlanes[i]);
            if (intersects.length > 0) {
                selectedPlane = intersects[0];
                document.addEventListener('mousemove', dragPointInit);
                return;
            }
        }
    }

    function onDocumentMouseUp() {
        if(event.which !== 1) return; //just left click
        if (action.type == "drag") {
            var positions = selectedPoint[0].object.geometry.attributes.position;
            history.push(action.type, action.laneNum, positions.array, $scope.laneTypes[action.laneNum]);
            deselectPoints(action.laneNum);
            dragPointDists = {};
        }
        if (action.type != "append")
            action.type = "";
        document.removeEventListener('mousemove', dragPointInit);
        document.removeEventListener('mousemove', dragPoint);
    }

    function onDocumentDblClick() {
        if (selectedPoint[0] === null) return;
        selectedLane = action.laneNum;
        var colors = selectedPoint[0].object.geometry.attributes.color;
        for (var i = 0; i < colors.array.length; i++) {
            colors.array[i] = 1;
        }
        colors.needsUpdate = true;
        showButton.laneType = true;
        $scope.flush();
    }

    function selectRange(intersectedPoint, laneNum) {
        var selectedPointRef = selectedPoint[0];
        deselectPoints(action.laneNum);
        selectedPoint[0] = selectedPointRef;
        setPointBoxVisibility(true, null);
        selectedPoint[1] = intersectedPoint;
        var startPositions = selectedPoint[0].object.geometry.attributes.position.array,
            endPositions = selectedPoint[1].object.geometry.attributes.position.array,
            startPos = util.getPos(startPositions, selectedPoint[0].index),
            endPos = util.getPos(endPositions, selectedPoint[1].index);
        if (action.laneNum != laneNum) {
            // join lane
            action.laneNum2 = laneNum;
            selectedPositions = {};
            selectedPositions[action.laneNum + "_" + selectedPoint[0].index] = startPos;
            selectedPositions[action.laneNum2 + "_" + selectedPoint[1].index] = endPos;
            util.paintPoint($scope.geometries["lane" + laneNum].attributes.color, selectedPoint[1].index, 255, 255, 255);
            selectedPointBox[1].position.set(endPos[0], endPos[1], endPos[2]);
            setPointBoxVisibility(null, true);
            return;
        }
        // select range
        //TODO change util.difference to use regular arrays
        selectedPositionsDir = util.maxDirectionComponent(startPos, endPos);
        var midPoint = util.midpoint(startPos, endPos);
        var range = util.distance(startPos, endPos) / 2 + 0.01;
        var nearestPoints = $scope.kdtrees["lane" + laneNum].nearest(midPoint, 100, range);
        selectedPositions = {};
        for (var i = 0; i < nearestPoints.length; i++) {
            var index = nearestPoints[i][0].pos;
            selectedPositions[index] = util.getPos(startPositions, index);
            util.paintPoint($scope.geometries["lane" + laneNum].attributes.color, index, 255, 255, 255);
        }
        selectedPointBox[1].position.set(endPos[0], endPos[1], endPos[2]);
        setPointBoxVisibility(null, true);
    }

    function dragPointInit() {
        var positions = selectedPoint[0].object.geometry.attributes.position.array;
        var nearestPoints = $scope.kdtrees["lane" + action.laneNum].nearest(util.getPos(positions, selectedPoint[0].index), 300, $scope.dragRange);
        selectedPositions = {};
        for (var i = 0; i < nearestPoints.length; i++) {
            var index = nearestPoints[i][0].pos;
            selectedPositions[index] = new Float32Array(util.getPos(positions, index));
        }
        document.removeEventListener('mousemove', dragPointInit);
        document.addEventListener('mousemove', dragPoint);
    }

    var dragPointDists = {};
    var dragPointMaxDist;

    function dragPoint() {
        $scope.updateMouse();
        //TODO: move selectedPoint[0]Box with selectedPoint[0]
        setPointBoxVisibility(false, null);
        var intersects = $scope.raycaster.intersectObject(selectedPlane.object);
        if (intersects.length > 0) {
            // var index = selectedPoint[0].index;
            var pointPosition = selectedPoint[0].object.geometry.attributes.position;
            var newPos = new THREE.Vector3();
            // var newPos = util.difference(intersects[0].point, selectedPlane.point);
            newPos.subVectors(intersects[0].point, selectedPlane.point);
            var index, dist;
            if (Object.keys(dragPointDists).length === 0) {
                dragPointMaxDist = 0;
                for (index in selectedPositions) {
                    dist = util.distance(selectedPositions[selectedPoint[0].index], selectedPositions[index]);
                    dragPointDists[index] = dist;
                    if (dist > dragPointMaxDist) dragPointMaxDist = dist;
                }
            }
            for (index in selectedPositions) {
                dist = dragPointDists[index];
                var weight = (Math.cos(Math.PI / dragPointMaxDist * dist) + 1) / 2;
                pointPosition.array[3 * index] = weight * newPos.x + selectedPositions[index][0];
                pointPosition.array[3 * index + 1] = weight * newPos.y + selectedPositions[index][1];
                pointPosition.array[3 * index + 2] = weight * newPos.z + selectedPositions[index][2];
            }
            pointPosition.needsUpdate = true;
            action.type = "drag";
        }
    }

    function colorLane(laneNum, colors) {
        for (var i = 0; 3 * i < colors.length; i++) {
            var color = util.laneTypeColor($scope.laneTypes[laneNum][i]);
            colors[3 * i + 0] = color.r;
            colors[3 * i + 1] = color.g;
            colors[3 * i + 2] = color.b;
        }
    }

    function deselectPoints(laneNum) {
        if (selectedLane >= 0) {
            var pointColors = selectedPoint[0].object.geometry.attributes.color;
            colorLane(laneNum, pointColors.array);
            pointColors.needsUpdate = true;
            selectedLane = -1;
        } else {
            var color;
            // if (selectedPoint[0] !== null)
            //     util.paintPoint(selectedPoint[0].object.geometry.attributes.color, selectedPoint[0].index, color.r, color.g, color.b);
            for (var index in selectedPositions) {
                var pointKey = index.split("_");
                if (pointKey.length > 1) {
                    laneNum = parseInt(pointKey[0], 10);
                    index = parseInt(pointKey[1], 10);
                }
                color = util.laneTypeColor($scope.laneTypes[laneNum][index]);
                util.paintPoint($scope.geometries["lane" + laneNum].attributes.color, index, color.r, color.g, color.b);
            }
        }

        selectedPoint = [null, null];
        selectedPositions = {};
        setPointBoxVisibility(false, false);
    }

    function selectPoint(laneNum, index) {
        var positions = $scope.geometries["lane" + laneNum].attributes.position,
            colors = $scope.geometries["lane" + laneNum].attributes.color;

        // util.paintPoint(colors, index, 255, 255, 255);
        var pos = util.getPos(positions.array, index);
        selectedPointBox[0].position.set(pos[0], pos[1], pos[2]);
        setPointBoxVisibility(true, null);
        selectedPoint[0] = {
            object: $scope.pointClouds.lanes[laneNum],
            index: index
        };
    }

    function newLaneNum() {
        var lanes = Object.keys($scope.kdtrees).filter(function(key) {
            return key.slice(0, 4) == "lane";
        }).map(function(key) {
            return parseInt(key.slice(4), 10);
        }).sort(function(a, b) {
            return a - b;
        });
        var laneNum;
        for (laneNum = 0; laneNum <= lanes.length; laneNum++) {
            if (lanes[laneNum] != laneNum) break;
        }
        return laneNum;
    }

    function newLane(laneNum, arrayBuffer, laneTypes) {
        // var color = util.generateRGB(laneNum);
        var laneCloud = $scope.generatePointCloud("lane" + laneNum, arrayBuffer, $scope.LANE_POINT_SIZE, laneTypes);
        $scope.scene.add(laneCloud);
        $scope.laneTypes[laneNum] = laneTypes;
        $scope.pointClouds.lanes[laneNum] = laneCloud;
        var newPositions = laneCloud.geometry.attributes.position;
        var newColors = laneCloud.geometry.attributes.color;
        $scope.kdtrees["lane" + laneNum] = new THREE.TypedArrayUtils.Kdtree(newPositions.array, util.distance, 3, newColors.array);
        for (var i = 0; i < $scope.laneTypes[laneNum].length; i++) {
            $scope.laneTypes[laneNum][i] = laneTypeColors[util.colorHash(newColors.array.subarray(3 * i, 3 * i + 3))]
        }
    }

    function deleteLane(laneNum) {
        $scope.geometries["lane" + laneNum].dispose();
        $scope.scene.remove($scope.pointClouds.lanes[laneNum]);
        delete $scope.geometries["lane" + laneNum];
        delete $scope.kdtrees["lane" + laneNum];
        delete $scope.pointClouds.lanes[laneNum];
        delete $scope.laneTypes[laneNum];
    }

    function updateLane(laneNum, positions, colors, positionsArray, laneTypes) {
        delete positions.array;
        positions.array = positionsArray;
        positions.needsUpdate = true;

        delete $scope.laneTypes[laneNum];
        $scope.laneTypes[laneNum] = laneTypes;

        delete colors.array;
        colors.array = new Float32Array(positions.array.length);
        colorLane(laneNum, colors.array);
        colors.needsUpdate = true;

        delete $scope.kdtrees["lane" + laneNum];
        $scope.kdtrees["lane" + laneNum] = new THREE.TypedArrayUtils.Kdtree(positions.array, util.distance, 3, colors.array);
        for (var i = 0; i < $scope.laneTypes[laneNum].length; i++) {
            $scope.laneTypes[laneNum][i] = laneTypeColors[util.colorHash(colors.array.subarray(3 * i, 3 * i + 3))];
        }
    }

    function copySegment() {
        if (selectedPoint[0] === null) {
            $scope.log("Please select points first");
            return;
        }
        if (Object.keys(selectedPositions)[0].split("_").length > 1) {
            $scope.log("Cannot copy points in multiple lanes");
            return;
        }
        action.type = "copy";
        var positions = selectedPoint[0].object.geometry.attributes.position;
        // var colors = selectedPoint[0].object.geometry.attributes.color;
        var laneTypes = $scope.laneTypes[action.laneNum];
        var newPositions, newLaneTypes;
        if (selectedLane >= 0) {
            newPositions = new Float32Array(positions.array);
            newLaneTypes = new Int8Array(laneTypes);
        } else {
            var lenNewPositions = 3 * Object.keys(selectedPositions).length;
            if (lenNewPositions === 0) return;
            newPositions = new Float32Array(lenNewPositions);
            newLaneTypes = new Int8Array(lenNewPositions / 3);
            var i = 0,
                j = 0;
            for (var index in selectedPositions) {
                newLaneTypes[j++] = laneTypes[index];
                newPositions[i++] = positions.array[3 * index];
                newPositions[i++] = positions.array[3 * index + 1];
                newPositions[i++] = positions.array[3 * index + 2];
            }
        }
        var selectedPointRef = selectedPoint[0];
        deselectPoints(action.laneNum);
        setPointBoxVisibility(true, null);
        selectedPoint[0] = selectedPointRef;
        var laneNum = newLaneNum();
        newLane(laneNum, newPositions, newLaneTypes);
        action.laneNum = laneNum;
    }

    function pasteSegment(destPos) {
        var laneNum = action.laneNum;
        var positions = $scope.pointClouds.lanes[laneNum].geometry.attributes.position;
        var sourcePos = util.getPos(selectedPoint[0].object.geometry.attributes.position.array, selectedPoint[0].index);
        var dVec = util.difference(destPos, sourcePos);
        for (var index = 0; index < positions.array.length;) {
            positions.array[index++] += dVec[0];
            positions.array[index++] += dVec[1];
            positions.array[index++] += dVec[2];
        }
        positions.needsUpdate = true;
        history.push("new", laneNum, positions.array, $scope.laneTypes[laneNum]);
        selectedPoint = [null, null];
        selectedPositions = {};
        setPointBoxVisibility(false, null);
    }

    function joinLanes() {
        if (selectedPoint[0] === null || selectedPoint[1] === null) {
            $scope.log("Please select points first");
            return;
        }
        if (Object.keys(selectedPositions)[0].split("_").length == 1) {
            $scope.log("Must select points in different lanes");
            return;
        }
        action.type = "join";
        setPointBoxVisibility(false, false);
        var positionArrs = [],
            laneTypes = [],
            lanes = [],
            endPositions = [];
        for (var pointKey in selectedPositions) {
            pointKeySplit = pointKey.split("_");
            lanes.push(pointKeySplit[0]);
            endPositions.push(selectedPositions[pointKey]);
            positionArrs.push($scope.pointClouds.lanes[pointKeySplit[0]].geometry.attributes.position);
            laneTypes.push($scope.laneTypes[pointKeySplit[0]]);
        }
        var fillPositions = util.interpolate(endPositions[0], endPositions[1]);
        // interpolate
        var lenNewPositions = positionArrs[0].array.length + fillPositions.length + positionArrs[1].array.length;
        var newPositions = new Float32Array(lenNewPositions);
        newPositions.set(positionArrs[0].array, 0);
        newPositions.set(fillPositions, positionArrs[0].array.length);
        newPositions.set(positionArrs[1].array, positionArrs[0].array.length + fillPositions.length);
        // set lane type
        var newLaneTypes = new Int8Array(lenNewPositions / 3);
        newLaneTypes.set(laneTypes[0], 0);
        var lastLaneType = newLaneTypes[laneTypes[0].length - 1];
        for (var i = 0; i < fillPositions.length / 3; i++) {
            newLaneTypes[laneTypes[0].length + i] = lastLaneType;
        }
        newLaneTypes.set(laneTypes[1], laneTypes[0].length + fillPositions.length / 3);
        // delete second lane
        history.push("delete", lanes[1], positionArrs[1].array, laneTypes[1]);
        deleteLane(lanes[1]);
        // modify first lane
        var positions = positionArrs[0];
        var colors = $scope.pointClouds.lanes[lanes[0]].geometry.attributes.color;
        updateLane(lanes[0], positions, colors, newPositions, newLaneTypes);

        history.push("join", lanes[0], positions.array, $scope.laneTypes[lanes[0]]);
        selectedPoint = [null, null];
        selectedPositions = {};
    }

    function deleteSegment() {
        if (selectedPoint[0] === null) {
            $scope.log("Please select points first");
            return;
        }
        if (Object.keys(selectedPositions)[0].split("_").length > 1) {
            $scope.log("Cannot delete points in multiple lanes");
            return;
        }
        if (selectedPositionsDir < 0) {
            $scope.log("Please select at least two points to delete");
            return;
        }
        var positions = selectedPoint[0].object.geometry.attributes.position;
        setPointBoxVisibility(false, false);
        if (selectedLane >= 0) {
            // delete entire lane
            history.push("delete", selectedLane, positions.array, $scope.laneTypes[selectedLane]);
            deleteLane(selectedLane);
            action.type = "delete";
            selectedLane = -1;
            selectedPoint = [null, null];
            selectedPositions = {};
            return;
        }
        action.type = "split";
        var colors = selectedPoint[0].object.geometry.attributes.color;
        var boundaryIndex = Object.keys(selectedPositions)[0];
        var oldPositions = new Float32Array(positions.array.length);
        var lenOldPositions = 0;
        var newPositions = new Float32Array(positions.array.length);
        var lenNewPositions = 0;
        var oldLaneTypes = new Int8Array($scope.laneTypes[action.laneNum].length);
        var lenOldLaneTypes = 0;
        var newLaneTypes = new Int8Array($scope.laneTypes[action.laneNum].length);
        var lenNewLaneTypes = 0;
        for (var index = 0; index < positions.length / 3; index++) {
            if (index in selectedPositions) continue;
            if (positions.array[3 * index + selectedPositionsDir] < positions.array[3 * boundaryIndex + selectedPositionsDir]) {
                oldPositions[lenOldPositions++] = positions.array[3 * index];
                oldPositions[lenOldPositions++] = positions.array[3 * index + 1];
                oldPositions[lenOldPositions++] = positions.array[3 * index + 2];
                oldLaneTypes[lenOldLaneTypes++] = $scope.laneTypes[action.laneNum][index];
            } else {
                newPositions[lenNewPositions++] = positions.array[3 * index];
                newPositions[lenNewPositions++] = positions.array[3 * index + 1];
                newPositions[lenNewPositions++] = positions.array[3 * index + 2];
                newLaneTypes[lenNewLaneTypes++] = $scope.laneTypes[action.laneNum][index];
            }
        }
        // Create new lane
        var laneNum = newLaneNum();
        var subNewPositions = newPositions.subarray(0, lenNewPositions);
        var subNewLaneTypes = newLaneTypes.subarray(0, lenNewLaneTypes);
        newLane(laneNum, subNewPositions, subNewLaneTypes);
        newPositions = $scope.geometries["lane" + laneNum].attributes.position;
        history.push("new_split", laneNum, newPositions.array, $scope.laneTypes[laneNum]);
        // truncate old lane
        var positionsArray = new Float32Array(oldPositions.subarray(0, lenOldPositions));
        var laneTypes = new Int8Array(oldLaneTypes.subarray(0, lenOldLaneTypes));
        updateLane(action.laneNum, positions, colors, positionsArray, laneTypes);

        //TODO edge case where newLane is empty
        history.push("split", action.laneNum, positions.array, $scope.laneTypes[action.laneNum]);
        selectedPoint = [null, null];
        selectedPositions = {};
    }

    function findNearestEndpoint(laneNum, pointPos, range) {
        var findNearest = $scope.kdtrees["lane" + laneNum].nearest;
        var excludeSelf = function(kdPoint) {
            return kdPoint[1] > 0;
        };
        var sortByDistance = function(kdPoint1, kdPoint2) {
            return kdPoint1[1] - kdPoint2[1];
        };
        var INF_RANGE = 10000;

        function isEndpoint(pos) {
            // 0: selected point
            // 1: neighbor 1
            // 2: neighbor 2
            var neighborsOf_0 = findNearest(pos, 3, INF_RANGE).filter(excludeSelf).sort(sortByDistance);
            if (neighborsOf_0.length < 2) return true;
            var neighborsOf_1 = findNearest(neighborsOf_0[0][0].obj, 3, INF_RANGE).filter(excludeSelf);
            var index_NeighborsOf_1 = neighborsOf_1.map(function(kdPoint) {
                return kdPoint[0].pos;
            });
            var index_2 = neighborsOf_0[1][0].pos;
            var indexNeighborOf_1_2 = index_NeighborsOf_1.indexOf(index_2);
            if (indexNeighborOf_1_2 < 0) return false;
            var dist_0_2 = neighborsOf_0[1][1],
                dist_1_2 = neighborsOf_1[indexNeighborOf_1_2][1];
            if (dist_0_2 > dist_1_2) return true;
            return false;
        }
        var nearestPoints = findNearest(pointPos, range, INF_RANGE).sort(sortByDistance);
        for (var i = 0; i < nearestPoints.length; i++) {
            var pos = nearestPoints[i][0].obj;
            if (isEndpoint(pos)) return nearestPoints[i][0].pos;
        }
        return -1;
    }

    function append() {
        initAppendForkLane("append");
    }

    function fork() {
        initAppendForkLane("fork");
    }

    function initAppendForkLane(mode) {
        if (selectedPoint[0] === null) {
            $scope.log("Please select point first");
            return;
        }
        if (selectedPoint[1] !== null) {
            $scope.log("Please select a single point");
            return;
        }
        if (mode != "fork" && mode != "append") return;
        $scope.log("Press Esc to finish " + mode);
        action.type = mode;
        if (mode == "fork") return;

        var laneNum = action.laneNum;
        var positions = selectedPoint[0].object.geometry.attributes.position;
        var selectedPos = util.getPos(positions.array, selectedPoint[0].index);
        var startPoint = findNearestEndpoint(laneNum, selectedPos, 5);
        if (startPoint < 0) {
            $scope.log("Please select an endpoint");
            action.type = "";
            return;
        }
        deselectPoints(laneNum);
        selectPoint(laneNum, startPoint);
    }

    function appendLane(endPos) {
        var laneNum = action.laneNum;
        var positions = selectedPoint[0].object.geometry.attributes.position;
        var colors = selectedPoint[0].object.geometry.attributes.color;

        var startPos = util.getPos(positions.array, selectedPoint[0].index);
        var fillPositions = util.interpolate(startPos, endPos);
        var lenNewPositions = positions.array.length + fillPositions.length;
        var newPositions = new Float32Array(lenNewPositions);
        newPositions.set(positions.array, 0);
        newPositions.set(fillPositions, positions.array.length);

        var newLaneTypes = new Int8Array(lenNewPositions / 3);
        newLaneTypes.set($scope.laneTypes[laneNum], 0);
        var lastLaneType = newLaneTypes[$scope.laneTypes[laneNum].length - 1];
        for (var i = 0; i < fillPositions.length / 3; i++) {
            newLaneTypes[$scope.laneTypes[laneNum].length + i] = lastLaneType;
        }

        updateLane(laneNum, positions, colors, newPositions, newLaneTypes);
        history.push("append", laneNum, positions.array, $scope.laneTypes[laneNum]);

        // select last point for next append
        var nearestPoints = $scope.kdtrees["lane" + laneNum].nearest(endPos, 1, util.INTERPOLATE_STEP);
        if (nearestPoints.length === 0) return;
        selectPoint(laneNum, nearestPoints[0][0].pos);
    }

    function forkLane(endPos) {
        var positions = selectedPoint[0].object.geometry.attributes.position;
        var startPos = util.getPos(positions.array, selectedPoint[0].index);
        var fillPositions = util.interpolate(startPos, endPos);

        var newPositions = new Float32Array(fillPositions);
        var newLaneTypes = new Int8Array(fillPositions.length / 3);
        var lastLaneType = $scope.laneTypes[action.laneNum][selectedPoint[0].index];
        for (var i = 0; i < fillPositions.length / 3; i++) {
            newLaneTypes[i] = lastLaneType;
        }
        var laneNum = newLaneNum();
        newLane(laneNum, newPositions, newLaneTypes);
        newPositions = $scope.geometries["lane" + laneNum].attributes.position;
        history.push("fork", laneNum, newPositions.array, $scope.laneTypes[laneNum]);

        // select end point for next append
        deselectPoints(action.laneNum);
        var nearestPoints = $scope.kdtrees["lane" + laneNum].nearest(endPos, 1, util.INTERPOLATE_STEP);
        if (nearestPoints.length === 0) return;
        selectPoint(laneNum, nearestPoints[0][0].pos);
        action = {
            laneNum: laneNum,
            type: "append"
        };
    }

    function laneType(laneType) {
        if (selectedPoint[0] === null) {
            $scope.log("Please select points first");
            return;
        }
        if (Object.keys(selectedPositions)[0].split("_").length > 1) {
            $scope.log("Cannot set lane type of points in different lanes");
            return;
        }
        action.type = "laneType";
        var colors = selectedPoint[0].object.geometry.attributes.color;
        if (selectedLane >= 0) {
            for (var i = 0; i < $scope.laneTypes[selectedLane].length; i++) {
                $scope.laneTypes[selectedLane][i] = laneType;
            }
            colorLane(selectedLane, colors);
            colors.needsUpdate = true;
            deselectPoints(selectedLane);
            selectedLane = -1;
            selectedPoint = [null, null];
            selectedPositions = {};
            setPointBoxVisibility(false, null);
            return;
        }
        var laneNum = action.laneNum;
        for (var index in selectedPositions) {
            $scope.laneTypes[laneNum][index] = laneType;
        }
        deselectPoints(laneNum);
        var positions = $scope.geometries["lane" + laneNum].attributes.position;
        history.push("type", laneNum, positions.array, $scope.laneTypes[laneNum]);
    }

    function undo() {
        action.type = "";
        try {
            history.undo(function(laneNum, action, posArrayBuf, typesArrayBuf) {
                if (action == "new" || action == "new_split" || action == "fork") {
                    deleteLane(laneNum);
                    return;
                } else if (action == "delete") {
                    newLane(laneNum, posArraybuf, new Int8Array(typesArrayBuf));
                    return;
                }
                var positions = $scope.geometries["lane" + laneNum].attributes.position;
                var colors = $scope.geometries["lane" + laneNum].attributes.color;
                var positionsArray = new Float32Array(posArrayBuf);
                var typesArray = new Int8Array(typesArrayBuf);
                updateLane(laneNum, positions, colors, positionsArray, typesArray);
                if (action == "split" || action == "join") {
                    undo();
                }
            });
        } catch (e) {
            $scope.log(e.message);
        }
    }

    function redo() {
        try {
            history.redo(function(laneNum, action, posArrayBuf, typesArrayBuf) {
                if (action == "new" || action == "new_split" || action == "fork") {
                    newLane(laneNum, posArrayBuf, new Int8Array(typesArrayBuf));
                    if (action == "new_split") redo();
                    //TODO if next is delete:
                    return;
                } else if (action == "delete") {
                    deleteLane(laneNum);
                    redo();
                    return;
                }
                var positions = $scope.geometries["lane" + laneNum].attributes.position;
                var colors = $scope.geometries["lane" + laneNum].attributes.color;
                var positionsArray = new Float32Array(posArrayBuf);
                var typesArray = new Int8Array(typesArrayBuf);
                updateLane(laneNum, positions, colors, positionsArray, typesArray);
            });
        } catch (e) {
            $scope.log(e.message);
        }
    }

    return {
        initLane: initLane,
        init: init,
        exit: exit,
        undo: undo,
        redo: redo,
        save: save,
        append: append,
        fork: fork,
        join: joinLanes,
        copy: copySegment,
        delete: deleteSegment,
        done: finishAction,
        laneType: laneType,
        showButton: showButton
    };
});