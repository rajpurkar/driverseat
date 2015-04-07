// requires
var debug = require('debug')('roadgl'),
  express = require('express'),
  path = require('path'),
  favicon = require('serve-favicon'),
  logger = require('morgan'),
  cookieParser = require('cookie-parser'),
  bodyParser = require('body-parser'),
  session = require('express-session'),
  auth = require('./routes/auth'),
  authrender = require('./routes/authrender'),
  util = require('./routes/util'),
  db = require('./routes/db'),
  renderer = require('./routes/renderer'),
  app = express()

// app setup
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'jade')
app.use(favicon(__dirname + '/public/favicon.ico'))
app.use(logger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(cookieParser())
app.use(session({
  secret: 'woah cat',
  saveUninitialized: true,
  resave: false
}))
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h' // caching
}))
app.use(util.initializeLocals)
db.initdb() // setup connection to the database

// Post routes
app.post('/save', auth.requiredAuthentication, db.saveEdit)
app.post('/autosave', auth.requiredAuthentication, db.autosaveEdit)
app.post('/categories', auth.requiredAuthentication, db.saveCategory)
app.post('/tags', auth.requiredAuthentication, db.saveTag)
app.post('/deleteTag', auth.requiredAuthentication, db.deleteTag)

// Get routes
app.get('/edit', auth.requiredAuthentication, renderer.edit)
app.get('/browse', auth.requiredAuthentication, renderer.browse)
app.get('/tags', auth.requiredAuthentication, renderer.tag)
app.get('/', function (req, res) { res.redirect('/browse') })

// Authentication routes
app.post('/login', authrender.loginPost)
app.post('/logout', authrender.logoutPost)
app.post('/signup', auth.userExist, authrender.signupPost)
app.get('/signup', authrender.signup)
app.get('/login', authrender.login)

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found')
  err.status = 404
  next(err)
})

// error handlers

// development error handler will print stacktrace
if (app.get('env') === 'development') {
  app.use(function (err, req, res, next) {
    res.status(err.status || 500)
    res.render('error', {
      message: err.message,
      error: err
    })
  })
}

// production error handler no stacktraces leaked to user
app.use(function (err, req, res, next) {
  res.status(err.status || 500)
  res.render('error', {
    message: err.message,
    error: {}
  })
})

module.exports = app
app.set('port', process.env.PORT || 3000)
var server = app.listen(app.get('port'), function () {
  debug('Express server listening on port ' + server.address().port)
})
