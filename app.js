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
var Category = require("./routes/category");
var Tag = require("./routes/tag");
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
    Category.find({}, function (err, categories) {
        var startFrame = req.query.startFrame;
        var endFrame = req.query.endFrame;
        if (err) return console.error("Cannot fetch metadata categories for run page");
        var editor = req.query.editor,
            track = req.query.route,
            lanesFile = req.query.filename;
        if (!track) res.redirect('/browse');

        var numCams = req.query.cameras;
        if (!numCams) numCams = 1;

        // var lanesFile = db.getLatestEdit(track);
        var datafilesPath = "/runs/" + track + "/";
        var dataFiles = {
            points:                 datafilesPath + "map.json.zip",
            gps:                    datafilesPath + "gps.json.zip",
            lanes:                  datafilesPath + "lanes/" + lanesFile,
            planes:                 datafilesPath + "planes.json.zip",
            video:                  datafilesPath + "cam_2.mpg",
            radar:                  datafilesPath + "radar.json.zip",
            carDetection:           datafilesPath + "bbs-cam2.json",
            carDetectionVerified:   datafilesPath + "bbs-cam2-verified.json",
            params:                 "/q50_4_3_14_params.json",
            precisionAndRecall:     "/precision_and_recall.json"
        }
        // We currently only have lane detection data for the sanrafael_e track
        if (track == "4-11-14-sanrafael/sanrafael_e") {
            dataFiles.laneDetection = "/4-11-14-sanrafael-sanrafael_e1_combined_lanepred_subsample.json"
        }
        res.render("index", {
            editor: editor,
            numCameras: numCams,
            categories: categories,
            trackInfo: {
                track: track,
                startFrame: startFrame,
                endFrame: endFrame,
                lanesFilename: lanesFile,
                files: dataFiles
            },
            laneTypes: [
                "white_dotted",
                "white_solid",
                "white_dotted_solid",
                "white_solid_dotted",
                "white_solid_solid",
                "yellow_dotted",
                "yellow_solid",
                "yellow_dotted_solid",
                "yellow_solid_dotted",
                "yellow_solid_solid"
            ]
        });
    });
});

app.get("/", function(req, res){
    res.redirect('/browse');
});

app.get("/browse", auth.requiredAuthentication, function(req, res) {
    // TODO(rchengyue): Cache level3Search and refresh periodically.
    var user = req.session.user.username,
        runs = util.level3Search("./public/runs", user),
        prettyPrint = db.prettyPrint(runs);
    var args = { runs: prettyPrint.runs, filenames: prettyPrint.filenames, user: user };
    res.render("browser", args);
});

app.post("/save", auth.requiredAuthentication, db.saveEdit);

app.post("/autosave", auth.requiredAuthentication, db.autosaveEdit);

// Tag routes

app.get("/tags", auth.requiredAuthentication, function(req, res) {
    if (req.query.route) {
        var route = req.query.route.split('/');
        Tag.find({
            run:   route[0],
            track: route[1]
        }).populate("category", "name displayColor description").exec(function(err, tags) {
            if (err) return res.status(500).send("Cannot fetch metadata tags for tags page");
            res.send(tags);
        });
    } else {
        Category.find(function (err, categories) {
            if (err) return res.status(500).send("Cannot fetch metadata tags for tags page");
            res.render("tags", {
                categories: categories
            });
        });
    }
});

app.post("/categories", auth.requiredAuthentication, db.saveCategory);
app.post("/tags", auth.requiredAuthentication, db.saveTag);
app.post("/deleteTag", auth.requiredAuthentication, db.deleteTag);

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
