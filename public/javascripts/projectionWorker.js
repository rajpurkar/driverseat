(function (global) {
  'use strict'

  var state = []

  // TODO : figure out whether this function is required
  global.onmessage = function (oEvent) {
    // console.log("data recv")
    var msg = oEvent.data
    var M
    if (msg.cmd === 'project_cloud') {
      // make a float32array around the buffer passed
      var data = new Float32Array(msg.data)
      var color_data = new Float32Array(msg.color_data)
      M = new Float32Array(msg.M)

      var valid_pix = projectPoints(data, color_data, M)
      global.postMessage({
        pix: valid_pix,
        canvasId: msg.canvasId
      })
    }

    if (msg.cmd === 'project_state') {
      M = new Float32Array(msg.M)
      var all_pix = []
      for (var idx in state) {
        var pos = state[idx].positions
        var col = state[idx].colors
        var pix = projectPoints(pos, col, M)
        for (var p in pix) {
          all_pix.push(pix[p])
        }
      // all_pix.concat(pix)
      // postMessage({ pix: pix, canvasId: msg.canvasId})
      }
      global.postMessage({
        pix: all_pix,
        canvasId: msg.canvasId
      })
    }

    if (msg.cmd === 'update_state') {
      state[msg.idx] = msg.state
    }
    if (msg.cmd === 'delete_state') {
      delete state[msg.idx]
    }

    if (msg.cmd === 'print_state') {
      console.log(state)
    }
  }

  function projectPoints (data, color_data, M) {
    var scaling = 4
    var c = {}
    c.width = 1280 / scaling
    c.height = 960 / scaling

    var valid_pix = []
    for (var idx = 0; idx < data.length / 3; idx += 3) {
      var x = data[3 * idx + 0]
      var y = data[3 * idx + 1]
      var z = data[3 * idx + 2]

      var u = M[0] * x + M[4] * y + M[8] * z + M[12]
      var v = M[1] * x + M[5] * y + M[9] * z + M[13]
      var s = M[2] * x + M[6] * y + M[10] * z + M[14]

      var px = u / (s * scaling)
      var py = v / (s * scaling)

      if (px > 0 && py > 0 && px < c.width && py < c.height && s > 0 && s < 100) {
        var r = parseInt(color_data[3 * idx + 0] * 255, 10)
        var g = parseInt(color_data[3 * idx + 1] * 255, 10)
        var b = parseInt(color_data[3 * idx + 2] * 255, 10)
        valid_pix.push([px, py, r, g, b])
      }
    }
    return valid_pix
  }
})(this)
