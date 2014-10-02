var renderer;
var camera;
var scene;
var geometry;
var pickLocation;
var mouse = { x: 1, y: 1 };
var projector, raycaster;
var dataFile = "files/datafile.json";
var shiftKey = false;

// Detect when shift key is being pressed for painting
document.addEventListener('keydown', function(event) {
	if (event.keyCode == 16)
		shiftKey = true;
}, false);
document.addEventListener('keyup', function(event) {
	if (event.keyCode == 16)
		shiftKey = false;
}, false);

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

 function generatePointCloud() {
 	geometry = new THREE.BufferGeometry();
 	var xhr = new XMLHttpRequest();
 	xhr.open("GET", dataFile, false);
 	xhr.send(null);
 	if (xhr.status !== 200 && xhr.status !== 0) {
 		throw new Error(dataFile + " not found");
 	}
 	var data = JSON.parse(xhr.responseText);
 	var positions = new Float32Array(3*data.length);
 	var colors    = new Float32Array(3*data.length);
 	for (var i = 0; i < data.length; i++) {
		//Note: order is changed
		positions[3*i]   = data[i][2];	//x
		positions[3*i+1] = data[i][0];	//y
		positions[3*i+2] = data[i][1];	//z
		// map intensity (0-120) to RGB
		var hue = 1 - data[i][3]/120;	//TODO: fix intensity scaling
		colors[3*i+1]   = HUEtoRGB(hue+1/3);	//r
		colors[3*i+2] = HUEtoRGB(hue);		//g
		colors[3*i+0] = HUEtoRGB(hue-1/3);	//b
	}

	geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
	
	var material = new THREE.PointCloudMaterial({ size: 0.01, vertexColors: true });
	var pointcloud = new THREE.PointCloud(geometry, material);
	
	return pointcloud;
}

function addCar(){
	
	var loader = new THREE.PLYLoader();
	loader.addEventListener( 'load', function ( event ) {

		var geometry = event.content;
		var material = new THREE.MeshBasicMaterial( {} );
		var mesh = new THREE.Mesh( geometry, material );

		mesh.position.set( -2, 30, -2 );
		mesh.rotation.set( 0, Math.PI / 2, Math.PI );
		mesh.scale.set( 1, 1, 1 );

		//mesh.castShadow = true;
		//mesh.receiveShadow = true;

		scene.add( mesh );

	} );
	loader.load('/files/gtr.ply' );
}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}


function init() {
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
	cameraTarget = new THREE.Vector3(0, 200, 0 );
	projector = new THREE.Projector();
	raycaster = new THREE.Raycaster();

	renderer = new THREE.WebGLRenderer();
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);
	
	pointcloud = generatePointCloud();
	scene.add(pointcloud);
	
	var sphereGeometry = new THREE.SphereGeometry(0.1, 32, 32);
	var sphereMaterial = new THREE.MeshBasicMaterial({color: 0xff0000, shading: THREE.FlatShading});
	pickLocation = new THREE.Mesh(sphereGeometry, sphereMaterial);
	scene.add(pickLocation);
	
	// controls
	camera.position.set(0,10,0);
	controls = new THREE.OrbitControls(camera);
	//controls.target.set( 0, 100, 0 );
	//camera.lookAt(new THREE.Vector3(0,100,0));
	addCar();

	document.addEventListener( 'mousemove', onDocumentMouseMove, false );
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

function render() {			
	
	camera.updateMatrixWorld(true);
	
	vector = new THREE.Vector3( mouse.x, mouse.y, 0.5 );
	projector.unprojectVector( vector, camera );
	raycaster.params = {"PointCloud" : {threshold: 0.1}};
	raycaster.ray.set( camera.position, vector.sub( camera.position ).normalize() );
	
	var intersects = raycaster.intersectObject(pointcloud);
	if(intersects.length > 0){
		pickLocation.position.copy(intersects[0].point);
		// Paint the points with the cursor while pressing <shift>
		if (shiftKey) {
			var pointColors = geometry.attributes.color.array;
			for (var i = 0; i < intersects.length; i++) {
				var index = 3*intersects[i].index;
				pointColors[index] = 255;
				pointColors[index+1] = 255;
				pointColors[index+2] = 255;
			}
			geometry.attributes.color.needsUpdate = true;
		}
	}
	var timer = Date.now() * 0.0005;

	//camera.position.y +=  Math.abs(Math.cos( timer )) *.3 ;
	camera.position.y +=  0.3;
	//camera.position.z += Math.cos( timer ) * 0.03;

	camera.lookAt( cameraTarget );

	renderer.render( scene, camera );

	renderer.render(scene, camera);
}

init();
animate();
