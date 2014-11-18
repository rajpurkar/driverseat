var debug = require('debug')('roadgl');
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var fs = require('fs');
var moment = require('moment');
var session = require('express-session')
var mongoose = require('mongoose');

mongoose.connect(process.env.MONGOHQ_URL || 'mongodb://localhost/roadgl');

var hash = require('./routes/hash').hash;
var auth = require('./routes/auth');
var User = require('./routes/user');
var util = require('./routes/util');
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
app.use(session({secret: "woah cat", saveUninitialized: true, resave: false}));
app.use(express.static(path.join(__dirname, 'public'), {maxAge: '1d'}));

app.use(function (req, res, next) {
    var err = req.session.error,
    msg = req.session.success;
    delete req.session.error;
    delete req.session.success;
    res.locals.message = '';
    if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
    if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
    next();
});


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

app.get("/signup", function (req, res) {
    if (req.session.user) {
        res.redirect("/");
    } else {
        res.render("login");
    }
});

app.post("/signup", userExist, function (req, res) {
    var password = req.body.password;
    var username = req.body.username;
    var fullname = req.body.fullname;

    hash(password, function (err, salt, hash) {
        if (err) throw err;
        var user = new User({
            username: username,
            fullname: fullname,
            salt: salt,
            hash: hash,
        }).save(function (err, newUser) {
            if (err) throw err;
            auth.authenticate(newUser.username, password, function(err, user){
                if(user){
                    req.session.regenerate(function(){
                        req.session.user = user;
                        res.redirect('/');
                    });
                }
            });
        });
    });
});

app.get("/login", function (req, res) {
    res.render("login");
});

app.post("/login", function (req, res) {
    auth.authenticate(req.body.username, req.body.password, function (err, user) {
        if (user) {
            req.session.regenerate(function () {
                req.session.user = user;
                res.redirect('/');
            });
        } else {
            req.session.error = 'Authentication failed, please check your ' + ' username and password.';
            res.redirect('/login');
        }
    });
});

app.post('/logout', function (req, res) {
    req.session.destroy(function () {
        res.redirect('/');
    });
});

app.get('/show', function(req, res, next){
    var track = req.query.route;
    var numCams = req.query.cameras;
    if(!track) track = "gilroy/to_gilroy_b";
    if(!numCams) numCams = 2;
    res.render('index', {track: track, numCameras: numCams});
});

app.get("/", requiredAuthentication, function (req, res) {
  User.find(function(error, users){
        res.render('browser', {dir: util.level2Search('./public/runs'), users: users, user: req.session.user.username});
    });
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


function requiredAuthentication(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        req.session.error = 'Access denied!';
        res.redirect('/login');
    }
}

function userExist(req, res, next) {
    User.count({
        username: req.body.username
    }, function (err, count) {
        if (count === 0) {
            next();
        } else {
            req.session.error = "User Exist";
            res.redirect("/");
        }
    });
}

module.exports = app;

app.set('port', process.env.PORT || 3000);

var server = app.listen(app.get('port'), function() {
  debug('Express server listening on port ' + server.address().port);
});
