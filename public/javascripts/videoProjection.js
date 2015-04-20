(function (window, THREE, Worker) {
  'use strict'

  window.myApp.
  service('videoProjection', function (util) {
    var last_pix // this needs to be refactored

    function CameraIntrinsics (c) {
      return new THREE.Matrix4(
        c.fx, 0, c.cu, 0,
        0, c.fy, c.cv, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      )
    }

    function create_R_from_l_to_c (cam) {
      var coordinate_change = new THREE.Matrix4(
        0, -1, 0, 0,
        0, 0, -1, 0,
        1, 0, 0, 0,
        0, 0, 0, 1)
      coordinate_change.multiplyMatrices(util.Matrix4FromJSON3x3(cam.R_to_c_from_l_in_camera_frame), coordinate_change)
      return coordinate_change
    }

    function create_T_from_l_to_c (cam) {
      var R_from_l_to_c = create_R_from_l_to_c(cam)
      var trans = cam.displacement_from_l_to_c_in_lidar_frame
      var T = new THREE.Matrix4()
      T.makeTranslation(trans[0], trans[1], trans[2])
      T.multiplyMatrices(R_from_l_to_c, T)
      return T
    }

    function processWorkerMessage (oEvent) {
      var msg = oEvent.data

      var canvasId = msg.canvasId
      var c = document.getElementById(canvasId)
      var ctx = c.getContext('2d')
      var pix = msg.pix
      last_pix = pix
      return
    }

    function computeProjectionMatrix (imu_loc_t, params) {
      var p = params
      var imu_transforms_t = util.Matrix4FromJSON4x4(imu_loc_t)
      var inv_imu_transforms_t = new THREE.Matrix4()
      inv_imu_transforms_t.getInverse(imu_transforms_t)

      var T = new THREE.Matrix4()
      // read this backwards
      T.multiply(p.KK) // camera intrinsics
      T.multiply(p.T_Extrinsics) // camera extrinsics
      T.multiply(p.T_from_l_to_c) // lidar_t -> camera_t
      T.multiply(p.T_from_i_to_l) // imu_t -> lidar_t
      T.multiply(inv_imu_transforms_t) // imu_0 -> imu_t
      T.multiply(p.T_THREE_to_imu_0)// from THREE_JS frame to imu_0
      var M = T.elements

      return M

    }

    function projectPoints (canvasId, data, color_data, imu_loc_t, params) {
      var p = params
      var M = computeProjectionMatrix(imu_loc_t, params)
      p.worker.postMessage({
        data: data.buffer,
        color_data: color_data.buffer,
        M: M.buffer,
        canvasId: canvasId
      })
    }

    function synchronizeState (tracking_clouds, target_state, worker) {
      for (var idx in tracking_clouds) {
        var updateState = false
        if (tracking_clouds[idx] === undefined &&
          target_state[idx] === undefined) {
          continue
        } else if (tracking_clouds[idx] !== undefined &&
          target_state[idx] === undefined) {
          updateState = true
        } else if (tracking_clouds[idx].geometry.uuid !== target_state[idx].uuid ||
          tracking_clouds[idx].geometry.attributes.position.needsUpdate ||
          tracking_clouds[idx].geometry.attributes.color.needsUpdate) {
          updateState = true
        }

        if (updateState) {
          // console.log("updating state")
          var uuid = tracking_clouds[idx].geometry.uuid
          var attr = tracking_clouds[idx].geometry.attributes
          var positions = new Float32Array(attr.position.array)
          var colors = new Float32Array(attr.color.array)
          target_state[idx] = {
            uuid: uuid,
            positions: positions,
            colors: colors
          }
          // also update worker state
          if (worker) {
            worker.postMessage({
              cmd: 'update_state',
              idx: idx,
              state: target_state[idx]
            })
          }
        }
      }

      for (var id in target_state) {
        if (tracking_clouds[id] === undefined) {
          delete target_state[id]
          // also update worker state
          if (worker) {
            worker.postMessage({
              cmd: 'delete_state',
              idx: id
            })
          }
        }
      }
    }

    return {
      init: function (calibration_params, camera_idx, clouds) {
        var params = calibration_params
        var cam_idx = camera_idx
        var cam = params.cam[cam_idx]

        var T_imu_0_to_THREE = new THREE.Matrix4(
          0, 1, 0, 0,
          0, 0, 1, 0,
          1, 0, 0, 0,
          0, 0, 0, 1)

        var T_THREE_to_imu_0 = new THREE.Matrix4()
        T_THREE_to_imu_0.getInverse(T_imu_0_to_THREE)
        var T_from_l_to_i = util.Matrix4FromJSON4x4(params.lidar.T_from_l_to_i)
        var T_from_i_to_l = new THREE.Matrix4()
        T_from_i_to_l.getInverse(T_from_l_to_i)

        var KK = CameraIntrinsics(cam)
        var T_from_l_to_c = create_T_from_l_to_c(cam)
        var T_Extrinsics = util.Matrix4FromJSON4x4(cam.E)

        var worker = new Worker('/javascripts/projectionWorker.js')
        worker.onmessage = processWorkerMessage

        return {
          T_imu_0_to_THREE: T_imu_0_to_THREE,
          T_THREE_to_imu_0: T_THREE_to_imu_0,
          T_from_l_to_i: T_from_l_to_i,
          T_from_i_to_l: T_from_i_to_l,
          T_from_l_to_c: T_from_l_to_c,
          T_Extrinsics: T_Extrinsics,
          params: params,
          cam_idx: cam_idx,
          cam: cam,
          KK: KK,
          worker: worker,
          scene_state: {},
          tracking_clouds: clouds
        }
      },
      projectScene: function (canvasId, imu_loc_t, params) {
        var p = params
        synchronizeState(p.tracking_clouds, p.scene_state, p.worker)
        var M = computeProjectionMatrix(imu_loc_t, params)
        p.worker.postMessage({
          cmd: 'project_state',
          M: M.buffer,
          canvasId: canvasId
        })

        var c = document.getElementById(canvasId)
        var ctx = c.getContext('2d')
        for (var idx in last_pix) {
          var px = last_pix[idx][0]
          var py = last_pix[idx][1]
          var r = last_pix[idx][2]
          var g = last_pix[idx][3]
          var b = last_pix[idx][4]
          var a = 255
          ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (a / 255) + ')'
          ctx.fillRect(px, py, 2, 2)
        }
      },

      projectCloud: function (canvasId, cloud, imu_loc_t, params) {
        var data = cloud.geometry.attributes.position.array
        var color_data = cloud.geometry.attributes.color.array
        projectPoints(canvasId, data, color_data, imu_loc_t, params)
      }
    }
  })
})(window, window.THREE, window.Worker)
