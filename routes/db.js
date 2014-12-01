var mongoose = require('mongoose');
var fs = require('fs');
var moment = require('moment');
var Busboy = require('busboy');

module.exports = {
    initdb: function(){
        try {
            var filename = "./credentials";
            if (fs.existsSync(filename)) {
                var data     = fs.readFileSync(filename, 'utf-8'),
                    credList = data.replace(' ', '').trim().split(','),
                    user     = credList[0], pass = credList[1],
                    url      = 'mongodb://' + user + ':' + pass + '@ds053140.mongolab.com:53140/roadgldatabase';
                console.log('Connected to Remote DB!');
                mongoose.connect(process.env.MONGOHQ_URL || url);
            } else {
                mongoose.connect(process.env.MONGOHQ_URL || 'mongodb://localhost/roadgl');
                console.log('Connected to Local DB! Remember to start your mongodb');
            }
        } catch (err) {
            console.log(err);
        }
    },
    saveEdit: function(req, res, next) {
        var busboy = new Busboy({ headers: req.headers });
        busboy.on("file", function(fieldname, stream) {
            var path = "./public/runs/" + fieldname + "/lanes/",
                username = req.session.user.username,
                filename = moment().unix() + "_" + username + ".json.zip";
            if (!fs.existsSync(path)) {
                res.status(500).end();
                stream.resume();
                return;
            }
            // stream.on("data", function(data) {
            //     // console.log(data.length);
            // });
            stream.pipe(fs.createWriteStream(path + filename));
        });
        busboy.on("finish", function() {
            res.status(200).end();
            // next();
        });
        req.pipe(busboy);
    },
    getLatestEdit: function(route) {
        var trackName = route,
            path = "./public/runs/" + trackName + "/lanes";

        var files = fs.readdirSync(path);
        if (files.length < 1) {
            res.status(500).end();
            return;
        }

        files.sort(function(f1, f2) {
            var ts1 = parseInt(f1.split("_")[0], 10),
                ts2 = parseInt(f2.split("_")[0], 10);
            if (isNaN(ts2-ts1))
                return isNaN(ts1) ? 1 : -1; // invalid filenames get pushed to back
            return ts2 - ts1;
        });
        return files[0];
    }
};
