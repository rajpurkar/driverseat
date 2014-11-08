angular.module('roadglApp').
service('video', function() {
	var ctx, canvas, video;
    var images = new Array();
    var zLoader;
    var currentImage = new Image();

    function loader(i, images, dir, prefix) {
        return function(callback) {
            images[i] = new Image();
            images[i].onload = function() { 
                callback(null, 'image load' + i);
                console.log("loaded in callback");
            }
            var n = i + 1;
            var data = zLoader.file("re_" + n + ".jpg").asBinary();
            images[i].src = "data:image/jpg;base64,"+btoa(data); 
        };
    }

    function lol(res, err) {
    }

	return {
		init: function(dir,prefix,completionCB) {
            JSZipUtils.getBinaryContent('280N_a604/re.zip', function(err, data) {
                if(err) {
                    throw err; // or handle err
                }

                zLoader = new JSZip(data);
                completionCB(null, 'video_init');
                /*
                fns = [ ];
                for (i = 0; i < 600; i++) {
                    fns[i] = loader(i, images, dir, prefix);
                }

                async.parallel(fns, function(err, results) {
                    completionCB(null, 'video_init');   
                });
                */
            });
			video = document.getElementById("video");
			canvas = document.getElementById("projectionCanvas");
			ctx = canvas.getContext("2d");
            /*
            for (i = 0; i < 600; i++) { 
                images[i] = new Image();
                var n = i + 1;
                images[i].onload = function() { 
                    console.log("loaded image");
                }
                images[i].src = dir + "/" + prefix + n + ".jpg";
            }
            */
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
                c.width = j.width;
                c.height = j.height;
                var ctx = c.getContext("2d");
                ctx.drawImage(j, 0, 0, j.width, j.height);
            };
            var n = framenum + 1;
            var data = zLoader.file("re_" + n + ".jpg").asBinary();
            j.src = "data:image/jpg;base64,"+btoa(data); 
            //j.src = url;
        },
	};
});
