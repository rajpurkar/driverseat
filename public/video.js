angular.module('roadglApp').
service('video', function() {
	var ctx, canvas, video;
    var images = new Array();
    var zLoader;
    var currentImage = new Image();
    var scaling = 1;

	return {
		init: function(data) {
            zLoader = new JSZip(data);
			video = document.getElementById("video");
			canvas = document.getElementById("projectionCanvas");
			ctx = canvas.getContext("2d");
		},
        displayImage: function(canvasId, framenum) {
            var j = currentImage; 
            j.onload = function() {
                var c = document.getElementById(canvasId);
                var ctx = c.getContext("2d");
                c.width = j.width * scaling;
                c.height = j.height * scaling;
                ctx.drawImage(j, 0, 0, c.width, c.height);
            };
            var n = framenum + 1;
            var data = zLoader.file("re_" + n + ".jpg").asBinary();
            j.src = "data:image/jpg;base64,"+btoa(data); 
        },
	};
});
