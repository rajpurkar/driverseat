angular.module('roadglApp').
service('video', function() {
	var ctx, canvas, video;
    var images = new Array();
    var zLoader;
    var currentImage = new Image();

	return {
		init: function(dir,prefix,completionCB) {
            JSZipUtils.getBinaryContent('280N_a604/re.zip', function(err, data) {
                if(err) {
                    throw err; // or handle err
                }

                zLoader = new JSZip(data);
                completionCB(null, 'video_init');
            });
			video = document.getElementById("video");
			canvas = document.getElementById("projectionCanvas");
			ctx = canvas.getContext("2d");
            canvas.width = 320;
            canvas.height = 200;
		},
        displayPreloadedImage: function(canvasId, num) {
            var j = images[num];
            var c = document.getElementById(canvasId);
            c.width = j.width;
            c.height = j.height;
            ctx.drawImage(j, 0, 0, j.width, j.height);
        },
        displayImage: function(canvasId, framenum) {
            var j = currentImage; 
            j.onload = function() {
                var c = document.getElementById(canvasId);
                var ctx = c.getContext("2d");
                ctx.drawImage(j, 0, 0, c.width, c.height);
            };
            var n = framenum + 1;
            var data = zLoader.file("re_" + n + ".jpg").asBinary();
            j.src = "data:image/jpg;base64,"+btoa(data); 
        },
	};
});
