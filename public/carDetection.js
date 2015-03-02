myApp.
service('carDetection', function(util) {
    var MAX_NUM_CANVAS_BOXES = 64;
    var CAR_DETECTION_VERIFIED_FRAME_MULTIPLIER = 4;
    var canvasBoxes = [];
    var carDetectionData;
    var carDetectionVerifiedData;
    var precisionRecallData;
    var scene;
    var videoProjectionParams;

    function initializeCanvasBoxes() {
        for (var i = 0; i < MAX_NUM_CANVAS_BOXES; i++) {
            var geometry = new THREE.BoxGeometry(2, 1, 3);
            var material = new THREE.MeshBasicMaterial( {color: 0x0000ff} );
            var canvasBox = new THREE.Mesh( geometry, material );
            canvasBoxes.push(canvasBox);
            scene.add(canvasBox);
        }
    }

    /**
     * Compiles a vector of x, y, z coordinates of the carDetection boxes in the canvas.
     */
    function getCarDetectionBoxLocations(carDetectionFrameData, imuLocationT) {
        var carDetectionBoxLocations = []
        for (var i = 0; i < carDetectionFrameData.length; i++) {
            var rect = carDetectionFrameData[i].rect;
            var depth = carDetectionFrameData[i].depth;
            var width = rect[2];
            var height = rect[3];
            var u = rect[0];
            var v = rect[1];
            carDetectionBoxLocations.push(depth * (u + width / 2));
            carDetectionBoxLocations.push(depth * (v + height / 2));
            carDetectionBoxLocations.push(depth);
        }
        var projectionMatrix = getProjectionMatrix(imuLocationT);
        projectionMatrix.applyToVector3Array(carDetectionBoxLocations);
        return carDetectionBoxLocations;
    }

    function drawCameraCarDetectionBox(ctx, carDetectionBoxFrameData, color) {
        var rect = carDetectionBoxFrameData.rect;
        var x = rect[0];
        var y = rect[1];
        var width = rect[2];
        var height = rect[3];

        // Camera view is 1/4 the size of the canvas view
        ctx.strokeStyle = color;
        ctx.strokeRect(x / 4, y / 4, width / 4, height / 4);
    }

    function drawCanvasCarDetectionBox(index, carDetectionBoxLocations) {
        // TODO(rchengyue): Figure out why canvas carDetection boxes are a little off.
        var canvasBox = canvasBoxes[index];
        canvasBox.position.x = carDetectionBoxLocations[3 * index];
        canvasBox.position.y = carDetectionBoxLocations[3 * index + 1];
        canvasBox.position.z = carDetectionBoxLocations[3 * index + 2];
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
        init: function(data, verifiedData, precisionAndRecall, vpParams, scn) {
            carDetectionData = data;
            carDetectionVerifiedData = verifiedData;
            precisionAndRecallData = precisionAndRecall;
            videoProjectionParams = vpParams;
            scene = scn;
            // TODO(rchengyue): Make separate sets of canvas boxes for detected and verified
            // if verified data has depth fields
            initializeCanvasBoxes();
        },
        drawCarDetectionBoxes: function(canvasId, frameNum, imuLocationT) {
            if (carDetectionData && frameNum < carDetectionData.length) {
                var c = document.getElementById(canvasId);
                var ctx = c.getContext("2d");
                var carDetectionFrameData = carDetectionData[frameNum];
                var carDetectionBoxLocations = getCarDetectionBoxLocations(carDetectionFrameData, imuLocationT);
                var index = 0;

                for (; index < carDetectionFrameData.length; index++) {
                    drawCameraCarDetectionBox(ctx, carDetectionFrameData[index], "blue");
                    drawCanvasCarDetectionBox(index, carDetectionBoxLocations);
                }

                resetCanvasBoxes(index);
                return true;
            }
        },
        drawCarDetectionVerifiedBoxes: function(canvasId, frameNum, imuLocationT) {
            // TODO(rchengyue): Consider making a helper method
            // if verified data contains depth fields to draw canvas canvasBoxes
            if (carDetectionVerifiedData && frameNum < carDetectionVerifiedData.length) {
                var c = document.getElementById(canvasId);
                var ctx = c.getContext("2d");
                // Multiple frame number by 4 since bbs-cam2-verified.json is about
                // four times the length of bbs-cam2.json
                var carDetectionVerifiedFrameData =
                    carDetectionVerifiedData[frameNum * CAR_DETECTION_VERIFIED_FRAME_MULTIPLIER];

                for (var index = 0; index < carDetectionVerifiedFrameData.length; index++) {
                    drawCameraCarDetectionBox(ctx, carDetectionVerifiedFrameData[index], "green");
                }

                return true;
            }
        },
        displayPrecisionAndRecall: function() {
            var precisionElement = document.getElementById("precision");
            var recallElement = document.getElementById("recall");
            if (precisionAndRecallData) {
                precisionElement.innerHTML = precisionAndRecallData.precision;
                recallElement.innerHTML = precisionAndRecallData.recall;
            } else {
                precisionElement.innerHTML = "N/A";
                recallElement.innerHTML = "N/A";
            }
        }
    };
});
