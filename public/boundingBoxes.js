myApp.
service('boundingBoxes', function(util) {
    var canvasBoxes = [];
    var MAX_NUM_CANVAS_BOXES = 64;
    var boundingBoxesData;
    var scene;
    var videoProjectionParams;

    function initializeBoxes() {
        for (var i = 0; i < MAX_NUM_CANVAS_BOXES; i++) {
            var geometry = new THREE.BoxGeometry(2, 1, 3);
            var material = new THREE.MeshBasicMaterial( {color: 0x0000ff} );
            var canvasBox = new THREE.Mesh( geometry, material );
            canvasBoxes.push(canvasBox);
            scene.add(canvasBox);
        }
    }

    /**
     * Compiles a vector of x, y, z coordinates of the bounding boxes in the canvas.
     */
    function getBoundingBoxLocations(boundingBoxesFrameData, imuLocationT) {
        var boundingBoxLocations = []
        for (var i = 0; i < boundingBoxesFrameData.length; i++) {
            var rect = boundingBoxesFrameData[i].rect;
            var depth = boundingBoxesFrameData[i].depth;
            var u = rect[0];
            var v = rect[1];
            boundingBoxLocations.push(depth * u);
            boundingBoxLocations.push(depth * v);
            boundingBoxLocations.push(depth);
        }
        var projectionMatrix = getProjectionMatrix(imuLocationT);
        projectionMatrix.applyToVector3Array(boundingBoxLocations);
        return boundingBoxLocations;
    }

    function drawCameraBoundingBox(ctx, boundingBoxFrameData) {
        var rect = boundingBoxFrameData.rect;
        var x = rect[0];
        var y = rect[1];
        var width = rect[2];
        var height = rect[3];

        // Camera view is 1/4 the size of the canvas view
        ctx.rect(x / 4, y / 4, width / 4, height / 4);
        ctx.stroke();
    }

    function drawCanvasBoundingBox(index, boundingBoxLocations) {
        // TODO(rchengyue): Figure out why canvas bounding boxes are a little off.
        var canvasBox = canvasBoxes[index];
        canvasBox.position.x = boundingBoxLocations[3 * index];
        canvasBox.position.y = boundingBoxLocations[3 * index + 1];
        canvasBox.position.z = boundingBoxLocations[3 * index + 2];
        canvasBox.lookAt($scope.getCarCurPosition());
        canvasBox.updateMatrix();
    }

    function getProjectionMatrix(imuLocationT) {
        var T_imu_0_to_THREE = videoProjectionParams.T_imu_0_to_THREE;
        var T_from_l_to_i = videoProjectionParams.T_from_l_to_i;
        var T_imu_t_to_imu_0 = util.Matrix4FromJSON4x4(imuLocationT);

        var T_from_c_to_l = new THREE.Matrix4();
        T_from_c_to_l.getInverse(videoProjectionParams.T_from_l_to_c);

        var inv_T_Extrinsics = new THREE.Matrix4();
        inv_T_Extrinsics.getInverse(videoProjectionParams.T_Extrinsics);

        var inv_KK = new THREE.Matrix4();
        inv_KK.getInverse(videoProjectionParams.KK);

        //read this bottom up to follow the order of transformations
        var T = new THREE.Matrix4();
        T.multiply(T_imu_0_to_THREE);// imu_0 -> THREE js frame
        T.multiply(T_imu_t_to_imu_0); //imu_t -> imu_0
        T.multiply(T_from_l_to_i); // lidar_t -> imu_t
        T.multiply(T_from_c_to_l); // camera_t -> lidar_t
        T.multiply(inv_T_Extrinsics); // camera extrinsics
        T.multiply(inv_KK);// camera intrinsics
        return T;
    }

    /**
     * Reset all canvas boxes after the specified index.
     * Used to clear out any remaining boxes from previous frame counts.
     */
    function resetCanvasBoxes(resetIndex) {
        for (; resetIndex < MAX_NUM_CANVAS_BOXES; resetIndex++) {
            var canvasBox = canvasBoxes[resetIndex];
            canvasBox.position.x = -100000;
            canvasBox.position.y = 1000000;
            canvasBox.position.z = 1000000;
        }
    }

    return {
        init: function(data, vpParams, scn) {
            boundingBoxesData = data;
            videoProjectionParams = vpParams;
            scene = scn;
            initializeBoxes();
        },
        drawBoundingBoxes: function(canvasId, frameNum, imuLocationT) {
            if (boundingBoxesData && frameNum < boundingBoxesData.length) {
                var c = document.getElementById(canvasId);
                var ctx = c.getContext("2d");
                var boundingBoxesFrameData = boundingBoxesData[frameNum];
                var boundingBoxLocations = getBoundingBoxLocations(boundingBoxesFrameData, imuLocationT);
                var index = 0;

                for (; index < boundingBoxesFrameData.length; index++) {
                    drawCameraBoundingBox(ctx, boundingBoxesFrameData[index]);
                    drawCanvasBoundingBox(index, boundingBoxLocations);
                }

                resetCanvasBoxes(index);
                return true;
            }
        },
    };
});
