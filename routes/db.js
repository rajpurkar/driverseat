var mongoose = require('mongoose')
var fs = require('fs')
var moment = require('moment')
var Busboy = require('busboy')
var Category = require('./category')
var Tag = require('./tag')

module.exports = {
  initdb: function () {
    try {
      var filename = './credentials'
      if (fs.existsSync(filename)) {
        var data = fs.readFileSync(filename, 'utf-8'),
          credList = data.replace(' ', '').trim().split(','),
          user = credList[0], pass = credList[1],
          url = 'mongodb://' + user + ':' + pass + '@ds053140.mongolab.com:53140/roadgldatabase'
        console.log('Connected to Remote DB!')
        mongoose.connect(process.env.MONGOHQ_URL || url)
      } else {
        mongoose.connect(process.env.MONGOHQ_URL || 'mongodb://localhost/roadgl')
        console.log('Connected to Local DB! Remember to start your mongodb')
      }
    } catch (err) {
      console.log(err)
    }
  },
  saveEdit: function (req, res) {
    var busboy = new Busboy({ headers: req.headers })
    var path, username
    busboy.on('file', function (fieldname, stream) {
      path = './public/runs/' + fieldname + '/lanes/'
      username = req.session.user.username
      var filename = moment().unix() + '_' + username + '.json.zip'
      if (!fs.existsSync(path)) {
        res.status(500).end()
        stream.resume()
        return
      }
      // stream.on("data", function(data) {
      //     // console.log(data.length)
      // })
      stream.pipe(fs.createWriteStream(path + filename))
    })
    busboy.on('finish', function () {
      res.status(200).end()
      var autosaveFiles = fs.readdirSync(path).filter(function (file) {
        var tokens = file.split('_')
        return tokens.length > 2 && tokens[1] === username && tokens[2].match('autosave')
      })
      for (var i = 0; i < autosaveFiles.length; i++) {
        fs.unlinkSync(path + autosaveFiles[i])
      }
    })
    req.pipe(busboy)
  },
  autosaveEdit: function (req, res) {
    var busboy = new Busboy({ headers: req.headers })
    busboy.on('file', function (fieldname, stream) {
      var path = './public/runs/' + fieldname + '/lanes/',
        username = req.session.user.username,
        filename = moment().unix() + '_' + username + '_autosave.json.zip'
      if (!fs.existsSync(path)) {
        res.status(500).end()
        stream.resume()
        return
      }
      stream.pipe(fs.createWriteStream(path + filename))
    })
    busboy.on('finish', function () {
      res.status(200).end()
    })
    req.pipe(busboy)
  },
  prettyPrint: function (runs) {
    var filenames = {}
    for (var run in runs) {
      for (var track in runs[run]) {
        var edits = runs[run][track]
        edits.sort(function (f1, f2) {
          var ts1 = parseInt(f1.split('_')[0], 10),
            ts2 = parseInt(f2.split('_')[0], 10)
          if (isNaN(ts2 - ts1)) {
            return isNaN(ts1) ? 1 : -1 // invalid filenames get pushed to back
          }
          return ts2 - ts1
        })
        for (var i = 0; i < edits.length; i++) {
          var oldname = edits[i]
          edits[i] = edits[i].replace('.json.zip', '')
          var tokens = edits[i].split('_')
          var time = parseInt(tokens[0], 10)
          if (isNaN(time)) {
            filenames[edits[i]] = oldname
            continue
          }
          tokens[0] = moment.unix(time).format('MM/DD/YY h:mm:ss A')
          edits[i] = tokens.join('_')
          filenames[edits[i]] = oldname
        }
      // console.log(edits)
      }
    }
    return {
      runs: runs,
      filenames: filenames
    }
  },
  saveCategory: function (req, res) {
    var name = req.body.name
    var displayColor = req.body.displayColor
    var description = req.body.description

    new Category({
      name: name,
      displayColor: displayColor,
      description: description,
      tags: []
    }).save(function (err, newCategory) {
      if (err) throw err
      res.status(200).send(newCategory)
    })
  },
  saveTag: function (req, res) {
    var startFrame = req.body.startFrame
    var endFrame = req.body.endFrame
    var runTrack = req.body.runTrack.split('/')
    var run = runTrack[0]
    var track = runTrack[1]
    var lanesFilename = req.body.lanesFilename
    var description = req.body.description
    var categoryId = req.body.categoryId

    Category.findOne({
      _id: categoryId
    }, function (err, category) {
      if (err) {
        console.log(err)
        res.status(400).send()
      }
      new Tag({
        startFrame: startFrame,
        endFrame: endFrame,
        run: run,
        track: track,
        lanesFilename: lanesFilename,
        description: description,
        category: category
      }).save(function (err, newTag) {
        if (err) throw err
        category.tags.push(newTag)
        category.save(function (err, updatedCategory) {
          if (err) throw err
          res.status(200).send(newTag)
        })
      })
    })
  },
  deleteTag: function (req, res) {
    var tagId = req.body.tagId
    Tag.findOneAndRemove({
      _id: tagId
    }, function (err, tag) {
      console.log(tag)
      console.log(err)
      if (err) {
        res.status(500).end()
        return
      }
      res.status(200).end()
    })
  }
}
