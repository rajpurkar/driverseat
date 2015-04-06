(function (window, Image, JSZip) {
  window.myApp.
  service('video', function () {
    var images = [],
    scaling = 1

    var init = function (data) {
      var zLoader = new JSZip(data),
      files = zLoader.file(/jpg/)

      files.forEach(function (item) { // console.log(item)
        var frameNum = parseInt(item.name.split('.jpg')[0], 10)
        images[frameNum] = item.asBinary()
      })
    }

    var displayImage = function (canvasId, frameNum) {
      var j = new Image()
      j.onload = function () {
        var c = document.getElementById(canvasId)
        var ctx = c.getContext('2d')
        c.width = j.width * scaling
        c.height = j.height * scaling
        ctx.drawImage(j, 0, 0, c.width, c.height)
      }

      j.src = 'data:image/jpg;base64,' + window.btoa(images[frameNum])
      return true
    }

    return {
      init: init,
      displayImage: displayImage
    }
  })
})(window, window.Image, window.JSZip)
