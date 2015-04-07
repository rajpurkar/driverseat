var mongoose = require('mongoose'),
	Run = require('./run')

var UserSchema = new mongoose.Schema({
    username: { type: String, unique: true},
    fullname: {type: String, default: 'Anonybunny'},
    password: String,
    salt: String,
    hash: String,
	runs: [Run.schema]
})

module.exports = mongoose.model('users', UserSchema)
