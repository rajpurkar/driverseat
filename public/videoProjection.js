myApp.
service('videoProjection', function(util) {

    var T_THREE_to_imu_0 = new THREE.Matrix4();
    var T_from_l_to_i = new THREE.Matrix4();
    var T_from_i_to_l = new THREE.Matrix4();
    var T_from_l_to_c = new THREE.Matrix4();
    var params;
    var cam_idx = 1;
    var KK;

    function CameraIntrinsics(c) { 
        return new THREE.Matrix4(
            c.fx, 0, c.cu, 0,
            0, c.fy, c.cv, 0,
            0,    0,    1, 0,
            0,    0,    0, 1
        );
    }

    function create_R_from_l_to_c(cam) {
        var coordinate_change = new THREE.Matrix4(
                0, -1,  0, 0,
                0,  0, -1, 0,
                1,  0,  0, 0,
                0,  0,  0, 1);
        coordinate_change.multiplyMatrices(util.Matrix4FromJSON3x3(cam.R_to_c_from_l_in_camera_frame), coordinate_change);
        return coordinate_change;
    }

    function create_T_from_l_to_c(cam) { 
        var R_from_l_to_c = create_R_from_l_to_c(cam);
        var trans = cam.displacement_from_l_to_c_in_lidar_frame;
        var T = new THREE.Matrix4(); 
        T.makeTranslation(trans[0], trans[1], trans[2]); 
        T.multiplyMatrices(R_from_l_to_c, T);
        return T; 
    }

	return {
		init: function(calibration_params) {
            T_imu_0_to_THREE = new THREE.Matrix4(
                0, 1, 0, 0,
                0, 0, 1, 0,
                1, 0, 0, 0,
                0, 0, 0, 1);

            T_THREE_to_imu_0 = new THREE.Matrix4();
            T_THREE_to_imu_0.getInverse(T_imu_0_to_THREE);
            params = calibration_params;
            var cam = params.cam[cam_idx];
            KK = CameraIntrinsics(cam);
            T_from_l_to_i = util.Matrix4FromJSON4x4(params.lidar.T_from_l_to_i);
            T_from_i_to_l.getInverse(T_from_l_to_i);
            T_from_l_to_c = create_T_from_l_to_c(cam);
		},
        projectPoints: function(canvasId, cloud, imu_loc_t) {
            var data = cloud.geometry.attributes.position.array;
            var color_data = cloud.geometry.attributes.color.array;
           
            var imu_transforms_t = util.Matrix4FromJSON4x4(imu_loc_t);
            var inv_imu_transforms_t = new THREE.Matrix4();
            inv_imu_transforms_t.getInverse(imu_transforms_t);
            
            var T = new THREE.Matrix4(); 
            // read this backwards
            T.multiply(KK); // camera intrinsics
            T.multiply(T_from_l_to_c); // lidar_t -> camera_t
            T.multiply(T_from_i_to_l); // imu_t -> lidar_t
            T.multiply(inv_imu_transforms_t); // imu_0 -> imu_t
            T.multiply(T_THREE_to_imu_0); // from THREE_JS frame to imu_0
            var M = T.elements;
            var c = document.getElementById(canvasId);
            var ctx = c.getContext("2d");

            var scaling = 4;
            for (var idx = 0; idx < data.length/3; idx+=3) {
                var x = data[3*idx+0];
                var y = data[3*idx+1];
                var z = data[3*idx+2];

                var u = M[0]*x + M[4]*y + M[8]*z + M[12];
                var v = M[1]*x + M[5]*y + M[9]*z + M[13];
                var s = M[2]*x + M[6]*y + M[10]*z + M[14];

                var px = u/(s*scaling);
                var py = v/(s*scaling);

                if (px > 0 && py > 0 && px < c.width && py < c.height && s > 0 && s < 100) {
                    var r = parseInt(color_data[3*idx+0]*255);
                    var g = parseInt(color_data[3*idx+1]*255);
                    var b = parseInt(color_data[3*idx+2]*255);
                    var a = 255;
                    ctx.fillStyle = "rgba("+r+","+g+","+b+","+(a/255)+")";
                    ctx.fillRect(px, py, 2, 2);
                }
            }
            
        },
	};
});
