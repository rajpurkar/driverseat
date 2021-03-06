var User = require('./user')
var hash = require('./hash').hash

function authenticate (name, pass, fn) {
  if (!module.parent) console.log('authenticating %s:%s', name, pass)
  User.findOne({
    username: name
  },
    function (err, user) {
      if (user) {
        if (err) return fn(new Error('cannot find user'))
        hash(pass, user.salt, function (err, hash) {
          if (err) return fn(err)
          if (hash.toString('utf8') === user.hash) return fn(null, user)
          fn(new Error('invalid password'))
        })
      } else {
        return fn(new Error('cannot find user'))
      }
    })
}

module.exports = {
  authenticate: authenticate,
  userExist: function (req, res, next) {
    User.count({
      username: req.body.username
    }, function (err, count) {
      if (err) {
        req.session.error = 'Error'
        res.redirect('/login')
      }
      if (count === 0) {
        next()
      } else {
        req.session.error = 'User Exist'
        res.redirect('/login')
      }
    })
  },
  requiredAuthentication: function (req, res, next) {
    if (req.session.user) {
      next()
    } else {
      res.redirect('/login')
    }
  },
  signup: function (req, res) {
    var password = req.body.password
    var username = req.body.username
    var fullname = req.body.fullname
    hash(password, function (err, salt, hash) {
      if (err) throw err
      new User({
        username: username,
        fullname: fullname,
        salt: salt,
        hash: hash
      }).save(function (err, newUser) {
        if (err) throw err
        authenticate(newUser.username, password, function (err, user) {
          if (err) {
            req.session.error = 'Error'
            res.redirect('/')
          }
          if (user) {
            req.session.regenerate(function () {
              req.session.user = user
              res.redirect('/')
            })
          }
        })
      })
    })
  }
}
