var fs = require('fs');

module.exports = {
	level2Search: function(path){
		var dirs = fs.readdirSync(path);
		var list = {};
		dirs.forEach(function (file) {
			if(fs.statSync(path+'/'+file).isDirectory()){
				list[file] = fs.readdirSync(path+"/" + file).filter(function (file2){
					return fs.statSync(path+'/'+file + "/" + file2).isDirectory();
				});
			}
		});
		return list;
	},
	initializeLocals: function(req, res, next){
		res.locals.title = "RoadGL";
	    var err = req.session.error, msg = req.session.success;
	    delete req.session.error;
	    delete req.session.success;
	    res.locals.message = '';
	    if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
	    if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
	    next();
	}
}