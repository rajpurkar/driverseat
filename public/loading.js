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
                    var data = JSON.parse(loader(gzipped_data, "lanes.json"));
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
                /*
                var player_onload = function(player) {
                    video.init(player);
                    callback(null, 'video_init');
                }
                var canvas = document.getElementById('projectionCanvas');
                jsmpeg_video = new jsmpeg($scope.trackInfo.files.video, {onload:player_onload, forceCanvas2D: true});
                */
                JSZipUtils.getBinaryContent($scope.trackInfo.files.video, function(err, data) {
                    if(err) {
                        throw err; // or handle err
                    }
                    $scope.videoData = data;
                    callback(null, 'video_init');
                });
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
            boundingBoxes: function(callback) {
                util.loadJSON(
                    $scope.trackInfo.files.boundingBoxes,
                    function(data) {
                        $scope.boundingBoxData = data;
                        callback(null, "bounding_boxes_init");
                    },
                    function(data) {
                        console.log("Cannot open bounding boxes file: " + $scope.trackInfo.files.boundingBoxes);
                        callback(null, "bounding_boxes_init");
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
