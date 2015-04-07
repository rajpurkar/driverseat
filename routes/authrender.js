var auth = require('./auth')

exports.logoutPost = function (req, res) {
  req.session.destroy(function () {
    res.redirect('/login')
  })
}

exports.loginPost = function (req, res) {
  auth.authenticate(req.body.username, req.body.password, function (err, user) {
    if (err) {
      res.send('error')
      return
    }
    if (user) {
      req.session.regenerate(function () {
        req.session.user = user
        res.redirect('/')
      })
    } else {
      req.session.error = 'Authentication failed, please check your ' + ' username and password.'
      res.redirect('/login')
    }
  })
}

exports.login = function (req, res) {
  res.render('login')
}

exports.signup = function (req, res) {
  res.render('signup')
}

exports.signupPost = function (req, res) {
  if (req.session.user) {
    res.redirect('/browse')
  } else {
    res.render('signup')
  }
}
