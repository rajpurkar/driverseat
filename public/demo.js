//todo: not make these globals since multiple things are starting to use geometry
//please don't remove commented code
var renderer;
var camera;
var scene;
var geometries = {};	//TODO: make non-global
var kdtrees = {};		//TODO: make non-global
var laneClouds = [];	//TODO: make non-global
var groundNormals = [];	//TODO: make non-global
var pickLocation;
var mouse = { x: 1, y: 1 };
var projector, raycaster;
var dataFile = "files/datafile.json";
var gpsFile = "files/gpsfile.json";
var lanesFile = "files/lanesfile.json";
var planesFile = "files/planesfile.json";
var shiftKey = false;
var gpsData;
var paused = true;
var DRAG_RANGE = 3;

//TODO: make keycode handler
document.addEventListener('keydown', function(event) {
	if (event.keyCode == 16){
		shiftKey = true;
	} else if (event.keyCode == 80){
		togglePause();
	}
}, false);
document.addEventListener('keyup', function(event) {
	if (event.keyCode == 16)
		shiftKey = false;
}, false);

//TODO: make mouse event handler, decompose function, clean up globals
document.addEventListener('mousedown', function(event) {
	for (var i = 0; i < laneClouds.length; i++) {
		var intersects = raycaster.intersectObject(laneClouds[i]);
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
					document.addEventListener('mousemove', dragPoint);
					return;
				}
			}
		}
	}
});
function dragPoint(event) {
	var intersects = raycaster.intersectObject(selectedPlane.object);
	if (intersects.length > 0) {
		// var index = selectedPoint.index;
		var pointPosition = selectedPoint.object.geometry.attributes.position;
		var newPos = new THREE.Vector3();
		newPos.subVectors(intersects[0].point, selectedPlane.point);
		for (var index in selectedPositions) {
			var dist = distanceFunction(selectedPositions[selectedIndex], selectedPositions[index]);
			var weight = (Math.cos(Math.PI/DRAG_RANGE * Math.sqrt(dist)) + 1)/2;
			pointPosition.array[3*index] = weight * newPos.x + selectedPositions[index][0];
			pointPosition.array[3*index+1] = weight * newPos.y + selectedPositions[index][1];
			pointPosition.array[3*index+2] = weight * newPos.z + selectedPositions[index][2];
		}
		pointPosition.needsUpdate = true;
	}
}
document.addEventListener('mouseup', function(event) {
	document.removeEventListener('mousemove', dragPoint);
	var pointColor = selectedPoint.object.geometry.attributes.color;
	var index = selectedIndex;
	pointColor.array[3*index] = 255;
	pointColor.array[3*index+1] = 255;
	pointColor.array[3*index+2] = 255;
	pointColor.needsUpdate = true;
});

function togglePause(){
	paused = !paused;
}

function distanceFunction(a, b) {
	return (a[0]-b[0])*(a[0]-b[0]) + (a[1]-b[1])*(a[1]-b[1]) + (a[2]-b[2])*(a[2]-b[2]);
}
/**
 * Algorithm to calculate a single RGB channel (0-255) from HSL hue (0-1.0)
 */
 function HUEtoRGB(hue) {
 	if (hue < 0) {
 		hue += 1;
 	} else if (hue > 1) {
 		hue -= 1;
 	}
 	var rgb = 0;
 	if (hue < 1/6) {
 		rgb = hue*6;
 	} else if (hue < 1/2) {
 		rgb = 1;
 	} else if (hue < 2/3) {
 		rgb = (2/3 - hue)*6;
 	}
 	return Math.round(rgb * 255);
 }

 function loadPoints(df){
 	var xhr = new XMLHttpRequest();
 	xhr.open("GET", df, false);
 	xhr.send(null);
 	if (xhr.status !== 200 && xhr.status !== 0) {
 		throw new Error(df + " not found");
 	}
 	var data = JSON.parse(xhr.responseText);
 	return data;
 }

 function generatePointCloud(name, data, size, color) {
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
			colors[3*i+1]   = HUEtoRGB(hue+1/3);	//r
			colors[3*i+2] = HUEtoRGB(hue);		//g
			colors[3*i+0] = HUEtoRGB(hue-1/3);	//b
		} else {
			colors[3*i+1] = color;
			colors[3*i+2] = color;
			colors[3*i+0] = color;
		}
	}

	geometries[name].addAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometries[name].addAttribute('color', new THREE.BufferAttribute(colors, 3));
	var material = new THREE.PointCloudMaterial({ size: size, vertexColors: true });
	var pointcloud = new THREE.PointCloud(geometries[name], material);

	return pointcloud;
}

function addCar2(){
	THREE.Loader.Handlers.add( /\.dds$/i, new THREE.DDSLoader() );
	var loader = new THREE.OBJMTLLoader();
	loader.load('/files/R8_14blend.obj', '/files/R8_14blend.mtl', function(object) {
		object.position.set( 0, 0, 0 );
		object.rotation.set( 0, Math.PI / 2, Math.PI );
		object.scale.set( 10, 10, 10 );
		scene.add(object);
	});
}


function addCar() {

	directionalLight = new THREE.DirectionalLight( 0xffffff );
	directionalLight.position.set( 1, 1, 0.5 ).normalize();
	scene.add( directionalLight );

	//var light = new THREE.AmbientLight( 0x404040 ); // soft white light
	//scene.add( light )

	
	//var light = new THREE.AmbientLight( 0x00ee00 ); // soft white light
	//scene.add( light );
	/*
	var sphere = new THREE.SphereGeometry( 100, 16, 8 );
	var mesh = new THREE.Mesh( sphere, new THREE.MeshBasicMaterial( { color: 0xffaa00 } ) );
	mesh.scale.set( 0.05, 0.05, 0.05 );
	pointLight.add( mesh );
	*/
	var camaroMaterials = {

		body: {

			Orange: new THREE.MeshLambertMaterial( {
				color: 0xff6600,
				combine: THREE.MixOperation,
				reflectivity: 0.3
			} ),

			Blue: new THREE.MeshLambertMaterial( {
				color: 0x226699,
				combine: THREE.MixOperation,
				reflectivity: 0.3
			} ),

			Red: new THREE.MeshLambertMaterial( {
				color: 0x660000,
				combine: THREE.MixOperation,
				reflectivity: 0.5
			} ),

			Black: new THREE.MeshLambertMaterial( {
				color: 0x000000,
				combine: THREE.MixOperation,
				reflectivity: 0.5
			} ),

			White: new THREE.MeshLambertMaterial( {
				color: 0xffffff,
				combine: THREE.MixOperation,
				reflectivity: 0.5
			} ),

			Carmine: new THREE.MeshPhongMaterial( {
				color: 0x770000,
				specular: 0xffaaaa,
				combine: THREE.MultiplyOperation
			} ),

			Gold: new THREE.MeshPhongMaterial( {
				color: 0xaa9944,
				specular: 0xbbaa99,
				shininess: 50,
				combine: THREE.MultiplyOperation
			} ),

			Bronze: new THREE.MeshPhongMaterial( {
				color: 0x150505,
				specular: 0xee6600,
				shininess: 10,
				combine: THREE.MixOperation,
				reflectivity: 0.5
			} ),

			Chrome: new THREE.MeshPhongMaterial( {
				color: 0xffffff,
				specular:0xffffff,
				combine: THREE.MultiplyOperation
			} )

		},

		chrome: new THREE.MeshLambertMaterial( {
			color: 0xffffff,
		} ),

		darkchrome: new THREE.MeshLambertMaterial( {
			color: 0x444444,
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
	loader.load( "/files/CamaroNoUv_bin.js", function( geometry ) { createScene( geometry, camaroMaterials ) } );

				//
}

var car; 
function createScene( geometry, materials ) {

	var s = 0.35, m = new THREE.MeshFaceMaterial();

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
	car.rotation.set( - Math.PI / 2, 0, Math.PI /2);
	car.scale.set( s, s, s );
	car.position.set( -3, 0, 0 );
	target = car.position;
	//camera.position.set(car.position.x - 12, car.position.y -14, car.position.z- 0.11);
	scene.add( car );
	camera.position.set(car.position.x -5 , car.position.y -14, car.position.z - 0);
	//controls.target = car.position;
	camera.lookAt(car.position);
	pointLight = new THREE.PointLight( 0xffaa00 );
	scene.add( pointLight );
	pointLight.position= car.position;
	pointLight.position.x= car.position.x -10;
}

			function addPlanes() {
				planesData = loadPoints(planesFile);
				planes = [];
				var groundGeometry = new THREE.Geometry();
				for (var i = 0; i < planesData.length; i++) {
					var normal = planesData[i];
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
		//scene.add(line);
	}
}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}
var target = new THREE.Vector3(0, 200, 0 );


function init() {
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
	cameraTarget = target;
	projector = new THREE.Projector();
	raycaster = new THREE.Raycaster();
	renderer = new THREE.WebGLRenderer();
	// renderer = new THREE.WebGLRenderer({alpha:true});
	// renderer.setClearColor(0, 1);
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);
	/*
	var pointData = loadPoints(dataFile);
	pointcloud = generatePointCloud("points", pointData, 0.01);
	scene.add(pointcloud);
	*/
	/*
	gpsData = loadPoints(gpsFile);
	gpsCloud = generatePointCloud("gps", gpsData, 0.1, 240);
	*/
	lanesData = loadPoints(lanesFile);
	for (var lane in lanesData){
		var laneCloud = generatePointCloud("lane"+lane, lanesData[lane], 0.15, 255);
		scene.add(laneCloud);	
		laneClouds.push(laneCloud);
		var positions = laneCloud.geometry.attributes.position.array;
		kdtrees["lane"+lane] = new THREE.TypedArrayUtils.Kdtree(positions, distanceFunction, 3);
	}
	addPlanes();
	/*
	var sphereGeometry = new THREE.SphereGeometry(0.1, 32, 32);
	var sphereMaterial = new THREE.MeshBasicMaterial({color: 0xff0000, shading: THREE.FlatShading});
	pickLocation = new THREE.Mesh(sphereGeometry, sphereMaterial);
	scene.add(pickLocation);
	*/
	addCar();

	// controls
	//camera.position.set(-2,-14,0);
	//controls = new THREE.OrbitControls(camera);
	//controls.addEventListener( 'change', render );
	//controls.target = new THREE.Vector3(0,1,0);
	//camera.lookAt(new THREE.Vector3(0,100,0));

	//document.addEventListener( 'mousemove', onDocumentMouseMove, false );
	window.addEventListener( 'resize', onWindowResize, false );
}

function onDocumentMouseMove( event ) {
	event.preventDefault();

	mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
}

function animate() {
	requestAnimationFrame( animate );
	render();
}
var count = 0;

function render() {
	camera.updateMatrixWorld(true);
	vector = new THREE.Vector3( mouse.x, mouse.y, 0.5 );
	projector.unprojectVector( vector, camera );
	raycaster.params = {"PointCloud" : {threshold: 0.1}};
	raycaster.ray.set( camera.position, vector.sub( camera.position ).normalize() );
	if(car){
		camera.position.set(car.position.x -5 , car.position.y -14, car.position.z - 0);
		car.position.y += 0.1;
	}
	//
	//var intersects = raycaster.intersectObject(pointcloud);
	/*
	if(intersects.length > 0){
		// pickLocation.position.copy(intersects[0].point); // brush cursor
		// Paint the points with the cursor while pressing <shift>
		if (shiftKey) {
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
	*/
	/*
	//var timer = Date.now() * 0.0005;
	//camera.position.y +=  Math.abs(Math.cos( timer )) *.3 ;
	//camera.position.z += Math.cos( timer ) * 0.03;
	positionArr = gpsData[count];
	camera.position.y =  gpsData[count+1][0];
	camera.position.z =  gpsData[count+1][1];
	camera.position.x =  gpsData[count+1][2];
	target.y = gpsData[count + 5][0];
	target.z = gpsData[count + 1][1];
	target.x = gpsData[count + 1][2];
	//camera.position.set(new THREE.Vector3(positionArr[2],positionArr[0],positionArr[1]));
	//camera.lookAt(new THREE.Vector3(0,100,0));
	*/
	//camera.position.set(target);
	//camera.position.x = target - 10;
	//camera.lookAt(target);
	renderer.render(scene, camera);
	if(!paused){
		count++;	
	}
	/*
	if(count+5 >= gpsData.length){
		count = 0;
	}
	*/
}

init();
animate();
