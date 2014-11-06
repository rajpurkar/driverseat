angular.module('roadglApp').
service('video', function() {
	var ctx, canvas, video;
    var images = new Array(); 

	return {
		init: function(dir,prefix) {
			video = document.getElementById("video");
			canvas = document.getElementById("projectionCanvas");
			ctx = canvas.getContext("2d");
            for (i = 0; i < 600; i++) { 
                images[i] = new Image();
                var n = i + 1;
                images[i].onload = function() { 
                    console.log("loaded image");
                }
                images[i].src = dir + "/" + prefix + n + ".jpg";
            }
		},
        displayPreloadedImage: function(canvasId, num) {
            var j = images[num];
            var c = document.getElementById(canvasId);
            c.width = j.width;
            c.height = j.height;
            ctx.drawImage(j, 0, 0, j.width, j.height);
        },
        displayImage: function(canvasId, url) {
            var j = new Image(); 
            j.onload = function() {
                var c = document.getElementById(canvasId);
                c.width = j.width;
                c.height = j.height;
                var ctx = c.getContext("2d");
                ctx.drawImage(j, 0, 0, j.width, j.height);
            };
            j.src = url;
        },
	};
});
