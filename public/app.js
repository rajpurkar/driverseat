angular.module('roadglApp').
controller('AppCtrl', ['$scope', '$window', 'editor', 'util', 'key', 'video',
function($scope, $window, editor, util, key, video) {
	$scope.scene = null;
	$scope.raycaster = null;
	$scope.geometries = {};
	$scope.pointClouds = {};
	$scope.kdtrees = {};
	var camera, renderer,
		projector,
		controls,
        fpsMeter,
		groundNormals = [],
		mouse = { x: 1, y: 1 },
		windowWidth = $window.innerWidth,
		windowHeight = $window.innerHeight,
		datafiles = {
			points: "files/datafile.json",
			gps: "files/gpsfile.json",
			lanes: "files/lanesfile.json",
			planes: "files/planesfile.json",
			video: "files/videofile.zip"
		},
		frameCount = 0,
		offset = [0, 5, -14],//[0,1,-2],
		car,
		carOffset = 0;

	$scope.setCameraOffset = function(){
		offset[0] = - car.position.x + camera.position.x;
		offset[1] = - car.position.y + camera.position.y;
		offset[2] = - car.position.z + camera.position.z;
	};

	$scope.init = function() {
        fpsMeter = new FPSMeter(document.getElementById("fps"));

		$scope.scene = new THREE.Scene();
		//scene.fog = new THREE.Fog( 0xcce0ff, 500, 10000 );
		camera = new THREE.PerspectiveCamera(75, windowWidth/windowHeight, 1, 10000);
		projector = new THREE.Projector();
		$scope.raycaster = new THREE.Raycaster();
		var canvas = document.getElementById("road");
		renderer = new THREE.WebGLRenderer({canvas: canvas});
		renderer.setSize(windowWidth, windowHeight);
		//renderer.setClearColor( scene.fog.color );

		controls = new THREE.OrbitControls(camera);

		$scope.debugText = "Loading...";
		async.parallel({
			pointCloud: function(callback){
				util.loadJSON(datafiles.points, function(data) {
					$scope.pointClouds.points = $scope.generatePointCloud("points", data, 0.004);
					$scope.scene.add($scope.pointClouds.points);
					callback(null, 1);
				});
			},
			gps: function(callback){
				util.loadJSON(datafiles.gps, function(data) {
					$scope.pointClouds.gps = $scope.generatePointCloud("gps", data, 0.1);
					callback(null, 2);
				});
			},
			lanes: function(callback){
				util.loadJSON(datafiles.lanes, function(data) {
					$scope.pointClouds.lanes = {};
					for (var lane in data){
						var color = util.generateRGB(lane);
						var laneCloud = $scope.generatePointCloud("lane"+lane, data[lane], 0.35, color);
						$scope.scene.add(laneCloud);	
						$scope.pointClouds.lanes[lane] = laneCloud;
						var positions = laneCloud.geometry.attributes.position.array;
						$scope.kdtrees["lane"+lane] = new THREE.TypedArrayUtils.Kdtree(positions, util.distance, 3);
						editor.initLane(positions, lane);
					}
					callback(null, 3);
				});
			},
			planes: function(callback){
				util.loadJSON(datafiles.planes, function(data) {
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
                JSZipUtils.getBinaryContent(datafiles.video, function(err, data) {
                if(err) {
                    throw err; // or handle err
                }
                video.init(data);
                callback(null, 'video_init');
            });
            }
		},
		function(err, results) {
			$scope.debugText = "";
			//$scope.debugText = JSON.stringify(offset);
			$scope.execOnLoaded();
		});
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
		document.addEventListener('keydown', $scope.onDocumentKeyDown, false);
		document.addEventListener('mousemove', $scope.onDocumentMouseMove, false);
		controls.addEventListener('change', $scope.setCameraOffset);
		window.addEventListener('resize', $scope.onWindowResize, false);
		document.getElementById("undo").addEventListener("click", editor.undo, false);
		document.getElementById("redo").addEventListener("click", editor.redo, false);
	};

	$scope.execOnLoaded = function(){
		editor.init($scope);

		key.watchToggle("space");
		$scope.addEventListeners();
		$scope.addLighting();
		$scope.updateCamera(0);
		$scope.animate();
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
			case key.keyMap.right:
				$scope.carRight();
				break;
			case key.keyMap.left:
				$scope.carLeft();
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

	$scope.carRight= function(){
		carOffset-=0.3;

		$scope.updateCamera(frameCount);
	};

	$scope.carLeft = function(){
		carOffset+=0.3;
		$scope.updateCamera(frameCount);
	};

	$scope.carForward = function(){
		var numForward = 3;
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
		var gpsPositions = $scope.pointClouds.gps.geometry.attributes.position.array;
		var x = gpsPositions[3*frameCount+0] + carOffset;
		var y = gpsPositions[3*frameCount+1] -1.1;
		var z = gpsPositions[3*frameCount+2];
		return {x: x, y:y, z:z};
	};

	$scope.updateCamera = function(frameCount) {
		var lastCarPosition = new THREE.Vector3(0, 0, 0);
		var pos = $scope.getCarPosition(frameCount);
		angular.extend(car.position, pos);
		car.lookAt($scope.getCarPosition(frameCount + 5));
		camera.position.set(car.position.x + offset[0], car.position.y + offset[1], car.position.z + offset[2]);
		var target = car.position;
		camera.lookAt(target);
		controls.target.copy(target);
		controls.update();
	};

	$scope.updateMouse = function() {
		var mousePosition = new THREE.Vector3(mouse.x, mouse.y, 0.5);
		projector.unprojectVector(mousePosition, camera);
		$scope.raycaster.params = {"PointCloud" : {threshold: 0.1}};
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

		if (key.isToggledOn("space")) {
			$scope.updateCamera(frameCount);
			//video.nextFrame();
			frameCount++;
		}
		var gpsPositions = $scope.pointClouds.gps.geometry.attributes.position.array;
        video.displayImage("projectionCanvas", frameCount);
		if (frameCount+5 >= gpsPositions.length/3) {
			frameCount = 0;
		}

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
			colors    = new Float32Array(data);
			for (i = 0; 3*i < colors.length; i++) {
				colors[3*i+0] = color.r;
				colors[3*i+1] = color.g;
				colors[3*i+2] = color.b;
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
				$scope.fillColor(colors, data, 20, 100,20);
			} else if (typeof color === "undefined") {
				$scope.fillColor(colors, data, 255, 255, 255);
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
			car.position.set( 0, -1.2, 7 );
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
}]);

