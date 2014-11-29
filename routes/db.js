var mongoose = require('mongoose');
var fs = require('fs');
var moment = require('moment');
var multiparty = require('multiparty');

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
        /*TODO : fix function */
        var form = new multiparty.Form();
        var trackName, laneData;

        form.on("error", function() {
            res.status(500).end();
        });
        form.on("close", function() {
            var tempPath = laneData.path,
                path = "./public/runs/" + trackName + "/lanes/",
                username = req.session.user.username,
                filename = moment().unix() + "_" + username + ".json.zip";

            //TODO remove this line when all runs have the 'lanes' folder
            fs.mkdirSync(path);

            fs.renameSync(tempPath, path + filename);
            res.status(200).end();
            next();
        });
        form.on("field", function(name, val) {
            switch (name) {
                case "trackName": trackName = val; break;
            }
        });
        form.on("file", function(name, val) {
            if (name != "laneData") return;
            laneData = val;
        });
        form.parse(req);
    },
    getLatestEdit: function(req, res, next) {
        var trackName = decodeURI(req.query.trackname),
            path = "./public/runs/" + trackName + "/lanes";

        var files = fs.readdirSync(path);
        if (files.length < 1) {
            res.status(500).end();
            return;
        }

        files.sort(function(f1, f2) {
            var ts1 = f1.split("_")[0],
                ts2 = f2.split("_")[0];
            return ts2 - ts1;
        });
        console.log(files);
        res.send(files[0]);
    }
};
