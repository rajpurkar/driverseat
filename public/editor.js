myApp.
factory('editor', function(util, key, history, $http) {
    var $scope,
        selectedPoint = [null, null],
        selectedPointBox = [null, null],
        selectedPositions = {}, // index => position array
        selectedPositionsDir = -1;
        selectedLane = -1,
        action = { laneNum: 0, type: "" },
        dragRange = 15,
        autosaveInterval = 30000,
        typeAddBtnIdSuffix = "AddBtn",
        typeContentIdSuffix = "Content"
        isDisableKeyDown = false;

    function initLane(laneNum) {
        var positions = $scope.geometries["lane"+laneNum].attributes.position;
        history.push("original", positions.array, laneNum);
    }

    function changeDragRange(event){
        dragRange = event.target.value;
    }

    function setPointBoxVisibility(box1, box2){
        if(box1 !== null){
            selectedPointBox[0].visible = box1;
        }
        if(box2 !== null){
            selectedPointBox[1].visible = box2;
        }

        if(selectedPointBox[0].visible === true && selectedPointBox[1].visible === false){
            $scope.appendShow = true;
            $scope.forkShow = true;
        }else{
            $scope.appendShow = false;
            $scope.forkShow = false;
        }

        if(selectedPointBox[0].visible === true && selectedPointBox[1].visible === true){
            $scope.joinShow = true;
            $scope.deleteShow = true;
        }else{
            $scope.joinShow = false;
            $scope.deleteShow = false;
        }
        $scope.$apply();
    }

    function createSelectedPointBoxes() {
        var geometry = new THREE.SphereGeometry(0.2, 20, 20);
        var material = new THREE.MeshNormalMaterial()
        selectedPointBox[0] = new THREE.Mesh(geometry, material);
        selectedPointBox[1] = new THREE.Mesh(geometry, material);
        setPointBoxVisibility(false, false);
        $scope.scene.add(selectedPointBox[0]);
        $scope.scene.add(selectedPointBox[1]);
    }

    function init(scope) {
        $scope = scope;
        //todo make these more angularish!
        var buttons = document.getElementsByClassName("actionBtn");
        for(var i=0;i<buttons.length;i++){
            buttons[i].addEventListener('mouseup', stopBubble, false);
            buttons[i].addEventListener('mousedown', stopBubble, false);
        }

        var inputs = document.getElementsByTagName('input');
        for (var i = 0; i < inputs.length; i++) {
            var input = inputs[i];
            if (input.type == 'text') {
                input.addEventListener('focus', disableKeyDown, true);
                input.addEventListener('blur', enableKeyDown, true);
            }
        }
        document.getElementById("categoryAddBtn").addEventListener("click", handleCategoryAddBtnShow, false);
        document.getElementById("categoryAddBtn").addEventListener("click", handleCategoryAddBtnShow, false);
        document.getElementById("tagAddBtn").addEventListener("click", handleTagAddBtnShow, false);
        document.getElementById("categoryForm").addEventListener("submit", handleCategorySubmit, false);
        document.getElementById("tagForm").addEventListener("submit", handleTagSubmit, false);
        document.getElementById("undo").addEventListener("click", undo, false);
        document.getElementById("redo").addEventListener("click", redo, false);
        document.getElementById("save").addEventListener("click", save, false);
        document.getElementById("fork").addEventListener("click", handleFork, false);
        document.getElementById("append").addEventListener("click", handleAppend, false);
        document.getElementById("join").addEventListener("click", handleJoin, false);
        document.getElementById("delete").addEventListener("click", handleDelete, false);
        document.addEventListener('mousedown', onDocumentMouseDown, false);
        document.addEventListener('mouseup', onDocumentMouseUp, false);
        document.addEventListener('keydown', onDocumentKeyDown, false);
        document.addEventListener('dblclick', onDocumentDblClick, false);
        document.querySelector('#drrange').addEventListener('input', changeDragRange);
        createSelectedPointBoxes();

        setInterval(function() { save(true); }, autosaveInterval);
    }

    function disableKeyDown(event) {
        isDisableKeyDown = true;
    }

    function enableKeyDown(event) {
        isDisableKeyDown = false;
    }

    function isKeyDownDisabled() {
        return isDisableKeyDown;
    }

    function handleAddBtnShow(event, typeToShow, typeToHide) {
        var typeToShowContent = document.getElementById(typeToShow + typeContentIdSuffix);
        var typeToShowBtn = document.getElementById(typeToShow + typeAddBtnIdSuffix);
        var typeToHideContent = document.getElementById(typeToHide + typeContentIdSuffix);
        var typeToHideBtn = document.getElementById(typeToHide + typeAddBtnIdSuffix);
        if (typeToShowContent.classList.contains("hidden")) {
            typeToHideContent.classList.add("hidden");
            typeToHideBtn.classList.remove("greenBackground");
            typeToShowContent.classList.remove("hidden");
            typeToShowBtn.classList.add("greenBackground");
        } else {
            typeToShowContent.classList.add("hidden");
            typeToShowBtn.classList.remove("greenBackground");
        }
    }

    function handleCategoryAddBtnShow(event){
        handleAddBtnShow(event, "category", "tag");
    }

    function handleTagAddBtnShow(event) {
        handleAddBtnShow(event, "tag", "category");
    }

    function handleCategorySubmit(event) {
        $.ajax({
            url: "/categories",
            type: "POST",
            data: $("#categoryForm").serialize(),
            success: function(newCategory) {
                alert("Saved category!");
                $(".category-input").val("");
                $('#categorySelector').append($('<option/>', {
                    value: newCategory._id,
                    text : newCategory.name
                }));
            }
        });
        event.preventDefault();
        return false;
    }

    function handleTagSubmit(event) {
        $.ajax({
            url: "/tags",
            type: "POST",
            data: $("#tagForm").serialize(),
            success: function(data) {
                alert("Saved tag!");
                $(".tag-input").val("");
            }
        });
        event.preventDefault();
        return false;
    }

    function stopBubble(event){
        if(event){
            event.stopPropagation();
            event.preventDefault();
        }
    }

    function handleDelete(event){
        deleteSegment();
    }

    function handleJoin(event){
        joinLanes();
        return false;
    }

    function handleAppend(event){
        $scope.log("Press Esc to finish append");
        initAppendForkLane("append");
        return false;
    }

    function handleFork(event){
        $scope.log("Press Esc to finish fork");
        initAppendForkLane("fork");
        return false;
    }

    function handleDone(event){
        deselectPoints(action.laneNum);
        action = { laneNum: 0, type: "" };
        return false;
    }

    var lastSave = "";
    function save(autosave) {
        document.getElementById("save").removeEventListener("click", save);
        autosave = typeof autosave === "boolean" ? autosave : false;
        if (!autosave) $scope.log("Saving...");

        var trackName = $scope.trackInfo.track;

        var lanes = {};
        for (var laneNum in $scope.pointClouds.lanes) {
            var positions = $scope.geometries["lane"+laneNum].attributes.position.array;
            var posVectors = [];
            for (var i = 0; i < positions.length; i+=3) {
                posVectors.push([positions[i+2], positions[i], positions[i+1]]);
            }
            lanes[laneNum] = posVectors;
        }
        var data = {};
        var serializedLanes = JSON.stringify(lanes);
        if (autosave) {
            if (serializedLanes == lastSave) {
                document.getElementById("save").addEventListener("click", save, false);
                return;
            }
            $scope.log("Autosaving...");
        }
        lastSave = serializedLanes;
        var zip = new JSZip();
        zip.file("lanes.json", serializedLanes);
        data[trackName] = zip.generate({ compression: "DEFLATE", type: "blob" });

        var postUrl = autosave ? "/autosave" : "/save";
        $http.post(postUrl, data, {
            // browser turns undefined into "multipart/form-data" with correct boundary
            headers: { "Content-Type": undefined },
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
        if (isDisableKeyDown) return;
        var preventDefault = true;
        switch (event.keyCode) {
            case key.keyMap.esc:
                handleDone();
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
                handleAppend();
                break;
            case key.keyMap.F:
            case key.keyMap.f:
                handleFork();
                break;
            case key.keyMap.Z:
            case key.keyMap.z:
                if (!event.ctrlKey) break;
                undo();
                break;
            case key.keyMap.Y:
            case key.keyMap.y:
                if (!event.ctrlKey) break;
                redo();
                break;
            default:
                preventDefault = false;
        }
        if (preventDefault) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    function onDocumentMouseDown(event) {
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
        action = { laneNum: laneNum, type: "" };
        selectedPoint = [intersects[0], null];
        var positions = selectedPoint[0].object.geometry.attributes.position.array;
        var selectedPos = util.getPos(positions, selectedPoint[0].index);
        selectedPointBox[0].position.set(selectedPos[0], selectedPos[1], selectedPos[2]);
        setPointBoxVisibility(true, null);
        util.paintPoint($scope.geometries["lane"+laneNum].attributes.color, selectedPoint[0].index, 255, 255, 255);
        selectedPositions = {};
        selectedPositions[selectedPoint[0].index] = selectedPos;

        var nearestPoints = $scope.kdtrees["lane"+laneNum].nearest(selectedPos, 2).filter(function(kdPoint) {
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
        if (action.type == "drag") {
            history.push(action.type, selectedPoint[0].object.geometry.attributes.position.array, action.laneNum);
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
    }

    function selectRange(intersectedPoint, laneNum) {
        var selectedPointRef = selectedPoint[0];
        deselectPoints(action.laneNum);
        selectedPoint[0] = selectedPointRef;
        setPointBoxVisibility(true, null);
        selectedPoint[1] = intersectedPoint;
        var startPositions = selectedPoint[0].object.geometry.attributes.position.array,
            endPositions   = selectedPoint[1].object.geometry.attributes.position.array,
            startPos = util.getPos(startPositions, selectedPoint[0].index),
            endPos   = util.getPos(endPositions, selectedPoint[1].index);
        if (action.laneNum != laneNum) {
            // join lane
            action.laneNum2 = laneNum;
            selectedPositions = {};
            selectedPositions[action.laneNum+"_"+selectedPoint[0].index] = startPos;
            selectedPositions[action.laneNum2+"_"+selectedPoint[1].index] = endPos;
            util.paintPoint($scope.geometries["lane"+laneNum].attributes.color, selectedPoint[1].index, 255, 255, 255);
            selectedPointBox[1].position.set(endPos[0], endPos[1], endPos[2]);
            setPointBoxVisibility(null, true);
            return;
        }
        // select range
        //TODO change util.difference to use regular arrays
        selectedPositionsDir = util.maxDirectionComponent(startPos, endPos);
        var midPoint = util.midpoint(startPos, endPos);
        var range = util.distance(startPos, endPos) / 2 + 0.01;
        var nearestPoints = $scope.kdtrees["lane"+laneNum].nearest(midPoint, 100, range);
        selectedPositions = {};
        for (var i = 0; i < nearestPoints.length; i++) {
            var index = nearestPoints[i][0].pos;
            selectedPositions[index] = util.getPos(startPositions, index);
            util.paintPoint($scope.geometries["lane"+laneNum].attributes.color, index, 255, 255, 255);
        }
        selectedPointBox[1].position.set(endPos[0], endPos[1], endPos[2]);
        setPointBoxVisibility(null, true);
    }

    function dragPointInit() {
        var positions = selectedPoint[0].object.geometry.attributes.position.array;
        var nearestPoints = $scope.kdtrees["lane"+action.laneNum].nearest(util.getPos(positions, selectedPoint[0].index), 300, dragRange);
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
                var weight = (Math.cos(Math.PI/dragPointMaxDist * dist) + 1)/2;
                pointPosition.array[3*index] = weight * newPos.x + selectedPositions[index][0];
                pointPosition.array[3*index+1] = weight * newPos.y + selectedPositions[index][1];
                pointPosition.array[3*index+2] = weight * newPos.z + selectedPositions[index][2];
            }
            pointPosition.needsUpdate = true;
            action.type = "drag";
        }
    }

    function colorLane(laneNum, colors) {
        var color = util.generateRGB(laneNum);
        for (var i = 0; 3*i < colors.length; i++) {
            colors[3*i+0] = color.r;
            colors[3*i+1] = color.g;
            colors[3*i+2] = color.b;
        }
    }

    function deselectPoints(laneNum) {
        var color = util.generateRGB(laneNum);
        if (selectedLane >= 0) {
            var pointColors = selectedPoint[0].object.geometry.attributes.color;
            colorLane(laneNum, pointColors.array);
            pointColors.needsUpdate = true;
            selectedLane = -1;
        } else {
            if (selectedPoint[0] !== null)
                util.paintPoint(selectedPoint[0].object.geometry.attributes.color, selectedPoint[0].index, color.r, color.g, color.b);
            for (var index in selectedPositions) {
                var pointKey = index.split("_");
                if (pointKey.length > 1) {
                    laneNum = parseInt(pointKey[0], 10);
                    index = parseInt(pointKey[1], 10);
                    color = util.generateRGB(laneNum);
                }
                util.paintPoint($scope.geometries["lane"+laneNum].attributes.color, index, color.r, color.g, color.b);
            }
        }

        selectedPoint = [null, null];
        selectedPositions = {};
        setPointBoxVisibility(false, false);
    }

    function selectPoint(laneNum, index) {
        var positions = $scope.geometries["lane"+laneNum].attributes.position,
            colors = $scope.geometries["lane"+laneNum].attributes.color;

        util.paintPoint(colors, index, 255, 255, 255);
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
            return key.slice(0,4) == "lane";
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

    function newLane(laneNum, arrayBuffer) {
        var color = util.generateRGB(laneNum);
        var laneCloud = $scope.generatePointCloud("lane"+laneNum, arrayBuffer, $scope.LANE_POINT_SIZE, color);
        $scope.scene.add(laneCloud);
        $scope.pointClouds.lanes[laneNum] = laneCloud;
        var newPositions = laneCloud.geometry.attributes.position;
        $scope.kdtrees["lane"+laneNum] = new THREE.TypedArrayUtils.Kdtree(newPositions.array, util.distance, 3);
    }

    function deleteLane(laneNum) {
        $scope.geometries["lane"+laneNum].dispose();
        $scope.scene.remove($scope.pointClouds.lanes[laneNum]);
        delete $scope.geometries["lane"+laneNum];
        delete $scope.kdtrees["lane"+laneNum];
        delete $scope.pointClouds.lanes[laneNum];
    }

    function updateLane(laneNum, positions, colors, positionsArray) {
        delete positions.array;
        positions.array = positionsArray;
        positions.needsUpdate = true;

        delete colors.array;
        colors.array = new Float32Array(positions.array.length);
        colorLane(laneNum, colors.array);
        colors.needsUpdate = true;

        delete $scope.kdtrees["lane"+laneNum];
        $scope.kdtrees["lane"+laneNum] = new THREE.TypedArrayUtils.Kdtree(positions.array, util.distance, 3);
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
        var newPositions;
        if (selectedLane >= 0) {
            newPositions = new Float32Array(positions.array);
        } else {
            var lenNewPositions = 3*Object.keys(selectedPositions).length;
            if (lenNewPositions === 0) return;
            newPositions = new Float32Array(lenNewPositions);
            var i = 0;
            for (var index in selectedPositions) {
                newPositions[i++] = positions.array[3*index];
                newPositions[i++] = positions.array[3*index+1];
                newPositions[i++] = positions.array[3*index+2];
            }
        }
        var selectedPointRef = selectedPoint[0];
        deselectPoints(action.laneNum);
        setPointBoxVisibility(true, null);
        selectedPoint[0] = selectedPointRef;
        var laneNum = newLaneNum();
        newLane(laneNum, newPositions);
        action.laneNum = laneNum;
    }

    function pasteSegment(destPos) {
        var laneNum = action.laneNum;
        var positions = $scope.pointClouds.lanes[laneNum].geometry.attributes.position;
        var sourcePos = util.getPos(selectedPoint[0].object.geometry.attributes.position.array, selectedPoint[0].index);
        var dVec = util.difference(destPos, sourcePos);
        for (var index = 0; index < positions.array.length; ) {
            positions.array[index++] += dVec[0];
            positions.array[index++] += dVec[1];
            positions.array[index++] += dVec[2];
        }
        positions.needsUpdate = true;
        history.push("new", positions.array, laneNum);
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
            lanes = [],
            endPositions = [];
        for (var pointKey in selectedPositions) {
            pointKeySplit = pointKey.split("_");
            lanes.push(pointKeySplit[0]);
            endPositions.push(selectedPositions[pointKey]);
            positionArrs.push($scope.pointClouds.lanes[pointKeySplit[0]].geometry.attributes.position);
        }
        var fillPositions = util.interpolate(endPositions[0], endPositions[1]);
        // interpolate
        var lenNewPositions = positionArrs[0].array.length + fillPositions.length + positionArrs[1].array.length;
        var newPositions = new Float32Array(lenNewPositions);
        newPositions.set(positionArrs[0].array, 0);
        newPositions.set(fillPositions, positionArrs[0].array.length);
        newPositions.set(positionArrs[1].array, positionArrs[0].array.length + fillPositions.length);
        // delete second lane
        history.push("delete", positionArrs[1].array, lanes[1]);
        deleteLane(lanes[1]);
        // modify first lane
        var positions = positionArrs[0];
        var colors = $scope.pointClouds.lanes[lanes[0]].geometry.attributes.color;
        updateLane(lanes[0], positions, colors, newPositions);

        history.push("join", positions.array, lanes[0]);
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
            history.push("delete", positions.array, selectedLane);
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
        for (var index = 0; index < positions.length/3; index++) {
            if (index in selectedPositions) continue;
            if (positions.array[3*index+selectedPositionsDir] < positions.array[3*boundaryIndex+selectedPositionsDir]) {
                oldPositions[lenOldPositions++] = positions.array[3*index];
                oldPositions[lenOldPositions++] = positions.array[3*index+1];
                oldPositions[lenOldPositions++] = positions.array[3*index+2];
            } else {
                newPositions[lenNewPositions++] = positions.array[3*index];
                newPositions[lenNewPositions++] = positions.array[3*index+1];
                newPositions[lenNewPositions++] = positions.array[3*index+2];
            }
        }
        // Create new lane
        var laneNum = newLaneNum();
        var subNewPositions = newPositions.subarray(0,lenNewPositions);
        newLane(laneNum, subNewPositions);
        history.push("new_split", subNewPositions, laneNum);
        // truncate old lane
        var positionsArray = new Float32Array(oldPositions.subarray(0,lenOldPositions));
        updateLane(action.laneNum, positions, colors, positionsArray);

        //TODO edge case where newLane is empty
        history.push("split", positions.array, action.laneNum);
        selectedPoint = [null, null];
        selectedPositions = {};
    }

    function findNearestEndpoint(laneNum, pointPos, range) {
        var findNearest = $scope.kdtrees["lane"+laneNum].nearest;
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
        updateLane(laneNum, positions, colors, newPositions);
        history.push("append", positions.array, laneNum);

        // select last point for next append
        var nearestPoints = $scope.kdtrees["lane"+laneNum].nearest(endPos, 1, util.INTERPOLATE_STEP);
        if (nearestPoints.length === 0) return;
        selectPoint(laneNum, nearestPoints[0][0].pos);
    }

    function forkLane(endPos) {
        var positions = selectedPoint[0].object.geometry.attributes.position;
        var startPos = util.getPos(positions.array, selectedPoint[0].index);
        var fillPositions = util.interpolate(startPos, endPos);

        var newPositions = new Float32Array(fillPositions);
        var laneNum = newLaneNum();
        newLane(laneNum, newPositions);
        history.push("fork", newPositions, laneNum);

        // select end point for next append
        deselectPoints(action.laneNum);
        var nearestPoints = $scope.kdtrees["lane"+laneNum].nearest(endPos, 1, util.INTERPOLATE_STEP);
        if (nearestPoints.length === 0) return;
        selectPoint(laneNum, nearestPoints[0][0].pos);
        action = {
            laneNum: laneNum,
            type: "append"
        };
    }

    function undo() {
        action.type = "";
        try {
            history.undo(function(action, arrayBuffer, laneNum) {
                if (action == "new" || action == "new_split" || action == "fork") {
                    deleteLane(laneNum);
                    return;
                } else if (action == "delete") {
                    newLane(laneNum, arrayBuffer);
                    return;
                }
                var positions = $scope.geometries["lane"+laneNum].attributes.position;
                var colors = $scope.geometries["lane"+laneNum].attributes.color;
                var positionsArray = new Float32Array(arrayBuffer);
                updateLane(laneNum, positions, colors, positionsArray);
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
            history.redo(function(laneNum, action, arrayBuffer) {
                if (action == "new" || action == "new_split" || action == "fork") {
                    newLane(laneNum, arrayBuffer);
                    if (action == "new_split") redo();
                    //TODO if next is delete:
                    return;
                } else if (action == "delete") {
                    deleteLane(laneNum);
                    redo();
                    return;
                }
                var positions = $scope.geometries["lane"+laneNum].attributes.position;
                var colors = $scope.geometries["lane"+laneNum].attributes.color;
                var positionsArray = new Float32Array(arrayBuffer);
                updateLane(laneNum, positions, colors, positionsArray);
            });
        } catch (e) {
            $scope.log(e.message);
        }
    }

    return {
        initLane: initLane,
        init: init,
        undo: undo,
        redo: redo,
        save: save,
        isKeyDownDisabled: isKeyDownDisabled
    };
});
