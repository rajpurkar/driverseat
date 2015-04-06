var myApp = angular.module('roadglApp', ['angular-loading-bar', 'ngAnimate']);

myApp.
controller(
    'AppCtrl',
    function(
        $scope,
        $attrs,
        $window,
        $parse,
        $timeout,
        laneEditor,
        loading,
        util,
        key,
        videoProjection,
        radar,
        carDetection,
        cfpLoadingBar,
        tagEditor,
        laneDetection) {

        $scope.laneEditor = laneEditor;
        $scope.tagEditor = tagEditor;
        // scope variables
        $scope.trackInfo = JSON.parse($attrs.ngTrackinfo);
        $scope.editor = $attrs.ngEditor;
        // $scope.categories            = JSON.parse($attrs.ngCategories);
        $scope.scene = null;
        $scope.raycaster = null;
        $scope.geometries = {};
        $scope.pointClouds = {};
        $scope.meshes = {};
        $scope.kdtrees = {};
        $scope.video = null;
        //$scope.videoData              = null;
        $scope.radarData = null;
        $scope.carDetectionData = null;
        $scope.carDetectionVerifiedData = null;
        $scope.datafiles = null;
        $scope.LANE_POINT_SIZE = 0.11;
        $scope.LIDAR_POINT_SIZE = 0.15;
        $scope.params = null;
        $scope.precisionAndRecall = null;
        $scope.shortcutsEnabled = true;
        $scope.dragRange = 15;
        $scope.numLaneTypes = $attrs.ngLanetypes.split(',').length;

        // constants
        var INITIAL_OFFSET = [0, 3, -8],
            INITIAL_MOUSE = {
                x: 1,
                y: 1
            },
            INITIAL_FRAME = typeof $scope.trackInfo.startFrame === 'undefined' ? 0 : parseInt($scope.trackInfo.startFrame),
            INITIAL_SPEED = 1;
        END_VIEW_THRESHOLD = 2;

        $scope.frameCount = INITIAL_FRAME;
        $scope.frameCountTemp = -1;


        if (!Detector.webgl){
          $("#loaderMessage").remove();
          Detector.addGetWebGLMessage();  
        } 

        // local variables
        var camera, renderer,
            projector,
            controls,
            fpsMeter,
            groundNormals = [],
            mouse = INITIAL_MOUSE,
            speed = INITIAL_SPEED,
            windowWidth = $window.innerWidth,
            windowHeight = $window.innerHeight,
            // frameCount = INITIAL_FRAME,
            offset = INITIAL_OFFSET,
            car;

        $scope.scrubFrameCount = function(event) {
            var percent = event.target.value;
            $scope.frameCount = Math.floor(percent * ($scope.gps.length));
        }

        $scope.flush = function() {
            $timeout(function() {
                try {
                    $scope.$apply();
                } catch (e) {}
            }, 0, false);
        }

        $scope.log = function(message) {
            //TODO fix conflict with apply calls already in progress
            $scope.logText = message;
            $scope.flush();
        };

        $scope.getCarCurPosition = function() {
            return car.position;
        };

        $scope.changeSpeed = function(event) {
            speed = Math.floor(event.target.value);
        };

        $scope.setCameraOffset = function() {
            offset[0] = -car.position.x + camera.position.x;
            offset[1] = -car.position.y + camera.position.y;
            offset[2] = -car.position.z + camera.position.z;
        };

        $scope.init = function() {
            if ($scope.editor != "lane" && $scope.editor != "tag")
                $scope.editor = "lane";
            //fpsMeter = new FPSMeter(document.getElementById("fps"));
            $scope.scene = new THREE.Scene();
            $scope.scene.fog = new THREE.Fog(0x111132, 0.1, 5000);
            //scene.fog = new THREE.Fog( 0xcce0ff, 500, 10000 );
            camera = new THREE.PerspectiveCamera(75, windowWidth / windowHeight, 0.01, 1000);

            projector = new THREE.Projector();
            $scope.raycaster = new THREE.Raycaster();
            var canvas = document.getElementById("road");
            renderer = new THREE.WebGLRenderer({
                canvas: canvas
            });
            renderer.setSize(windowWidth, windowHeight);
            renderer.setClearColor($scope.scene.fog.color);
            controls = new THREE.OrbitControls(camera);
            $scope.logText = "Loading...";
            cfpLoadingBar.start();
            loading.init($scope);
            loading.loaders($scope.execOnLoaded);
            if ($scope.editor == "tag")
                tagEditor.init($scope);
            $("input[type=text]").focus(function() {
                $scope.shortcutsEnabled = false;
            }).blur(function() {
                $scope.shortcutsEnabled = true;
            });
            $(".actionBtn").on("mouseup mousedown", function(event) {
                if (!event) return;
                event.stopPropagation();
                event.preventDefault();
            });
        };

        $scope.addLighting = function() {
            var directionalLight = new THREE.DirectionalLight(0xffffdd);
            directionalLight.position.set(0, 1, -0.3).normalize();
            $scope.scene.add(directionalLight);
        };

        $scope.addEventListeners = function() {
            document.addEventListener('mousedown', $scope.rotateCamera, false);
            document.addEventListener('mousemove', $scope.onDocumentMouseMove, false);
            controls.addEventListener('change', $scope.setCameraOffset);
            document.addEventListener('keydown', $scope.onDocumentKeyDown, false);
            window.addEventListener('resize', $scope.onWindowResize, false);
            document.querySelector('#scrubber').addEventListener('mousedown', function() {
                $scope.frameCountTemp = -1;
            });
            document.querySelector('#playspeedrange').addEventListener('input', $scope.changeSpeed);
        };

        $scope.execOnLoaded = function() {
            $scope.log("Rendering...");
            $("#wrap").fadeOut(0);
            $("#wrap").css("visibility", "visible");
            $("#loaderMessage").remove();
            $("#wrap").fadeIn(4000);
            //video.init($scope.videoData);
            if ($scope.radarData !== null) radar.init($scope.radarData, $scope.params, $scope.scene);
            if ($scope.editor == "lane")
                laneEditor.init($scope);
            $scope.videoProjectionParamsFromCamera0 = videoProjection.init($scope.params, 0, $scope.pointClouds.lanes);
            $scope.videoProjectionParamsFromCamera1 = videoProjection.init($scope.params, 1, $scope.pointClouds.lanes);
            carDetection.init(
                $scope.carDetectionData,
                $scope.carDetectionVerifiedData,
                $scope.precisionAndRecallData[$scope.trackInfo.track],
                $scope.videoProjectionParamsFromCamera1,
                $scope.scene);
            carDetection.displayPrecisionAndRecall();
            laneDetection.init(
                $scope.laneDetectionData,
                $scope.videoProjectionParamsFromCamera0,
                $scope.videoProjectionParamsFromCamera1,
                $scope.scene);

            // TODO(rchengyue): Find out how to only watch toggle for space if input text boxes are not in focus.
            key.watchToggle("space");
            $scope.addEventListeners();
            $scope.addLighting();
            $scope.updateCamera(0);
            $scope.animate();
            cfpLoadingBar.complete();
            $scope.log("");
        };

        $scope.rotateCamera = function(event) {
            if(event.which !== 1) return; //just left click
            if (!(event.metaKey || event.ctrlKey)) return;
            controls.onMouseDown(event);
        };

        $scope.changeEditor = function() {
            if ($scope.editor == "lane") {
                $scope.editor = "tag";
                laneEditor.exit();
                tagEditor.init($scope);
            } else if ($scope.editor == "tag") {
                $scope.editor = "lane";
                laneEditor.init($scope);
            }

        };

        $scope.onDocumentMouseMove = function(event) {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        };

        $scope.onDocumentKeyDown = function(event) {
            // TODO(rchengyue): Figure out a better way to determine whether or not to disable key down.
            if (!$scope.shortcutsEnabled) return;
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
                case key.keyMap["0"]:
                    $scope.goToStartFrame();
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

        $scope.changeFrame = function(amt) {
            $scope.frameCountTemp = -1;
            if ($scope.frameCount + amt < $scope.gps.length - END_VIEW_THRESHOLD && $scope.frameCount + amt >= 0) {
                $scope.frameCount += amt;
                $scope.flush();
            }
        }

        $scope.goToStartFrame = function() {
            $scope.frameCount = 0;
        }

        $scope.carForward = function() {
            var numForward = 3;
            $scope.changeFrame(numForward);
            $scope.updateCamera();
        };

        $scope.carBack = function() {
            var numDecline = 3;
            $scope.changeFrame(-numDecline);
            $scope.updateCamera();
        };

        $scope.getCarPosition = function(frameCount) {
            var pos = $scope.gps[frameCount];
            var x = pos[1][3];
            var y = pos[2][3] - 1.1;
            var z = pos[0][3];
            return new THREE.Vector3(x, y, z);
        };

        $scope.updateCamera = function() {
            var frameCount = $scope.frameCountTemp > -1 ? $scope.frameCountTemp : $scope.frameCount;
            frameCount = parseInt(frameCount, 10);
            frameCount = Math.min(frameCount, $scope.gps.length - END_VIEW_THRESHOLD);
            if ($scope.frameCountTemp > -1)
                $scope.frameCountTemp = frameCount;
            else
                $scope.frameCount = frameCount;
            var pos = $scope.getCarPosition(frameCount);
            angular.extend(car.position, pos);
            car.lookAt($scope.getCarPosition(frameCount + 1));
            camera.position.set(car.position.x + offset[0], car.position.y + offset[1], car.position.z + offset[2]);
            var target = car.position;
            camera.lookAt(target);
            controls.target.copy(target);
            controls.update();
        };

        $scope.updateMouse = function() {
            var mousePosition = new THREE.Vector3(mouse.x, mouse.y, 0.5);
            projector.unprojectVector(mousePosition, camera);
            $scope.raycaster.params = {
                "PointCloud": {
                    threshold: 0.3
                }
            };
            $scope.raycaster.ray.set(camera.position, mousePosition.sub(camera.position).normalize());
        };

        $scope.animate = function(timestamp) {
            requestAnimationFrame($scope.animate);
            $scope.render();
        };

        $scope.render = function() {
            camera.updateMatrixWorld(true);
            $scope.updateCamera();
            if (key.isToggledOn("space") && $scope.shortcutsEnabled) {
                $scope.changeFrame(speed);
            }
            var img_disp = $scope.video.displayImage("projectionCanvas", $scope.frameCount);
            if (img_disp) {
                /*
                for (var idx in $scope.pointClouds.lanes) {
                    videoProjection.projectCloud("projectionCanvas", $scope.pointClouds.lanes[idx], $scope.gps[frameCount], $scope.videoProjectionParamsFromCamera1);
                }
                */
                videoProjection.projectScene("projectionCanvas", $scope.gps[$scope.frameCount], $scope.videoProjectionParamsFromCamera1);
            } else {
                var canv = document.getElementById("projectionCanvas");
                var ctx = canv.getContext("2d");
                ctx.clearRect(0, 0, canv.width, canv.height);
                ctx.fillStyle = "blue";
                ctx.fillRect(0, 0, canv.width, canv.height);
                ctx.fillStyle = "white";
                ctx.font = "bold 20px Arial";
                ctx.textAlign = "center";
                ctx.fillText("Buffering", canv.width / 2, canv.height / 2);
            }

            //videoProjection.projectCloud("projectionCanvas", $scope.pointClouds.points, $scope.gps[$scope.frameCount], $scope.videoProjectionParamsFromCamera1);
            if ($scope.radarData !== null) radar.displayReturns($scope.frameCount, $scope.gps[$scope.frameCount]);
            carDetection.drawCarDetectionBoxes("projectionCanvas", $scope.frameCount, $scope.gps[$scope.frameCount]);
            carDetection.drawCarDetectionVerifiedBoxes("projectionCanvas", $scope.frameCount, $scope.gps[$scope.frameCount]);
            laneDetection.drawLaneDetectionPoints("projectionCanvas", $scope.frameCount, $scope.gps[$scope.frameCount]);
            //fpsMeter.tick();

            renderer.render($scope.scene, camera);
        };

        $scope.fillColor = function(colors, r, g, b) {
            for (i = 0; i < colors.length; i++) {
                colors[3 * i + 0] = r;
                colors[3 * i + 1] = g;
                colors[3 * i + 2] = b;
            }
        };

        $scope.generatePointCloud = function(name, data, size, colorIndices) {
            $scope.geometries[name] = new THREE.BufferGeometry();
            var positions, colors;
            var i;
            var dataType = Object.prototype.toString.call(data);
            if (dataType === "[object Float32Array]" || dataType === "[object ArrayBuffer]") {
                positions = new Float32Array(data);
                // colors    = new Float32Array(positions.length);
                // for (i = 0; i < colors.length; i += 3) {
                //     colors[i]   = color.r;
                //     colors[i+1] = color.g;
                //     colors[i+2] = color.b;
                // }
            } else {
                positions = new Float32Array(3 * data.length);
                // colors    = new Float32Array(3*data.length);
                for (i = 0; i < data.length; i++) {
                    //Note: order is changed
                    positions[3 * i] = data[i][1]; //x
                    positions[3 * i + 1] = data[i][2]; //y
                    positions[3 * i + 2] = data[i][0]; //z
                }

                // if (data[0].length >= 4) {
                //     $scope.fillColor(colors, data, 0.6, 0.6, 0.6);
                // } else if (typeof color === "undefined") {
                //     $scope.fillColor(colors, data, 1, 1, 1);
                // } else {
                //     $scope.fillColor(colors,data, color.r, color.g, color.b);
                // }
            }

            colors = new Float32Array(positions.length);
            if (typeof colorIndices === "undefined") {
                color = {
                    r: 1,
                    g: 1,
                    b: 1
                };
                $scope.fillColor(colors, color.r, color.g, color.b);
            } else {
                for (i = 0; i < colorIndices.length; i++) {
                    var color = util.laneTypeColor(colorIndices[i]);
                    colors[3 * i + 0] = color.r;
                    colors[3 * i + 1] = color.g;
                    colors[3 * i + 2] = color.b;
                }
            }

            $scope.geometries[name].addAttribute('position', new THREE.BufferAttribute(positions, 3));
            $scope.geometries[name].addAttribute('color', new THREE.BufferAttribute(colors, 3));
            var material = new THREE.PointCloudMaterial({
                size: size,
                vertexColors: true
            });
            pointCloud = new THREE.PointCloud($scope.geometries[name], material);
            return pointCloud;
        };

        $scope.addCar = function(callback) {
            var camaroMaterials = {
                body: {
                    Orange: new THREE.MeshLambertMaterial({
                        color: 0xff4411,
                        combine: THREE.MixOperation,
                        reflectivity: 0.3
                    })
                },
                chrome: new THREE.MeshLambertMaterial({
                    color: 0xffffff
                }),
                darkchrome: new THREE.MeshLambertMaterial({
                    color: 0x444444
                }),
                glass: new THREE.MeshBasicMaterial({
                    color: 0x223344,
                    opacity: 0.25,
                    combine: THREE.MixOperation,
                    reflectivity: 0.25,
                    transparent: true
                }),
                tire: new THREE.MeshLambertMaterial({
                    color: 0x050505
                }),
                interior: new THREE.MeshPhongMaterial({
                    color: 0x050505,
                    shininess: 20
                }),
                black: new THREE.MeshLambertMaterial({
                    color: 0x000000
                })
            };

            var loader = new THREE.BinaryLoader();
            loader.load("/files/CamaroNoUv_bin.js", function(geometry) {
                var materials = camaroMaterials;
                var s = 0.25,
                    m = new THREE.MeshFaceMaterial();
                m.materials[0] = materials.body.Orange; // car body
                m.materials[1] = materials.chrome; // wheels chrome
                m.materials[2] = materials.chrome; // grille chrome
                m.materials[3] = materials.darkchrome; // door lines
                m.materials[4] = materials.glass; // windshield
                m.materials[5] = materials.interior; // interior
                m.materials[6] = materials.tire; // tire
                m.materials[7] = materials.black; // tireling
                m.materials[8] = materials.black; // behind grille

                car = new THREE.Mesh(geometry, m);
                // car.rotation.set( - Math.PI / 2, 0, -Math.PI /2);
                car.scale.set(s, s, s);
                car.position.set(0, -1.5, 7);
                // TODO car gets in the way of lane editing
                $scope.scene.add(car);
                callback();
            });
        };

        $scope.addPlanes = function(data) {
            $scope.meshes.groundPlanes = [];
            var groundGeometry = new THREE.Geometry();
            for (var i = 0; i < data.length; i++) {
                var normal = data[i];
                var dz = normal[0],
                    dx = normal[1],
                    dy = normal[2],
                    z = normal[3],
                    x = normal[4],
                    y = normal[5];
                var origin = new THREE.Vector3(x, y, z),
                    direction = new THREE.Vector3(dx, dy, dz),
                    end = new THREE.Vector3(x + dx, y + dy, z + dz);
                direction.normalize();
                var plane = new THREE.Plane();
                plane.setFromNormalAndCoplanarPoint(direction, origin);
                var planeGeometry = new THREE.PlaneGeometry(50, 50),
                    planeMaterial = new THREE.MeshBasicMaterial({
                        color: 0x000000,
                        transparent: true
                    });
                plane = new THREE.Mesh(planeGeometry, planeMaterial);
                plane.position.set(x, y, z);
                plane.lookAt(end);
                plane.visible = false;
                $scope.scene.add(plane);
                $scope.meshes.groundPlanes.push(plane);
                // var material = new THREE.LineBasicMaterial({ color: 0x00ff00 }),
                //     geometry = new THREE.Geometry();
                // geometry.vertices.push(origin);
                // geometry.vertices.push(end);
                // var line = new THREE.Line(geometry, material);
                // $scope.scene.add(line);
            }
        };

        $scope.init();
    });