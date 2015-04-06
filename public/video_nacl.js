(function (window, Image, XMLHttpRequest) {
  'use strict'

  // TODO PSR: better way?
  window.VideoNACL = function(cam_file, id, parent_id, downloadCb) {
    this.VideoNACLModule = null
    this.nacl_id = id
    this.statusText = 'NO-STATUS'
    var nacl = this
    var bytes = null
    var images = []

    nacl.displayImage = function (canvasId, framenum) {
      if (images[framenum]) {
        var j = images[framenum]
        var c = document.getElementById(canvasId)
        var ctx = c.getContext('2d')
        c.width = j.width
        c.height = j.height
        ctx.drawImage(j, 0, 0, c.width, c.height)
        return true
      } else {
        return false
      }
    }

    nacl.loadCallback = function (data) {
      bytes = new Uint8Array(data)
      // console.log(bytes.length)
      var command = {
        cmd: 'raw_data',
        data: bytes.buffer,
        length: bytes.length
      }
      // console.log(command)
      nacl.VideoNACLModule.postMessage(command)
    }

    nacl.load = function (url) {
      this.url = url

      var request = new XMLHttpRequest()
      request.onreadystatechange = function () {
        if (request.readyState === request.DONE && request.status === 200) {
          if (downloadCb) {
            downloadCb()
          }
          nacl.loadCallback(request.response)
        }
      }

      request.open('GET', url)
      request.responseType = 'arraybuffer'
      request.send()
    }

    nacl.moduleDidLoad = function () {
      nacl.VideoNACLModule = document.getElementById(nacl.nacl_id)
      nacl.load(cam_file)
    }

    nacl.handleMessage = function (message_event) {
      var data = message_event.data
      if (data.Type === 'CompressedJPEG') {
        images[data.FrameCount] = new Image()
        images[data.FrameCount].src = data.Data
      }
    }

    var embed_div = document.createElement('div')
    embed_div.setAttribute('id', 'div_' + id)
    embed_div.addEventListener('load', this.moduleDidLoad, true)
    embed_div.addEventListener('message', this.handleMessage, true)
    var embed_obj = document.createElement('embed')
    embed_obj.setAttribute('id', id)
    embed_obj.setAttribute('width', 0)
    embed_obj.setAttribute('height', 0)
    embed_obj.setAttribute('src', 'pnacl/Release/av_pnacl.nmf')
    embed_obj.setAttribute('type', 'application/x-pnacl')
    embed_div.appendChild(embed_obj)

    document.getElementById(parent_id).appendChild(embed_div)

  }
})(window, window.Image, window.XMLHttpRequest)
