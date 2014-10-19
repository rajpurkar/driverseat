//todo: not make these globals since multiple things are starting to use geometry
//please don't remove commented code
//
angular.module('roadglApp').
directive('ngRoadgl', ['$window', 'util', 'key', function($window, util, key) {
	return {
		link: function postLink($scope, element, attrs) {
			var camera, scene, renderer,
			projector, raycaster,
			geometries = {},
			pointClouds = {},
			kdtrees = {},
			groundNormals = [],
			mouse = { x: 1, y: 1 },
			windowWidth = $window.innerWidth,
			windowHeight = $window.innerHeight,
			datafiles = {
				points: "files/datafile.json",
				gps: "files/gpsfile.json",
				lanes: "files/lanesfile.json",
				planes: "files/planesfile.json"
			},
			selectedPoint,
				frameCount = 0, //TODO
				DRAG_RANGE = 3,
				car;
				// laneClouds = [],
				// laneCloudsHistoryFlag,

			$scope.init = function() {
				scene = new THREE.Scene();
				camera = new THREE.PerspectiveCamera(75, windowWidth/windowHeight, 0.1, 1000);
				projector = new THREE.Projector();
				raycaster = new THREE.Raycaster();
				renderer = new THREE.WebGLRenderer();
				renderer.setSize(windowWidth, windowHeight);
				element[0].appendChild(renderer.domElement);

				//load the datafiles
				//-----------------------------------------------------------------------
				async.parallel({
					pointCloud: function(callback){
						util.loadJSON(datafiles.points, function(data) {
							pointClouds.points = $scope.generatePointCloud("points", data, 0.01);
							scene.add(pointClouds.points);
							callback(null, 1);
						});
					},
					gps: function(callback){
						util.loadJSON(datafiles.gps, function(data) {
							pointClouds.gps = $scope.generatePointCloud("gps", data, 0.01);
							$scope.updateCamera(frameCount);
							callback(null, 2);
						});
					},
					lanes: function(callback){
						util.loadJSON(datafiles.lanes, function(data) {
							pointClouds.lanes = [];
							for (var lane in data){
								var laneCloud = $scope.generatePointCloud("lane"+lane, data[lane], 0.15, 255);
								scene.add(laneCloud);	
								pointClouds.lanes.push(laneCloud);
								var positions = laneCloud.geometry.attributes.position.array;
								kdtrees["lane"+lane] = new THREE.TypedArrayUtils.Kdtree(positions, util.distanceFunction, 3);
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
							//to clean
							camera.position.set(car.position.x +5 , car.position.y -14, car.position.z - 0);
							camera.lookAt(car.position);
							pointLight = new THREE.PointLight( 0xffaa00 );
							scene.add( pointLight );
							pointLight.position= car.position;
							pointLight.position.x= car.position.x -5;
							directionalLight = new THREE.DirectionalLight( 0xffffff );
							directionalLight.position.set( 1, 1, 0.5 ).normalize();
							scene.add( directionalLight );
							callback(null, 5);
						});
					}
				},
				function(err, results) {
					console.log("Loaded!");
					key.watchToggle("space");
					document.addEventListener('mousedown', $scope.onDocumentMouseDown, false);
					document.addEventListener('mouseup', $scope.onDocumentMouseUp, false);
					document.addEventListener('mousemove', $scope.onDocumentMouseMove, false);
					window.addEventListener('resize', $scope.onWindowResize, false);
					$scope.animate();
				});
				//-----------------------------------------------------------------------
			};

			//--------------------
			// Event Listeners
			//--------------------

			//TODO: not working yet
			//also take care of car loading
			$scope.onDocumentMouseDown = function(event) {
				// if (!key.isDown("ctrl")) return;
				// event.stopPropagation();
				for (var i = 0; i < pointClouds.lanes.length; i++) {
					var intersects = raycaster.intersectObject(pointClouds.lanes[i]);
					if (intersects.length > 0) {
						selectedPoint = intersects[0];
						var pointColors = geometries["lane"+i].attributes.color.array;
						var index = intersects[0].index;
						pointColors[3*index] = 255;
						pointColors[3*index+1] = 0;
						pointColors[3*index+2] = 0;
						geometries["lane"+i].attributes.color.needsUpdate = true;
						var pointPos = selectedPoint.object.geometry.attributes.position.array;

						var nearestPoints = kdtrees["lane"+i].nearest(pointPos.subarray(3*index, 3*index+3), 100, DRAG_RANGE);
						selectedPositions = {};
						selectedIndex = index;
						for (var j = 0; j < nearestPoints.length; j++) {
							index = nearestPoints[j][0].pos;
							selectedPositions[index] = new Float32Array(pointPos.subarray(3*index, 3*index+3));
						}
						for (j = 0; j < planes.length; j++) {
							intersects = raycaster.intersectObject(planes[j]);
							if (intersects.length > 0) {
								selectedPlane = intersects[0];
								document.addEventListener('mousemove', $scope.dragPoint);
								// laneCloudsHistoryFlag = $scope.laneCloudsHistory.startFlag();
								return;
							}
						}
					}
				}
			};

			$scope.onDocumentMouseUp = function() {
				document.removeEventListener('mousemove', $scope.dragPoint);
				// $scope.laneCloudsHistory.endFlag(laneCloudsHistoryFlag);
				var pointColor = selectedPoint.object.geometry.attributes.color;
				var index = selectedIndex;
				pointColor.array[3*index] = 255;
				pointColor.array[3*index+1] = 255;
				pointColor.array[3*index+2] = 255;
				pointColor.needsUpdate = true;
			};

			$scope.onDocumentMouseMove = function(event) {
				event.preventDefault();
				mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
				mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
			};
			
			$scope.onWindowResize = function() {
				windowWidth = $window.innerWidth;
				windowHeight = $window.innerHeight;

				camera.aspect = windowWidth / windowHeight;
				camera.updateProjectionMatrix();

				renderer.setSize(windowWidth, windowHeight);
			};

			$scope.updateCamera = function(frameCount) {
				var gpsPositions = pointClouds.gps.geometry.attributes.position.array;
				//var timer = Date.now() * 0.0005;
				//camera.position.y +=  Math.abs(Math.cos( timer )) *.3 ;
				//camera.position.z += Math.cos( timer ) * 0.03;
				camera.position.x = gpsPositions[3*frameCount+0];
				camera.position.y = gpsPositions[3*frameCount+1];
				camera.position.z = gpsPositions[3*frameCount+2];
				//camera.position.set(new THREE.Vector3(positionArr[2],positionArr[0],positionArr[1]));
				camera.lookAt(new THREE.Vector3(
					gpsPositions[3*frameCount+0],
					gpsPositions[3*(frameCount+5)+1],
					gpsPositions[3*frameCount+2]
					));
			};
			
			$scope.animate = function() {
				requestAnimationFrame($scope.animate);
				$scope.render();
			};

			$scope.render = function() {
				camera.updateMatrixWorld(true);
				
				mousePosition = new THREE.Vector3(mouse.x, mouse.y, 0.5);
				projector.unprojectVector(mousePosition, camera);
				raycaster.params = {"PointCloud" : {threshold: 0.1}};
				raycaster.ray.set(camera.position, mousePosition.sub(camera.position).normalize());
				
				if (car) {
					camera.position.set(car.position.x -5 , car.position.y -14, car.position.z - 0);
					car.position.y += 0.1;
				}
				
				var intersects = raycaster.intersectObject(pointClouds.points);
				if(intersects.length > 0){
					// cursor.position.copy(intersects[0].point); // brush cursor
					// Paint the points with the cursor while pressing <shift>
					if (key.isDown("shift")) {
						var pointColors = geometries.points.attributes.color.array;
						for (var i = 0; i < intersects.length; i++) {
							var index = 3*intersects[i].index;
							pointColors[index] = 255;
							pointColors[index+1] = 255;
							pointColors[index+2] = 255;
						}
						geometries.points.attributes.color.needsUpdate = true;
					}
				}

				if(car){
					var gpsPositions = pointClouds.gps.geometry.attributes.position.array;
					camera.position.set(car.position.x +5 , car.position.y -14, car.position.z - 0);
					camera.position.x = gpsPositions[3*frameCount+0];
					camera.position.y = gpsPositions[3*frameCount+1];
					camera.position.z = gpsPositions[3*frameCount+2];
				}

				if (key.isToggledOn("space")) {
					$scope.updateCamera(frameCount);
					frameCount++;
				}
				var gpsPositions = pointClouds.gps.geometry.attributes.position.array;
				if (frameCount+5 >= gpsPositions.length/3) {
					frameCount = 0;
				}

				renderer.render(scene, camera);
			};

			$scope.dragPoint = function() {
				var intersects = raycaster.intersectObject(selectedPlane.object);
				if (intersects.length > 0) {
					console.log(pointClouds.lanes);
					console.log(selectedPoint);
					// var index = selectedPoint.index;
					var pointPosition = selectedPoint.object.geometry.attributes.position;
					var newPos = new THREE.Vector3();
					newPos.subVectors(intersects[0].point, selectedPlane.point);
					for (var index in selectedPositions) {
						var dist = util.distanceFunction(selectedPositions[selectedIndex], selectedPositions[index]);
						var weight = (Math.cos(Math.PI/DRAG_RANGE * Math.sqrt(dist)) + 1)/2;
						pointPosition.array[3*index] = weight * newPos.x + selectedPositions[index][0];
						pointPosition.array[3*index+1] = weight * newPos.y + selectedPositions[index][1];
						pointPosition.array[3*index+2] = weight * newPos.z + selectedPositions[index][2];
					}
					pointPosition.needsUpdate = true;
				}
			};

			$scope.generatePointCloud = function(name, data, size, color) {
				geometries[name] = new THREE.BufferGeometry();
				var positions = new Float32Array(3*data.length);
				var colors    = new Float32Array(3*data.length);
				for (var i = 0; i < data.length; i++) {
					//Note: order is changed
					positions[3*i]   = data[i][2];	//x
					positions[3*i+1] = data[i][0];	//y
					positions[3*i+2] = data[i][1];	//z
					// map intensity (0-120) to RGB
					if (data[i].length >= 4) {
						var hue = 1 - data[i][3]/120;	//TODO: fix intensity scaling
						colors[3*i+1]   = util.HUEtoRGB(hue+1/3);	//r
						colors[3*i+2] = util.HUEtoRGB(hue);		//g
						colors[3*i+0] = util.HUEtoRGB(hue-1/3);	//b
					} else {
						colors[3*i+1] = color;
						colors[3*i+2] = color;
						colors[3*i+0] = color;
					}
				}

				geometries[name].addAttribute('position', new THREE.BufferAttribute(positions, 3));
				geometries[name].addAttribute('color', new THREE.BufferAttribute(colors, 3));
				var material = new THREE.PointCloudMaterial({ size: size, vertexColors: true });
				pointCloud = new THREE.PointCloud(geometries[name], material);

				return pointCloud;
			};

			$scope.addCarLight = function() {
				
			};

			$scope.addCar = function(callback) {
				var camaroMaterials = {
					body: {
						Orange: new THREE.MeshLambertMaterial( {
							color: 0xff6600,
							combine: THREE.MixOperation,
							reflectivity: 0.3
						} ),
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
					var s = 0.27, m = new THREE.MeshFaceMaterial();
					m.materials[ 0 ] = materials.body[ "Orange" ]; // car body
					m.materials[ 1 ] = materials.chrome; // wheels chrome
					m.materials[ 2 ] = materials.chrome; // grille chrome
					m.materials[ 3 ] = materials.darkchrome; // door lines
					m.materials[ 4 ] = materials.glass; // windshield
					m.materials[ 5 ] = materials.interior; // interior
					m.materials[ 6 ] = materials.tire; // tire
					m.materials[ 7 ] = materials.black; // tireling
					m.materials[ 8 ] = materials.black; // behind grille

					car = new THREE.Mesh( geometry, m );
					car.rotation.set( - Math.PI / 2, 0, -Math.PI /2);
					car.scale.set( s, s, s );
					car.position.set( -3, 0, 0 );
					scene.add( car );
					callback(); 
				});
			};

			$scope.addPlanes = function(data) {
				planes = [];
				var groundGeometry = new THREE.Geometry();
				for (var i = 0; i < data.length; i++) {
					var normal = data[i];
					var dy = normal[0],
					dz = normal[1],
					dx = normal[2],
					y = normal[3],
					z = normal[4],
					x = normal[5];
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
					scene.add(plane);
					planes.push(plane);
					// var ray = new THREE.Ray(origin, direction);
					// groundNormals.push(ray);
					var material = new THREE.LineBasicMaterial({ color: 0x00ff00 }),
					geometry = new THREE.Geometry();
					geometry.vertices.push(origin);
					geometry.vertices.push(end);
					var line = new THREE.Line(geometry, material);
					scene.add(line);
				}
			};
			$scope.init();
		}
	};
}]);

