angular.module('roadglApp').
service('video', function() {
	var playing = false;
	var ctx, canvas, video;
	var framerate = 25;//29.914;
	var width = 320;//320
	var height = 180;//240

	paintFrame = function() {
		// console.log(timestamp, "paintframe");
		ctx.drawImage(video, 0, 0, width, height);
		// ctx.beginPath();
		// ctx.moveTo(100, 150);
		// ctx.lineTo(300, 50);
		// ctx.stroke();
	};

	return {
		init: function() {
			video = document.getElementById("video");
			canvas = document.getElementById("projectionCanvas");
			ctx = canvas.getContext("2d");
			canvas.width = width;
			canvas.height = height;
			video.addEventListener("seeked", paintFrame);
			video.addEventListener("loadedmetadata", function() {
				console.log("loaded metadata");
			}, false);
		},
		nextFrame: function() {
			video.currentTime += 1/framerate;
		},
		restart: function() {
			video.currentTime = 0;
		}
	};
});
