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
    level3Search: function(path, username) {
        if (!fs.existsSync(path)) return {};
        var dirs = fs.readdirSync(path);
        var list = {};
        dirs.forEach(function(dir) {
            var dirPath = path+"/"+dir;
            if (!fs.statSync(dirPath).isDirectory()) return;
            list[dir] = {};
            var subdirs = fs.readdirSync(dirPath);
            subdirs.forEach(function(subdir) {
                var subdirPath = dirPath+"/"+subdir;
                if (!fs.statSync(subdirPath).isDirectory()) return;
                if (!fs.existsSync(subdirPath+"/lanes")) return;
                var files = fs.readdirSync(subdirPath+"/lanes").filter(function(file) {
                    if (fs.statSync(subdirPath+"/lanes/"+file).isDirectory()) return false;
                    var tokens = file.split("_");
                    if (tokens.length > 2 && tokens[2].match("autosave"))
                        return tokens[1] == username;
                    return true;
                })
                list[dir][subdir] = files;
            });
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
