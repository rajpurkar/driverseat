angular.module('roadglApp').
service('boundingBoxes', function() {
    var boundingBoxesData;

    return {
        init: function(data) {
            boundingBoxesData = data;
        },
        drawBoundingBoxes: function(canvasId, frameNum) {
            if (frameNum < boundingBoxesData.length) {
                var boxes = boundingBoxesData[frameNum];
                for (var i = 0; i < boxes.length; i++) {
                    var rect = boxes[i].rect;
                    var x = rect[0]/4;
                    var y = rect[1]/4;
                    var width = rect[2]/4;
                    var height = rect[3]/4;

                    var c = document.getElementById(canvasId);
                    var ctx = c.getContext("2d");
                    ctx.rect(x, y, width, height);
                    ctx.stroke();
                }
                return true;
            }
        },
    };
});
