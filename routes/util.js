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
	}
}