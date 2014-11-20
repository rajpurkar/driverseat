var mongoose = require('mongoose');
var fs = require('fs');
var moment = require('moment');

module.exports = {
	initdb: function(){
		try {
			var filename = "./credentials";
			if (fs.existsSync(filename)) {
				var data = fs.readFileSync(filename, 'utf-8'),
					credList = data.replace(' ', '').trim().split(','),
					user = credList[0], pass = credList[1],
					url = 'mongodb://' + user + ':' + pass + '@ds053140.mongolab.com:53140/roadgldatabase';
				console.log('Connected to Remote DB!');
				mongoose.connect(process.env.MONGOHQ_URL || url);
			}else{
				mongoose.connect(process.env.MONGOHQ_URL || 'mongodb://localhost/roadgl');
				console.log('Connected to Local DB! Remember to start your mongodb');
			}
		} catch (err) {
			console.log(err);
		}
	},
	saveEdit: function(req, res, next){
		/*TODO : fix function */
		var lanes = req.body.lanes,
			track = req.body.track,
			filename = track + "/" + moment().unix(),
			path = "/tmp",
			completepath = path+ "/" + filename.trim();
		fs.mkdirSync(completepath);
		fs.writeFile(completepath , lanes, function(err) {
			if(err) {
				console.log(err);
				res.status(500).end();
			} else {
				console.log("The file was saved!");
				res.status(200).end();
			}
		});
	}
}