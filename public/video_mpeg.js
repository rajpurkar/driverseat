myApp.
service('video_mpeg', function() {
    var images;
    var scaling = 1;
    var frameCountSaved = 0;
    var encoder = new JPEGEncoder(95);

    function encodeFrame(frame) {
        images[frameCountSaved] = encoder.encode(frame);
        frameCountSaved++;
    }

    function loadImage() {
        var frame = player.nextFrame();
        if (frame == null) return;
        encodeFrame(frame);
        setTimeout(loadImage, 0);
    }

    return {
        init: function(jsmpeg_player) {
            player = jsmpeg_player;
            images = new Array(player.calculateFrameCount());
            console.log("frames: " + player.calculateFrameCount());
            setTimeout(loadImage, 5);
        },
        displayImage: function(canvasId, framenum) {

            var c = document.getElementById(canvasId);
            var ctx = c.getContext("2d");
            if (framenum < frameCountSaved) {

                var j = new Image();
                j.onload = function() {
                    var c = document.getElementById(canvasId);
                    var ctx = c.getContext("2d");
                    c.width = j.width * scaling;
                    c.height = j.height * scaling;
                    ctx.drawImage(j, 0, 0, c.width, c.height);
                };
                j.src = images[framenum];
                return true;
            } else {
                return false;
            }
        },
    };
});