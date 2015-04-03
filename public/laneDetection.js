myApp.
service('laneDetection', function(util) {
    var laneColors = ["#499DF5", "#BCD2EE", "#6D9BF1", "#4876FF", "#00009C", "#0000EE", "#4D4DFF"];
    var laneDetectionData;
    var videoProjectionParamsFromCamera0;
    var videoProjectionParamsFromCamera1;
    var cameraProjectionMatrix;
    var scene;

    // TODO(rchengyue): Create general class to calculate projection points
    function getCameraProjectionMatrix() {
        var KK = videoProjectionParamsFromCamera1.KK;
        var inv_T_Extrinsics = new THREE.Matrix4();
        inv_T_Extrinsics.getInverse(videoProjectionParamsFromCamera0.T_Extrinsics);

        var T = new THREE.Matrix4();
        T.multiply(KK);
        T.multiply(inv_T_Extrinsics);
        return T;
    }

    function getCanvasProjectionMatrix(imuLocationT) {
        var T_imu_0_to_THREE = videoProjectionParamsFromCamera1.T_imu_0_to_THREE;
        var T_imu_t_to_imu_0 = util.Matrix4FromJSON4x4(imuLocationT);
        var T_from_l_to_i = videoProjectionParamsFromCamera1.T_from_l_to_i;
        var T_from_c_to_l = new THREE.Matrix4();
        T_from_c_to_l.getInverse(videoProjectionParamsFromCamera1.T_from_l_to_c);
        var inv_T_Extrinsics = new THREE.Matrix4();
        inv_T_Extrinsics.getInverse(videoProjectionParamsFromCamera0.T_Extrinsics);

        // read this bottom up to follow the order of transformations
        var T = new THREE.Matrix4();
        T.multiply(T_imu_0_to_THREE); // imu_0 -> THREE js frame
        T.multiply(T_imu_t_to_imu_0); //imu_t -> imu_0
        T.multiply(T_from_l_to_i); // lidar_t -> imu_t
        T.multiply(T_from_c_to_l); // camera_t -> lidar_t
        T.multiply(inv_T_Extrinsics); // camera extrinsics
        return T;
    }

    function getLaneDetectionPoints(laneDetectionFrameData, projectionMatrix) {
        var laneDetectionPoints = [];
        for (var laneIndex = 0; laneIndex < laneDetectionFrameData.length; laneIndex++) {
            laneDetectionLanePoints = [];
            for (var pointIndex = 0; pointIndex < laneDetectionFrameData[laneIndex].length; pointIndex++) {
                var point = laneDetectionFrameData[laneIndex][pointIndex];
                var x = point[0];
                var y = point[1];
                var z = point[2];
                laneDetectionLanePoints.push(x);
                laneDetectionLanePoints.push(y);
                laneDetectionLanePoints.push(z);
            }
            projectionMatrix.applyToVector3Array(laneDetectionLanePoints);
            laneDetectionPoints.push(laneDetectionLanePoints);
        }
        return laneDetectionPoints;
    }

    function getCameraLaneDetectionPoints(laneDetectionFrameData) {
        return getLaneDetectionPoints(laneDetectionFrameData, cameraProjectionMatrix);
    }

    function getCanvasLaneDetectionPoints(laneDetectionFrameData, imuLocationT) {
        var canvasProjectionMatrix = getCanvasProjectionMatrix(imuLocationT);
        return getLaneDetectionPoints(laneDetectionFrameData, canvasProjectionMatrix);
    }

    function drawCameraLaneDetectionPoint(ctx, laneDetectionPoint, color) {
        var x = laneDetectionPoint[0];
        var y = laneDetectionPoint[1];
        var z = laneDetectionPoint[2];

        // Camera view is 1/4 the size of the canvas view
        ctx.fillStyle = color;
        var cameraX = x / (4 * z);
        var cameraY = y / (4 * z);
        ctx.fillRect(cameraX, cameraY, 2, 2);
    }

    function drawCanvasLaneDetectionPoint(laneDetectionPoints) {
        var positions = new Float32Array(laneDetectionPoints.length);
        var colors = new Float32Array(laneDetectionPoints.length);
        for (var pointIndex = 0; pointIndex < laneDetectionPoints.length; pointIndex += 3) {
            positions[pointIndex] = laneDetectionPoints[pointIndex];
            positions[pointIndex + 1] = laneDetectionPoints[pointIndex + 1];
            positions[pointIndex + 2] = laneDetectionPoints[pointIndex + 2];
            colors[pointIndex] = 0;
            colors[pointIndex + 1] = 0;
            colors[pointIndex + 2] = 1;
        }

        var geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
        var material = new THREE.PointCloudMaterial({
            size: 0.05,
            vertexColors: true
        });
        pointCloud = new THREE.PointCloud(geometry, material);
        scene.add(pointCloud);
    }

    return {
        init: function(data, vpParamsFromCamera0, vpParamsFromCamera1, scn) {
            laneDetectionData = data;
            videoProjectionParamsFromCamera0 = vpParamsFromCamera0;
            videoProjectionParamsFromCamera1 = vpParamsFromCamera1;
            cameraProjectionMatrix = getCameraProjectionMatrix();
            scene = scn;
        },
        drawLaneDetectionPoints: function(canvasId, frameNum, imuLocationT) {
            if (laneDetectionData) {
                var laneDetectionLanesData = laneDetectionData['Lanes'];
                if (laneDetectionData && frameNum < laneDetectionLanesData.length) {
                    var c = document.getElementById(canvasId);
                    var ctx = c.getContext("2d");
                    var laneDetectionFrameData = laneDetectionLanesData[frameNum];

                    // TODO(rchengyue): Refactor out camera and canvas methods (have separate class for projection type).

                    var cameraLaneDetectionPoints = getCameraLaneDetectionPoints(laneDetectionFrameData);
                    var canvasLaneDetectionPoints = getCanvasLaneDetectionPoints(laneDetectionFrameData, imuLocationT);

                    for (var laneIndex = 0; laneIndex < cameraLaneDetectionPoints.length; laneIndex++) {
                        var cameraLaneDetectionLanePoints = cameraLaneDetectionPoints[laneIndex];
                        for (var pointIndex = 0; pointIndex < cameraLaneDetectionLanePoints.length; pointIndex += 3) {
                            drawCameraLaneDetectionPoint(
                                ctx,
                                cameraLaneDetectionLanePoints.slice(pointIndex, pointIndex + 3),
                                laneColors[laneIndex % laneColors.length]);
                        }
                    }

                    for (var laneIndex = 0; laneIndex < canvasLaneDetectionPoints.length; laneIndex++) {
                        var canvasLaneDetectionLanePoints = canvasLaneDetectionPoints[laneIndex];
                        drawCanvasLaneDetectionPoint(canvasLaneDetectionLanePoints);
                    }
                }
            }
        }
    };
});