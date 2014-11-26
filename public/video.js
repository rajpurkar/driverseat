myApp.
service('video', function() {
	var ctx, canvas, video;
    var images = new Array();
    var zLoader;
    var currentImage = new Image();
    var maxFrameNum = 0;
    var scaling = 1;

	return {
		init: function(data) {
            zLoader = new JSZip(data);
			video = document.getElementById("video");
			canvas = document.getElementById("projectionCanvas");
			ctx = canvas.getContext("2d");
            files = zLoader.file(/jpg/);
            files.forEach( function(item) {
                //console.log(item);
                var frameNum = parseInt(item.name.split('.jpg')[0]);
                images[frameNum] = item.asBinary();
            });

		},
        displayImage: function(canvasId, frameNum) {
            var j = new Image();
            j.onload = function() {
                var c = document.getElementById(canvasId);
                var ctx = c.getContext("2d");
                c.width = j.width * scaling;
                c.height = j.height * scaling;
                ctx.drawImage(j, 0, 0, c.width, c.height);
            };
            j.src = "data:image/jpg;base64,"+btoa(images[frameNum]);
            return true;
        },
	};
});
