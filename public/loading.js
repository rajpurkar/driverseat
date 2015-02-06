myApp.
factory('loading', function($http, util) {

    function init(scope) {
        $scope = scope;
        $scope.debugText = "Loading...";
    }

    function loaders(cb) {
        async.parallel({
            pointCloud: function(callback){
                JSZipUtils.getBinaryContent($scope.trackInfo.files.points, function(err, data) {
                    if(err) throw err; // or handle err
                    var loader = util.loadDataFromZip;
                    var points = JSON.parse(loader(data, "map.json"));
                    $scope.pointClouds.points = $scope.generatePointCloud("points", points, $scope.LIDAR_POINT_SIZE);
                    $scope.scene.add($scope.pointClouds.points);
                    callback(null, 'map_load');
                });
            },
            gps: function(callback){
                JSZipUtils.getBinaryContent($scope.trackInfo.files.gps, function(err, data) {
                    if(err) throw err; // or handle err
                    var loader = util.loadDataFromZip;
                    $scope.gps = JSON.parse(loader(data, "gps.json"));
                    callback(null, 'gps_load');
                });
            },
            lanes: function(callback){
                JSZipUtils.getBinaryContent($scope.trackInfo.files.lanes, function(err, gzipped_data) {
                    if (err) throw err; // or handle err
                    var loader = util.loadDataFromZip;
                    var data;
                    //TODO: fix lanes_done.json.zip to contain only lanes.json
                    try {
                        data = JSON.parse(loader(gzipped_data, "lanes.json"));
                    } catch (e) {
                        data = JSON.parse(loader(gzipped_data, "lanes_done.json"));
                    }
                    $scope.pointClouds.lanes = {};
                    for (var lane in data) {
                        var color = util.generateRGB(lane);
                        var laneCloud = $scope.generatePointCloud("lane"+lane, data[lane], $scope.LANE_POINT_SIZE, color);
                        $scope.scene.add(laneCloud);
                        $scope.pointClouds.lanes[lane] = laneCloud;
                        var positions = laneCloud.geometry.attributes.position.array;
                        $scope.kdtrees["lane"+lane] = new THREE.TypedArrayUtils.Kdtree(positions, util.distance, 3);
                    }
                    callback(null, 3);
                });
            },
            planes: function(callback){
                JSZipUtils.getBinaryContent($scope.trackInfo.files.planes, function(err, gzipped_data) {
                    if(err) throw err; // or handle err
                    var loader = util.loadDataFromZip;
                    var data = JSON.parse(loader(gzipped_data, "planes.json"));
                    $scope.addPlanes(data);
                    callback(null, 4);
                });
            },
            car: function(callback){
                $scope.addCar(function(geometry, materials){
                    callback(null, 5);
                });
            },
            video: function(callback) {
                var cb_fn = function() {
                    callback(null, "video_init");
                };
                $scope.video = new
                    VideoNACL($scope.trackInfo.files.video,
                            "video_nacl",
                            "videoPlayerWrap",
                            cb_fn);
            },
            radar: function(callback){
                JSZipUtils.getBinaryContent($scope.trackInfo.files.radar, function(err, gzipped_data) {
                    if(err) throw err; // or handle err
                    var loader = util.loadDataFromZip;
                    var data = JSON.parse(loader(gzipped_data, "radar.json"));
                    $scope.radarData = data;
                    callback(null, "radar_init");
                });
            },
            carDetection: function(callback) {
                util.loadJSON(
                    $scope.trackInfo.files.carDetection,
                    function(data) {
                        $scope.carDetectionData = data;
                        callback(null, "car_detection_init");
                    },
                    function(data) {
                        console.log("Cannot open car detection file: " + $scope.trackInfo.files.carDetection);
                        callback(null, "car_detection_init");
                    });
            },
            carDetectionVerified: function(callback) {
                util.loadJSON(
                    $scope.trackInfo.files.carDetectionVerified,
                    function(data) {
                        $scope.carDetectionVerifiedData = data;
                        callback(null, "car_detection_verified_init");
                    },
                    function(data) {
                        console.log("Cannot open car detection verified file: " + $scope.trackInfo.files.carDetectionVerified);
                        callback(null, "car_detection_verified_init");
                    });
            },
            params: function(callback) {
                util.loadJSON($scope.trackInfo.files.params, function(data) {
                    $scope.params = data;
                    callback(null, "params");
                });
            }
        },
        function(err, results) {
            cb();
        });
    }

    return {
        init: init,
        loaders: loaders
    };
});
