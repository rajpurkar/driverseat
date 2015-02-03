myApp.
service('boundingBoxes', function(util) {
    var boundingBoxesData;
    var params;
    var scene;
    var cubes;

    // TODO(rchengyue): Centralize method (same as method in radar.js).
    function create_T_from_r_to_l() {
        var R_from_r_to_l = util.Matrix4FromJSON3x3(params.radar.R_from_r_to_l);
        var trans = params.radar.T_from_r_to_l;
        var T = new THREE.Matrix4();
        T.makeTranslation(trans[0], trans[1], trans[2]);
        T.multiplyMatrices(R_from_r_to_l, T);
        return T;
    }

    function get_T(imu_loc_t, p) {
        console.log("BLAH imu_loc_t: " + imu_loc_t);
        console.log("BLAH p: " + p);
        var T_imu_0_to_THREE = p.T_imu_0_to_THREE;
        var T_from_l_to_i = p.T_from_l_to_i;
        var T_imu_t_to_imu_0 = util.Matrix4FromJSON4x4(imu_loc_t);
        var T_from_c_to_l = new THREE.Matrix4();
        T_from_c_to_l.getInverse(p.T_from_l_to_c);
        var inv_T_Extrinsics = new THREE.Matrix4();
        inv_T_Extrinsics.getInverse(p.T_Extrinsics);
        var inv_KK = new THREE.Matrix4();
        inv_KK.getInverse(p.KK);

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

    return {
        init: function(data, calibration_params, scn) {
            boundingBoxesData = data;
            params = calibration_params;
            scene = scn;
            cubes = [];

            for (var i = 0; i < 64; i++) {
                var geometry = new THREE.BoxGeometry(2, 3, 1); // width, height, depth; set x, y, z later
                var material = new THREE.MeshBasicMaterial( {color: 0xff0000} );
                var cube = new THREE.Mesh( geometry, material );
                cubes.push(cube);
                scene.add(cube);
            }
        },
        drawBoundingBoxes: function(canvasId, frameNum, imu_loc_t, p) {
            if (boundingBoxesData && frameNum < boundingBoxesData.length) {
                var c = document.getElementById(canvasId);
                var ctx = c.getContext("2d");

                var boxes = boundingBoxesData[frameNum];
                for (var i = 0; i < boxes.length; i++) {
                    var rect = boxes[i].rect;
                    var depth = boxes[i].depth;
                    var x = rect[0];
                    var y = rect[1];
                    var width = rect[2];
                    var height = rect[3];
                    var box = cubes[i];

                    var locations = [x * depth, y * depth, depth];

                    var T = get_T(imu_loc_t, p);
                    console.log("BLAH T: " + T);

                    T.applyToVector3Array(locations);

                    box.position.x = locations[0];
                    box.position.y = locations[1];
                    box.position.z = locations[2];
                    box.lookAt($scope.getCarCurPosition());
                    box.updateMatrix();

                    ctx.rect(x/4, y/4, width/4, height/4);
                    ctx.stroke();
                }
                return true;
            }
        },
    };
});
