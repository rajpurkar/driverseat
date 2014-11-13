var debug = require('debug')('roadgl');
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var fs = require('fs');
var moment = require('moment');
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), {maxAge: '1d'}));

app.post('/save', function(req, res, next){
    var lanes = req.body.lanes; 
    var track = req.body.track; 
    var filename = track + ":" + moment().unix();
    var path = '/tmp';
    fs.writeFile(path+ "/" + filename, lanes, function(err) {
        if(err) {
            console.log(err);
            res.status(500).end();
        } else {
            console.log("The file was saved!");
            res.status(200).end();
        }
    });
});

app.get('/', function(req, res, next){
   var track = req.query.route;
   var numCams = req.query.cameras;
   if(!track) track = "4-2-14-Monterey";
   if(!numCams) numCams = 2;
   res.render('index', {track: track, numCameras: numCams})
});

function level2Search(path) {
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

app.get('/list', function(req, res, next){
    res.render('files', {dir: level2Search('./public/sample')});
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;

app.set('port', process.env.PORT || 3000);

var server = app.listen(app.get('port'), function() {
  debug('Express server listening on port ' + server.address().port);
});
