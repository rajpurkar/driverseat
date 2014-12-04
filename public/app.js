var myApp = angular.module('roadglApp', ['angular-loading-bar','ngAnimate']);

myApp.
controller('AppCtrl', function($scope, $attrs, $window, $parse, editor, loading, util, key, videoProjection, radar, boundingBoxes, cfpLoadingBar) {
    // constants
    var INITIAL_OFFSET = [0, 5, -14],
        INITIAL_MOUSE  = { x: 1, y: 1 },
        INITIAL_FRAME  = 0;

    // scope variables
    $scope.trackInfo        = JSON.parse($attrs.ngTrackinfo);
    $scope.scene            = null;
    $scope.raycaster        = null;
    $scope.geometries       = {};
    $scope.pointClouds      = {};
    $scope.kdtrees          = {};
    $scope.video            = null;
    //$scope.videoData        = null;
    $scope.radarData        = null;
    $scope.boundingBoxData  = null;
    $scope.datafiles        = null;
    $scope.LANE_POINT_SIZE  = 0.08;
    $scope.LIDAR_POINT_SIZE = 0.12;
    $scope.params           = null;

    // local variables
    var camera, renderer,
        projector,
        controls,
        fpsMeter,
        groundNormals = [],
        mouse = INITIAL_MOUSE,
        windowWidth = $window.innerWidth,
        windowHeight = $window.innerHeight,
        frameCount = INITIAL_FRAME,
        offset = INITIAL_OFFSET,
        car;

    $scope.log = function(message) {
        $scope.logText = message;
        $scope.$apply();
    };

    $scope.setCameraOffset = function(){
        offset[0] = - car.position.x + camera.position.x;
        offset[1] = - car.position.y + camera.position.y;
        offset[2] = - car.position.z + camera.position.z;
    };

    $scope.init = function() {
        fpsMeter = new FPSMeter(document.getElementById("fps"));
        $scope.scene = new THREE.Scene();
        //scene.fog = new THREE.Fog( 0xcce0ff, 500, 10000 );
        camera = new THREE.PerspectiveCamera(75, windowWidth/windowHeight, 0.01, 500);
        projector = new THREE.Projector();
        $scope.raycaster = new THREE.Raycaster();
        var canvas = document.getElementById("road");
        renderer = new THREE.WebGLRenderer({canvas: canvas});
        renderer.setSize(windowWidth, windowHeight);
        //renderer.setClearColor( scene.fog.color );
        controls = new THREE.OrbitControls(camera);
        $scope.log("Loading...");
        cfpLoadingBar.start();
        loading.init($scope);
        loading.loaders($scope.execOnLoaded);
    };

    $scope.addLighting = function(){
        pointLight = new THREE.PointLight( 0xffffff );
        $scope.scene.add( pointLight );
        pointLight.position= car.position;
        pointLight.position.x= car.position.x -5;
        directionalLight = new THREE.DirectionalLight( 0xffffff );
        directionalLight.position.set( 1, 1, 0.5 ).normalize();
        $scope.scene.add( directionalLight );
    };

    $scope.addEventListeners = function(){
        document.addEventListener('mousedown', $scope.rotateCamera, false);
        document.addEventListener('mousemove', $scope.onDocumentMouseMove, false);
        controls.addEventListener('change', $scope.setCameraOffset);
        document.addEventListener('keydown', $scope.onDocumentKeyDown, false);
        window.addEventListener('resize', $scope.onWindowResize, false);
    };

    $scope.execOnLoaded = function(){
        $scope.log("Rendering...");
        //video.init($scope.videoData);
        editor.init($scope);
        radar.init($scope.radarData, $scope.params, $scope.scene);
        $scope.videoProjectionParams = videoProjection.init($scope.params, 1);
        if($scope.boundingBoxData) boundingBoxes.init($scope.boundingBoxData);
        for (var lane in $scope.pointClouds.lanes) {
            editor.initLane(lane);
        }

        key.watchToggle("space");
        $scope.addEventListeners();
        $scope.addLighting();
        $scope.updateCamera(0);
        $scope.animate();
        cfpLoadingBar.complete();
        $scope.log("");
    };

    $scope.rotateCamera = function(event) {
        if (!key.isDown("ctrl")) return;
        controls.onMouseDown(event);
    };


    $scope.onDocumentMouseMove = function(event) {
        mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    };

    $scope.onDocumentKeyDown = function(event) {
        var preventDefault = true;
        switch (event.keyCode) {
            case key.keyMap.space:
                break;
            case key.keyMap.down:
                $scope.carBack();
                break;
            case key.keyMap.up:
                $scope.carForward();
                break;
            default:
                preventDefault = false;
        }
        if (preventDefault) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    $scope.onWindowResize = function() {
        windowWidth = $window.innerWidth;
        windowHeight = $window.innerHeight;

        camera.aspect = windowWidth / windowHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(windowWidth, windowHeight);
    };

    $scope.carForward = function(){
        var numForward = 3;
        if (frameCount + numForward < $scope.gps.length)
            frameCount += numForward;
        $scope.updateCamera(frameCount);
    };

    $scope.carBack = function(){
        var numDecline = 3;
        if(frameCount>=numDecline){
            frameCount-=numDecline;
        }
        $scope.updateCamera(frameCount);
    };

    $scope.getCarPosition = function(frameCount){
        var pos = $scope.gps[frameCount];
        var x = pos[1][3];
        var y = pos[2][3] - 1.1;
        var z = pos[0][3];
        return {x: x, y:y, z:z};
    };

    $scope.updateCamera = function(frameCount) {
        if (frameCount + 1 < $scope.gps.length) {
            var lastCarPosition = new THREE.Vector3(0, 0, 0);
            var pos = $scope.getCarPosition(frameCount);
            angular.extend(car.position, pos);
            car.lookAt($scope.getCarPosition(frameCount + 1));
            camera.position.set(car.position.x + offset[0], car.position.y + offset[1], car.position.z + offset[2]);
            var target = car.position;
            camera.lookAt(target);
            controls.target.copy(target);
            controls.update();
        }
    };

    $scope.updateMouse = function() {
        var mousePosition = new THREE.Vector3(mouse.x, mouse.y, 0.5);
        projector.unprojectVector(mousePosition, camera);
        $scope.raycaster.params = {"PointCloud" : {threshold: 0.3}};
        $scope.raycaster.ray.set(camera.position, mousePosition.sub(camera.position).normalize());
    };

    $scope.animate = function(timestamp) {
        // console.log(timestamp);
        requestAnimationFrame($scope.animate);
        //setTimeout($scope.animate, 2);
        $scope.render();
    };

    $scope.render = function() {
        camera.updateMatrixWorld(true);
        $scope.updateCamera(frameCount);
        if (key.isToggledOn("space")) {
            $scope.updateCamera(frameCount);
            if (frameCount + 1 < $scope.gps.length)
                frameCount += 1;
        }
        var img_disp = $scope.video.displayImage("projectionCanvas", frameCount);
        if (img_disp) {
            for (var idx in $scope.pointClouds.lanes) {
                videoProjection.projectPoints("projectionCanvas", $scope.pointClouds.lanes[idx], $scope.gps[frameCount], $scope.videoProjectionParams);
            }
        } else {
            var canv = document.getElementById("projectionCanvas");
            var ctx = canv.getContext("2d");
            ctx.clearRect(0,0,canv.width, canv.height);
            ctx.fillStyle="blue";
            ctx.fillRect(0,0,canv.width,canv.height);
            ctx.fillStyle="white";
            ctx.font = "bold 20px Arial";
            ctx.textAlign = "center";
            ctx.fillText("Buffering", canv.width/2, canv.height/2);
        }

        //videoProjection.projectPoints("projectionCanvas", $scope.pointClouds.points, $scope.gps[frameCount], $scope.videoProjectionParams);
        radar.displayReturns(frameCount, $scope.gps[frameCount]);
        boundingBoxes.drawBoundingBoxes("projectionCanvas", frameCount);
        fpsMeter.tick();

        renderer.render($scope.scene, camera);
    };

    $scope.fillColor = function(colors, data, r, g, b){
        for (i = 0; i < data.length; i++) {
            colors[3*i+0] = r;
            colors[3*i+1] = g;
            colors[3*i+2] = b;
        }
    };

    $scope.generatePointCloud = function(name, data, size, color) {
        $scope.geometries[name] = new THREE.BufferGeometry();
        var positions, colors;
        var i;
        var dataType = Object.prototype.toString.call(data);
        if (dataType === "[object Float32Array]" || dataType === "[object ArrayBuffer]") {
            positions = new Float32Array(data);
            colors    = new Float32Array(positions.length);
            for (i = 0; i < colors.length; i += 3) {
                colors[i]   = color.r;
                colors[i+1] = color.g;
                colors[i+2] = color.b;
            }
        } else {
            positions = new Float32Array(3*data.length);
            colors    = new Float32Array(3*data.length);
            for (i = 0; i < data.length; i++) {
                //Note: order is changed
                positions[3*i]   = data[i][1];	//x
                positions[3*i+1] = data[i][2];	//y
                positions[3*i+2] = data[i][0];	//z
            }

            if (data[0].length >= 4) {
                $scope.fillColor(colors, data, 0.6, 0.6, 0.6);
            } else if (typeof color === "undefined") {
                $scope.fillColor(colors, data, 1, 1, 1);
            } else {
                $scope.fillColor(colors,data, color.r, color.g, color.b);
            }
        }
        $scope.geometries[name].addAttribute('position', new THREE.BufferAttribute(positions, 3));
        $scope.geometries[name].addAttribute('color', new THREE.BufferAttribute(colors, 3));
        var material = new THREE.PointCloudMaterial({ size: size, vertexColors: true });
        pointCloud = new THREE.PointCloud($scope.geometries[name], material);
        return pointCloud;
    };

    $scope.addCar = function(callback) {
        var camaroMaterials = {
            body: {
                Orange: new THREE.MeshLambertMaterial( {
                    color: 0xff0000,
                combine: THREE.MixOperation,
                reflectivity: 0.3
                } )
            },
            chrome: new THREE.MeshLambertMaterial( {
                color: 0xffffff
            } ),
            darkchrome: new THREE.MeshLambertMaterial( {
                color: 0x444444
            } ),
            glass: new THREE.MeshBasicMaterial( {
                color: 0x223344,
            opacity: 0.25,
            combine: THREE.MixOperation,
            reflectivity: 0.25,
            transparent: true
            } ),
            tire: new THREE.MeshLambertMaterial( {
                color: 0x050505
            } ),
            interior: new THREE.MeshPhongMaterial( {
                color: 0x050505,
            shininess: 20
            } ),
            black: new THREE.MeshLambertMaterial( {
                color: 0x000000
            } )
        };

        var loader = new THREE.BinaryLoader();
        loader.load("/files/CamaroNoUv_bin.js", function(geometry) {
            var materials = camaroMaterials;
            var s = 0.23, m = new THREE.MeshFaceMaterial();
            m.materials[ 0 ] = materials.body.Orange; // car body
            m.materials[ 1 ] = materials.chrome; // wheels chrome
            m.materials[ 2 ] = materials.chrome; // grille chrome
            m.materials[ 3 ] = materials.darkchrome; // door lines
            m.materials[ 4 ] = materials.glass; // windshield
            m.materials[ 5 ] = materials.interior; // interior
            m.materials[ 6 ] = materials.tire; // tire
            m.materials[ 7 ] = materials.black; // tireling
            m.materials[ 8 ] = materials.black; // behind grille

            car = new THREE.Mesh( geometry, m );
            // car.rotation.set( - Math.PI / 2, 0, -Math.PI /2);
            car.scale.set( s, s, s );
            car.position.set( 0, -1.5, 7 );
            // TODO car gets in the way of lane editing
            $scope.scene.add( car );
            callback();
        });
    };

    $scope.addPlanes = function(data) {
        planes = [];
        var groundGeometry = new THREE.Geometry();
        for (var i = 0; i < data.length; i++) {
            var normal = data[i];
            var dz = normal[0],
                dx = normal[1],
                dy = normal[2],
                z = normal[3],
                x = normal[4],
                y = normal[5];
            var origin = new THREE.Vector3(x,y,z),
                direction = new THREE.Vector3(dx,dy,dz),
                end = new THREE.Vector3(x+dx,y+dy,z+dz);
            direction.normalize();
            var plane = new THREE.Plane();
            plane.setFromNormalAndCoplanarPoint(direction, origin);
            var planeGeometry = new THREE.PlaneGeometry(50, 50),
                planeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true });
            plane = new THREE.Mesh(planeGeometry, planeMaterial);
            // groundGeometry.vertices.push()
            plane.position.set(x, y, z);
            plane.lookAt(end);
            plane.visible = false;
            $scope.scene.add(plane);
            planes.push(plane);
            // var ray = new THREE.Ray(origin, direction);
            // groundNormals.push(ray);
            var material = new THREE.LineBasicMaterial({ color: 0x00ff00 }),
                geometry = new THREE.Geometry();
            geometry.vertices.push(origin);
            geometry.vertices.push(end);
            var line = new THREE.Line(geometry, material);
            $scope.scene.add(line);
        }
    };

    $scope.init();
});

