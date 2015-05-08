var db = require('../routes/db')
var Category = require('../routes/category')
var fs = require('fs')
var moment = require('moment')

var main = function (callback) {
  db.initdb() // setup connection to the database
  Category.find({}, function (err, categories) {
    if (err) {
      console.error(err)
    } else {
      var folder_name = moment().format('ll')
      fs.mkdirSync('./' + folder_name)
      categories.forEach(function (cat) {
        var wstream = fs.createWriteStream('./' + folder_name + '/' + cat.name + '.txt', { flags: 'w'})
        cat.tags.forEach(function (tag) {
          var runAndTrack = tag.run + '/' + tag.track
          /* to get the camera frame, need to multiply by 0.8 before 360,
          * and 0.4 after the 360 cameras were installed */
          var startAndEndFrame = tag.startFrame + ' ' + tag.endFrame
          wstream.write(runAndTrack + ' ' + startAndEndFrame + '\n')
        })
        wstream.end()
      })
      callback && callback()
    }
  })
}

if (require.main === module) {
  main(function () {
    db.closedb()
  })
}
