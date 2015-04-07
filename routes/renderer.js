var Category = require('./category')
var util = require('./util')
var db = require('./db')
var Tag = require('./tag')

exports.edit = function (req, res) {
  Category.find({}, function (err, categories) {
    var startFrame = req.query.startFrame
    var endFrame = req.query.endFrame
    if (err) return console.error('Cannot fetch metadata categories for run page')
    var editor = req.query.editor,
      track = req.query.route,
      lanesFile = req.query.filename
    if (!track) res.redirect('/browse')

    var numCams = req.query.cameras
    if (!numCams) numCams = 1

    // var lanesFile = db.getLatestEdit(track)
    var datafilesPath = '/runs/' + track + '/'
    var dataFiles = {
      points: datafilesPath + 'map.json.zip',
      gps: datafilesPath + 'gps.json.zip',
      lanes: datafilesPath + 'lanes/' + lanesFile,
      planes: datafilesPath + 'planes.json.zip',
      video: datafilesPath + 'cam_2.mpg',
      radar: datafilesPath + 'radar.json.zip',
      carDetection: datafilesPath + 'bbs-cam2.json',
      carDetectionVerified: datafilesPath + 'bbs-cam2-verified.json',
      params: '/files/q50_4_3_14_params.json',
      precisionAndRecall: '/files/precision_and_recall.json'
    }
    // We currently only have lane detection data for the sanrafael_e track
    if (track === '4-11-14-sanrafael/sanrafael_e') {
      dataFiles.laneDetection = '/4-11-14-sanrafael-sanrafael_e1_combined_lanepred_subsample.json'
    }
    res.render('index', {
      editor: editor,
      numCameras: numCams,
      categories: categories,
      trackInfo: {
        track: track,
        startFrame: startFrame,
        endFrame: endFrame,
        lanesFilename: lanesFile,
        files: dataFiles
      },
      laneTypes: [
        'white_dotted',
        'white_solid',
        'white_dotted_solid',
        'white_solid_dotted',
        'white_solid_solid',
        'yellow_dotted',
        'yellow_solid',
        'yellow_dotted_solid',
        'yellow_solid_dotted',
        'yellow_solid_solid'
      ]
    })
  })
}

exports.browse = function (req, res) {
  // TODO(rchengyue): Cache level3Search and refresh periodically.
  var user = req.session.user.username,
    runs = util.level3Search('./public/runs', user),
    prettyPrint = db.prettyPrint(runs)
  var args = {
    runs: prettyPrint.runs,
    filenames: prettyPrint.filenames,
    user: user
  }
  res.render('browser', args)
}

exports.tag = function (req, res) {
  if (req.query.route) {
    var route = req.query.route.split('/')
    Tag.find({
      run: route[0],
      track: route[1]
    }).populate('category', 'name displayColor description').exec(function (err, tags) {
      if (err) return res.status(500).send('Cannot fetch metadata tags for tags page')
      res.send(tags)
    })
  } else {
    Category.find(function (err, categories) {
      if (err) return res.status(500).send('Cannot fetch metadata tags for tags page')
      res.render('tags', {
        categories: categories
      })
    })
  }
}
