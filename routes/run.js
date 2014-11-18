var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var RunSchema = new Schema({
    title: String,
    dateFinished: { type: Date, default: Date.now },
    completed: { type: Boolean, default: false }
});


module.exports = mongoose.model('runs', RunSchema);