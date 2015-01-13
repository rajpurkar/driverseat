var debug = require("debug")("roadgl");
var express = require("express");
var path = require("path");
var favicon = require("serve-favicon");
var logger = require("morgan");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
var session = require("express-session");
var auth = require("./routes/auth");
var User = require("./routes/user");
var util = require("./routes/util");
var db = require("./routes/db");
var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

// uncomment after placing your favicon in /public
app.use(favicon(__dirname + "/public/favicon.ico"));
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({secret: "woah cat", saveUninitialized: true, resave: false}));
app.use(express.static(path.join(__dirname, "public"), {maxAge: "1d"}));
app.use(util.initializeLocals);
db.initdb();

app.get("/edit", auth.requiredAuthentication, function(req, res) {
    var track = req.query.route,
        lanesFile = req.query.filename;
    if (!track) res.redirect('/browse');

    var numCams = req.query.cameras;
    if (!numCams) numCams = 1;

    // var lanesFile = db.getLatestEdit(track);
    var datafilesPath = "/runs/" + track + "/";
    res.render("index", {
        numCameras: numCams,
        trackInfo: {
            track: track,
            files: {
                points:        datafilesPath + "map.json.zip",
                gps:           datafilesPath + "gps.json.zip",
                lanes:         datafilesPath + "lanes/" + lanesFile,
                planes:        datafilesPath + "planes.json.zip",
                video:         datafilesPath + "cam_2.mpg",
                radar:         datafilesPath + "radar.json.zip",
                boundingBoxes: datafilesPath + "bbs-cam2.json",
                params:        "/q50_4_3_14_params.json"
            }
        }
    });
});

app.get("/", function(req, res){
    res.redirect('/browse');
});

app.get("/browse", auth.requiredAuthentication, function(req, res) {
    var user = req.session.user.username,
        runs = util.level3Search("./public/runs", user),
        prettyPrint = db.prettyPrint(runs);
    var args = { runs: prettyPrint.runs, filenames: prettyPrint.filenames, user: user };
    res.render("browser", args);
});

app.post("/save", auth.requiredAuthentication, db.saveEdit);

app.post("/autosave", auth.requiredAuthentication, db.autosaveEdit);

//Authentication routes

app.get("/signup", function (req, res) {
    if (req.session.user) {
        res.redirect("/browse");
    } else {
        res.render("signup");
    }
});

app.post("/signup", auth.userExist, auth.signup);

app.route("/login")
    .get(function (req, res) {
        res.render("login");
    })
    .post(function (req, res) {
        auth.authenticate(req.body.username, req.body.password, function (err, user) {
            if (user) {
                req.session.regenerate(function () {
                    req.session.user = user;
                    res.redirect("/");
                });
            } else {
                req.session.error = "Authentication failed, please check your " + " username and password.";
                res.redirect("/login");
            }
        });
    });

app.post("/logout", function (req, res) {
    req.session.destroy(function () {
        res.redirect("/login");
    });
});


// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error("Not Found");
    err.status = 404;
    next(err);
});
// error handlers

// development error handler will print stacktrace
if (app.get("env") === "development") {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render("error", {
            message: err.message,
            error: err
        });
    });
}

// production error handler no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render("error", {
        message: err.message,
        error: {}
    });
});

module.exports = app;
app.set("port", process.env.PORT || 3000);
var server = app.listen(app.get("port"), function() {
    debug("Express server listening on port " + server.address().port);
});
