 myApp.
service('radar', function(util) {

    var boxes = [ ];
    var scene; 
    var lastFrameNum = -1;
    var MAX_NUMBER_RADAR_OBJECTS = 64;
    var log; 
    var params;
    var T_from_r_to_l, T_from_l_to_i, T_imu_0_to_THREE;

    function create_T_from_r_to_l() {
        var R_from_r_to_l = util.Matrix4FromJSON3x3(params.radar.R_from_r_to_l);
        var trans = params.radar.T_from_r_to_l; 
        var T = new THREE.Matrix4(); 
        T.makeTranslation(trans[0], trans[1], trans[2]); 
        T.multiplyMatrices(R_from_r_to_l, T);
        return T; 
    }

    function setRadarObjectPosition(obj, x, y, z) {
        obj.position.x = x;
        obj.position.y = y;
        obj.position.z = z;
        obj.lookAt($scope.getCarCurPosition());
        obj.updateMatrix();
    }

	return {
		init: function(radar_log, calibration_params, scn) {
            log = radar_log;
            params = calibration_params;
            scene = scn;

            for (var idx = 0; idx < MAX_NUMBER_RADAR_OBJECTS; idx++) {
                var geometry = new THREE.BoxGeometry(2,1,3);
                var material = new THREE.MeshBasicMaterial( {color: 0xdddddd} );
                var cube = new THREE.Mesh( geometry, material );
                boxes.push(cube);
                scene.add(cube);
            }
            T_from_r_to_l = create_T_from_r_to_l(); 
            T_from_l_to_i = util.Matrix4FromJSON4x4(params.lidar.T_from_l_to_i);
            T_imu_0_to_THREE = new THREE.Matrix4(
                0, 1, 0, 0,
                0, 0, 1, 0,
                1, 0, 0, 0,
                0, 0, 0, 1);
	    },
        displayReturns: function(framenum, imu_loc_t) {

            if (framenum == lastFrameNum) return; 

            var returns; 
            for (var timestamp in log[framenum])
                returns = log[framenum][timestamp];
            var locations = [];
            for (var idx in returns.O) {
                var data = returns.O[idx];
                if (data[5] > 5 && data[6] > -20) {
                    locations.push(data[0]);
                    locations.push(data[1]);
                    locations.push(data[2]);
                }
            }

            var T_imu_t_to_imu_0 = util.Matrix4FromJSON4x4(imu_loc_t);
            //read this bottom up to follow the order of transformations
            var T = new THREE.Matrix4();
            T.multiply(T_imu_0_to_THREE);// imu_0 -> THREE js frame
            T.multiply(T_imu_t_to_imu_0); //imu_t -> imu_0
            T.multiply(T_from_l_to_i); // lidar_t -> imu_t
            T.multiply(T_from_r_to_l); // radar_t -> lidar_t

            T.applyToVector3Array(locations);

            for (var i = 0; i < MAX_NUMBER_RADAR_OBJECTS; i++) {
                if (3*i < locations.length) {
                    setRadarObjectPosition(
                            boxes[i],
                            locations[3*i+0],
                            locations[3*i+1],
                            locations[3*i+2]);
                }
                else {
                    setRadarObjectPosition(boxes[i],
                            -100000, 1000000, 1000000); // in a land, far, far away...
                }
            }
            lastFrameNum = framenum;
        }
    }
});
